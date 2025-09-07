#!/usr/bin/env node
/*
 Hype Demo Creator (Demo-of-the-Demo)
 - Uploads your UI screenshots as scene images
 - Runs narrate → align → compose → render (FFmpeg by default)
 - Optional: try single-clip image-to-video (ltxv) with --i2v and --fal-seconds
 - Optional: publish to gallery

 Usage examples:
   APPCHECK_DEBUG_SECRET='<secret>' TARGET_ENV=prod \
   node scripts/hype-demo.mjs \
     --images ./shots/01.png ./shots/02.png ./shots/03.png \
     --title "ReelBanana — Demo of the Demo" \
     --narration "Meet ReelBanana — your AI‑powered cinematic studio..." \
     --project-id hype_$(date +%s)

   # Single-clip ltxv (image-to-video) test, 14 seconds
   APPCHECK_DEBUG_SECRET='<secret>' TARGET_ENV=prod \
   node scripts/hype-demo.mjs --images ./shots/hero.png --i2v --fal-seconds 14

 Notes:
 - Requires Playwright Chromium to mint App Check (installed by dev setup).
 - Uses the same endpoints and token flow as scripts/e2e-pipeline.mjs
*/

import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const args = new Map();
let curKey = null;
for (const a of argv) {
  if (a.startsWith('--')) { curKey = a.replace(/^--/, ''); args.set(curKey, true); }
  else if (curKey) { const v = args.get(curKey); args.set(curKey, Array.isArray(v) && v !== true ? [...v, a] : (v === true ? a : a)); }
}

const images = ([]).concat(args.get('images') || []).filter(Boolean);
const projectId = String(args.get('project-id') || `hype_${Date.now()}`);
const title = String(args.get('title') || 'ReelBanana — Demo of the Demo');
const narrationArg = args.get('narration');
const tryI2V = !!args.get('i2v');
const falSeconds = parseInt(String(args.get('fal-seconds') || '0'), 10) || 0;
const publish = !!args.get('publish');

const PRODUCTION = {
  upload: 'https://reel-banana-upload-assets-223097908182.us-central1.run.app',
  narrate: 'https://reel-banana-narrate-223097908182.us-central1.run.app',
  align: 'https://reel-banana-align-captions-223097908182.us-central1.run.app',
  render: 'https://reel-banana-render-223097908182.us-central1.run.app',
  compose: 'https://reel-banana-compose-music-223097908182.us-central1.run.app',
  polish: 'https://reel-banana-polish-223097908182.us-central1.run.app',
};
const DEV = {
  upload: 'http://localhost:8083',
  narrate: 'http://localhost:8080',
  align: 'http://localhost:8081',
  render: 'http://localhost:8082',
  compose: 'http://localhost:8084',
  polish: 'http://localhost:8086',
};
const ENV = (process.env.TARGET_ENV || 'prod').toLowerCase();
const BASE = ENV === 'dev' ? DEV : PRODUCTION;

const FIREBASE = {
  projectId: 'reel-banana-35a54',
  apiKey: 'AIzaSyCeZNdwsaZ_sBmOt8WY0FcUziq22-OVJjg',
  authDomain: 'reel-banana-35a54.firebaseapp.com',
  storageBucket: 'reel-banana-35a54.firebasestorage.app',
  appId: '1:223097908182:web:982c634d6aaeb3c805d277',
  recaptchaSiteKey: '6LfSNMArAAAAALXUYNGFmOSJN7O7W9c4Chp4oP1e',
};

const defaultNarration = (
  'Meet ReelBanana — your AI‑powered cinematic studio. ' +
  'Type an idea, and watch it become a storyboard of scenes. ' +
  'Stunning visuals? Generated. Voiceover? Pro‑grade narration, with captions synced to every word. ' +
  'Music? A custom score that fits your story. ' +
  'Then we assemble everything — clean camera motion, smooth transitions, polish, and playback that just works. ' +
  'Your project is ready to publish and share. ' +
  'Create product demos, explainers, or your next launch trailer in minutes — not days. ' +
  'ReelBanana. Turn ideas into movies.'
);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function mintTokens(debugSecret) {
  if (!debugSecret) throw new Error('APPCHECK_DEBUG_SECRET required');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.addInitScript((secret) => { window.FIREBASE_APPCHECK_DEBUG_TOKEN = secret; }, debugSecret);
  await page.goto('https://reel-banana-35a54.web.app', { waitUntil: 'load' });
  const tokens = await page.evaluate(async (cfg) => {
    const appMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
    const appCheckMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-check.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
    const app = appMod.initializeApp(cfg);
    const ac = appCheckMod.initializeAppCheck(app, { provider: new appCheckMod.ReCaptchaV3Provider(cfg.recaptchaSiteKey), isTokenAutoRefreshEnabled: true });
    const acTok = await appCheckMod.getToken(ac, false);
    const auth = authMod.getAuth(app);
    const cred = await authMod.signInAnonymously(auth);
    const idToken = await cred.user.getIdToken();
    return { appCheckToken: acTok.token, idToken };
  }, FIREBASE);
  await browser.close();
  return tokens;
}

