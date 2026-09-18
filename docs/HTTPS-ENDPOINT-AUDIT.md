# HTTPS / Public-Origin Endpoint Audit

Status: implementation planning baseline after managed Cloudflare HTTPS became operational.

This audit separates browser/agent endpoints that should prefer the configured public HTTPS/WSS RoomGoblin origin from privileged local/LAN protocols that must remain private. Tenant-specific hostnames and school addresses are runtime configuration and must never be hard-coded in the repository.

## Policy

1. **Public browser and authenticated agent traffic** should prefer the configured RoomGoblin HTTPS origin when one exists.
2. **Local service-to-service APIs** stay on loopback/private LAN unless there is a reviewed proxy with equivalent authentication and authorization.
3. **LAN HTTP remains an explicit fallback** where it materially improves recovery or preserves a validated local-media topology.
4. Do not expose arbitrary local ports through Cloudflare merely to make them HTTPS.
5. WebSocket clients must derive `wss://` from an HTTPS Hub origin and `ws://` only from an explicitly selected HTTP fallback.
6. Never publish maintenance, Host Agent, Docker, ADB, Veyon WebAPI, MQTT, ESPHome native API, or device-agent management ports directly to the Internet.

## Runtime endpoint inventory

| Component | Current endpoint / protocol | Current role | Public HTTPS/WSS policy | Local fallback |
| --- | --- | --- | --- | --- |
| RoomGoblin Hub | TCP 3000 HTTP | Controller, Setup, REST API, display/lab-agent WebSockets, enrollment/downloads | **Preferred public front door** through the managed Cloudflare hostname | Direct LAN HTTP remains available |
| Cloudflare Tunnel origin | `http://127.0.0.1:3000` | Same-host reverse-proxy origin | Keep loopback HTTP; Cloudflare supplies browser-facing HTTPS | N/A |
| Display WebSocket | same-origin `/ws` | Display commands/telemetry/enrollment | Automatically use WSS when display page is loaded over HTTPS | WS on LAN HTTP |
| Windows PowerShell lab agent | Hub origin -> `/ws` | Authenticated command/telemetry channel | Prefer HTTPS Hub URL, therefore WSS | HTTP requires explicit `-AllowHttp` |
| Native Windows agent | configured Hub origin | Authenticated command/telemetry, native downloads/enrollment | Prefer HTTPS Hub URL | HTTP requires explicit `--allow-http` |
| Native Windows bootstrap/downloads | Hub `/lab-agent/native/*` | Signed/hashed native package and enrollment | Prefer HTTPS Hub origin | LAN HTTP explicit fallback |
| Android display WebView | configured `display_url` | RoomGoblin display renderer | HTTPS is supported, but do not migrate blindly until media-plane behavior is preserved | LAN HTTP currently preserves validated media-plane routing |
| Dedicated media plane | TCP 3020 HTTP | Authorized `GET/HEAD /media/*`, byte ranges, large MP4/audio payloads | **Do not publish raw 3020.** Current receiver optimization intentionally uses 3020 only for HTTP display origins. HTTPS display migration needs an explicit secure media-plane design. | Local/LAN media delivery |
| Maintenance API | `127.0.0.1:3010` HTTP | Privileged maintenance bridge | **Never public** | Loopback only |
| Native Host Agent | Unix socket | Root host-management bridge | **Never public** | Local socket only |
| Veyon WebAPI | `127.0.0.1:11080` HTTP | RoomGoblin server-side Veyon control API | **Never publish raw WebAPI.** Browser Veyon controls already traverse RoomGoblin HTTPS/API. | Loopback only |
| Veyon native service | TCP 11100 on managed LAN | Native Veyon master/service communication to endpoints | Not HTTP; do not route through Cloudflare. Keep LAN-native Veyon transport. | Managed LAN |
| Music Assistant UI/API | TCP 8095 HTTP | Music Assistant administration/API | Keep RoomGoblin backend configuration on local service address. Browser access needs a reviewed HTTPS proxy or dedicated protected hostname; do not simply expose raw 8095 under the existing RoomGoblin tunnel. | Direct LAN 8095 |
| Music Assistant stream service | TCP 8097 normally | Audio streaming/discovery | Do not proxy through RoomGoblin HTTPS by default; LAN audio path | Managed LAN |
| Music Assistant Sendspin | WS TCP 8927 | Hub-to-Music Assistant audio upstream | Keep local/LAN WS upstream; RoomGoblin relays authenticated display-side traffic | Local/LAN |
| MQTT / Mosquitto | `127.0.0.1:1883` by default | Internal broker for managed integrations | Not HTTPS; **never public by default** | Loopback/managed bridge |
| Node-RED | TCP 1880 | Optional managed UI/runtime | Do not auto-publish. If remote UI is required, use an explicitly authenticated/protected proxy policy. | LAN/local |
| Govee2MQTT | host-network discovery/control + MQTT | LAN device integration | Not an HTTPS browser service | LAN |
| ESPHome native API | TCP 6053 private device addresses | Encrypted native API to enrolled ESPHome devices | **Never public** | Private LAN |
| Android Device Agent v2 | TCP 8765 on device | Authenticated Hub/maintenance management API | **Never public** | Private LAN |
| Android ADB | TCP 5555 policy/default | Bootstrap/recovery | **Never public** | Private LAN only |
| Pluto AV matrix | configured private HTTP endpoint | Hardware control | Keep server-side/private LAN | LAN |
| qBittorrent WebUI | TCP 8080 | Auxiliary host UI | Do not auto-publish; requires separate access/security review | LAN |
| MeTube | TCP 8081 | Auxiliary host UI | Do not auto-publish; requires separate access/security review | LAN |
| Torrent file browser | TCP 8090 | Auxiliary host file UI | Do not auto-publish; current Flask dev server is not an Internet edge | LAN |
| External signage/media URLs | operator-provided HTTP(S) | Display content | Preserve HTTPS where available; display gateway policy remains authoritative | As configured |
| Cloudflare API | HTTPS 443 | Cloudflare provisioning/reconciliation | External HTTPS as currently implemented | N/A |
| Cloudflare package repository | HTTPS 443 | Host package installation | External HTTPS in root installer/update path | N/A |

