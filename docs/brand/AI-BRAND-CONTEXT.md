# RoomGoblin AI-Aware Brand Context

Read this file before generating RoomGoblin UI, documentation, marketing copy, code, or imagery.

## Canonical identity
- Product: **RoomGoblin**
- Descriptor: **Classroom & Lab Management Hub**
- Tagline: **Run the room. Manage the lab.**
- Audience: teachers, CTE/IT instructors, lab managers, school technology staff, and administrators.

## AI rules
1. Preserve the exact spelling **RoomGoblin**.
2. Use supplied assets and machine-readable design tokens before inventing replacements.
3. Do not infer canonical typography or spelling from concept-board text; `docs/brand/`, AI context, and design tokens are authoritative.
4. Keep the mascot helpful, technically capable, curious, and slightly mischievous - never malicious, frightening, destructive, or incompetent.
5. Keep the UI professional enough for district/school operations; avoid turning it into a children's game.
6. Use Slate Navy for structure/text, Goblin Teal for primary controls, Electric Green for healthy/online states, Amber for attention, Cloud Gray for neutrals, and Mint Glow for friendly secondary surfaces.
7. Accessibility is mandatory. Do not communicate state by color alone, and give every form control a programmatic accessible name rather than relying on placeholder text or visual proximity.
8. Never bundle or redistribute font binaries merely because Poppins/Inter are preferred.
9. Never import branding, mascots, colors, slogans, screenshots, or visual concepts from Herd Store, LabGoblin, ScreenGoblin, PatchGoblin, or another project into RoomGoblin imagery.
10. Treat generated renderings as design references only. They do not establish implementation status, live-device validation, or canonical logo artwork.

## Core modules
Devices; Students; Announcements; Schedules; Digital Signage; Room Controls; Reports; Classes; Safety; Integrations; Settings.

For interface renderings, prefer the actual operator workspace vocabulary documented in `docs/GUI-WORKSPACES.md`: Today; Displays & AV; Lighting; ESPHome devices; Display content; Background Music; Lab Computers; Presentations; Media Library; Classes; Automation; Managed Displays; Settings; Diagnostics; Infrastructure & Recovery; System Updates; and Setup. Do not invent unrelated commerce, retail, or generic SaaS modules.

## Compatibility rule
The RoomGoblin rebrand must not casually rename persistent storage, environment variables, Android package IDs, service/socket names, container identities, database fields, enrollment identifiers, API contracts, or deployment paths. Legacy internal identifiers such as `classroom-hub`, `CLASSROOM_HUB_*`, `/opt/classroom-hub`, and `org.roomgoblin.display` remain compatibility identifiers until an explicit migration is designed, tested, documented, and reversible.

## Operator workspace styling

Use the scoped `public/shared/workspace.css` operator layer and existing runtime
brand tokens for GUI changes. Read `docs/GUI-WORKSPACES.md` for page-specific
layout ownership, navigation authorization and accessibility requirements. Do not
apply the operator design layer to physical display or playback renderers.

For renderings, use Slate Navy as structural framing rather than making Electric Green the dominant background. Goblin Teal should carry primary/selected actions; Electric Green should primarily indicate healthy/online/success states; Learning Amber should signal attention; Cloud Gray should provide neutral separation; Mint Glow is a restrained friendly secondary surface. Avoid generic bright-blue SaaS themes, neon gaming aesthetics, oversized cartoon mascots inside operational screens, and unnecessary visual clutter.

## Prompt seed
Design for RoomGoblin, a Classroom & Lab Management Hub. Use the canonical RoomGoblin assets and tokens. Make it clean, modern, accessible, teacher-first, technically credible, and fast to scan during class. Use Slate Navy structure, Goblin Teal primary actions, Electric Green healthy states, Learning Amber attention states, Cloud Gray neutrals, and Mint Glow secondary surfaces. Use the actual RoomGoblin operator workspaces and the supplied mascot identity. Do not use branding or visual language from any other Goblin or school-store project. Use the friendly goblin identity without generic childish ed-tech styling or visual clutter.

## Rendering and documentation assets

Canonical runtime branding belongs under `public/brand/`. Generated or manually designed concept boards, UI reference renderings, and documentation-only screenshots belong under `docs/brand/renderings/` (or another clearly documentation-only path), not in `public/brand/`. A concept image must never silently replace a runtime logo or mascot.

Preferred repository image formats:
- PNG for UI renderings, screenshots, logos, diagrams with text, and transparent raster assets.
- SVG for genuinely vector documentation diagrams/icons when safe and appropriate; do not trace the supplied raster mascot simply to create an SVG replacement.
- WebP for large documentation-only raster imagery when size savings are material and compatibility is acceptable.
- JPEG only for photographs, not UI or logos.
- GIF only when animation is necessary to explain a workflow.

Use descriptive lowercase filenames such as `roomgoblin-today-concept.png`. Keep generated working/source files and font binaries out of the repository. Optimize unusually large raster references while preserving legibility. Never place school-specific credentials, private addresses, production streams, secrets, or sensitive infrastructure details in a reference rendering.

## Asset integrity and header contract

Use `/brand/roomgoblin_app_192x192.png` with live product text for operator
headers, and `/brand/roomgoblin_app_32x32.png` for the default favicon.
`data-brand-lockup` opts a page header into the shared compact treatment;
`data-brand-logo` marks an existing image. Product name, descriptor, tagline,
logo and favicon are fixed canonical identity, including on existing installations.
Do not restore custom product-name or asset-URL settings. Preserve actual school,
room and device names, display prefixes and custom theme settings. Ignore old
identity overrides on read; canonicalize ordinary saves without deleting uploads.
The legacy 400w/512px filenames are compatibility aliases of the valid 192px
artwork after truncated originals were found; never infer dimensions from those
filenames. New art must not silently replace the supplied mascot.
Branding regressions must decode bundled PNG streams, not merely check file
extensions or PNG signatures.
