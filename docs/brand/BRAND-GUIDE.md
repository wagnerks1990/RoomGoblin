# RoomGoblin Brand Guide

**Canonical name:** RoomGoblin  
**Descriptor:** Classroom & Lab Management Hub  
**Tagline:** Run the room. Manage the lab.

## Positioning
RoomGoblin is a central classroom and technology-lab management hub for devices, students, announcements, schedules, digital signage, room controls, reporting, classes, safety, integrations, and settings.

## Personality
Smart, organized, playful, dependable, teacher-first, and technical. The goblin is a capable helper, never a destructive gremlin.

## Colors
- **Goblin Teal:** `#0F766E`
- **Electric Green:** `#22C55E`
- **Slate Navy:** `#1E293B`
- **Learning Amber:** `#F59E0B`
- **Cloud Gray:** `#E5E7EB`
- **Mint Glow:** `#D1FAE5`

## Typography
Use **Poppins** for headings/brand display and **Inter** for UI/body copy. Font binaries are intentionally not included; obtain them through normal licensed/package sources.

## Naming
First mention: **RoomGoblin - Classroom & Lab Management Hub**. Normal product mention: **RoomGoblin**. Do not write Room Goblin, Room-Goblin, ClassGoblin, or LabGoblin.

## Logo use
Do not stretch, rotate, add effects, or arbitrarily recolor the logo. At small sizes use the app icon/mascot rather than squeezing the descriptor.

The canonical operator mark is `/public/brand/roomgoblin_app_192x192.png` paired with live RoomGoblin product text. `/public/brand/roomgoblin_app_32x32.png` is the favicon. The legacy `roomgoblin_primary_400w.png` and `roomgoblin_app_512x512.png` paths are compatibility aliases of the supplied 192px artwork; their filenames do not indicate actual high-resolution source art.

## Voice
Short, useful, calm, slightly playful. Prefer actionable language such as “3 devices need attention” and “Room ready.” Avoid childish ed-tech copy.

## Approved phrases
- Run the room. Manage the lab.
- Less tech chaos. More teaching.
- Same rooms. Smarter days.
- Tech works better here.

## UI and rendering direction
RoomGoblin concept art, screenshots, mockups, documentation imagery, and future interface work must look like the same product. Use the repository UI and `docs/GUI-WORKSPACES.md` as the functional source of truth rather than inventing unrelated modules.

Renderings should emphasize a professional teacher-first operations console: Slate Navy provides structure, Goblin Teal identifies primary actions and active navigation, Electric Green communicates healthy/online states with a text or icon label, Learning Amber identifies attention states, Cloud Gray provides neutral separation, and Mint Glow may be used for friendly secondary surfaces. Avoid generic bright-blue SaaS styling and avoid neon-green-dominant or game-like interfaces.

Representative RoomGoblin rendering surfaces include:
- Today / classroom overview
- Displays & AV
- Lighting and ESPHome devices
- Display content and digital signage
- Background Music
- Lab Computers, including Veyon and Windows-agent views
- Presentations and Media Library
- Classes and Automation
- Managed Displays and Android agent/device capability views
- Settings and Diagnostics
- Infrastructure & Recovery and System Updates
- first-time Setup

Renderings are design references, not proof that a feature is implemented or live-tested. When sample data is shown, label it as conceptual/sample data where ambiguity could make a rendering look like a production screenshot. Preserve Morning Announcements priority, scheduler recovery, Background Music reconciliation, managed-display capability boundaries, and other documented behavior when illustrating workflows.

### Rendering identity rules
1. Use **RoomGoblin** only; never reuse Herd Store, LabGoblin, ScreenGoblin, PatchGoblin, or other project branding in RoomGoblin assets.
2. Use the canonical supplied mascot as the visual reference. Generated concept art must not silently become the canonical logo or replace the repository mascot.
3. Keep the mascot helpful, technically capable, curious, and slightly mischievous—not frightening, malicious, destructive, or childish.
4. Prefer live product text next to the mascot rather than generating a raster wordmark.
5. Use the canonical descriptor and tagline when a rendering needs supporting brand copy.
6. Keep controls dense enough for classroom operations but fast to scan during instruction. Advanced and maintenance controls should remain visually secondary to daily actions.
7. Do not use invented school-specific addresses, credentials, streams, infrastructure details, or production secrets in renderings.

## Image file formats
GitHub supports normal repository image assets without converting them to Markdown or another document type. Use formats intentionally:

- **PNG** — canonical choice for RoomGoblin logos, UI screenshots, renderings, diagrams with text, and transparent raster assets. This remains the preferred repository format for the mascot and UI reference images.
- **SVG** — preferred for newly created vector diagrams or icons when the source is genuinely vector and contains no unsafe embedded content. Do not trace or replace the canonical raster mascot merely to obtain SVG.
- **WebP** — acceptable for large documentation/reference renderings when it materially reduces repository size, but PNG is preferred when maximum GitHub/documentation compatibility or text sharpness matters.
- **JPEG** — use only for photographic material; avoid it for UI screenshots, logos, and text-heavy mockups because lossy compression reduces clarity.
- **GIF** — use only when a short animation materially explains a workflow. Prefer static PNG documentation when motion is unnecessary.

Store canonical runtime branding under `public/brand/`. Store non-runtime concept/reference imagery under a documentation path such as `docs/brand/renderings/` so concept art cannot be confused with application assets. Use descriptive lowercase filenames such as `roomgoblin-today-concept.png` or `roomgoblin-managed-displays-concept.png`.

Do not commit font binaries, generated image working files, school-specific secrets, or unnecessarily huge source exports. Optimize large raster references before committing while retaining readable UI text.

## Accessibility
Never use color alone to communicate state. Pair color with labels/icons and maintain accessible contrast.
Every form input, select, and textarea must have a programmatic accessible name
through an associated `label`, `aria-label`, or `aria-labelledby`; placeholder
text and visual proximity do not count as a label.
