# ReelBanana Enhancement Roadmap & Progress

Last updated: 2025-09-18 (maintain as you update)

## Objectives
- Deliver <15s “Fast Reel” generation on mobile for short clips.
- Add Video-to-Video Enhancement (style/face/cleanup) as a new pillar.
- Improve reliability, observability, and developer velocity.

## Current State Snapshot
- Strengths
  - Full AI pipeline (story → images → narration → captions → music → render).
  - Cost-aware model usage; caching to GCS; App Check + Firebase auth enforcement.
  - SSE job progress with Firestore fallback; idempotent credit operations.
- Recent Improvements (this week)
  - [Done] Standardized Cloud Run endpoints to project 223097908182 in code, docs, Postman.
  - [Done] Dynamic CORS allowlist via `ALLOWED_ORIGINS` across all services.
  - [Done] trust proxy hardening: `app.set('trust proxy', 1)` for ERL; `trustProxy: true` in rate limiter.
  - [Done] Align Captions: auth ordering fixed (App Check → verifyToken → credits), added targeted auth logs.
  - [Done] Narrate: fixed locked stream bug; adaptive upload; /tmp spooling; detailed progress logs.
  - [Done] Render: robust FFmpeg with concat fallback (transcode), correct audio mux, part-level subtitle fallback; input validation + `noSubtitles`; extensive stderr/start logs.
  - [Done] Test harness HTML: auto-anonymous auth; ensures/tops-up user credits; App Check; local run guidance.

## Competitive Insights (Summary)
- Market leaders: CapCut/InShot/Canva/Runway. Rich editing; huge user base.
- Our edge: cost-efficient AI, fully automated storytelling, good narration.
- Gaps to close: vtov enhancement, mobile-time budgets, “viral” template packs.

## Strategy & Focus
- Short-term focus: “AI Avatar Reels” and a minimal ViT/VToV enhancement capability.
- Do not chase full NLE parity; ship targeted, high-ROI features that leverage automation + cost advantage.

---

## Phased Roadmap

### Phase 0 – Stabilization & Observability (Complete / In Progress)
- [x] Standardize service URLs to 223097908182 across repo.
- [x] CORS allowlist via `ALLOWED_ORIGINS` env across services.
- [x] trust proxy hardened to `1`; rate limiter configured with `trustProxy: true`.
- [x] Align Captions: fix auth middleware order; concise header/token failure logs.
- [x] Narrate: read-once buffer → /tmp spool for large audio; `NARRATE_*` envs; detailed streaming logs.
- [x] Render: concat fallback; audio mux fix; part-level subtitles fallback; detailed ffmpeg logs; `noSubtitles` flag.
- [x] Test harness HTML: auto App Check + anonymous ID token; ensure user doc + credits; guidance for running from localhost.

### Phase 1 – Quick Wins for Mobile (Target: 1–2 weeks)
- [ ] Default mobile “Fast Reel” preset: 9:16 720p, total ≤ 12–15s, `noSubtitles=true`, `autoGenerateClips=false` by default.
- [ ] Webhooks (async callbacks): add optional `callbackUrl` to POST responses; POST job completion payload when done.
- [ ] Templates Library (Reels): Firestore + static overlays (CDN), caption styles; UI integration.
- [ ] Credit presets for Fast Reel (≤15 credits); expose cost preview in UI.
- [ ] Smoke tests for Fast Reel path (NO_SUBS/AUTO_CLIPS off) with strict time budgets.

### Phase 2 – Video Enhancement Service (Target: 3–4 weeks)
- [ ] New service: `backend/enhance` (Cloud Run)
  - Endpoints: `POST /enhance-video`, `GET /progress-stream`, health endpoints, cache status.
  - Input: `{ videoUrl|gsUrl|upload, ops: ['style','face','clean'], preset }`.
  - Output: `{ jobId }` → async completion with `{ enhancedUrl }`.
  - Security: App Check + Firebase ID tokens; credits + limiter like other services.
- [ ] Models via FAL
  - Start with 1–2 fast vtov stylizers (e.g., `fal-ai/styleshot/video`) and face cleanup.
  - Per-request cache key based on source hash + options.
- [ ] Persistence
  - /tmp for spooling; output to `OUTPUT_BUCKET_NAME`; prefer public URL (or signed URL per plan).
- [ ] OpenAPI spec + Postman env; CI: add to `deploy-all-services.yml`.
- [ ] Frontend: “Enhance Video” view; small explorer in `test-video-creator.html`.

### Phase 3 – Mobile Optimization (Target: 4–6 weeks)
- [ ] CDN for templates/overlays (improve load time on mobile networks).
- [ ] “Instant” edits via FFmpeg-only filter packs (color LUT, sharpen, vignette, watermark overlays).
- [ ] Lightweight beat detection for audio (drive transitions).
- [ ] Strict SLA on job durations; auto-select fast models.

