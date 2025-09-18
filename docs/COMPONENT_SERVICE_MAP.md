# Component ↔ Service Map

This document summarizes how the main frontend components interact with backend services and Firebase. It’s intended as an onboarding reference and to help reasoning about ownership and changes.

## Frontend Shell
- `index.tsx` → Mounts `<App />`, wraps with `ToastProvider` and `ConfirmProvider` for global UX.
- `App.tsx` → Orchestrates navigation between editor, wizard (pipeline), player, gallery, templates, settings, and admin views. Tracks project/video state and wires render completion.

## Story Authoring
- `components/StoryboardEditor.tsx`
  - Generates story scenes, character, and images via:
    - `services/trackedGeminiService.ts` → wraps `services/geminiService.ts` with credit tracking
    - `services/geminiService.ts` → Firebase AI Logic (Vertex AI backend) or BYOK via API‑Key Service
  - Persists projects, scenes, versions, presence, and comments via:
    - `services/firebaseService.ts` (Firestore, Storage URL synthesis)
  - Plan/credits:
    - `hooks/useUserCredits.ts`, `utils/costCalculator.ts`, `services/creditService.ts`

## Build Pipeline (One‑Click)
- `components/MovieWizard.tsx`
  - Upload images → `services/pipelineService.uploadImage` → Upload Assets service
  - Narrate → `pipelineService.narrate` → Narrate service (TTS)
  - Align captions → `pipelineService.alignCaptions` → Align Captions service
  - Compose music → `pipelineService.composeMusic` → Compose Music service
  - Render video → `pipelineService.renderVideo` → Render service (FAL + FFmpeg)
  - Live progress → SSE `progress-stream` (Render, Narrate, Align, Compose) + Firestore fallback
  - Optional polish → `pipelineService.polishVideo` → Polish service (Fal.ai upscaler/interp)
  - Plan gating/limits → `hooks/useUserPlan.ts`, `lib/planMapper.ts`, `services/planGatingService.ts`
  - Clips discovery → signed URLs via `pipelineService.getSignedClips` (Render service)

## Direct Render Flow (non‑wizard)
- `RenderingScreen.tsx`
  - Performs the same sequence (upload → narrate → align → compose → render → polish) with progress UI
  - Uses `pipelineService` endpoints and SSE progress

## Playback, Share, and Gallery
- `components/MoviePlayer.tsx`
  - Displays rendered movie; handles publish-to-gallery via `services/firebaseService.publishMovie`
- `components/PublicGallery.tsx`
  - Reads public movies from Firestore; function fallback: `functions/index.js` → `listPublicMovies`
- Cloud Functions
  - `functions/index.js`
    - `shareHandler` for `/share/:id` → dynamic OG tags from `public_movies` Firestore
    - `secureDataHandler` (App Check enforced callable example)

## Infrastructure and Cross‑Cutting
- `config/apiConfig.ts` → service base URLs, Firebase config, and `apiCall()` (attaches App Check and Authorization)
- `lib/firebase.ts` → Firebase app, App Check (ReCaptcha v3), Firestore (long polling tuned)
- `lib/appCheck.ts` → helper to fetch App Check token
- `lib/authFetch.ts` → attaches ID token + App Check for secure endpoints
- `services/stripeService.ts` → billing plan, subscription, credit packs via Stripe‑service
- `backend/*` (Cloud Run services) → Upload, Narrate, Align, Compose, Render, Polish, API‑Key, Stripe

## Ownership (Suggested)
- Editor & Authoring: Frontend team (components + gemini/tracked services)
- Pipeline UX: Frontend team (MovieWizard/RenderingScreen) + Backend team (Upload/Narrate/Align/Compose/Render/Polish)
- Share/Gallery: Frontend + Functions owner
- Billing & Plans: Frontend (Stripe Elements, UI) + Backend (stripe‑service) + Security/Compliance

