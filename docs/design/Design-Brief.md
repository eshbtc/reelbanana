# ReelBanana – Comprehensive Design Brief

Audience: Lead Product Designer (and supporting design team)
Owner: Founder/PM (ReelBanana)
Version: 1.0

## 1) Project Overview
ReelBanana turns ideas into short films/commercials/product demos using AI. We are replacing an MVP UI with a world‑class, production‑quality experience that feels premium, fast, and reliable for creators, marketers, and agencies.

Goals
- Elevate visual quality and UX to a best‑in‑class creative app.
- Increase activation (first video created), completion (rendered), and share/publish rates.
- Support pro workflows: brand kits, export presets, review links, and team roles.
- Establish a robust design system for rapid iteration.

Success Metrics (initial)
- Time to first render: < 8 minutes median (from new project).
- Activation rate (first video rendered): +30% vs current.
- Publish/share rate: +25% vs current.
- NPS/CSAT: 8+/10 on post‑render survey.

## 2) Users & Context
Primary Personas
- Indie Creator/Marketer: creates short social videos fast, needs templates and polish.
- Product Marketer: produces product demos and promo videos with brand consistency.
- Agency Producer: runs campaigns with variants, approvals, and handoffs.

Primary Devices & Environments
- Desktop first (macOS/Windows, Chrome/Safari/Edge). Responsive down to tablet where feasible.
- Real‑time generation can take seconds→minutes. UX must communicate progress, ETA, and success.

## 3) Scope (Flows & Screens)
Design the end‑to‑end flows with responsive coverage and all key states.
- Landing + Marketing: product value, examples, pricing, CTA.
- Auth & Onboarding: sign in, starter templates, “first video” path.
- Projects: dashboard, recent work, templates, brand kits.
- Storyboard Editor: topic, character passport, prompts, variants/compare, style presets, product demo mode.
- Generation Panels: image generation status, retries, cost/credits visibility.
- Render Wizard: upload, narrate, align, compose music, render/AI clips, polish.
- Review & Publish: playable result, revisions, version history, publish to gallery, share links with OG previews.
- Gallery: public showcase, filters, social share.
- Pricing & Billing: plan selection, BYO API keys, usage/credits.
- Admin/Analytics (lightweight): health/usage summaries.

Out of Scope (for now)
- Mobile‑first optimization, complex team admin UI beyond MVP roles, advanced video editors.

## 4) Design System & Deliverables
Design System
- Tokens: color (light/dark), typography scale, spacing, radii, elevation, motion.
- Components: inputs, buttons, modals, toasts, progress, tabs, stepper, cards, lists, tables, chips, dropdowns, tooltips, tags, banners.
- Patterns: forms/validation, empty/error/loading states, compare/variant UI, wizard/stepper, asset grids.
- Motion: micro‑interactions, loading/transition choreography, progress indicators with perceived performance.
- Accessibility: WCAG 2.2 AA, focus states, sufficient contrast, keyboard navigation.

Deliverables (Figma)
- Design System Library (tokens + components) with documentation and variants.
- Page‑level flows: lo‑fi → hi‑fi for all in Scope.
- Responsive specs: desktop (≥1280), tablet (~1024), small desktop (1440), key mobile screens if critical.
- Redlines/specs: spacing, sizes, states, motion guidelines.
- Prototype: happy‑path flows (onboarding → first render → publish) and key branches.
- Asset package: logos, icons, illustrations, overlays/CTA artwork (SVG/PNG), motion files if any.

Acceptance Criteria
- Complete coverage of the Scope with all primary and error/empty/loading states.
- Componentized, variant‑driven library, no one‑off styles.
- Tokenized designs, ready to map to Tailwind/theme tokens.
- Annotations for complex interactions and async states.
- Accessibility notes for components and pages.

## 5) Constraints & Technical Notes
- Frontend: React + Vite + Tailwind. We will map Figma tokens → Tailwind theme variables.
- Backends are async; some operations are minutes‑long. Must show progress, optimistic UI, and predictable retries.
- Target performance: fast perceived response, minimal layout shift, predictable skeletons.
- Brand overlays/CTAs integrate at render time; keep safe‑area guides per aspect ratio.

## 6) Visual Direction
Adjectives: Premium, cinematic, confident, modern, crisp, minimal, creative.
References: Runway, Adobe Express, Descript, Figma, Linear.
Moodboard: To be co‑created in week 1.

## 7) Accessibility
- WCAG 2.2 AA minimum.
- Contrast ≥ 4.5:1 for text; motion preferences respected; keyboard navigable.

## 8) Process & Timeline (proposed)
- Week 1: Kickoff, IA, low‑fi wires for core flows, style exploration (2 routes).
- Week 2: Lock route, build tokens + base components, hi‑fi for key flows, prototype v1.
- Week 3: Fill remaining flows/states, refine motion/accessibility, prototype v2, handoff setup.
- Week 4: Buffer for QA, redlines, documentation, and iteration.

## 9) Handoff Requirements
- Figma library + pages organized and named consistently.
- Exported token JSON (if possible) + mapping notes for Tailwind.
- Component inventory list (states/variants) with Do/Don’t.
- Prototype links and a change log.

## 10) Open Questions
- Final brand palette and tone: confirm or iterate during style exploration?
- Depth of team roles for v1 (reviewers vs editors)?
- Marketing site scope vs in‑app UI separation?

## 11) Contacts
- Product Owner: [name, email, Slack]
- Design Lead: [name]
- Eng Lead: [name]

---
Use alongside: User Flows, Tokens Spec, Accessibility Checklist, Analytics Plan, and Handoff Checklist.
