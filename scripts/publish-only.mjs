#!/usr/bin/env node
import { chromium } from 'playwright';

const RENDER_URL = process.env.BASE_URL_RENDER || 'https://reel-banana-render-223097908182.us-central1.run.app';
const PROJECT_ID = process.env.PROJECT_ID;
if (!PROJECT_ID) {
  console.error('PROJECT_ID env var is required');
  process.exit(1);
}

const FIREBASE = {
  projectId: 'reel-banana-35a54',
  apiKey: 'AIzaSyCeZNdwsaZ_sBmOt8WY0FcUziq22-OVJjg',
  authDomain: 'reel-banana-35a54.firebaseapp.com',
  storageBucket: 'reel-banana-35a54.firebasestorage.app',
  appId: '1:223097908182:web:982c634d6aaeb3c805d277',
  recaptchaSiteKey: '6LfSNMArAAAAALXUYNGFmOSJN7O7W9c4Chp4oP1e',
};

async function getAppCheckAndIdToken(debugSecret) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  if (!debugSecret) throw new Error('APPCHECK_DEBUG_SECRET is required');
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
    let idToken = null;
    try { const cred = await authMod.signInAnonymously(auth); idToken = await cred.user.getIdToken(); } catch (_) {}
    return { appCheckToken: acTok.token, idToken };
  }, FIREBASE);
  await browser.close();
  return tokens;
}

async function post(url, body, tokens) {
  const headers = { 'Content-Type': 'application/json' };
  if (tokens?.appCheckToken) headers['X-Firebase-AppCheck'] = tokens.appCheckToken;
  const idToken = process.env.FIREBASE_ID_TOKEN || tokens?.idToken || null;
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} ${t}`);
  }
  return res.json();
}

(async () => {
  const ac = await getAppCheckAndIdToken(process.env.APPCHECK_DEBUG_SECRET);
  const payload = { projectId: PROJECT_ID, published: true, useFal: true };
  const result = await post(`${RENDER_URL}/render`, payload, ac);
  console.log('Publish result:', result);
  console.log(result.videoUrl || result.url || result);
})().catch((e) => { console.error('Publish failed:', e?.message || e); process.exit(1); });

