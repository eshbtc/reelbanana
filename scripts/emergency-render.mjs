#!/usr/bin/env node

/**
 * Emergency script to render existing project using render service
 * Avoids regenerating clips and saves costs
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

async function emergencyRender() {
  console.log(`🚨 Emergency render for project: ${PROJECT_ID}`);
  
  try {
    // Get proper App Check token
    console.log('🔐 Getting App Check token...');
    const tokens = await getAppCheckAndIdToken(process.env.APPCHECK_DEBUG_SECRET);
    console.log('✅ Got tokens');
    
    // Create a simple scenes array for the existing clips
    const scenes = Array.from({ length: 17 }, (_, i) => ({
      id: `scene-${i}`,
      prompt: `Scene ${i + 1}`,
      narration: '',
      status: 'success',
      duration: 8,
      camera: i % 3 === 0 ? 'zoom-in' : i % 3 === 1 ? 'zoom-out' : 'pan-left',
      transition: i === 0 ? 'fade' : (i % 2 === 0 ? 'wipe' : 'fade'),
      imageUrls: [`https://storage.googleapis.com/reel-banana-35a54.firebasestorage.app/${PROJECT_ID}/scene-${i}-0.png`]
    }));
    
    const payload = {
      projectId: PROJECT_ID,
      scenes: scenes,
      gsAudioPath: `gs://reel-banana-35a54.firebasestorage.app/${PROJECT_ID}/narration.mp3`,
      srtPath: `gs://reel-banana-35a54.firebasestorage.app/${PROJECT_ID}/captions.srt`,
      gsMusicPath: `gs://reel-banana-35a54.firebasestorage.app/${PROJECT_ID}/music.wav`,
      useFal: false, // Use FFmpeg to avoid regenerating clips
      force: true
    };
    
    console.log('📡 Calling render service...');
    console.log(`🎬 Scenes: ${scenes.length}`);
    console.log(`🎵 Audio: ${payload.gsAudioPath}`);
    console.log(`🎶 Music: ${payload.gsMusicPath}`);
    
    const result = await post(RENDER_URL, payload, tokens);
    
    console.log('🎉 SUCCESS!');
    console.log(`📺 Video URL: ${result.videoUrl}`);
    console.log(`⚙️  Engine: ${result.engine || 'unknown'}`);
    
    return result.videoUrl;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run the script
emergencyRender()
  .then(url => {
    console.log('\n🎬 Final video ready for hackathon submission!');
    console.log(`🔗 ${url}`);
    console.log('\n💡 You can now download this video for your submission!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Failed to create video:', error.message);
    console.log('\n🆘 Fallback: Try using the regular MovieWizard with this project ID');
    process.exit(1);
  });
