# Component Inventory (Current Code → New Design System)

Purpose: Give the designer a quick view of what exists today and a target componentization plan for the new system.

## Found in `components/` (as of repo scan)
- AnimatedLoader
- EditSequenceModal
- AdminDashboard
- MyProjectsModal
- CharacterPicker
- PricingPage
- Spinner
- SceneCard
- ConfirmProvider
- Modal
- AdBlockerWarning
- TechWriteup
- Header
- MyProjectsPage
- Logo
- DemoWizardHelpModal
- PricingModal
- Icon
- CompareModal
- UserDashboard
- AdminAnalytics
- AdminHealth
- TemplatesPage
- MovieWizard
- PublicGallery
- CharacterGenerator
- ToastProvider
- StoryboardEditor
- MoviePlayer
- AuthButton

Related pages/roots
- `App.tsx` (routes/shell)
- `RenderingScreen.tsx`, `MoviePlayer.tsx` (non‑componentized variants)

## Proposed Design System (MVP set)
- Foundations: Colors, Typography, Spacing, Radius, Elevation, Motion, Grid/Breakpoints.
- Primitives: Button, IconButton, Input, TextArea, Select, Checkbox, Radio, Toggle, Slider, Tag/Chip, Avatar, Tooltip.
- Surfaces: Card, Modal/Sheet/Drawer, Panel, Tabs, Accordion, Table, List, Toast/Inline Alert, Banner.
- Navigation: Header/Nav, Sidebar, Breadcrumbs, Pagination, Stepper/Progress.
- Media: Thumbnail, Player shell, Skeletons, Empty states.
- Composition: Scene Card, Variant Compare, Generation Panel, Wizard Step, Share Preview, Gallery Tile.

## Mapping Suggestions
- SceneCard → new Card + Media + Tag + Actions pattern
- CompareModal → Compare pattern with side‑by‑side + diff states
- MovieWizard → Stepper + Panel + Progress + Logs pattern
- TemplatesPage → Filterable grid/list, tagged cards
- PublicGallery → Gallery Tile + Hover actions + Share
- AuthButton/Header → Unify under Nav system with auth states
- Modals → unify spacing, sizes, focus traps, and close affordances

The designer should rationalize the above into scalable components with documented states and variants.