## Code locations that select or transform origins

- `src/cloudflare.js` and `src/cloudflare-bridge.js`: saved public hostname, Cloudflare API and tunnel management.
- `deploy/configure-cloudflare-tunnel.sh`: loopback RoomGoblin origin and connector service.
- `src/network.js` / `maintenance-agent/network.js`: host-mode alias normalization and local HTTP endpoints.
- `public/controller/workspace.js`: Windows native enrollment origin and install command generation.
- `public/lab-agent/ClassroomHubAgent.ps1`: converts HTTPS -> WSS and HTTP -> WS for the lab agent.
- `windows-agent/*`: validates the Hub URL; HTTPS is preferred and HTTP requires explicit acknowledgement.
- `public/display/index.html`: display same-origin WebSocket.
- `public/shared/attribution.js`: HTTP-only receiver media-plane reroute to TCP 3020.
- `agents/android-tv/*`: accepts HTTP(S) display URLs and local agent-management configuration.
- `public/shared/integration-setup.js` and `public/controller/app.js`: browser-opening helpers for Music Assistant and local integrations.
- `src/music-assistant-sendspin.js`: dedicated WS Sendspin upstream.
- `maintenance-agent/android-tv-agent-v2.js`: private authenticated HTTP requests to Android Agent v2.
- `src/veyon-ai.js`: fixed loopback local-AI endpoint.
- `src/server.js`: Veyon WebAPI, Music Assistant control, MQTT, WebSocket and integration runtime URLs.
- `install.sh`, README, deployment/operator docs: currently still print or document LAN HTTP as the primary controller URL in several places.

## Migration phases

### Phase 1 — canonical public origin and browser/agent preference

- Treat the saved Cloudflare hostname as the optional canonical public RoomGoblin origin.
- Surface both **Public HTTPS** and **Local LAN fallback** in the Controller and installer/status UX.
- Generate new Windows lab/native enrollment using public HTTPS when Cloudflare is healthy/configured, while retaining an explicit local-LAN choice.
- Ensure WSS is used automatically from the HTTPS origin.
- Remove stale documentation that describes RoomGoblin as globally HTTP-only.

### Phase 2 — Music Assistant browser access

Do **not** change `MUSIC_ASSISTANT_URL` away from the host-local/LAN service address used by the backend. Add a separate browser-facing access mechanism. Before implementation, verify Music Assistant reverse-proxy/base-path and WebSocket behavior. Prefer one of:

1. authenticated same-origin RoomGoblin proxy with strict path/WebSocket handling; or
2. a separate protected Cloudflare hostname dedicated to Music Assistant.

The existing raw 8095 listener remains the LAN fallback.

### Phase 3 — display HTTPS without media regression

Do not mass-rewrite physical display URLs to HTTPS until large uploaded media keeps the dedicated media-plane isolation. Options require review/testing:

- authenticated HTTPS proxy route to the dedicated media-plane process;
- a protected secondary Cloudflare origin/hostname for media only; or
- keep physical displays on trusted-LAN HTTP while admin/remote clients use HTTPS.

The validated 3020 separation must not be silently lost.

### Phase 4 — optional auxiliary web UIs

qBittorrent, MeTube, Node-RED, and the torrent browser require independent authentication and proxy/security review. They are not automatically added to the RoomGoblin Cloudflare tunnel.

## Explicit non-goals

- No public Veyon WebAPI.
- No public maintenance API or Host Agent.
- No public ADB or Android management port.
- No public MQTT or ESPHome native API.
- No public local-AI listener.
- No generic “proxy any localhost port” feature.
- No hard-coded school hostname or address in source.

## Acceptance criteria

- Cloudflare outage affects only remote/public access; local classroom operation continues.
- New Windows agents can enroll and remain connected over HTTPS/WSS without `AllowHttp`.
- Existing LAN agents continue to work until deliberately migrated.
- Veyon browser controls work through the RoomGoblin HTTPS Controller while Veyon WebAPI stays loopback.
- Music Assistant backend/API integration continues using the reviewed local endpoint regardless of browser-facing access.
- Physical display video playback retains the dedicated media-plane performance behavior.
- No secret-bearing or privileged local endpoint is made publicly reachable merely for URL uniformity.