### Phase 4 – Viral Features & Library (Ongoing)
- [ ] Trending templates (weekly updates) + curated caption styles.
- [ ] Transition packs (ready-to-apply) with brand kit tie-ins.
- [ ] One-click publish flows (gallery, social cards), plus auto-trim for platform limits.

---

## Work Breakdown – Detailed Checklist

### Backend – Common
- [x] Dynamic CORS env (`ALLOWED_ORIGINS`) all services
- [x] `trust proxy` hardening + ERL compatibility
- [x] SSE progress endpoints verified
- [ ] Callback webhooks (all long-running ops) → implement + docs

### Narrate
- [x] One-shot ReadableStream fix → buffer/spool; adaptive upload (`file.save` vs stream)
- [x] Env toggles: `NARRATE_SPOOL_THRESHOLD_MB`, `NARRATE_FILE_SAVE_THRESHOLD_MB`, `NARRATE_STREAM_TIMEOUT_MS`
- [x] Progress and byte-based logs

### Align Captions
- [x] Middleware order: App Check → verifyToken → credits → limiter
- [x] Header/verify logs; better 401 diagnostics
- [ ] Add `autoNoSubsOn422` env to render path (optional)

### Render
- [x] Input validation & `noSubtitles` support
- [x] FFmpeg concat fallback (copy → transcode)
- [x] Audio mux fix & logs
- [x] Part-level subtitles fallback & logs
- [ ] RENDER_FORCE_TRANSCODE env to skip copy attempt when needed
- [ ] Fast Reel preset & plan gating

### Compose Music
- [x] Buffer response normalization; `file.save` to GCS; credit completion
- [ ] Optional beat markers output for later transitions

### Enhance (New)
- [ ] Scaffold service, OpenAPI spec, CI
- [ ] FAL vtov style transfer minimal path
- [ ] Face cleanup/light enhancement
- [ ] /tmp spool + GCS persistence
- [ ] Credits + caching + limiter
- [ ] Frontend UI and test harness support

### Frontend
- [x] Test harness: auto auth, ensure credits, App Check, localhost guidance
- [ ] “Enhance Video” test tile
- [ ] Add Fast Reel preset (mobile card) in app (9:16, 720p, ≤15s)
- [ ] Template library UI and caption styles

### Docs & Tooling
- [x] URL audit script; env override guide; LFS setup doc
- [ ] Enhance service spec + Postman
- [ ] Developer runbook: webhooks + SSE

---

## Metrics & SLIs
- Success rate: ≥ 99% for Fast Reel (noSubs, single-clip) path.
- P50 render time (Fast Reel): ≤ 12s (warm instance); P95 ≤ 20s.
- Cost per reel (credits): ≤ 15 credits.
- Error budget: ≤ 1% FFmpeg failures per 24h; auto-retry w/ fallback.

## Risks & Mitigations
- Model instability / vendor limits → queue + retry, cache outputs, cap concurrency via env.
- Sub-10s constraints → constrain clip length & resolution, skip heavy ops by default on mobile.
- Costs → plan gating, shared caches (hash of inputs), preflight warn on expensive ops.

## Owners & Timeline (fill in)
- Phase 1 owner: ___ | Start: ___ | ETA: ___
- Phase 2 owner: ___ | Start: ___ | ETA: ___
- Phase 3 owner: ___ | Start: ___ | ETA: ___

## Smoke Test Procedures
- Browser harness (recommended): run from `http://localhost:5173/test-video-creator.html` to satisfy CORS; use anonymous sign‑in or paste ID token.
- CLI smoke: `node scripts/smoke-render.mjs` with `APPCHECK_DEBUG_SECRET` and `FIREBASE_REFRESH_TOKEN`; set `NO_SUBS=1` for Fast Reel path.

---

## Appendix – Env Reference (new/updated)
- CORS: `ALLOWED_ORIGINS`
- Narrate: `NARRATE_SPOOL_THRESHOLD_MB`, `NARRATE_FILE_SAVE_THRESHOLD_MB`, `NARRATE_STREAM_TIMEOUT_MS`, `NARRATE_KEEP_TEMP`
- Render: `FFMPEG_LOG_LEVEL`, `[planned] RENDER_FORCE_TRANSCODE`
- FAL: `FAL_RENDER_MODEL`, `FAL_RENDER_TIMEOUT_MS`, `FAL_CLIP_CONCURRENCY`
- Webhooks: `[planned] CALLBACK_SECRET`, `[planned] CALLBACK_RETRY_MS`

