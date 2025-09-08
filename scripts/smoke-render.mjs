#!/usr/bin/env node
/*
 Quick render smoke: uploads N simple images, narrates a short script,
 aligns captions, and assembles a video of N scenes x SECONDS each.

 Usage:
   APPCHECK_DEBUG_SECRET='<secret>' TARGET_ENV=prod \
   SCENES=3 SECONDS=8 PROJECT_ID='smoke_<id>' \
   node scripts/smoke-render.mjs

 Notes:
 - Uses your deployed Cloud Run services; no UI required
 - Requires App Check debug secret; optionally signs in anonymously for ID token
 - Keeps costs minimal (tiny images, short narration)
*/

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PRODUCTION = {
  upload: 'https://reel-banana-upload-assets-223097908182.us-central1.run.app',
  narrate: 'https://reel-banana-narrate-223097908182.us-central1.run.app',
  align: 'https://reel-banana-align-captions-223097908182.us-central1.run.app',
  render: 'https://reel-banana-render-223097908182.us-central1.run.app',
  compose: 'https://reel-banana-compose-music-223097908182.us-central1.run.app',
};

const AI_STUDIO = {
  upload: 'https://reel-banana-upload-assets-423229273041.us-central1.run.app',
  narrate: 'https://reel-banana-narrate-423229273041.us-central1.run.app',
  align: 'https://reel-banana-align-captions-423229273041.us-central1.run.app',
  render: 'https://reel-banana-render-423229273041.us-central1.run.app',
  compose: 'https://reel-banana-compose-music-423229273041.us-central1.run.app',
};

const DEV = {
  upload: 'http://localhost:8083',
  narrate: 'http://localhost:8080',
  align: 'http://localhost:8081',
  render: 'http://localhost:8082',
  compose: 'http://localhost:8084',
};

const ENV = (process.env.TARGET_ENV || 'prod').toLowerCase();
const BASE = ENV === 'ai-studio' ? AI_STUDIO : ENV === 'dev' ? DEV : PRODUCTION;

const BASE_URLS = {
  upload: process.env.BASE_URL_UPLOAD || BASE.upload,
  narrate: process.env.BASE_URL_NARRATE || BASE.narrate,
  align: process.env.BASE_URL_ALIGN || BASE.align,
  render: process.env.BASE_URL_RENDER || BASE.render,
};

const FIREBASE = {
  projectId: 'reel-banana-35a54',
  apiKey: 'AIzaSyCeZNdwsaZ_sBmOt8WY0FcUziq22-OVJjg',
  authDomain: 'reel-banana-35a54.firebaseapp.com',
  storageBucket: 'reel-banana-35a54.firebasestorage.app',
  appId: '1:223097908182:web:982c634d6aaeb3c805d277',
  recaptchaSiteKey: '6LfSNMArAAAAALXUYNGFmOSJN7O7W9c4Chp4oP1e',
};

function pngDataUri(color = { r: 59, g: 130, b: 246 }) {
  // 1x1 PNG (blue), base64
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
}

async function loadDemoImagesDir(imagesDir, max) {
  try {
    const entries = await fs.readdir(imagesDir, { withFileTypes: true });
    const files = entries
      .filter(e => e.isFile())
      .map(e => path.join(imagesDir, e.name))
      .filter(p => /\.(png|jpg|jpeg|webp)$/i.test(p))
      .slice(0, max);
    const out = [];
    for (const f of files) {
      const buf = await fs.readFile(f);
      const ext = path.extname(f).slice(1).toLowerCase();
      const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      out.push(`data:${mime};base64,${buf.toString('base64')}`);
    }
    return out;
  } catch {
    return [];
  }
}

async function getAppCheckAndIdToken(debugSecret) {
  if (!debugSecret) throw new Error('APPCHECK_DEBUG_SECRET env var is required');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.addInitScript((secret) => { window.FIREBASE_APPCHECK_DEBUG_TOKEN = secret; }, debugSecret);
  await page.goto('https://reel-banana-35a54.web.app', { waitUntil: 'load' });
  const tokens = await page.evaluate(async (cfg) => {
    const appMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
    const appCheckMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-check.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
    const app = appMod.initializeApp({ projectId: cfg.projectId, apiKey: cfg.apiKey, authDomain: cfg.authDomain, storageBucket: cfg.storageBucket, appId: cfg.appId });
    const ac = appCheckMod.initializeAppCheck(app, { provider: new appCheckMod.ReCaptchaV3Provider(cfg.recaptchaSiteKey), isTokenAutoRefreshEnabled: true });
    const acTok = await appCheckMod.getToken(ac, false);
    const auth = authMod.getAuth(app);
    let idToken = null; try { const cred = await authMod.signInAnonymously(auth); idToken = await cred.user.getIdToken(); } catch (_) {}
    return { appCheckToken: acTok.token, idToken };
  }, FIREBASE);
  await browser.close();
  return tokens;
}

