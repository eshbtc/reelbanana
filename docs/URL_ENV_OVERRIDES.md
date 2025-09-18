# Service URL Overrides

This project supports overriding Cloud Run base URLs via environment variables to avoid hardcoded drift across README, tests, and deployments.

Set any of the following in your `.env.local` (or build‑time env):

- `VITE_BASE_UPLOAD`
- `VITE_BASE_NARRATE`
- `VITE_BASE_ALIGN`
- `VITE_BASE_RENDER`
- `VITE_BASE_COMPOSE`
- `VITE_BASE_POLISH`
- `VITE_BASE_API_KEY`
- `VITE_BASE_STRIPE`

Notes
- Partial overrides are allowed. Any service without an override falls back to the default production config.
- Precedence: ENV_OVERRIDE > import.meta.env.PROD > VITE_TARGET_ENV > localhost.
- E2E tests also accept `BASE_URL_*` environment variables and will respect your chosen environment.

Quick start
1) Copy `.env.example` to `.env.local` and adjust the `VITE_BASE_*` URLs.
2) Run `node scripts/audit-urls.mjs` to verify consistency across sources.

