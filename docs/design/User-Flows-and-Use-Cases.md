# User Flows & Information Architecture (IA)

Purpose: Align on the core journeys to design, the information architecture, and page inventory. Use this to scope screens and validate coverage.

## Roles
- Visitor: unauthenticated, lands on marketing site or shared links.
- Creator (authenticated): creates/edit projects, generates assets, renders, publishes.
- Admin: monitors usage/health, manages plans/limits.

## Primary Journeys
1) First Video (Happy Path)
- Landing → Sign in → Start from Template → Storyboard (prompts/narration) → Generate images → Render Wizard → Publish/Share → Gallery/Share Page

2) Custom Story (From Scratch)
- Dashboard → New Project → Topic + Character Passport → Storyboard → Generate per scene (variants/compare) → Render → Publish

3) Product Demo Flow
- Dashboard → New Project (Product Demo) → Upload product assets → Auto‑generate feature scenes → Generate images → Render → Export presets (9:16/1:1/16:9) → Publish/Download

4) Review & Iteration
- Open project → Play latest render → Add comments per scene → Regenerate scene (variant) → Re‑render → Version history

5) Brand Kit Setup
- Dashboard → Brand Kit → Upload logo/colors/fonts → CTA presets → Apply kit to project → Render with overlays

6) Pricing & Billing
- Pricing page → Select plan → Checkout → Plan gating (resolution, concurrency, polish) reflected in UI

## IA / Page Inventory
- Marketing: Home, Examples/Gallery, Pricing, Docs, Login.
- App Shell: Header, Nav (Projects, Templates, Brand Kit, Gallery, Account).
- Dashboard: Projects list (search, sort), quick actions, recent renders.
- Templates: browse/search, categories, preview, start.
- Project/Storyboard: scene list, prompt/narration, character passport, refs, background, style presets, variants/compare.
- Generation Panel: per scene status, cost/credits visibility, retry policy, error handling.
- Render Wizard: steps (upload, narrate, align, compose music, render/AI clips, polish), progress/ETA/state logs.
- Review & Publish: player, captions toggle, publish settings, SEO/OG preview, share links.
- Gallery: public list, filters, detail page, social actions.
- Brand Kit: logo upload, colors, typography, CTA presets, safe‑areas.
- Account/Billing: plans, usage, BYO keys.
- Admin Lite: health, cache stats, basic analytics.

## States to Cover (for each page)
- Loading, Empty, Error, Success, Partial (some steps done), Permission denied, Plan‑gated.

## Metrics (per flow)
- First Video: conversion to first render, time to render, publish rate.
- Product Demo: completion rate, time to export, export format mix.
- Review: comments per project, revision cycles, approval time.

Use this as the checklist to ensure every screen and edge state is designed.
