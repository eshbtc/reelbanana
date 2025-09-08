# Founder Playbook – Working with a Product Designer (Fast + High Quality)

Purpose: Give you a practical, step‑by‑step way to drive a world‑class redesign with a professional designer.

## Principles
- Clarity beats volume: set a sharp product goal and constraints.
- Show, don’t tell: examples and screenshots > vague adjectives.
- Decide fast: timebox feedback and lock decisions each milestone.
- Own outcomes, not pixels: avoid prescribing solutions; state goals/problems.

## What to Share on Day 1
- Vision and goals (business + user), success metrics.
- Core flows to prioritize (see User Flows doc).
- Brand direction (adjectives, references) and any existing assets.
- Technical constraints (React/Vite/Tailwind, async pipeline, performance targets).
- Timelines and availability for reviews.

## Cadence & Milestones
- Weekly milestone with a 30–45m review; daily async check‑ins on Slack.
- Milestone checkpoints:
  1) IA + Low‑Fi wires for core flows
  2) Visual route (2 directions) → pick one
  3) Tokens + Base components
  4) Hi‑Fi for core flow + prototype v1
  5) Fill coverage + prototype v2
  6) Handoff package (redlines/specs/doc)

## How to Give Great Feedback
- Start with intent: what success looks like for the screen/flow.
- Flag issues, not solutions: “Users might miss the CTA because…”
- Be specific: call out exact elements; use Loom/screenshots timestamps.
- Use a decision log: capture what we’re locking in and why.
- Avoid design‑by‑committee: identify a single decision maker.

## Acceptance Criteria (use in each review)
- Does this improve the user’s speed to create a finished video?
- Are async states (loading/retry/progress/errors) covered?
- Responsive specs for target breakpoints included?
- Components/variants documented in the library?
- Tokens defined and mappable to Tailwind?
- Accessibility considered (focus, contrast, keyboard)?

## Risks to Manage Early
- Scope creep → Use “Out of Scope” and a parking lot list.
- Missing copy → Assign a temporary copy owner; create a copy deck.
- Slow decisions → timebox to 24–48h; default to designer’s call if unblocked.
- Brand indecision → choose a direction in week 1; refine, don’t restart.

## File Hygiene (Figma)
- One shared library for tokens/components; product files reference it.
- Clear page structure: Cover, Foundations, Components, Patterns, Flows, Spec/Redlines, Prototypes.
- Consistent naming: `RB/{Category}/{Component}/{Variant}`.
- Comment in Figma, keep a “Changelog” page.

## Two Rapid Plans
- 2‑Week Crash Plan (if needed)
  - W1: IA + lo‑fi core flows; pick visual route; tokens + base components.
  - W2: Hi‑fi core flows + prototype; partial coverage; handoff for dev of core path.
- 4‑Week Full Plan (preferred)
  - See Design Brief timeline.

## Handoff Checklist (use with designer)
- Library + tokens + components finalized and named.
- Redlines/specs for spacing, sizes, states.
- Motion specs documented (durations/easings).
- Asset exports (SVG/PNG/WebP) organized.
- Prototype links and notes on async states.
- Accessibility notes (contrast, focus, keyboard traps avoided).

## Post‑Handoff (Dev Phase)
- Lock tokens → implement Tailwind theme.
- Build primitives first (buttons/inputs/modals/toasts), then pages.
- Weekly QA with designer; log deltas to fix in Figma.
- Track metrics (activation, time‑to‑render, publish) vs baseline.

## Tools
- Figma (design + prototypes), FigJam (workshops), Loom (reviews), Linear/Jira (tickets), Slack (async), Notion/Docs (decision log).

Keep this open during the project. It’s your checklist to stay on track.

---

## Your 2‑Week Crash Plan (dated)

Assuming kickoff today (Mon, Sep 8, 2025). Adjust dates if needed.

- Week 1 (Sep 8–Sep 14)
  - Mon: Kickoff (45–60m). Align on goals/KPIs, scope, constraints. Share assets and references. Start Decision‑Log.
  - Tue: IA + low‑fi wires for core flows (onboarding → storyboard → generation → render wizard → publish). Async feedback by EOD.
  - Wed: Visual exploration (2 routes). Pick one route in a 30m review; log decision. Begin tokens draft.
  - Thu: Base components (buttons, inputs, cards, modals, toasts) + update wires to selected route.
  - Fri: Hi‑fi for core happy path screens; prototype v1. Founder review + punchlist.
  - Sat/Sun: Buffer (designer optional); founder gathers copy in Copy‑Deck.

- Week 2 (Sep 15–Sep 21)
  - Mon: Fill remaining flows/states (error/empty/loading), responsive specs for desktop + tablet.
  - Tue: Motion spec draft (durations/easing), accessibility pass #1.
  - Wed: Prototype v2 with key branches (variants/compare, product demo mode, publish/share).
  - Thu: Handoff prep: redlines/specs, token export/mapping notes, asset exports.
  - Fri: Final handoff review using Handoff‑Checklist; schedule weekly QA during dev.
  - Sat/Sun: Buffer.

## KPIs (prefilled targets)
- Activation (first render within 7 days): +30% vs current baseline.
- Time‑to‑First‑Render (median): < 8 minutes from project start.
- Publish/Share rate: +25% vs current.
- Variant usage: > 35% of projects use variants/compare.

Track these via Analytics‑Events‑Plan after launch; review weekly in the first month.

## First 48‑Hours: Action Checklist
- Share Design‑Brief, User‑Flows, Tokens‑Spec with designer; confirm timeline and review slots.
- Create Slack channel (#rb‑design‑overhaul), add designer, Eng lead.
- Grant access: Figma, Loom, Notion/Docs, example assets, product demo account.
- Populate Decision‑Log with: KPIs, timeline, chosen visual references, out‑of‑scope list.
- Start Copy‑Deck with top 10 screens; assign owner for copy tweaks.
- Confirm Figma file structure and naming conventions.

## Review Templates (use in every review)
- What we evaluated (screens/flows): …
- What works: …
- What’s unclear or risky (and why): …
- Decisions locked today: …
- Open questions + owners + due: …

## Quick DM/Email Template
“Thanks for the drop. I reviewed [screens]. Success for this milestone is [goal]. I’m approving [parts], and need changes on [specific elements] because [user‑impact]. Let’s lock [decision] today; otherwise we’ll proceed with your recommendation. I’ll update the Decision‑Log now. Next review: [date/time].”
