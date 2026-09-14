# GitHub Copilot Instructions

## Product identity

The current product name is **RoomGoblin — Classroom & Lab Management Hub**. The tagline is **Run the room. Manage the lab.** Read `/docs/brand/AI-BRAND-CONTEXT.md` before adding or changing user-facing names, colors, logos, icons, setup copy, documentation, or agent presentation.

Do not perform blind renames of legacy identifiers. Alpha.77 intentionally changes the Android identity from `org.classroomhub.display` to `org.roomgoblin.display` and therefore requires uninstall/reinstall. Existing appliance paths, environment variables, service/socket/container identifiers, persisted keys, and enrollment IDs remain compatibility-sensitive. New user-facing copy should say RoomGoblin; old names may remain only for history, transition detection, or compatibility contracts documented in `/docs/ROOMGOBLIN-REBRAND.md`.

## Host-network deployment contract

The Linux RoomGoblin appliance and maintenance containers, plus reviewed managed add-on templates, use host networking. Maintenance is loopback-only; custom ports are actual listeners. Preserve explicit bind addresses, persistent mounts and secrets, and never silently recreate adopted containers. See [Host networking and migration](../docs/HOST-NETWORKING.md) for preflight, port inventory, compatibility, acceptance tests and rollback. Do not reintroduce Docker service DNS or port-publishing assumptions.

Read `/AGENTS.md` before making changes. Use `/docs/AI-CONTEXT.md` for the current technical/operational model, `/docs/brand/AI-BRAND-CONTEXT.md` for branding rules, `/docs/ai/ANDROID-TV-HARDWARE-VALIDATION.md` for physically validated Android/Google TV capability boundaries, `/docs/DISPLAY-ACCESS.md` for the classroom display access contract, `/docs/AUTOMATION-DISPLAY-MEDIA.md` for automation media/class-target behavior, and `/docs/VEYON-MUSIC-INTEGRATIONS.md` for the Veyon/Music Assistant contract.

Key rules:

- `VERSION` and `CHANGELOG.md` define the current release state.
- Standard production checkout: `/opt/classroom-hub`.
- Preserve runtime `.env`, `data/`, databases, uploads, backups, keys, and secrets during upgrades.
- Never hardcode or commit production IPs, credentials, tokens, stream IDs, school-specific calendars, or private URLs.
- Keep backend/controller/display/maintenance/host-agent version strings converged for every release.
- RoomGoblin browser display receivers use stable direct URLs `/display/<id>` without credentials by default. This is an intentional product contract for trusted classroom networks; do not silently make enrollment mandatory again.
- Unknown or disabled display IDs must always be rejected. Administrators may explicitly enable individual credential authentication only after enrolling their displays. Controller/user authentication and Windows lab-agent enrollment remain mandatory and separate.
- Display credentials and one-use enrollment records remain active optional security state. Preserve them across upgrades and never log or embed credential secrets in routine controller pages.
- Direct displays still receive short-lived signed asset tokens for protected `/media/*` and `/presentations/*` requests. URL-only display access must not make protected asset paths public.
- A successful automation result does not prove media rendered; tests for display media must verify the receiver can fetch and render the protected asset.
- `Use class default display targets` is persisted independently of the primary action domain. Do not silently clear it just because an event starts with lighting or another non-display action.
- Morning Announcements are highest priority. When they end, re-evaluate and re-trigger the currently applicable winning display automations before Background Music resumes; do not restore stale snapshots.
- Timer chaining is only for the matching Bison continuation of the same base period.
- Integration health must be independent. A Pluto failure must not falsely mark MQTT/Govee offline.
- Optional or slow hardware probes must not block initial Overview rendering.
- Android capability reporting must distinguish API availability from physically validated behavior. Keep `globalNavigation` for compatibility, but use separate Home/Back/Recents capability entries for current UI decisions.
- Accessibility Home and Back are physically validated on the current Onn Android 14 target. Recents is OEM-dependent: Android may accept the global action without showing a visible Recents UI.
- Accessibility global actions are not arbitrary input injection. Until the native Agent v2 actually implements and validates arbitrary key/text/tap/swipe/coordinate input, `inputInjection.available` must remain false.
- Do not add Onn-specific backend branches merely because a behavior was observed on that test device; represent OEM-dependent behavior through the generic capability model and documentation.
- Veyon computer inventory and RoomGoblin-side Veyon configuration are database-authoritative. `veyon-computers.json` is migration input only; do not reintroduce it as runtime state.
- Native `veyon.service` / `veyon-webapi.service` are host-managed but remain fully configurable from RoomGoblin. Do not deploy the obsolete Veyon proxy when native services exist.
- Veyon control authentication uses the Veyon key pair. Domain credentials and SSH keys, when configured, are optional endpoint-deployment credentials and must not be described as Veyon control authentication.
- Veyon private keys and endpoint deployment secrets must be encrypted in SQLite. Native Veyon filesystem keys are derived/imported runtime material, not RoomGoblin configuration authority.
- Music Assistant is not ready merely because its container is running. A valid long-lived token is mandatory; Save & Verify must fail on missing/rejected credentials and the token must remain encrypted/database-backed.
- Do not treat Veyon WebAPI `GET /` returning HTTP 404 as proof of successful Veyon authentication/control. Use computer/authentication status for operational validation.
- Update the relevant `docs/` and `wiki/` mirror pages when behavior, branding, or operations change.
- Run the validation steps in `.github/workflows/validate.yml` before release and do not claim tests that were not actually run.
