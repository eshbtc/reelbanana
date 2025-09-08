# Hype Mode — Ops Handoff

This document summarizes the latest Hype Mode work so you can reuse it next session without re-discovery.

## What We Built/Fixed

- Hype Mode: Upload 2–12 screenshots and/or add AI-only scenes; assemble, polish, publish. Route: `/hype`.
- Motion Clips: “Generate Motion Clips” (Veo 3 Fast i2v by default). New endpoint `POST /generate-clip`. Assembly prefers `clips/scene-{i}.mp4` when present.
- Model Fallback: `/generate-clip` auto-tries Veo 3 Fast → LTXV on failure.
- Per-Scene Narration: Applies short lines per scene; joins for TTS/align; persists `lines + imageUrls` to Firestore.
- Cache-First Reuse: Toggle to reuse existing assets + “Existing projectId” to salvage prior runs.
- Callouts + CTA: Optional scene labels + branded CTA end frame.
- Tech Beat: Optional stack highlight scenes (Cloud Run + Firebase, ElevenLabs, FAL Veo3, App Check + GCS).
- Player Reliability: Normalizes Firebase Storage API / encoded GCS URLs to proper GCS paths; avoids 0:00 demuxer.
- Render Improvements: `-movflags +faststart`, multi-scene assembly, honors client `useFal` for FAL vs FFmpeg.

## Wiring/Crashes Resolved

- `/hype` blank page: Removed dynamic require; statically imported `HypeMode`; replaced hook-based toast with safe notifier.
- `files is not defined`: Uses `entries[]` throughout (files + AI scenes).
- Autosave/rules: Immediately persists scenes (`imageUrls`, durations, narration); reuse projects behave like normal projects.

## Run A 2‑Minute Hype (Veo3 Fast)

1) Upload ~10 screenshots in `/hype` (best 5 first).
2) Toggle:
   - Stylize screenshots: ON
   - Overlay callouts: ON
   - CTA end frame: ON
   - Generate Motion Clips: ON (Model: Veo 3 Fast; Clips: 5; Seconds/clip: 12)
   - Include Tech Beat: ON
   - Reuse existing assets: ON (paste a prior `projectId` to reuse)
3) Set target runtime: 120s → click “Auto distribute”.
4) Click “Build Hype Video” → Publish from the player to get `/share/:id`.

## Backend Deploy Needed (Render)

Deploy to enable `/generate-clip`, clip-aware assembly, and model fallback:

```bash
gcloud builds submit backend/render --tag gcr.io/$PROJECT_ID/render
gcloud run deploy render --image gcr.io/$PROJECT_ID/render --region us-central1
```

Verify health (should show `falConfigured: true` and `falModel`):

```bash
curl https://<render-service-url>/health
```

Frontend deploy:

```bash
npm run build && firebase deploy --only hosting
```

## If Motion Clips 500

- Use Hype Mode with Reuse assets ON (skip new API calls).
- Get a `requestId` from console logs; check Cloud Run logs:

```bash
gcloud logging read 'jsonPayload.requestId="<id>" AND resource.labels.service_name="render"' --freshness=1h --limit=50
```

- Tune model inputs/duration or add further fallback based on `code/message/details`.

## Defaults In Use

- Model: Veo 3 Fast (image‑to‑video)
- Clips: 5
- Seconds per clip: 12
- Target runtime: 120s (auto-distributed)

## What You Can Reuse

- Hype flow with Reuse assets ON and Existing `projectId` to avoid re-generation.
- Scene transcripts auto-applied per scene and combined for TTS/align.
- Player normalization handles all GCS/Firebase URL variants.

## Open/Next

- Optional: per‑scene lower‑third captions that match narration lines exactly.
- To stitch more i2v clips, increase Clips or Seconds/clip in Hype Mode; cache-first reuse avoids duplicate spend.

