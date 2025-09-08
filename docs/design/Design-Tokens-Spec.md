# Design Tokens Spec (to map to Tailwind)

Purpose: Define a single source of truth for foundational styles. The output should be easy to export from Figma and map into Tailwind theme config.

## Token Categories
- Color
  - `color.background.{default,subtle,raised}`
  - `color.surface.{default,elevated}`
  - `color.text.{primary,secondary,tertiary,inverse,link}`
  - `color.brand.{primary,primary-contrast,accent}`
  - `color.state.{success,warning,error,info}`
  - `color.border.{default,focus}`
- Typography
  - `font.family.{sans,mono}`
  - `font.size.{xs,sm,md,lg,xl,2xl,3xl,4xl}`
  - `font.weight.{regular,medium,semibold,bold}`
  - `line.height.{tight,normal,relaxed}`
- Spacing & Sizing
  - `space.{0,0.5,1,1.5,2,3,4,6,8,12,16}`
  - `size.radius.{sm,md,lg,xl,full}`
  - `size.container.{sm,md,lg,xl}`
- Elevation
  - `elevation.{sm,md,lg,overlay}` with shadow tokens
- Motion
  - `motion.duration.{fast,base,slow}`
  - `motion.easing.{standard,emphasized,decay}`

## Example Token Values (draft)
- color.brand.primary: `#FFCD1F`
- color.text.primary: `#FFFFFF`
- color.text.secondary: `#B9C2CF`
- color.background.default: `#0B0F14`
- color.surface.elevated: `#141B24`
- color.state.success: `#22C55E`
- color.state.error: `#EF4444`
- font.family.sans: `Inter, ui-sans-serif, system-ui, ...`
- motion.duration.base: `200ms`
- motion.easing.standard: `cubic-bezier(0.2, 0, 0, 1)`

## Export & Mapping Notes
- Prefer Figma Tokens plugin or similar for JSON export.
- Map to Tailwind in `tailwind.config.js` (colors, fontFamily, borderRadius, boxShadow, transitionDuration/easing).
- Provide light/dark palettes (token modes). Ensure contrast AA in both.

## Safe Areas (Video)
- Provide overlays for 16:9, 9:16, 1:1 safe areas to guide CTA/logo placement.

The designer should provide the token JSON or a documented list ready to transcribe into Tailwind.
