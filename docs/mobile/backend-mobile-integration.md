# Backend–Mobile Integration Guide

## Goals & Scope

- **Objective:** Reuse the existing backend to power a simplified mobile app that creates reels for TikTok/Instagram with 3 simple options, Auto Mode, and a lightweight Preview Mode. Keep professional tools (brand kits, advanced editing) on the web.
- **Outcomes:** Fast first‑run success, live progress, resilient jobs, and clean share flows. Mobile UI stays minimal; backend handles complexity.

### Branding & Defaults
- Consumer‑facing terminology: use “Reel” everywhere in the app; keep technical “videoUrl/render” in backend.
- Default aspect ratio: 9:16 (vertical). Export presets map to TikTok/Instagram/YouTube Shorts.
- Three simple options (mobile):
  1) Photos (camera/library) 2) Optional voice or text 3) Optional vibe/style preset — then Auto Mode runs the pipeline.
  - Preview Mode: same flow with light controls (style/vibe, aspect ratio, duration cap).

## Architecture Overview

- **Frontend:** React Native app consumes backend services and Firestore directly.
- **Backend Services:** Upload, Narrate, Align, Compose, Render, Polish (Express + Cloud Run).
- **Data Plane:** Firebase Auth + App Check, Firestore for documents and streaming fallback, GCS for assets/output.
- **Progress:** Server‑Sent Events (SSE) per service + Firestore persistence (`job_progress/{jobId}`) as a durable fallback.

## Security & Auth

- **Auth Header:** Firebase ID token (Authorization: `Bearer <idToken>`).
- **App Check:** `X-Firebase-AppCheck` header required for service calls (configure RN App Check).
- **Rules:** Clients can read job progress; writes are server‑only (Admin SDK).

## Core Services & Endpoints

- **Upload Assets** — `POST {uploadBase}/upload-image`
  - Body: `projectId`, `base64Image`, `fileName`
  - Writes: `gs://{bucket}/{projectId}/scene-{i}-{j}.png|jpg`

- **Narrate** — `POST {narrateBase}/narrate`
  - Body: `projectId`, `narrationScript`, `emotion?`, `jobId?`
  - Returns: `gsAudioPath`, `cached?`, `jobId?`
  - SSE: `GET {narrateBase}/progress-stream?jobId=...`

- **Align Captions** — `POST {alignBase}/align`
  - Body: `projectId`, `gsAudioPath`, `jobId?`
  - Returns: `srtPath`, `cached?`, `jobId?`
  - SSE: `GET {alignBase}/progress-stream?jobId=...`

- **Compose Music** — `POST {composeBase}/compose-music`
  - Body: `projectId`, `narrationScript`, `jobId?`
  - Returns: `gsMusicPath`, `cached?`, `jobId?`
  - SSE: `GET {composeBase}/progress-stream?jobId=...`

- **Render** — `POST {renderBase}/render`
  - Body: `projectId`, `scenes[]`, `gsAudioPath`, `srtPath`, `gsMusicPath?`, `jobId?`, `targetW`, `targetH`, `aspectRatio`, `exportPreset`, `force?`, `useFal?`
  - Returns: `videoUrl`, `cached?`, `engine`
  - SSE: `GET {renderBase}/progress-stream?jobId=...`
  - Emits per‑scene clip progress in FAL path; persists to Firestore.

- **Polish (optional)** — `POST {polishBase}/polish`
  - Body: `projectId`, `videoUrl`
  - Returns: `polishedUrl`, `cached?`

### Proposed Helper Endpoints (to simplify RN)
- **Generate Story** — `POST {aiBase}/generate-story` (proposed)
  - Body: `topic`
  - Returns: `{ scenes: [{ prompt, narration }...], characterAndStyle }`
  - Rationale: Move client‑side AI story from web to backend for parity and stable quotas.
- **Upload Audio** — `POST {uploadBase}/upload-audio` (proposed)
  - Body: `projectId`, `base64Audio` or file ref
  - Returns: `gsAudioPath` (so users can record their own narration on mobile and skip TTS).
- **IAP Entitlements** — `POST /iap/validate`, `GET /plan/status` (proposed)
  - Validate App Store / Play receipts → write plan entitlements; read plan in mobile to gate features.
- **Job Push** — Accept `deviceToken?` in step bodies (proposed)
  - On `done/error`, services send FCM push: "Your reel is ready" / "Generation failed; tap to retry".

## Progress & State (Mobile‑Ready)

- **Job ID:** Provide `jobId` per step (e.g., `narrate-<project>-<ts>`, `render-...`).
- **Streams:** SSE per service; Firestore fallback via `job_progress/{jobId}`.
- **Document fields:** `service`, `progress (0-100)`, `stage`, `message`, `etaSeconds?`, `done`, `error?`, `updatedAt`.
- **(Proposed)** Per‑scene struct for render: `perScene: { [sceneIndex]: percent }`, `sceneCount`, `currentScene` for richer UI.

## Primary Collections

- `projects/{projectId}` — Owner project doc (topic, characterAndStyle, scenes[], videoUrl(s)).
- `projects/{projectId}/versions` — Snapshot + diff (for rollback).
- `presence` — Flat docs `{projectId}__{userId}` with `activeSceneId`, `lastSeen`.
- `projects/{projectId}/comments` — Scene/project comments.
- `job_progress/{jobId}` — Persistent progress (read‑only for clients).

## Creation Modes (Mobile)

- **Quick Auto (1 tap):** Photos + voice → Create project → upload → narrate → align → compose → render → publish → share.
- **Preview Mode (light controls):** Mood/style preset, aspect ratio, duration cap → maps to `compose` and `render` params.
- **Professional Tools:** Remain on web (brand kits, advanced scene editing, voice library, templates marketplace).

