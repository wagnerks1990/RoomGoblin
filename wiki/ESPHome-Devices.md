# ESPHome devices

**Status: Unreleased.** RoomGoblin manages already-flashed ESPHome devices through the native API and can discover ESPHome native-API advertisements on the classroom network. Home Assistant, MQTT, and a separately deployed ESPHome dashboard are not required for discovery or control.

RoomGoblin does **not** currently compile, flash, or OTA-update ESPHome firmware. It also does not recover or bypass a lost API encryption key.

## Discovery and adoption

Open **Room controls → ESPHome devices** as an administrator. RoomGoblin automatically listens for `_esphomelib._tcp.local` mDNS advertisements when the workspace opens and periodically while it remains open. **Scan network** forces a fresh bounded scan.

Discovery can show the advertised device name, private addresses, native API port, MAC when advertised, ESPHome version, platform, board, and whether the device already appears enrolled. Discovery is read-only and never alters a device.

Choose **Configure / adopt** to copy a discovered device's private IPv4 address, port, and name into the enrollment form. Discovery data is not trusted as proof of identity: RoomGoblin still connects to the native API and pins the hardware MAC returned by the authenticated/verified connection before saving the device.

Same-subnet mDNS normally works directly because RoomGoblin uses host networking. If ESPHome devices live on routed VLANs and multicast DNS is not forwarded, an mDNS reflector/repeater may be required. Discovery may observe hostnames and IPv6 addresses, but the current control endpoint intentionally remains a literal RFC1918 IPv4 address plus pinned MAC while hostname/IPv6 SSRF and rebinding protections are designed separately.

Discovery is administrator-only, separately rate-limited, capped at 128 results, briefly cached, and implemented in a credential-free helper process. Service resolution is concurrent but bounded so a classroom full of ESPHome devices does not make scans linear or unbounded.

## API encryption and unknown keys

ESPHome API encryption keys are secrets. They are not published through mDNS and cannot be extracted through unauthenticated discovery.

For a device configured with ESPHome API encryption, enter its existing `api.encryption.key`, for example:

```yaml
api:
  encryption:
    key: !secret api_encryption_key
```

The key must decode to 32 bytes. A Wi-Fi password, OTA password, dashboard password, or old API password is not the native API Noise encryption key.

If an already-flashed encrypted device's key has been lost, RoomGoblin will still be able to discover the device advertisement but cannot adopt/control it. Recovery requires a device-side action such as reflashing/rebuilding firmware or an already-authorized OTA/configuration path. RoomGoblin must not guess, bypass, replace, or silently downgrade unknown encryption.

ESPHome also permits the native API to be intentionally configured without Noise encryption. RoomGoblin can adopt such a device with the key field blank. It stores no fake key and labels the connection **unencrypted native API**. This is weaker transport security and should be used only on an appropriate trusted/isolated network; migrate to encrypted API where practical.

When editing an enrolled encrypted device, leaving the key field blank preserves the stored key. A replacement key is only needed for an intentional key rotation.

## Enrollment identity and lifecycle

Enrollment verifies the native API before saving and pins the returned hardware MAC. Duplicate endpoints and duplicate hardware are rejected. Editing a device cannot silently switch the record to different hardware even if DHCP later reuses an address.

**Disable** closes RoomGoblin's connection without changing physical device state. **Remove** deletes the RoomGoblin enrollment and stored encryption key, if any; it does not factory-reset, power off, unlock, reflash, or otherwise modify the physical ESPHome node.

The registry is stored in SQLite preference `esphome.devices.v1`. Encryption keys are stored separately as AES-GCM encrypted `secret_store` entries using the appliance master key. Inventory APIs never return the key material and the controller does not persist keys in browser local/session storage.

## Supported entities and commands

The workspace shows connection state, device identity/model/firmware, advertised entities, current values, and report timestamps. Supported controls are:

- switches;
- light on/off and advertised brightness;
- numbers using device-advertised minimum, maximum, and step;
- selects using device-advertised options;
- administrator-confirmed ESPHome button entities.

Sensor, binary-sensor, and text-sensor values are read-only. Disabled-by-default entities are read-only. Unknown/unsupported entity domains remain visible but cannot be controlled. Configuration/diagnostic controls and buttons require administrator permission and explicit confirmation.

There is no generic ESPHome service executor, firmware shell, lock/climate control, camera subscription, or OTA endpoint in this integration.

## Reliability and command semantics

One supervised, unprivileged Python worker maintains persistent native API connections for enabled nodes. Connection establishment is bounded, reconnects use exponential backoff with jitter, and the registry is capped at 64 devices with 128 entities per device.

Slow or offline ESPHome nodes do not block RoomGoblin health, Today, Morning Announcements, Background Music, scheduler recovery, Veyon, or display rendering.

RoomGoblin does not queue hardware commands while a node is offline and does not replay uncertain one-shot actions after reconnect/restart. A second simultaneous command for the same device is rejected. At most 32 devices may have commands in flight. Caller-scoped request IDs are deduplicated for five minutes in memory.

