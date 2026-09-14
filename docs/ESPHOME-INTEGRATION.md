# ESPHome devices

**Status: Unreleased.** This adds encrypted native ESPHome device management to
RoomGoblin. It does not install Home Assistant, change the MQTT/Govee transport,
flash firmware, or deploy the ESPHome Device Builder/dashboard.

## Operator workflow

Open **Room controls → ESPHome devices**. An administrator expands **Add or edit
an ESPHome device**, enters a friendly name, its private IPv4 address, native API
port (normally 6053), and its existing `api.encryption.key`. RoomGoblin verifies
the encrypted connection before saving and pins the returned hardware MAC.
Existing native-API devices do not need MQTT or a Home Assistant installation.

Use an already-flashed ESPHome device with API encryption enabled. This is the
relevant device-side fragment, not a complete board or GPIO configuration:

```yaml
api:
  encryption:
    key: !secret api_encryption_key
```

The key must decode to 32 bytes. A Wi-Fi password, OTA password, old API password,
or dashboard login is not a native API encryption key. The integration does not
read firmware YAML, Wi-Fi credentials or OTA secrets. Keep those in the device's
separate firmware management system. Do not commit actual keys to this repository.

Reserve a device address in DHCP. This initial integration accepts literal
RFC1918 IPv4 addresses only, including routed private VLANs. DNS names, `.local`,
IPv6, automatic mDNS discovery, link-local, loopback, and public endpoints are not
supported. Permit the appliance to reach the configured TCP API port. No new
inbound RoomGoblin port, USB access, Docker socket mount or host privilege is added.

The workspace shows connection status, device identity/model/firmware, advertised
entities, values and their report times. Expand **Entities** for controls.
Search/filter only changes presentation. Polling retains expanded cards and
unsaved numeric/select and enrollment edits. A failed inventory refresh retains
last data but disables controls until a successful refresh.

Supported controls are switches, light on/off and brightness when advertised,
numbers with device-defined bounds/steps, selects with device-defined options,
and explicitly confirmed administrator button presses. Sensor, binary-sensor
and text-sensor values are read-only. Other advertised types are shown as
unsupported/read-only. There is no generic service executor, Home Assistant action
handler, camera subscription, lock/climate control, OTA endpoint or firmware shell.
Disabled-by-default entities remain read-only. Configuration/diagnostic controls
and buttons require administrator permission and confirmation.

Edit retains the stable RoomGoblin device ID and verifies the same MAC; leave
the key blank to preserve it. Changing to different hardware is rejected, even
when the address is reused. **Disable** closes the connection without changing
hardware state. **Remove** deletes enrollment and the stored API key; it does
not factory-reset, power off, unlock, or otherwise act on the physical device.

## Reliability and command semantics

One supervised, unprivileged Python worker maintains one persistent encrypted
native connection per enabled node. The connection-establishment limit is six,
with exponential reconnect delays capped at 60 seconds plus jitter. There is a
64-node limit and a 128-entity limit per node. Slow/offline ESPHome nodes do not
block main application health, Today, announcements, music, Veyon or displays.
Native keepalive is 10 seconds; a lost connection may take several keepalive
intervals to be detected. A quiet sensor value is not itself an offline signal.
Deep-sleep nodes will naturally disconnect; this is not a wake-on-demand service.

Entity identity includes both native subdevice ID and entity key. Firmware state
is reacquired after reconnect. RoomGoblin does not reassert old relay/light state
on restart. A second simultaneous command for the same node is rejected rather
than queued. At most 32 nodes have commands in flight. There is no offline queue.
Commands use caller-scoped request IDs with five-minute deduplication (bounded to
1,024 entries). A conflicting reuse is rejected. The browser never retries an
uncertain command automatically. Deduplication is memory-only and does not survive
a Hub restart; clients must not replay commands after a restart or timeout.

`state-confirmed` means a newer ESPHome state report matched the requested state;
it is not independent verification of relay contacts or a physical action.
`sent-unconfirmed` means a write was issued but no matching state arrived within
two seconds. Buttons always return `sent-unconfirmed`. Disconnects/timeouts can
leave outcomes unknown. Check the device before explicitly repeating an action.
A stalled/crashed worker is terminated, pending commands fail without replay,
connection status becomes unavailable, and configured connections are retried by
the supervisor. A 45-second worker heartbeat deadline is checked every 15 seconds;
worker address space is limited to 512 MiB and core dumps are disabled. Snapshot/error traffic and requests are bounded. Upstream raw
exception text and device logs are not returned to the browser.

## Architecture, credentials and authorization

- `src/esphome.js`: registry, encrypted-secret transactions, worker supervision,
  bounded IPC, command validation/deduplication and authenticated HTTP routes.
- `src/esphome/worker.py`: the official `aioesphomeapi` client, identity validation,
  persistent subscriptions, reconnects and a fixed command allowlist. Keys arrive
  through private stdin, never command arguments, environment variables or URLs.