## Mobile IA (4‑Screen Flow → Backend Mapping)
1) **Magic Input**: Photos (camera/gallery), optional voice/text → upload‑image; (optional) upload‑audio OR generate‑story by topic.
2) **Style/Vibe**: Select preset (maps to compose mood/style + render presets; default vertical).
3) **Production Studio**: Run narrate → align → compose → render; subscribe SSE + Firestore `job_progress/{jobId}`; show stage/ETA.
4) **Share Cosmos**: Publish to public GCS and open native share sheet; store `videoUrl` on project.

## Mobile → Backend Contract (Simplified)

1) Create or fetch `projects/{id}` (Firestore).  
2) Upload images via `upload-image`.  
3) Run pipeline: `narrate(jobId)` → `align(jobId)` → `compose(jobId)` → `render(jobId)` (subscribe to each job’s progress).  
4) Publish public URL via `{renderBase}/render` with `{ published: true }`.  
5) Share via native share sheets.

## Offline & Queuing (Mobile)

- Queue base64 uploads and job starts when offline; replay with same `jobId` on reconnect.  
- Always listen to `job_progress/{jobId}` (Firestore onSnapshot) to resume live UI.
- Optional: enqueue publish step; push notify when ready.

## Monetization & Plan Gating

- **Current:** Web uses Stripe; backend enforces gates.  
- **Needed for Mobile:** IAP receipt validation service to write plan entitlements to Firestore.  
- **Endpoints (proposed):** `POST /iap/validate` (App Store/Play receipts), `GET /plan/status`.  
- **Mobile UX:** Trigger upgrades on limit reached (free 3 videos), HD preview, advanced styles, etc.
  - Web keeps Stripe; backend normalizes entitlements for a unified plan view.

## Sharing & Distribution

- Publish to public GCS for durable URLs.  
- Use RN Share; pre‑fill captions/hashtags; optional preview screen.

## Analytics (Suggested)

- Journey: `app_launched`, `story_started`, `story_generated`, `video_generated`, `video_shared`.  
- Engagement: `session_duration`, `feature_used`, `upgrade_prompted`.  
- Technical: `error_occurred`, `performance_issue`, `crash_occurred`.

## Security & Rate Limits

- **App Check:** Mandatory header; set up RN App Check provider.  
- **Rate Limiting:** Enforced in services; supply idempotent `jobId`.  
- **Firestore Rules:**  
  - `job_progress`: read allowed for authed users; write denied for clients (server‑only).  
  - Presence/comments: add owner/collaborator rules per team policy.
  - TTL cleanup: schedule deletion of stale `job_progress` docs after N days.

## Performance

- **FE:** Buffer SSE updates to ~200ms for smoothness.  
- **BE:** Throttle Firestore progress writes (~900ms), always write on `done/error`.  
- **Assets:** Compress images client‑side; use lazy load for previews.
- **Mobile payloads:** Prefer JPEG/WebP; limit image count by default; progressive scene loading in the studio.

## Gaps & TODOs

- **Story Generation API:** Add backend `POST /generate-story` to match RN flow (or use Firebase AI SDK in RN).  
- **IAP Entitlements:** Build receipt validation + plan state endpoints.  
- **Firestore Rules:** Finalize presence/comments access; add TTL cleanup for `job_progress` docs.  
- **Per‑Scene Progress:** Persist `perScene: { [sceneIndex]: percent }` in `job_progress` for richer per‑scene UI.  
- **RN App Check:** Document setup and token injection.
- **Push Notifications:** Accept device token and send FCM on job done/error.
- **Rules:** Add presence/comments rules for owner/collaborators; define team model if needed.

## RN Integration Checklist

- Firebase: Auth, Firestore, App Check, Analytics.  
- Networking: Add `Authorization` and `X-Firebase-AppCheck` to all service calls.  
- Project lifecycle: create/fetch → upload → pipeline steps with `jobId` → publish → share.  
- Progress: prefer SSE when stable; always subscribe to Firestore `job_progress/{jobId}`.  
- Modes: Quick Auto, Preview; Advanced via web.

## Example Mobile Flow (Pseudocode)

```
projectId = createProject({ userId, topic })
for photo in photos: POST /upload-image { projectId, base64Image, fileName }

jobN = narrate({ projectId, narrationScript, emotion, jobId })
subscribe(job_progress/jobN)

jobA = align({ projectId, gsAudioPath, jobId })
subscribe(job_progress/jobA)

jobC = compose({ projectId, narrationScript, jobId })
subscribe(job_progress/jobC)

jobR = render({ projectId, scenes, aspectRatio: '9:16', exportPreset: 'tiktok', jobId })
subscribe(job_progress/jobR)

publishUrl = render({ projectId, published: true }).videoUrl
Share.share({ url: publishUrl })
```

## Release Plan (Mobile)

- **Phase 1 (Foundation):** Auth/App Check, Quick Auto, Firestore progress + SSE, publish & share, analytics.
- **Phase 1.5 (Backend helpers):** `/generate-story`, `/upload-audio`, deviceToken push, `perScene` in `job_progress`.
- **Phase 2 (Polish):** Preview controls, per‑scene progress UI, comments, presence, error recovery, offline queue.
- **Phase 3 (Monetization):** IAP validation + plan gating (unified across web/mobile), upgrade moments.
- **Phase 4 (Scale):** TTL cleanup for `job_progress`, SLIs, template marketplace, enterprise provisioning.