`state-confirmed` means a newer ESPHome state report matched the requested state. It is not independent physical verification of a relay/contact. `sent-unconfirmed` means the native command was written but no matching state report arrived within the confirmation window. Button presses are inherently sent-unconfirmed. If delivery becomes uncertain after a timeout/disconnect, inspect the device before explicitly repeating the action.

A stalled worker is terminated; pending commands fail and are not replayed. Connection state is marked unavailable and configured nodes are retried by the supervisor. Process-level start/crash failures use an exponential restart cooldown capped at 30 seconds; one valid worker IPC message resets it.

## Authorization and HTTP boundaries

Inventory requires `classroom.read`. Ordinary entity commands require `integrations.control`. Enrollment, edit, enable/disable, removal, and discovery require the existing administrator boundary. Backend/worker validation is authoritative; UI visibility is not an access-control boundary.

Separate appliance-wide one-minute limits exist for inventory, discovery, management, and interactive commands. Rejected over-limit requests do not create worker jobs or queued device actions.

The ESPHome Noise transport is encrypted only when a device has an API encryption key. An intentionally unencrypted native API is plaintext on the local network. The current RoomGoblin alpha controller itself is HTTP-only, so a key entered through the browser is protected only by the trusted-network boundary until HTTPS is introduced. Do not expose RoomGoblin or ESPHome management surfaces directly to the public Internet.

## Architecture

- `src/esphome.js` — registry, encrypted-secret transactions, worker supervision, bounded discovery launch, command validation/deduplication, and authenticated HTTP routes.
- `src/esphome/discovery.py` — credential-free bounded mDNS discovery of `_esphomelib._tcp.local`.
- `src/esphome/worker.py` — native API subscriptions, identity validation, reconnect behavior, and the fixed command allowlist.
- `src/esphome/worker_entry.py` — production worker entry that permits an explicitly blank key only for intentionally unencrypted API nodes while preserving private-address and non-empty-key validation.
- `src/esphome/requirements.txt` — pinned official native-client/discovery Python dependencies installed in `/opt/esphome` at image-build time.
- `public/controller/esphome.js` / `esphome.css` — capability-aware discovery, enrollment, inventory, and control workspace.

The worker receives credentials through private stdin rather than command arguments, environment variables, URLs, or browser storage. It runs as the existing unprivileged RoomGoblin UID/GID without new host capabilities or exposed ports.

## APIs

| Method and path | Purpose |
| --- | --- |
| `GET /api/v1/esphome/devices` | Safe enrolled inventory and cached live state |
| `GET /api/v1/esphome/discovery` | Administrator-only bounded mDNS discovery |
| `POST /api/v1/esphome/devices` | Verify and enroll `{name,address,port,key}`; blank key means intentionally unencrypted API |
| `PUT /api/v1/esphome/devices/:id` | Verify/edit; blank key preserves an existing stored key |
| `POST /api/v1/esphome/devices/:id/enabled` | Enable/disable RoomGoblin connection |
| `DELETE /api/v1/esphome/devices/:id` | Remove registry/key without changing physical device state |
| `POST /api/v1/esphome/devices/:id/entities/:entityId/command` | Send a bounded, validated entity command |

## Recovery, deployment, and acceptance

ESPHome enrollment mutations participate in Full Recovery writer draining. The SQLite registry and encrypted keys are already covered by the RoomGoblin database/master-key recovery identity. Live sensor state and reconnect state are memory-only. Device firmware projects remain outside the RoomGoblin recovery bundle.

Validation includes Node integration tests, real Express permission/rate-limit routes, encrypted SQLite transactions, pinned native-client Python tests, browser regressions in Chromium/Firefox, restrictive non-root image tests, image vulnerability scans, host-network/Compose smoke tests, and production-image import of the discovery/worker modules.

These automated tests are **not physical-device acceptance**. After deployment, validate against representative real devices:

1. mDNS discovery on the intended classroom/VLAN topology;
2. adoption of an intentionally unencrypted API node if one exists;
3. encrypted adoption using a known real key;
4. device reboot/disconnect/reconnect;
5. switch/light state read-back where applicable;
6. RoomGoblin restart recovery;
7. failure behavior when an encrypted device is discovered without its key.

Deploy only after the exact merged commit's Hub and maintenance image pair passes RoomGoblin's normal publication/preflight path. Back up first and use the normal RoomGoblin updater/install process. Rollback preserves the existing SQLite/master-key state and does not change ESPHome firmware.

## Not implemented yet

The following are separate follow-up work and must not be claimed as current capabilities:

- firmware compilation/building;
- USB/serial flashing;
- ESPHome OTA firmware/configuration management;
- automatic recovery/replacement of unknown encryption keys;
- hostname or IPv6 control endpoints (discovery can display them);
- sensor-triggered RoomGoblin automation rules;
- RGB/effect/color-temperature controls, climate, locks, cameras, and other unimplemented entity domains.

## Upstream references

- [ESPHome native API](https://esphome.io/components/api/)
- [Official aioesphomeapi client](https://github.com/esphome/aioesphomeapi)
- [python-zeroconf](https://github.com/python-zeroconf/python-zeroconf)
