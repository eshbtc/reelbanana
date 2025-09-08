# Accessibility Checklist (WCAG 2.2 AA)

Use this to review components and pages before handoff and during dev.

## Global
- Color contrast: text ≥ 4.5:1; large text ≥ 3:1; icons ≥ 3:1.
- Focus visible: clear focus rings; logical tab order; skip to content.
- Keyboard access: all actions reachable; no keyboard traps; modals trap focus and restore.
- Motion preferences: respect `prefers-reduced-motion`; avoid parallax/auto‑playing motion unless user‑initiated.
- Semantics: landmarks (header/nav/main/footer), correct roles, labels.
- Error messaging: programmatic association; clear, specific guidance.

## Components
- Buttons/Links: correct roles; link vs button semantics; disabled vs aria‑disabled.
- Forms: labels, descriptions, error text, required state, inline validation.
- Dialog/Modal: `role=dialog`, labelled by title; close via Esc; focus trap.
- Lists/Tables: header associations; cell roles; keyboard navigation.
- Toasts/Banners: not steal focus; are dismissible; ARIA live region.
- Tooltips: do not replace labels; keyboard accessible; delay/hide specs.

## Media
- Video: captions toggle; keyboard controls; focus order correct.
- Images: alt text for informative; decorative marked accordingly.

## States
- Loading/Skeletons: announce progress where relevant; avoid infinite spinners without context.
- Errors/Retries: clear text; not only color; actionable guidance.

Run through this checklist at each milestone; log any exceptions with rationale.
