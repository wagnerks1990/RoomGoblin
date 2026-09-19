# Cloudflare Remote HTTPS

RoomGoblin can provision and manage an optional Cloudflare remote-access path from Setup or Controller Settings.

Managed provisioning supports:

- a remotely managed Cloudflare Tunnel;
- one proxied RoomGoblin DNS hostname;
- Always Use HTTPS;
- Automatic HTTPS Rewrites;
- HTTP/3;
- Brotli;
- optional Cloudflare Access with an explicit allowed email domain;
- the local `cloudflared-roomgoblin.service` connector.

Cloudflare Universal SSL and standard proxied-DNS/edge protections are supplied by Cloudflare for eligible active zones.

## Domain activation prerequisite

Cloudflare Free uses a full authoritative DNS setup. Add the apex domain to Cloudflare and delegate the domain at its registrar to the nameservers Cloudflare assigns. If RoomGoblin sees the zone in `pending` state, validation reports those assigned nameservers and stops before provisioning. Retry after Cloudflare reports the zone `active`.

## Credential choice

Use a scoped API Token whenever possible. Global API Key + account email is a broader legacy alternative.

Full provisioning needs Zone Read, DNS Write, Zone Settings Edit/Write, and Tunnel/Cloudflare One Connectors Write. Add Access Apps and Policies Write only when Access is enabled.

The API credential is encrypted in RoomGoblin's secret store and is never returned to the browser.

## Safety

The tunnel origin is loopback only:

```text
http://127.0.0.1:3000
```

Port 3000 is the default; RoomGoblin follows the configured `HUB_PORT`. Never publish maintenance 3010, Host Agent, Docker, SSH, Veyon, MQTT, or arbitrary lab services. Music Assistant is limited to the protected auxiliary exception below.

A same-name existing tunnel is not adopted automatically because adoption replaces its ingress rules. Conflicting DNS is not replaced automatically either. Both require explicit administrator choices.

Cloudflare Access cannot be enabled without an explicit allowed email domain.

The safe preset deliberately avoids Bot Fight Mode, authenticated-page caching, HSTS, and private-network/WARP routing.

## Full Recovery transport

A local connector socket does not make the original browser local or encrypted.
Known forwarding headers, even empty ones, disable the direct-localhost exception.
Forwarded recovery requires an immediate loopback peer, explicitly configured
proxy trust (the managed topology uses `TRUST_PROXY_HOPS=1`), and a complete
HTTPS-only `X-Forwarded-Proto` chain. Empty entries, HTTP prefixes, mixed protocols,
and chains longer than the trusted hop count are rejected.

The proxy must overwrite `X-Forwarded-Proto` from the original client connection.
Stripping every forwarding header makes a proxy indistinguishable from a direct
local client and is unsupported. Host/Origin alone are not transport identity;
existing unforwarded loopback API clients and SSH forwards using aliases retain
their behavior. Browser passphrase submission also requires its own HTTPS/local
location and the server's `allowed` decision, not merely `loopback: true`.

The unreleased hardening corrects the server-side loopback exception and protocol
chain validation without changing administrator authorization, encryption,
recovery data, deployment ports, or ordinary trusted-LAN administration.

```bash
node --check src/recovery-transport-policy.js
node --test test/recovery-transport-policy.test.js test/recovery-transport-boundary.test.js
```

These tests cover policy decisions and local HTTP header handling, not a full
appliance restore or live tunnel. Verify secure and rejected plaintext paths on
an isolated authorized installation using only test data; never send a real
passphrase over an insecure connection to test rejection.

## Connector secret

The browser never receives the tunnel connector token. RoomGoblin retrieves it server-side and sends it through the authenticated local maintenance/Host Agent path. The durable token is stored only at:

```text
/etc/cloudflared/roomgoblin.token
```

with mode `0600`.

The native Host Agent remains `ProtectSystem=full`; managed provisioning grants write access only to `/etc/cloudflared` and the dedicated `/etc/systemd/system/cloudflared-roomgoblin.service` file.

`cloudflared` package installation is handled by the normal root RoomGoblin install/update path, not by the Host Agent. The Host Agent configures only an already-installed binary, avoiding writes to APT, dpkg, or `/usr` from its restricted mount namespace.

If an interrupted/failed attempt left the dedicated RoomGoblin unit masked to `/dev/null`, the next RoomGoblin update safely removes only that stale dedicated mask. A valid existing `cloudflared-roomgoblin.service` file is preserved rather than overwritten.

Provision/Reconcile restarts the dedicated connector after writing a new tunnel token. This prevents an older running cloudflared process from keeping a deleted/stale tunnel token and producing Cloudflare Error 1033.

The connector token file contains the exact Cloudflare token with one real trailing newline. The Controller also preserves Configured/Credential stored indicators and the Open HTTPS URL after reload or reboot, while showing live tunnel health separately.

The GUI installs the connector without restarting the requesting Hub and then offers a separate **Restart RoomGoblin** action so `TRUST_PROXY_HOPS=1` can take effect cleanly.

RoomGoblin checkpoints the created tunnel and DNS IDs before installing the local connector. If host installation fails, retry provisioning reuses those recorded resources instead of leaving them as an unrecognized same-name tunnel.

## Availability
## Additional protected HTTPS resources

Music Assistant can optionally use a separate hostname on the same RoomGoblin tunnel. Its public hostname routes to local port 8095 and is required to have a Cloudflare Access email-domain Allow policy. RoomGoblin keeps its backend Music Assistant URL local and does not move stream/Sendspin traffic onto the public UI hostname.

After provisioning, use the returned Music Assistant HTTPS URL as Music Assistant's browser/external URL. Direct LAN port 8095 remains available as a trusted-network fallback.

This is an allowlist, not a generic port publisher. Veyon WebAPI, maintenance, Host Agent, media plane, MQTT, ESPHome, Android management/ADB and local AI stay private.


Cloudflare is outside RoomGoblin health. Internet, DNS, Cloudflare, or tunnel outages affect only the remote path. Local schedules, Morning Announcements, Background Music, displays, managed devices, and maintenance continue independently.

## Manual fallback

```bash
cd /opt/classroom-hub
sudo bash deploy/configure-cloudflare-tunnel.sh
```

## Verify

```bash
curl -fsS http://127.0.0.1:3000/health
systemctl is-active cloudflared-roomgoblin.service
systemctl status cloudflared-roomgoblin.service --no-pager
journalctl -u cloudflared-roomgoblin.service -n 100 --no-pager
```

Then verify HTTPS, optional Access, RoomGoblin login, WebSockets, Full Recovery transport boundaries, Morning Announcements priority, scheduler recovery, and Background Music reconciliation.

See `docs/CLOUDFLARE-TUNNEL.md` for full permissions, security, provisioning, and rollback details.
