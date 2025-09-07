import { test, expect, chromium, Page } from '@playwright/test';

type ServiceUrls = {
  upload: string;
  narrate: string;
  align: string;
  render: string;
  compose: string;
  polish: string;
};

const PRODUCTION: ServiceUrls = {
  upload: 'https://reel-banana-upload-assets-223097908182.us-central1.run.app',
  narrate: 'https://reel-banana-narrate-223097908182.us-central1.run.app',
  align: 'https://reel-banana-align-captions-223097908182.us-central1.run.app',
  render: 'https://reel-banana-render-223097908182.us-central1.run.app',
  compose: 'https://reel-banana-compose-music-223097908182.us-central1.run.app',
  polish: 'https://reel-banana-polish-223097908182.us-central1.run.app',
};

const AI_STUDIO: ServiceUrls = {
  upload: 'https://reel-banana-upload-assets-423229273041.us-central1.run.app',
  narrate: 'https://reel-banana-narrate-423229273041.us-central1.run.app',
  align: 'https://reel-banana-align-captions-423229273041.us-central1.run.app',
  render: 'https://reel-banana-render-423229273041.us-central1.run.app',
  compose: 'https://reel-banana-compose-music-423229273041.us-central1.run.app',
  polish: 'https://reel-banana-polish-423229273041.us-central1.run.app',
};

const DEV: ServiceUrls = {
  upload: 'http://localhost:8083',
  narrate: 'http://localhost:8080',
  align: 'http://localhost:8081',
  render: 'http://localhost:8082',
  compose: 'http://localhost:8084',
  polish: 'http://localhost:8086',
};

const FIREBASE = {
  projectId: 'reel-banana-35a54',
  apiKey: 'AIzaSyCeZNdwsaZ_sBmOt8WY0FcUziq22-OVJjg',
  authDomain: 'reel-banana-35a54.firebaseapp.com',
  storageBucket: 'reel-banana-35a54.firebasestorage.app',
  appId: '1:223097908182:web:982c634d6aaeb3c805d277',
  recaptchaSiteKey: '6LfSNMArAAAAALXUYNGFmOSJN7O7W9c4Chp4oP1e',
};

function pngDataUri(): string {
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
  return `data:image/png;base64,${base64}`;
}

async function getAppCheckAndIdToken(debugSecret: string | undefined) {
  if (!debugSecret) throw new Error('APPCHECK_DEBUG_SECRET env var is required');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.addInitScript((secret) => {
    (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = secret;
  }, debugSecret);
  await page.goto('https://reel-banana-35a54.web.app', { waitUntil: 'load' });

  const tokens = await page.evaluate(async (cfg) => {
    // Load Firebase SDKs in the real browser context
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
    let idToken: string | null = null;
    try {
      const cred = await authMod.signInAnonymously(auth);
      idToken = await cred.user.getIdToken();
    } catch {}
    return { appCheckToken: acTok.token, idToken };
  }, FIREBASE);

  await browser.close();
  return tokens as { appCheckToken: string; idToken: string | null };
}

async function exchangeRefreshTokenForIdToken(refreshToken: string) {
  const url = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  });
  if (!res.ok) throw new Error(`Refresh token exchange failed: ${res.status}`);
  const data = await res.json();
  return (data as any).id_token as string;
}

