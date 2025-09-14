# Web + Mobile Phases Roadmap (Working Doc)

This is the authoritative, high‑level phases plan we’ll work from. It complements `COMPREHENSIVE_ROADMAP.md` and the mobile integration guide.

Status tags: ✅ done • 🔄 in‑progress • ⏭ next • 🗓 planned • ⛳ acceptance

---

## Phase 0 — Platform Baseline (✅)
- ✅ Multi‑service pipeline (upload, narrate, align, compose, render, polish)
- ✅ Auth + App Check wired through services
- ✅ Wizard + Editor flows on web
- ✅ Caching and credit/plan system

Acceptance: Web app can produce end‑to‑end videos reliably.

---

## Phase 1 — Web Foundation & Streaming (🔄)
- ✅ Real‑time progress
  - ✅ SSE for narrate/align/compose/render
  - ✅ Firestore `job_progress/{jobId}` persistence + throttled writes
  - ✅ FE buffering (200ms) and fallback subscription via Firestore
- 🔄 UX polish on web
  - 🔄 Per‑scene render progress indicators in UI
  - 🔄 ETA improvements in Wizard (streamed or computed)
  - ✅ Story progress bar + “Generate Everything”
  - ✅ Batch progress header with cancel
  - ✅ Timeline view (quick actions, move/duplicate/insert)
  - ✅ Sticky Character & Style panel
  - ✅ Presence chips + Comments (basic modal)
  - ✅ Version History (autosave→diff→rollback)

⛳ Web users see live progress, confident statuses, and simple collaboration primitives.

---

## Phase 1.5 — Backend Helpers for Mobile (⏭)
- ⏭ `/generate-story` endpoint (topic → scenes + character/style)
- ⏭ `/upload-audio` to accept recorded narration → returns `gsAudioPath`
- ⏭ Per‑scene fields in job progress: `perScene`, `sceneCount`, `currentScene`
- ⏭ Device token support and FCM push on job `done/error`
- ⏭ Firestore rules: presence/comments tightened; TTL cleanup for `job_progress`

⛳ Enables a minimal RN app to reuse backend cleanly without client‑side AI.

---

## Phase 2 — Mobile MVP & Web Polish (🗓)
- Mobile (RN)
  - 🗓 Quick Auto flow (photos/voice → vibe → progress → share)
  - 🗓 Preview Mode (light presets: vibe/aspect/duration)
  - 🗓 Offline queue for uploads + job starts (idempotent jobIds)
  - 🗓 Per‑scene progress stripes using `job_progress.perScene`
- Web
  - 🗓 Version diffs: field‑level changes + jump‑to‑scene
  - 🗓 Inline comment count badges per scene; live updates

⛳ Ship a delightful 4‑screen reel creation experience; keep pro tools on web.

---

## Phase 3 — Monetization & Entitlements (🗓)
- 🗓 IAP validation service (App Store / Play)
- 🗓 Unified plan status API; web Stripe + mobile IAP normalized
- 🗓 Upgrade moments (limits, HD preview, advanced styles)

⛳ Seamless upgrades; consistent plan gates across platforms.

---

## Phase 4 — Scale, SLIs, & Marketplace (🗓)
- 🗓 TTL cleanup for `job_progress`; job history aggregation
- 🗓 SLI dashboards & alerting (latency, success rates)
- 🗓 Template marketplace; advanced presets
- 🗓 Enterprise provisioning (SSO, audit logs)

⛳ Operational maturity + growth levers.

---

## Cross‑Cutting Concerns
- Security: App Check required; ID token on all service calls; Firestore rules tightened
- Performance: compress images client‑side; progressive scene rendering; rate limits observed
- Accessibility: clear progress states; minimal steps; haptic/voice support on mobile

---

## Open Questions / Decisions
- Team/collaborator model for presence/comments rules
- Trending/licensed audio sources for mobile (phase later)
- Whether to expose full story controls on mobile or keep strictly Quick/Preview

---

## Owner & Cadence
- Owner: PM/Eng leads across Web (Studio) and Mobile tracks
- Weekly check‑in: Update 🔄/⏭ statuses and acceptance notes here

