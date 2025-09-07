#!/usr/bin/env node
/*
 E2E pipeline test runner (upload -> narrate -> align -> compose -> render -> polish)
 - Obtains a real App Check token via headless Chromium (Playwright) using your debug secret
 - Optionally signs in anonymously to get a Firebase ID token
 - Calls deployed Cloud Run services in sequence

 Requirements:
   npm i -D playwright
   export APPCHECK_DEBUG_SECRET=your_debug_secret_from_console
   export TARGET_ENV=prod|ai-studio|dev (default: prod)
   Optional: export BASE_URL_* to override endpoints
*/

import { chromium } from 'playwright';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PRODUCTION = {
  upload: 'https://reel-banana-upload-assets-223097908182.us-central1.run.app',
  narrate: 'https://reel-banana-narrate-223097908182.us-central1.run.app',
  align: 'https://reel-banana-align-captions-223097908182.us-central1.run.app',
  render: 'https://reel-banana-render-223097908182.us-central1.run.app',
  compose: 'https://reel-banana-compose-music-223097908182.us-central1.run.app',
  polish: 'https://reel-banana-polish-223097908182.us-central1.run.app',
};
const AI_STUDIO = {
  upload: 'https://reel-banana-upload-assets-423229273041.us-central1.run.app',
  narrate: 'https://reel-banana-narrate-423229273041.us-central1.run.app',
  align: 'https://reel-banana-align-captions-423229273041.us-central1.run.app',
  render: 'https://reel-banana-render-423229273041.us-central1.run.app',
  compose: 'https://reel-banana-compose-music-423229273041.us-central1.run.app',
  polish: 'https://reel-banana-polish-423229273041.us-central1.run.app',
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
const BASE = ENV === 'ai-studio' ? AI_STUDIO : ENV === 'dev' ? DEV : PRODUCTION;

const BASE_URLS = {
  upload: process.env.BASE_URL_UPLOAD || BASE.upload,
  narrate: process.env.BASE_URL_NARRATE || BASE.narrate,
  align: process.env.BASE_URL_ALIGN || BASE.align,
  render: process.env.BASE_URL_RENDER || BASE.render,
  compose: process.env.BASE_URL_COMPOSE || BASE.compose,
  polish: process.env.BASE_URL_POLISH || BASE.polish,
};

const FIREBASE = {
  projectId: 'reel-banana-35a54',
  apiKey: 'AIzaSyCeZNdwsaZ_sBmOt8WY0FcUziq22-OVJjg',
  authDomain: 'reel-banana-35a54.firebaseapp.com',
  storageBucket: 'reel-banana-35a54.firebasestorage.app',
  appId: '1:223097908182:web:982c634d6aaeb3c805d277',
  recaptchaSiteKey: '6LfSNMArAAAAALXUYNGFmOSJN7O7W9c4Chp4oP1e',
};

function pngDataUri(color = { r: 255, g: 0, b: 0 }) {
  // 1x1 PNG for quick upload
  // Precomputed 1x1 red pixel PNG
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
  return `data:image/png;base64,${base64}`;
}

async function getAppCheckAndIdToken(debugSecret) {
  if (!debugSecret) throw new Error('APPCHECK_DEBUG_SECRET env var is required');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.addInitScript((secret) => {
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = secret;
  }, debugSecret);
  // Navigate to the real app domain so reCAPTCHA v3 domain checks pass
  await page.goto('https://reel-banana-35a54.web.app', { waitUntil: 'load' });

  const tokens = await page.evaluate(async (cfg) => {
    const appMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
    const appCheckMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-check.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');

    const app = appMod.initializeApp({
      projectId: cfg.projectId,
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      storageBucket: cfg.storageBucket,
      appId: cfg.appId,
    });
    const appCheck = appCheckMod.initializeAppCheck(app, {
      provider: new appCheckMod.ReCaptchaV3Provider(cfg.recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    const acTok = await appCheckMod.getToken(appCheck, false);

    const auth = authMod.getAuth(app);
    let idToken = null;
    try {
      const cred = await authMod.signInAnonymously(auth);
      idToken = await cred.user.getIdToken();
    } catch (_) {}

    return { appCheckToken: acTok.token, idToken };
  }, FIREBASE);

  await browser.close();
  return tokens;
}

async function exchangeRefreshTokenForIdToken(refreshToken) {
  const url = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  });
  if (!res.ok) throw new Error(`Refresh token exchange failed: ${res.status}`);
  const data = await res.json();
  return data.id_token;
}

async function post(url, body, tokens, label) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 10 * 60 * 1000); // 10 minutes
  const headers = { 'Content-Type': 'application/json' };
  if (tokens?.appCheckToken) headers['X-Firebase-AppCheck'] = tokens.appCheckToken;
  if (tokens?.idToken) headers['Authorization'] = `Bearer ${tokens.idToken}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: ctrl.signal,
  });
  clearTimeout(timeout);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${label} failed: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

(async () => {
  console.log('E2E pipeline starting...');
  console.log('Base URLs:', BASE_URLS);

  const ac = await getAppCheckAndIdToken(process.env.APPCHECK_DEBUG_SECRET);
  const tokens = { appCheckToken: ac.appCheckToken, idToken: null };
  if (process.env.FIREBASE_ID_TOKEN) {
    tokens.idToken = process.env.FIREBASE_ID_TOKEN;
  } else if (process.env.FIREBASE_REFRESH_TOKEN) {
    tokens.idToken = await exchangeRefreshTokenForIdToken(process.env.FIREBASE_REFRESH_TOKEN);
  } else {
    tokens.idToken = ac.idToken; // anonymous fallback
  }
  console.log('Obtained App Check token', tokens.appCheckToken?.slice(0, 12) + '...');
  if (tokens.idToken) console.log('Using Firebase ID token');

  const projectId = process.env.PROJECT_ID || `e2e_${Date.now()}`;
  const narrationScript = 'Once upon a time, a brave rabbit explored a magical forest.';

  // 1) Upload two images with proper names for render lookup
  const img1 = pngDataUri();
  const img2 = pngDataUri();
  await post(`${BASE_URLS.upload}/upload-image`, { projectId, fileName: 'scene-0-0.png', base64Image: img1 }, tokens, 'Upload 1');
  await post(`${BASE_URLS.upload}/upload-image`, { projectId, fileName: 'scene-1-0.png', base64Image: img2 }, tokens, 'Upload 2');
  console.log('Uploaded images');

  // 2) Narrate
  const narr = await post(`${BASE_URLS.narrate}/narrate`, { projectId, narrationScript }, tokens, 'Narrate');
  console.log('Narrate:', narr);

  // 3) Align
  const align = await post(`${BASE_URLS.align}/align`, { projectId, gsAudioPath: narr.gsAudioPath }, tokens, 'Align');
  console.log('Align:', align);

  // 4) Compose music (optional; service may fallback to placeholder WAV)
  const comp = await post(`${BASE_URLS.compose}/compose-music`, { projectId, narrationScript }, tokens, 'Compose');
  console.log('Compose:', comp);

  // 5) Render (draft, signed URL)
  const scenes = [
    { duration: 3, camera: 'zoom-in', transition: 'fade' },
    { duration: 3, camera: 'pan-left', transition: 'wipe' },
  ];
  const render = await post(
    `${BASE_URLS.render}/render`,
    {
      projectId,
      scenes,
      gsAudioPath: narr.gsAudioPath,
      srtPath: align.srtPath,
      gsMusicPath: comp.gsMusicPath,
      published: false,
    },
    tokens,
    'Render'
  );
  console.log('Render:', render);

  // 6) Polish
  const polish = await post(
    `${BASE_URLS.polish}/polish`,
    { projectId, videoUrl: render.videoUrl },
    tokens,
    'Polish'
  );
  console.log('Polish:', polish);

  console.log('E2E pipeline complete.');
  console.log(JSON.stringify({ projectId, narr, align, comp, render, polish }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
