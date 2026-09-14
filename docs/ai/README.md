# AI maintainer context

This directory contains narrow, behavior-specific context for AI coding assistants and automated contributors. It supplements, but does not replace, the project-wide contracts in `AGENTS.md`, `docs/AI-CONTEXT.md`, and `docs/brand/AI-BRAND-CONTEXT.md`.

Read the relevant file before changing the subsystem it describes.

## Current subsystem context

- [Android TV Hardware Validation](ANDROID-TV-HARDWARE-VALIDATION.md) — physically validated Android/Google TV behavior, Accessibility Home/Back/Recents boundaries, Device Administrator scope, and the rule that Accessibility global actions must not be represented as arbitrary input injection.
- [Android TV Sendspin and Device Admin](ANDROID-TV-SENDSPIN-DEVICE-ADMIN.md) — required Sendspin Moshi adapter order, the `JsonOptional` serialization failure mode, and the user-confirmed Device Administrator deactivation path needed for safe legacy package migration.

## Maintenance rule

When physical testing changes what RoomGoblin can accurately claim about a managed device, update the operator documentation, the matching `wiki/` page, and this AI-aware context in the same change. Distinguish:

- implemented capability;
- API or permission availability;
- physically validated behavior;
- OEM-dependent behavior; and
- planned or unimplemented behavior.

Do not turn a single-device observation into model-specific backend logic unless the product intentionally adopts that behavior and supplies compatibility tests.