async function postJson<T>(url: string, body: any, tokens: { appCheckToken?: string; idToken?: string | null }, label: string): Promise<T> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 10 * 60 * 1000);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tokens?.appCheckToken) headers['X-Firebase-AppCheck'] = tokens.appCheckToken;
  if (tokens?.idToken) headers['Authorization'] = `Bearer ${tokens.idToken}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
  clearTimeout(timeout);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${label} failed: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json() as Promise<T>;
}

async function openShareAndCheck(page: Page, shareId: string) {
  const hostingBase = process.env.BASE_URL_HOSTING || 'https://reel-banana-35a54.web.app';
  const hostingUrl = `${hostingBase.replace(/\/$/, '')}/share/${encodeURIComponent(shareId)}`;
  const resp = await page.goto(hostingUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const status = resp?.status() || 0;
  const tags = await page.evaluate(() => {
    const get = (sel: string, attr: string) => document.querySelector(sel)?.getAttribute(attr) || null;
    return {
      ogTitle: get('meta[property="og:title"]', 'content'),
      ogDesc: get('meta[property="og:description"]', 'content'),
      ogImage: get('meta[property="og:image"]', 'content'),
      ogUrl: get('meta[property="og:url"]', 'content'),
      twCard: get('meta[name="twitter:card"]', 'content'),
    };
  });
  const ok = status === 200 && !!tags.ogTitle && !!tags.ogImage && !!tags.ogUrl;
  return { url: hostingUrl, ok, status, tags };
}

test('E2E pipeline (upload → narrate → align → compose → render → polish) + share', async ({ page }) => {
  // Resolve base URLs based on TARGET_ENV and overrides
  const env = (process.env.TARGET_ENV || 'prod').toLowerCase();
  const base: ServiceUrls = env === 'ai-studio' ? AI_STUDIO : env === 'dev' ? DEV : PRODUCTION;
  const BASE_URLS: ServiceUrls = {
    upload: process.env.BASE_URL_UPLOAD || base.upload,
    narrate: process.env.BASE_URL_NARRATE || base.narrate,
    align: process.env.BASE_URL_ALIGN || base.align,
    render: process.env.BASE_URL_RENDER || base.render,
    compose: process.env.BASE_URL_COMPOSE || base.compose,
    polish: process.env.BASE_URL_POLISH || base.polish,
  };

  test.info().annotations.push({ type: 'env', description: JSON.stringify(BASE_URLS) });

  // Quick sanity: render health must have the correct output bucket
  await test.step('Render service health check', async () => {
    const res = await fetch(`${BASE_URLS.render}/health`).catch(() => null);
    if (!res || !res.ok) {
      test.fail(true, `Render /health not reachable at ${BASE_URLS.render}`);
      return;
    }
    const json = await res.json();
    const outputBucket = (json as any)?.outputBucket || '';
    const expected = 'reel-banana-35a54.firebasestorage.app';
    if (outputBucket && outputBucket !== expected) {
      test.fail(true, `Render misconfigured output bucket: ${outputBucket} (expected ${expected}). Update Cloud Run env OUTPUT_BUCKET_NAME.`);
    }
  });

  // Obtain App Check + ID tokens
  const ac = await getAppCheckAndIdToken(process.env.APPCHECK_DEBUG_SECRET);
  const tokens: { appCheckToken?: string; idToken?: string | null } = { appCheckToken: ac.appCheckToken, idToken: null };
  if (process.env.FIREBASE_ID_TOKEN) {
    tokens.idToken = process.env.FIREBASE_ID_TOKEN;
  } else if (process.env.FIREBASE_REFRESH_TOKEN) {
    tokens.idToken = await exchangeRefreshTokenForIdToken(process.env.FIREBASE_REFRESH_TOKEN);
  } else {
    tokens.idToken = ac.idToken; // anonymous fallback
  }

  // Project and inputs
  const projectId = process.env.PROJECT_ID || `e2e_${Date.now()}`;
  const narrationScript = 'Once upon a time, a brave rabbit explored a magical forest.';

  // 1) Upload two images for two scenes
  await test.step('Upload images', async () => {
    await postJson(`${BASE_URLS.upload}/upload-image`, { projectId, fileName: 'scene-0-0.png', base64Image: pngDataUri() }, tokens, 'Upload 1');
    await postJson(`${BASE_URLS.upload}/upload-image`, { projectId, fileName: 'scene-1-0.png', base64Image: pngDataUri() }, tokens, 'Upload 2');
  });

  // 2) Narrate
  const narr = await test.step('Narrate', async () => {
    const r = await postJson<{ gsAudioPath: string; cached?: boolean }>(
      `${BASE_URLS.narrate}/narrate`,
      { projectId, narrationScript },
      tokens,
      'Narrate'
    );
    expect(typeof r.gsAudioPath).toBe('string');
    return r;
  });

  // 3) Align (retry if needed)
  const align = await test.step('Align', async () => {
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const a = await postJson<{ srtPath: string; cached?: boolean }>(
          `${BASE_URLS.align}/align`,
          { projectId, gsAudioPath: narr.gsAudioPath },
          tokens,
          'Align'
        );
        expect(typeof a.srtPath).toBe('string');
        return a;
      } catch (e: any) {
        lastErr = e;
        const msg = String(e?.message || e);
        if (attempt < 3 && (msg.includes('UNPROCESSABLE') || msg.includes('No words'))) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        throw e;
      }
    }
    throw lastErr;
  });

  // 4) Compose music
  const comp = await test.step('Compose music', async () => {
    const c = await postJson<{ gsMusicPath: string; cached?: boolean }>(
      `${BASE_URLS.compose}/compose-music`,
      { projectId, narrationScript },
      tokens,
      'Compose'
    );
    expect(typeof c.gsMusicPath).toBe('string');
    return c;
  });

  // 5) Render
  const render = await test.step('Render', async () => {
    const minimal = (process.env.RENDER_MINIMAL || '0') === '1';
    const scenes = minimal
      ? [
          { duration: 2, camera: 'static', transition: 'none' },
          { duration: 2, camera: 'static', transition: 'none' },
        ]
      : [
          { duration: 3, camera: 'zoom-in', transition: 'fade' },
          { duration: 3, camera: 'pan-left', transition: 'wipe' },
        ];
    const r = await postJson<{ videoUrl: string; cached?: boolean }>(
      `${BASE_URLS.render}/render`,
      {
        projectId,
        scenes,
        gsAudioPath: narr.gsAudioPath,
        srtPath: align.srtPath,
        gsMusicPath: comp.gsMusicPath,
        published: false,
        useFal: true,
        veoPrompt: `Video depicting: ${narrationScript}`,
      },
      tokens,
      'Render'
    );
    expect(typeof r.videoUrl).toBe('string');
    return r;
  });

  // 6) Polish
  const polish = await test.step('Polish', async () => {
    const p = await postJson<{ polishedUrl: string }>(
      `${BASE_URLS.polish}/polish`,
      { projectId, videoUrl: (render as any).videoUrl },
      tokens,
      'Polish'
    );
    expect(typeof p.polishedUrl).toBe('string');
    return p;
  });

  // 7) Cloud Functions onCall check via browser context (secureDataHandler)
  await test.step('secureDataHandler (callable)', async () => {
    await page.addInitScript((secret) => {
      (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = secret;
    }, process.env.APPCHECK_DEBUG_SECRET);
    await page.goto('https://reel-banana-35a54.web.app', { waitUntil: 'load' });
    const data = await page.evaluate(async (cfg) => {
      const appMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
      const appCheckMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-check.js');
      const authMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
      const fnMod = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js');
      const app = appMod.initializeApp({
        projectId: cfg.projectId,
        apiKey: cfg.apiKey,
        authDomain: cfg.authDomain,
        storageBucket: cfg.storageBucket,
        appId: cfg.appId,
      });
      const ac = appCheckMod.initializeAppCheck(app, { provider: new appCheckMod.ReCaptchaV3Provider(cfg.recaptchaSiteKey), isTokenAutoRefreshEnabled: true });
      await appCheckMod.getToken(ac, false);
      const auth = authMod.getAuth(app);
      try { await authMod.signInAnonymously(auth); } catch {}
      const fns = fnMod.getFunctions(app, 'us-central1');
      const callable = fnMod.httpsCallable(fns, 'secureDataHandler');
      const resp = await callable({ ping: 'hello' });
      return resp?.data || null;
    }, FIREBASE);
    expect(data).toBeTruthy();
  });

  // 8) Share page OG tags (Hosting) or function fallback
  await test.step('Share page OG tags', async () => {
    const share = await openShareAndCheck(page, projectId);
    // Do not fail test on share page; record status for visibility
    test.info().annotations.push({ type: 'shareCheck', description: `Share status ${share.status} at ${share.url}` });
    if (!share.ok) {
      // Non-blocking: share may not exist for unpublished project
      console.warn('Share page check did not meet OG tag requirements:', share);
    }
  });

  // Attach summary
  test.info().attachments.push({
    name: 'pipeline-summary.json',
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({ projectId, narr, align, comp, render, polish }, null, 2)
    ),
  });
});
