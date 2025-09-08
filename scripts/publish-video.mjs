#!/usr/bin/env node

/**
 * Simple script to publish existing video to make it publicly accessible
 */

import { chromium } from 'playwright';

const PROJECT_ID = 'MFFE4hv1oI8QBeyoTBtk';
const RENDER_URL = 'https://reel-banana-render-nyckt4dazq-uc.a.run.app/render';

const FIREBASE = {
  projectId: 'reel-banana-35a54',
  apiKey: 'AIzaSyCeZNdwsaZ_sBmOt8WY0FcUziq22-OVJjg',
  authDomain: 'reel-banana-35a54.firebaseapp.com',
  storageBucket: 'reel-banana-35a54.firebasestorage.app',
  appId: '1:223097908182:web:982c634d6aaeb3c805d277',
  recaptchaSiteKey: '6LfSNMArAAAAALXUYNGFmOSJN7O7W9c4Chp4oP1e',
};

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

async function publishVideo() {
  console.log(`📢 Publishing video for project: ${PROJECT_ID}`);
  
  try {
    // Get proper App Check token
    console.log('🔐 Getting App Check token...');
    const tokens = await getAppCheckAndIdToken(process.env.APPCHECK_DEBUG_SECRET);
    console.log('✅ Got tokens');
    
    // Just publish the existing video - no regeneration
    const payload = {
      projectId: PROJECT_ID,
      published: true
    };
    
    console.log('📡 Publishing existing video...');
    
    const result = await post(RENDER_URL, payload, tokens);
    
    console.log('🎉 SUCCESS! Video published!');
    console.log(`📺 Public Video URL: ${result.videoUrl}`);
    
    return result.videoUrl;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run the script
publishVideo()
  .then(url => {
    console.log('\n🎬 Video is now publicly accessible!');
    console.log(`🔗 Share this URL: ${url}`);
  })
  .catch(error => {
    console.error('💥 Failed to publish video:', error.message);
    process.exit(1);
  });
