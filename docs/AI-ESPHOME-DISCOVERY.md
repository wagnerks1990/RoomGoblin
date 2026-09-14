# AI context — ESPHome discovery

RoomGoblin's ESPHome integration has two separate responsibilities:

1. `src/esphome.js` + `src/esphome/worker.py`: enrolled-device registry, secret handling, persistent native API connections, entity state, and bounded commands.
2. `src/esphome/discovery.py`: credential-free, read-only mDNS discovery of `_esphomelib._tcp.local` advertisements.

`src/esphome/worker_entry.py` is the production worker entry point. It preserves the original worker's private-IPv4 and port validation while allowing an empty `key` to represent a device whose ESPHome native API is intentionally unencrypted. A non-empty key must still be a valid 32-byte base64 Noise PSK. Do not make unknown encrypted devices fall back to unencrypted operation.

Discovery is not authorization. It may populate the administrator enrollment form, but enrollment must still probe the native API and pin the returned hardware MAC before persisting a device. mDNS data must never be treated as trusted hardware identity by itself.

Do not add API-key extraction, guessing, downgrade, or implicit firmware changes. ESPHome encryption keys are secrets and are not published in mDNS. If an encrypted device's key is unknown, the integration must report that a key/device-side recovery is required.

Discovery runs only for authenticated administrators, is rate-limited, bounded to 128 results, and briefly cached. It must not gain access to the RoomGoblin master key or stored integration secrets. Keep it read-only.

The current enrollment endpoint remains private IPv4-only even though discovery can observe hostnames and IPv6 addresses. Hostname/IPv6 control requires a separate design that preserves SSRF/rebinding protections and hardware identity pinning.

Preserve existing RoomGoblin priorities and isolation: Morning Announcements, scheduler recovery, Background Music reconciliation, display stability, Veyon, Full Recovery writer draining, and managed-device compatibility must not depend on ESPHome discovery success.

## Current implemented scope

As of the ESPHome discovery/adoption merge, RoomGoblin can:

- discover already-flashed ESPHome native-API nodes through mDNS;
- automatically scan when an administrator opens **Room controls → ESPHome devices** and manually rescan on demand;
- display discovered device name, private addresses, API port and advertised metadata;
- populate the enrollment form from a discovery result;
- enroll and control intentionally unencrypted native-API devices without inventing or storing a fake key;
- enroll encrypted devices only when the administrator supplies the exact existing encryption key;
- verify the native connection and pin returned hardware identity before persistence;
- maintain bounded persistent connections, state subscriptions, command deduplication and no automatic replay of uncertain hardware commands.

## Not implemented — do not claim otherwise

The following remain explicit follow-up work rather than existing capability:

- ESPHome firmware compilation or YAML project management;
- USB/serial flashing;
- OTA firmware/configuration updates;
- extraction, recovery, replacement or bypass of an unknown encryption key;
- hostname or IPv6 control endpoints (discovery may display them);
- sensor-triggered RoomGoblin automation rules;
- generic ESPHome service execution;
- RGB/effects/color-temperature, climate, lock, camera and other unsupported entity-domain controls.

For the current classroom use case, automatic discovery plus native enrollment/control is the recommended baseline. Firmware/OTA management should be added only if RoomGoblin needs to become responsible for device lifecycle/recovery rather than merely discovering and controlling already-flashed ESPHome nodes. Sensor-triggered automation is the highest-value functional extension after real-device discovery/adoption has been validated in production.
