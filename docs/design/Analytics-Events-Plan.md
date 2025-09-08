# Analytics & Success Metrics Plan

Purpose: Define product KPIs and the event schema the UI should instrument post‑overhaul.

## Core KPIs
- Activation: % of new users who render a first video.
- Time‑to‑First‑Render: median minutes from project start to render.
- Completion: % who finish render after starting generation.
- Publish/Share Rate: % of rendered videos that get published/shared.
- Variant Usage: % of scenes with variants/compare used (quality seeking).

## Event Schema (draft)
- user_signup { method }
- project_created { project_id, source: template|scratch|product_demo }
- storyboard_scene_generated { project_id, scene_index, frames, cached }
- image_variant_generated { project_id, scene_index }
- render_started { project_id, scenes, aspect, polish_enabled }
- render_step_completed { project_id, step: upload|narrate|align|compose|render|polish, ms, cached }
- render_completed { project_id, ms, cached, resolution, engine: ffmpeg|fal }
- publish_clicked { project_id, title_length, description_length }
- share_link_copied { project_id, network }
- brandkit_applied { org_id, project_id }
- plan_gated_view { plan, feature }

## Implementation Notes
- Use one analytics SDK (GA4, Segment, or PostHog). Keep PII out of event properties.
- Attach a requestId/jobId to correlate steps to a single render.
- Sample rate for verbose logs to keep costs in check.
- Mirror a subset in BigQuery for analysis.

## Dashboards
- Weekly activation/publish funnel
- Median time‑to‑first‑render trend
- Error rate by step and reason
- Cache hit rates per service
