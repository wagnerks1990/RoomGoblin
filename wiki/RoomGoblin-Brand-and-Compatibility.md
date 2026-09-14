# RoomGoblin brand and compatibility

RoomGoblin is the current product identity for the Classroom & Lab Management Hub.

**Tagline:** *Run the room. Manage the lab.*

## Brand defaults

The built-in interface uses Goblin Teal `#0F766E`, Electric Green `#22C55E`, Slate Navy `#1E293B`, Learning Amber `#F59E0B`, Cloud Gray `#E5E7EB`, and Mint Glow `#D1FAE5`. Poppins is preferred for headings and Inter for body copy, with system-font fallbacks.

Canonical runtime assets are stored in `public/brand/`. Full rules are maintained in `docs/brand/BRAND-GUIDE.md` and `docs/brand/AI-BRAND-CONTEXT.md`.

Accessibility is part of the UI contract: state is never communicated by color
alone, and every form input, select, and textarea has a programmatic accessible
name. Placeholder text or a visually adjacent label is not sufficient.

## Android app transition

Starting with `1.0.0-alpha.77`, the RoomGoblin Display Agent uses `org.roomgoblin.display`. If `org.classroomhub.display` is installed, uninstall the old Android app and install the new RoomGoblin version instead of attempting an in-place update. Android treats the two package IDs as separate apps.

The managed installer removes only the old app package, installs RoomGoblin, retains the server-side device enrollment and ADB trust, and reapplies saved configuration and supported grants. Device Administrator and Accessibility approval may need to be confirmed again on the TV.

## Why old names still appear internally

RoomGoblin is a compatibility-safe rebrand. Existing installations depend on
legacy paths and identifiers such as `/opt/classroom-hub`, `CLASSROOM_HUB_*`,
`classroom-control-hub*` service/container names, and persisted
enrollment/storage identifiers. The alpha.77-and-later Android identity
`org.roomgoblin.display` is new, but is now protected from casual renaming.

Those are not the product's current name. They remain intentionally stable so an upgrade does not break installed appliances or managed endpoints.

Canonical images are `ghcr.io/wagnerks1990/roomgoblin` and
`ghcr.io/wagnerks1990/roomgoblin-maintenance`. CI also publishes transitional
`classroom-control-hub*` aliases for existing automation. New deployments use
the RoomGoblin names; removing the aliases requires a tested migration.

Do not perform a repository-wide search-and-replace. A future migration of an internal identifier must include an upgrade path, rollback path, and validation of data, authentication, displays, Android/Google TV enrollment, Windows lab agents, updater, and backup/recovery behavior.

## Fresh-install behavior

All installations present the canonical **RoomGoblin** product name, descriptor, tagline, mascot and favicon. School/classroom names and theme remain configurable. Former product-name and asset overrides are ignored on reads and canonicalized on ordinary saves without deleting uploaded files. Settings and Setup no longer expose custom product-name, logo or favicon controls.

## Operational invariants

The rebrand must not change the current deployment architecture, database identity, managed-device IDs, Android package identity, ADB trust, API contracts, or updater/rollback expectations merely for naming consistency.

See `docs/ROOMGOBLIN-REBRAND.md` for the authoritative migration and audit policy.

## Permanent operator artwork

Operator headers use the supplied 192 × 192 app mark at 30–48 CSS pixels,
paired with live product text. The optional `data-brand-lockup` hook creates
this treatment; existing shell images opt in with `data-brand-logo`.
Do not squeeze a wordmark into a square icon slot. The runtime applies built-in
artwork immediately, then loads school, room and theme settings. Product name,
descriptor, tagline, logo and favicon are fixed in both backend projections and
the shared browser layer. Settings and Setup no longer expose custom product-name
or asset-URL inputs. Browser favicons use the supplied 32px icon. If the bundled
mark cannot load, it is hidden without a retry loop; product text stays readable.

Old saved identity overrides are ignored on reads, without deleting raw profile
data or uploaded files. A normal site-profile save writes the canonical identity.
Stale clients may still submit the old API fields; those values are ignored.
School/room labels, display prefixes, device names, timezones and custom colors
remain configurable. No device identifiers or credentials are migrated.

The originally committed `roomgoblin_primary_400w.png` had a broken PNG stream,
and `roomgoblin_app_512x512.png` was truncated. Neither was recoverable as a
complete original. Both old URLs now serve byte-identical copies of the valid
192px supplied mark for compatibility. Their filenames do **not** describe their
current dimensions. New UI must reference `roomgoblin_app_192x192.png` directly;
use live text for the wordmark. This repair does not introduce a replacement
mascot or upscale artwork.

`test/branding.test.js` validates complete decoded image streams, default loading,
legacy runtime aliases, fixed identity, retained school/theme settings and bounded image failure.
Browser workspace checks also cover visible artwork and responsive headers.
