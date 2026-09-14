# RoomGoblin Wiki

**RoomGoblin — Classroom & Lab Management Hub** is a centralized classroom and lab management platform for displays, AV routing, lighting, media, live announcements, Background Music, schedules, lab infrastructure, managed displays, and appliance integration management.

*Run the room. Manage the lab.*

> **Status:** `1.0.0-alpha.82` — alpha software; production deployment remains limited to reviewed, backed-up `amd64` installations. Recovery passphrases require loopback or HTTPS through a same-host proxy even when ordinary administration uses trusted-LAN HTTP.

## Start here

- [RoomGoblin Brand and Compatibility](RoomGoblin-Brand-and-Compatibility)
- [Operator Workspaces](GUI-Workspaces)
- [Architecture](Architecture)
- [Installation and Deployment](Installation-and-Deployment)
- [Configuration](Configuration)
- [Database-First Recovery Contract](Database-First-Recovery)
- [Operations](Operations)
- [Troubleshooting](Troubleshooting)
- [Development](Development)
- [AI and Contributor Guide](AI-and-Contributor-Guide)
- [Android TV Hardware Validation](Android-TV-Hardware-Validation)
- [Security](Security)
- [Release and Upgrade Process](Release-and-Upgrade-Process)

## Current verified baseline

Alpha.80 retains the recovery invariants established in alpha.71/alpha.79 and adds:

- one passphrase-encrypted/authenticated `.rgbak` Full Recovery Export and
  clean-host import for the database/key, assets, Android/ADB/signing identity,
  allowlisted service state, and bounded native Veyon identity;
- host-owned staging, complete safety snapshots, a shared update/recovery lock,
  durable transaction journaling, full verification and all-state rollback;
- strict RoomGoblin-owned versus adopted/external service reconciliation; and
- clean-host, corruption/authentication, ownership, lifecycle, capacity,
  restart and interruption recovery gates.

Alpha.79 added:

- canonical RoomGoblin source and GHCR publication with dual-published legacy image aliases;
- full validation-matrix gating before immutable images publish;
- explicit `amd64`-only production support until `arm64` images and Android/ADB tooling are validated;
- sensitive-data confirmation for recovery backups and metadata-only support diagnostics;
- exact image-tag and retained-image rollback preservation;
- per-display Morning Announcements recovery before Background Music resumes.

The inherited baseline includes:

- direct HTTP appliance mode while TLS/Caddy is intentionally deferred;
- SQLite-safe migration backups and active-database identity preservation;
- startup recovery for incomplete built-in access profiles;
- punctuation-safe local authentication regression coverage;
- maintenance startup health independent of main-app readiness;
- editable receiver IDs with stale display-group pruning;
- appliance-wide Docker inventory/lifecycle control for existing containers;
- optional managed deployment/adoption for Mosquitto, Govee2MQTT, Music Assistant, and Veyon WebAPI;
- HLS-based Morning Announcements live detection;
- working local announcement audio volume/mute control;
- highest-priority Morning Announcements display/audio arbitration;
- post-announcement failsafe scheduler resync;
- Background Music recovery after priority audio;
- explicitly linked class-continuation rules;
- converged runtime release versioning through release metadata/stamping.

Current Android managed-display validation additionally records that Device Administrator, Accessibility, Home, and Back are physically validated on the current Onn Android 14 target; Accessibility Recents is OEM-dependent and may return Android success without showing a visible Recents UI; and native Agent v2 arbitrary input remains unimplemented. See [[Android TV Hardware Validation|Android-TV-Hardware-Validation]].

## Project principles

1. RoomGoblin is the canonical current product name; legacy Classroom Control Hub identifiers remain only where compatibility or history requires them.
2. Site-specific configuration stays outside the application source.
3. Persistent runtime data must survive container replacement and Git upgrades.
4. The configured active SQLite database must never silently switch to a stale alternate file during recreation.
5. Built-in authorization profiles must remain complete; explicit profiles fail closed.
6. Morning Announcements are a priority system and may preempt normal display/audio automation.
7. When announcements end, current scheduler state is re-evaluated rather than restoring stale display snapshots.
8. Background Music is independent of visual automation and yields to priority audio.
9. Classroom schedules, cycle days, delays, half days, remote days, and closures are first-class scheduling inputs.
10. Host-level management remains separated from the main web container through the authenticated Host Agent.
11. Existing Docker services can be adopted without recreation; new container creation remains limited to reviewed supported integration templates.
12. Optional/slow hardware integrations must not block the initial controller Overview screen.
13. Integration health is independent; one failed integration must not falsely mark unrelated integrations offline.
14. Managed-device capability reporting must distinguish physically validated behavior, API availability, OEM-dependent behavior, and unimplemented features.

## Deployment model

The following internal names are retained intentionally for upgrade compatibility:

```text
Ubuntu host
├── /opt/classroom-hub
├── classroom-hub-host-agent.service
│   └── /run/classroom-control-hub/host-agent.sock
└── Docker
    ├── classroom-control-hub
    └── classroom-control-hub-maintenance
```

Optional managed add-ons:

```text
mosquitto                 eclipse-mosquitto:2.0.22
govee2mqtt                ghcr.io/wez/govee2mqtt:2025.04.13-17d43d72
music-assistant-server     ghcr.io/music-assistant/server:2.9.13
```

## Repository and documentation

Source repository: https://github.com/wagnerks1990/RoomGoblin

The repository `docs/` directory is the canonical technical documentation set. `wiki/` is the Git-tracked mirror of this GitHub Wiki. AI coding assistants should read `AGENTS.md`, `docs/AI-CONTEXT.md`, `docs/brand/AI-BRAND-CONTEXT.md`, and the relevant `docs/ai/` context before modifying managed-device behavior.

- [[ESPHome devices|ESPHome-Devices]] — encrypted native enrollment and supported controls.
- [[Android TV Hardware Validation|Android-TV-Hardware-Validation]] — physical managed-display validation and capability-reporting boundaries.