- `src/esphome/requirements.txt`: all Python dependencies pinned. The main image
  installs `/opt/esphome` at build time and runs it as the existing UID/GID 10001.
  There are no runtime dependency downloads. `ESPHOME_PYTHON` is a local development
  override; production uses `/opt/esphome/bin/python`.
- `public/controller/esphome.{js,css}`: capability-aware operator workspace, scoped
  to the main controller. It does not load into physical display renderers.

The registry is in SQLite preference `esphome.devices.v1`. Keys are separate
AES-GCM encrypted `secret_store` entries named
`esphome.<stable-device-id>.encryption-key`, using the appliance's existing master
key. Enrollment/removal updates registry and secret state in one SQLite
transaction. Inventory APIs never return key material; password inputs are cleared
on submission, closing the editor, leaving the workspace and authentication
changes. Keys are not stored in browser local/session storage. Configuration
changes should use this workspace, not manual edits to generic secret rows.

Inventory requires `classroom.read`. Ordinary commands require
`integrations.control`; device enrollment/edit/enable/remove require the existing
administrator boundary. Buttons and configuration/diagnostic commands additionally
require an enabled administrator profile and explicit confirmation. Backend and
worker validate commands and current entity identity; UI visibility is not an
access boundary. Global same-origin request protection remains unchanged.

The native transport is encrypted. The existing alpha controller may still use
trusted-LAN HTTP, which does **not** encrypt key entry between browser and Hub.
Use HTTPS through a reviewed same-host proxy or local access where available,
and restrict any remaining HTTP administration to a trusted network. Do not expose
ESPHome, the controller, or the firmware dashboard to the public Internet.

All ESPHome HTTP mutations and in-flight async work join Full Recovery Export
writer-drain accounting. Enrollment rechecks the freeze after its network probe,
before writing. Live state and reconnection work are memory-only; no sensor-history
writer bypasses the freeze. Full Recovery already preserves the SQLite registry
and encrypted keys as part of its database/master-key identity. Firmware projects
and physical device configuration remain outside the appliance recovery bundle.

## APIs

| Method and path | Purpose |
| --- | --- |
| `GET /api/v1/esphome/devices` | Safe inventory and live cached state |
| `POST /api/v1/esphome/devices` | Verify and enroll `{name,address,port,key}` |
| `PUT /api/v1/esphome/devices/:id` | Verify/edit; blank key preserves stored key |
| `POST /api/v1/esphome/devices/:id/enabled` | Enable/disable with `{enabled}` |
| `DELETE /api/v1/esphome/devices/:id` | Remove registry and key, not physical state |
| `POST /api/v1/esphome/devices/:id/entities/:entityId/command` | `{requestId,command}`; entity ID is `subdevice:key` |

Examples of command objects: `{"state":true}`, `{"brightness":0.5}`, and
`{"state":"advertised option"}`. Buttons require `{"press":true,"confirm":true}`
and administrator permission. Confirmation does not grant authorization.

## Validation, deployment and rollback

```bash
npm run check
node --test test/esphome.test.js
npm test
python3 -m venv /tmp/roomgoblin-esphome
/tmp/roomgoblin-esphome/bin/pip install -r src/esphome/requirements.txt
/tmp/roomgoblin-esphome/bin/python -m unittest discover -s test -p esphome_worker_test.py -v
```

The Python suite uses actual pinned API models/signatures and simulated devices;
the Node suite exercises real Express permission routes and encrypted SQLite
storage, plus IPC failure fixtures. Browser regressions cover mobile/desktop,
read-only permissions, preserved input and stale-state controls. The main Docker build runs the native tests in its exact shipped Python runtime
and removes test sources afterward. The normal CI also builds/scans both images and runs existing classroom/recovery/display gates.
These tests are **not physical-device acceptance**. Validate enrollment, key
rotation, relay/light read-back, native reboot/reconnect, VLAN connectivity and
Hub restart against real intended devices before operational use.

Deploy only after the exact merged commit's Hub and maintenance images pass normal
publication. Back up first and use the normal RoomGoblin upgrade path; a source-only
update without the new image will lack the Python environment. No new optional
container needs installation. Roll back through the existing updater and matching
operational backup. The older application ignores the new registry preference;
never manually delete the database or master key during rollback. ESPHome devices
keep their own firmware state when RoomGoblin is rolled back or disabled.

Automatic discovery, firmware compilation/flashing/OTA, RGB/effect/color-temperature
controls, sensor-triggered automation rules and other entity domains are outside
this initial integration. Do not claim those capabilities are implemented.

## Upstream references

- [ESPHome native API](https://esphome.io/components/api/)
- [Official aioesphomeapi client](https://github.com/esphome/aioesphomeapi)
- [Pinned aioesphomeapi 46.4.1](https://pypi.org/project/aioesphomeapi/46.4.1/)