async function postJson(url, body, tokens, label) {
  const headers = { 'Content-Type': 'application/json' };
  if (tokens?.appCheckToken) headers['X-Firebase-AppCheck'] = tokens.appCheckToken;
  if (tokens?.idToken) headers['Authorization'] = `Bearer ${tokens.idToken}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${label} failed: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

async function fileToDataUri(fp) {
  const abs = path.resolve(fp);
  const buf = await fs.readFile(abs);
  const ext = path.extname(abs).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

(async () => {
  if (images.length === 0) {
    console.error('Provide at least one --images path');
    process.exit(1);
  }
  console.log('Hype demo starting…');
  console.log('Project:', projectId);
  console.log('Images:', images);
  const tokens = await mintTokens(process.env.APPCHECK_DEBUG_SECRET);

  // Upload images to scene-{i}-0
  for (let i = 0; i < images.length; i++) {
    const base64Image = await fileToDataUri(images[i]);
    const fileName = `scene-${i}-0.jpeg`;
    await postJson(`${BASE.upload}/upload-image`, { projectId, fileName, base64Image }, tokens, `Upload scene ${i}`);
  }
  console.log('Uploaded screenshots.');

  // Narrate
  const narrationScript = narrationArg ? String(narrationArg) : defaultNarration;
  const narr = await postJson(`${BASE.narrate}/narrate`, { projectId, narrationScript, emotion: 'professional' }, tokens, 'Narrate');
  console.log('Narrate ok');

  // Align
  const align = await postJson(`${BASE.align}/align`, { projectId, gsAudioPath: narr.gsAudioPath }, tokens, 'Align');
  console.log('Align ok');

  // Compose
  const comp = await postJson(`${BASE.compose}/compose-music`, { projectId, narrationScript }, tokens, 'Compose');
  console.log('Compose ok');

  // Render
  const scenes = images.map((_, i) => ({ duration: Math.max(3, Math.min(6, Math.round(50 / images.length))), camera: 'zoom-in', transition: i === 0 ? 'fade' : 'wipe' }));
  let render;
  if (tryI2V && images.length === 1) {
    const seconds = falSeconds > 0 ? falSeconds : Math.max(8, scenes[0].duration);
    render = await postJson(`${BASE.render}/render`, {
      projectId,
      scenes,
      gsAudioPath: narr.gsAudioPath,
      srtPath: align.srtPath,
      gsMusicPath: comp.gsMusicPath,
      useFal: true,
      falVideoSeconds: seconds,
      veoPrompt: 'Cinematic parallax over UI; soft glow; modern tech vibe; slow zoom-in.'
    }, tokens, 'Render i2v');
  } else {
    // Multi-scene FFmpeg assembly
    try {
      render = await postJson(`${BASE.render}/render`, {
        projectId, scenes, gsAudioPath: narr.gsAudioPath, srtPath: align.srtPath, gsMusicPath: comp.gsMusicPath, useFal: false
      }, tokens, 'Render');
    } catch (e) {
      // Try FAL first if FFmpeg path is blocked in env
      render = await postJson(`${BASE.render}/render`, {
        projectId, scenes, gsAudioPath: narr.gsAudioPath, srtPath: align.srtPath, gsMusicPath: comp.gsMusicPath, useFal: true,
        falVideoSeconds: Math.max(8, images.length * 4), veoPrompt: 'Cinematic product UI demo; modern tech vibe.'
      }, tokens, 'Render (fallback to FAL)');
    }
  }
  console.log('Render ok');

  // Polish (best-effort)
  let finalUrl = render.videoUrl;
  try {
    const polish = await postJson(`${BASE.polish}/polish`, { projectId, videoUrl: render.videoUrl }, tokens, 'Polish');
    finalUrl = polish.polishedUrl || render.videoUrl;
  } catch (_) {}

  console.log('\n✨ Hype Demo Complete');
  console.log('Project ID:', projectId);
  console.log('Video URL:', finalUrl);

  // Optional publish path (function may vary; left as manual step in app)
  if (publish) {
    console.log('\nPublish from the app to create a share page: /share/:id');
  }
})().catch((err) => { console.error(err); process.exit(1); });

