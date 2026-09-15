# RoomGoblin Rendering References

This directory is reserved for **documentation-only RoomGoblin interface renderings, concept boards, and visual references**.

These files help contributors and AI workers understand the intended RoomGoblin visual direction. They are not runtime assets, implementation evidence, live-system screenshots, or a replacement for the canonical mascot in `public/brand/`.

## Source of truth

Before creating or changing a rendering, read:

1. `../BRAND-GUIDE.md`
2. `../AI-BRAND-CONTEXT.md`
3. `../../GUI-WORKSPACES.md`
4. `../../../AGENTS.md`
5. the current implementation for the workspace being illustrated

The repository implementation and documentation determine available workflows. A rendering must not be treated as authorization to add or change application behavior.

## Visual direction

Use the canonical RoomGoblin identity:

- RoomGoblin — Classroom & Lab Management Hub
- Run the room. Manage the lab.
- Goblin Teal `#0F766E`
- Electric Green `#22C55E`
- Slate Navy `#1E293B`
- Learning Amber `#F59E0B`
- Cloud Gray `#E5E7EB`
- Mint Glow `#D1FAE5`
- Poppins-style headings and Inter-style body/UI typography when available through normal licensed/package sources

Use the supplied mascot as the identity reference. Do not replace it with generated goblin artwork. Do not use Herd Store, LabGoblin, ScreenGoblin, PatchGoblin, or unrelated project branding.

## Recommended references

Useful concept images may cover Today, Displays & AV, Lighting, ESPHome, Display Content, Background Music, Lab Computers/Veyon, Presentations, Media Library, Classes, Automation, Managed Displays, Settings/Diagnostics, Infrastructure & Recovery, System Updates, and Setup.

A composite overview may be stored as `roomgoblin-ui-overview-concept.png`. Individual references should use names such as `roomgoblin-managed-displays-concept.png`.

## File formats

PNG is the default for UI mockups and text-heavy renderings. SVG is suitable for genuine vector diagrams. WebP is acceptable for large documentation-only raster references when it offers meaningful size savings. JPEG is for photographs, and GIF should be limited to cases where animation is necessary.

GitHub can display these normal image types directly; changing an image to a document format is not required. Keep runtime assets in `public/brand/` and reference imagery here.

## Safety and accuracy

Use fictional/sample device names and data unless a sanitized project example is already public. Never include passwords, tokens, school-specific private addresses, private streams, production secrets, or sensitive infrastructure. Clearly identify concept imagery as a concept/reference when it could otherwise be mistaken for a live screenshot.