async function post(url, body, tokens) {
  const headers = { 'Content-Type': 'application/json' };
  if (tokens?.appCheckToken) headers['X-Firebase-AppCheck'] = tokens.appCheckToken;
  if (tokens?.idToken) headers['Authorization'] = `Bearer ${tokens.idToken}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} ${t}`);
  }
  return res.json();
}

(async () => {
  const N = parseInt(process.env.SCENES || '3', 10);
  const SECS = parseInt(process.env.SECONDS || '8', 10);
  const projectId = process.env.PROJECT_ID || `smoke_${Date.now()}`;
  console.log(`Project: ${projectId} (${N} scenes x ${SECS}s)`);

  const tokens = await getAppCheckAndIdToken(process.env.APPCHECK_DEBUG_SECRET);

  // 1) Upload simple images
  const imagesDir = process.env.IMAGES_DIR || path.join(process.cwd(), 'public', 'demo-images');
  const demoImages = await loadDemoImagesDir(imagesDir, N);
  for (let i = 0; i < N; i++) {
    const base64 = demoImages[i] || pngDataUri();
    const ext = demoImages[i] ? (demoImages[i].slice(5, demoImages[i].indexOf(';')) || 'image/jpeg').split('/')[1] : 'jpeg';
    const body = { projectId, fileName: `scene-${i}-0.${ext}`, base64Image: base64 };
    const r = await post(`${BASE_URLS.upload}/upload-image`, body, tokens);
    console.log(`Uploaded scene ${i}:`, r?.publicUrl || r?.url || r);
  }

  // 2) Narrate a short script (N sentences)
  const parts = Array.from({ length: N }, (_, i) => `This is scene number ${i + 1}.`).join(' ');
  const narr = await post(`${BASE_URLS.narrate}/narrate`, { projectId, narrationScript: parts, emotion: 'neutral' }, tokens);
  console.log('Narrate:', narr);

  // 3) Align captions to narration
  const align = await post(`${BASE_URLS.align}/align`, { projectId, gsAudioPath: narr.gsAudioPath }, tokens);
  console.log('Align:', align);

  // 3.5) Optionally pre-generate per-scene motion clips via /generate-clip
  const PRECLIP = /^(1|true|yes)$/i.test(String(process.env.PRECLIP || '0'));
  if (PRECLIP) {
    console.log('Pre-generating clips via /generate-clip...');
    for (let i = 0; i < N; i++) {
      try {
        const body = { projectId, sceneIndex: i, videoSeconds: SECS };
        const res = await post(`${BASE_URLS.render}/generate-clip`, body, tokens);
        console.log(`Clip ${i}:`, res?.clipPath || res);
      } catch (e) {
        console.warn(`Clip ${i} generation failed:`, e?.message || e);
      }
    }
  }

  // 4) Render with force to bypass any stale outputs
  const scenes = Array.from({ length: N }, (_, i) => ({ id: String(i), duration: SECS, camera: 'static', transition: 'none' }));
  const AUTO_CLIPS = /^(1|true|yes)$/i.test(String(process.env.AUTO_CLIPS || '0'));
  const FORCE_CLIPS = /^(1|true|yes)$/i.test(String(process.env.FORCE_CLIPS || '1'));
  const CLIP_MODEL = process.env.CLIP_MODEL || null;
  const NO_SUBS = /^(1|true|yes)$/i.test(String(process.env.NO_SUBS || '0'));
  const body = {
    projectId,
    scenes,
    gsAudioPath: narr.gsAudioPath,
    srtPath: align.srtPath,
    useFal: true, // FAL full video generation
    force: true,
    // Auto-generate per-scene Veo3 i2v clips before assembly when requested
    ...(AUTO_CLIPS ? { autoGenerateClips: true, forceClips: FORCE_CLIPS, clipSeconds: SECS } : {}),
    ...(PRECLIP ? { autoGenerateClips: false } : {}),
    ...(CLIP_MODEL ? { clipModel: CLIP_MODEL } : {}),
    ...(NO_SUBS ? { noSubtitles: true } : {}),
  };
  console.log('Render request flags:', { autoGenerateClips: !!body.autoGenerateClips, clipSeconds: body.clipSeconds, force: body.force, forceClips: body.forceClips, clipModel: CLIP_MODEL || '(env default)', noSubtitles: !!body.noSubtitles });
  const render = await post(`${BASE_URLS.render}/render`, body, tokens);
  console.log('Render result:', render);
  console.log(render.videoUrl || render.url || render);
})().catch((e) => { console.error('Smoke render failed:', e?.message || e); process.exit(1); });
