#!/usr/bin/env node
// Minimal FAL Veo tester: supports queue submit/status/result
// Env:
//  - FAL_API_KEY (required)
//  - FAL_MODEL (e.g., 'fal-ai/veo3/fast' or 'fal-ai/veo3/fast/image-to-video')
//  - FAL_PROMPT (string prompt)
//  - FAL_IMAGE_URL (for image-to-video)

import { fal } from '@fal-ai/client';

const API_KEY = process.env.FAL_API_KEY;
const MODEL = process.env.FAL_MODEL || 'fal-ai/veo3/fast';
const PROMPT = process.env.FAL_PROMPT || 'A short cinematic video of a rabbit exploring a magical forest.';
const IMAGE_URL = process.env.FAL_IMAGE_URL || '';

if (!API_KEY) {
  console.error('FAL_API_KEY is required');
  process.exit(1);
}

fal.config({ credentials: API_KEY });

function pickUrl(data) {
  return (
    data?.output_url ||
    data?.result?.url ||
    data?.data?.url ||
    data?.output?.url ||
    data?.video?.url ||
    null
  );
}

// Allow passing extra input as JSON via FAL_EXTRA
let extra = {};
try {
  if (process.env.FAL_EXTRA) extra = JSON.parse(process.env.FAL_EXTRA);
} catch (e) {
  console.warn('Ignoring invalid FAL_EXTRA JSON:', e?.message || e);
}

const baseInput = MODEL.includes('image-to-video') ? { prompt: PROMPT, image_url: IMAGE_URL } : { prompt: PROMPT };
const input = { ...baseInput, ...extra };

console.log('Submitting to FAL:', { MODEL, hasImage: !!IMAGE_URL });

try {
  const submit = await fal.queue.submit(MODEL, { input, logs: true });
  const requestId = submit?.request_id || submit?.requestId;
  if (!requestId) throw new Error('Missing request_id');
  console.log('request_id:', requestId);

  const timeoutMs = parseInt(process.env.FAL_TEST_TIMEOUT_MS || '600000', 10);
  const pollMs = parseInt(process.env.FAL_TEST_POLL_MS || '3000', 10);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await fal.queue.status(MODEL, { requestId, logs: true });
    const s = String(st?.status || '').toUpperCase();
    if (Array.isArray(st?.logs)) {
      st.logs.map(l => l?.message).filter(Boolean).forEach(m => console.log('[log]', m));
    }
    if (s === 'COMPLETED') break;
    if (s === 'FAILED' || s === 'ERROR') {
      console.error('FAL status:', s, st?.error || st);
      process.exit(2);
    }
    await new Promise(r => setTimeout(r, pollMs));
  }

  const result = await fal.queue.result(MODEL, { requestId });
  const url = pickUrl(result?.data);
  console.log('Result:', { url, requestId });
  if (!url) {
    console.error('No output URL in result:', result);
    process.exit(3);
  }
  console.log(url);
} catch (e) {
  console.error('FAL test failed:', e?.message || e);
  process.exit(1);
}
