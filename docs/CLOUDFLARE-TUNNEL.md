# Cloudflare managed provisioning

RoomGoblin supports optional managed Cloudflare remote HTTPS. The setup wizard and Controller can provision or reconcile a remotely managed Cloudflare Tunnel, a proxied DNS hostname, selected safe Cloudflare Free-plan edge settings, optional Cloudflare Access, and the local `cloudflared-roomgoblin.service` connector.

Cloudflare remains an optional edge layer. It must never become a dependency for local classroom operation, Morning Announcements, scheduler recovery, Background Music reconciliation, managed displays, maintenance, updates, or rollback.

## Managed architecture

```text
Remote administrator
  -> HTTPS / Cloudflare edge
     -> Universal SSL for eligible proxied hostnames
     -> Cloudflare edge/DDoS protections
     -> optional Cloudflare Access allow policy
  -> proxied CNAME <hostname> -> <tunnel-id>.cfargotunnel.com
  -> outbound Cloudflare Tunnel
  -> cloudflared-roomgoblin.service on RoomGoblin host
  -> http://127.0.0.1:3000   # default HUB_PORT
  -> RoomGoblin Hub
```

The runtime origin follows `HUB_PORT`; port 3000 above is the default example. Only the Hub HTTP listener is a supported tunnel origin. Never publish maintenance port 3010, the Host Agent socket, Docker, SSH, Veyon, MQTT, Music Assistant, or another appliance-local service.

## Wizard and Controller

Use either Setup -> **Cloudflare Remote HTTPS** or Controller -> Settings -> **Integrations & Hardware -> Cloudflare Remote HTTPS**.

The managed flow can:

1. validate the Cloudflare credential and active zone; if the zone is pending, show the Cloudflare-assigned nameservers that must be set at the registrar;
2. create a dedicated remotely managed tunnel;
3. reuse RoomGoblin's previously recorded tunnel;
4. optionally adopt a same-name existing tunnel only after explicit administrator consent;
5. configure a single RoomGoblin hostname plus a terminal HTTP 404 ingress rule;
6. create a proxied CNAME to `<tunnel-id>.cfargotunnel.com`;
7. refuse conflicting DNS takeover unless explicit replacement is selected;
8. reconcile Always Use HTTPS, Automatic HTTPS Rewrites, HTTP/3, and Brotli;
9. optionally create Cloudflare Access with an explicit allowed email-domain policy;
10. retrieve the connector token server-side and install the local connector without exposing that token to the browser;
11. offer a separate Hub restart so `TRUST_PROXY_HOPS=1` becomes active.

Provisioning is repeatable. RoomGoblin stores resource IDs plus creation/adoption metadata in SQLite so later work can distinguish managed resources from unrelated Cloudflare resources.
Cloudflare-side tunnel and DNS ownership is checkpointed before local connector installation. If host installation fails after Cloudflare resources were created, a later retry reuses the recorded resources instead of treating them as unrelated.

## Authentication

### Scoped API Token — recommended

Prefer an API Token scoped to the intended account and zone. For the full managed feature set, grant only the permissions needed for the selected options:

- Zone Read;
- DNS Write;
- Zone Settings Edit/Write;
- Cloudflare Tunnel / Cloudflare One Connectors Write;
- Access Apps and Policies Write only when Cloudflare Access is enabled.

Cloudflare's UI/API permission wording can vary slightly. Do not add unrelated Workers, billing, registrar, account-user, email, or broad administrative permissions.

### Global API Key — legacy compatibility

RoomGoblin also supports Cloudflare account email + Global API Key. This is intentionally labeled legacy because it grants substantially broader authority than a scoped token. Use it only when a suitable API Token cannot be used.

## Secret handling

The API Token or Global API Key is stored in RoomGoblin's encrypted SQLite secret store:

- `integration.cloudflare.api-token`
- `integration.cloudflare.global-key`

Browser APIs expose only configured/not-configured flags; raw API credentials are never returned to the browser.

The tunnel connector token is different. It is retrieved from Cloudflare only during provisioning and moves server-side through:

```text
administrator route
 -> loopback maintenance API
 -> authenticated Host Agent Unix socket
 -> root-only temporary token file
 -> deploy/configure-cloudflare-tunnel.sh --token-file ...
```

The temporary file is deleted after the installer exits. The durable connector token remains only at:

The native Host Agent remains systemd-sandboxed with `ProtectSystem=full`. Automatic connector provisioning therefore grants write access only to `/etc/cloudflared` and the pre-created `/etc/systemd/system/cloudflared-roomgoblin.service` file; it does not make the rest of `/etc` or `/usr` writable to the Host Agent.

```text
/etc/cloudflared/roomgoblin.token
```

with mode `0600`. It must never enter Git, RoomGoblin `.env`, browser state, shell command arguments, application logs, support bundles, or documentation.

## Safe Free-plan preset

RoomGoblin defaults these managed options on:

- Cloudflare Tunnel;
- proxied DNS;
- Always Use HTTPS;
- Automatic HTTPS Rewrites;
- HTTP/3;
- Brotli.

Cloudflare also supplies Universal SSL for eligible proxied hostnames and its standard DNS/edge protections according to the active plan. RoomGoblin does not copy edge certificates onto the appliance.

For the simplest Free-plan certificate coverage, prefer a first-level hostname such as `roomgoblin.example.org` when `example.org` is the Cloudflare zone. Deeper hostnames can require different certificate coverage depending on the zone/certificate configuration.

Zone settings are zone-wide. On a dedicated lab domain this is usually desirable, but review the impact before enabling them on a shared production zone.

### Deliberately not automatic

- **Cloudflare Access** — optional because Access applications are deny-by-default. RoomGoblin requires an allowed email domain before enabling it.
- **Bot Fight Mode** — not automatically enabled because challenges can interfere with APIs, WebSockets, agents, or managed clients.
- **Cache Everything/authenticated-page caching** — not enabled; cached controller/API content can be stale or user-specific.
- **HSTS** — not automatic because it is a durable browser policy and can complicate emergency rollback.
- **WARP/private-network routing** — not part of the public RoomGoblin hostname and would broaden the trust boundary to lab networks.
- **Arbitrary services/ports** — prohibited by this integration.

## Cloudflare Access

Access is an additional outer gate, never a replacement for RoomGoblin login, capabilities, auditing, or recovery authorization.

When enabled, an allowed email domain is mandatory. RoomGoblin creates or reuses a self-hosted Access application for the exact public hostname and ensures an Allow policy for that domain. Complete Cloudflare Zero Trust onboarding and configure the intended identity provider before relying on Access.

Cloudflare's Zero Trust Free plan has user-count limits; verify the current plan terms for the intended staff population.

## Existing-resource safeguards

### Tunnel

A same-name tunnel is not sufficient evidence of RoomGoblin ownership. If RoomGoblin has no recorded tunnel ID and a same-name tunnel already exists, provisioning stops with HTTP 409. The administrator must choose a different tunnel name or explicitly enable adoption. Adoption replaces that tunnel's ingress configuration, so use it only for a tunnel dedicated to RoomGoblin.

### DNS

If the hostname already has a different DNS record, provisioning stops unless explicit conflicting-record replacement is enabled. An already-correct CNAME is safely adopted.

### Access

RoomGoblin matches the exact application hostname and adds the named RoomGoblin Allow policy; it does not delete unrelated Access policies.

## Reverse-proxy and Full Recovery trust

Full Recovery passphrases have a stricter transport boundary than ordinary administration. `src/recovery-transport-policy.js` accepts forwarded HTTPS only when:

1. `TRUST_PROXY_HOPS` is explicitly enabled; and
2. the immediate TCP peer is loopback.

The same-host `cloudflared` service connects to `127.0.0.1:${HUB_PORT:-3000}`, satisfying the reviewed topology. A LAN client cannot become a trusted recovery transport by spoofing `X-Forwarded-Proto` because its immediate peer is not loopback.

The connector installer sets:

```env
TRUST_PROXY_HOPS=1
```

Do not increase it without a topology/security review and regression tests.

## Manual fallback

The host-side installer remains supported:

```bash
cd /opt/classroom-hub
sudo bash deploy/configure-cloudflare-tunnel.sh
```

Useful options:

```bash
sudo bash deploy/configure-cloudflare-tunnel.sh --skip-install
sudo bash deploy/configure-cloudflare-tunnel.sh --token-file /root/private-token-file
sudo bash deploy/configure-cloudflare-tunnel.sh --no-restart
```

The installer verifies local health, installs `cloudflared` from Cloudflare's signed APT repository when needed, writes the mode-0600 connector token, creates the dedicated systemd service, sets `TRUST_PROXY_HOPS=1`, and verifies the connector.

## Verification

On the appliance:

```bash
curl -fsS http://127.0.0.1:3000/health
systemctl is-active cloudflared-roomgoblin.service
systemctl status cloudflared-roomgoblin.service --no-pager
journalctl -u cloudflared-roomgoblin.service -n 100 --no-pager
```

Then verify from an authorized remote client:

1. HTTPS works on the selected hostname;
2. Cloudflare Access is enforced if enabled;
3. RoomGoblin login still occurs;
4. controller live updates and WebSockets work;
5. Full Recovery accepts the secure tunnel/loopback path but not direct remote HTTP;
6. displays and managed agents remain stable on their intended local paths;
7. Morning Announcements retain highest priority;
8. scheduler catch-up/recovery still functions;
9. Background Music reconciles after higher-priority media;
10. a Cloudflare outage removes only the remote path.

## Availability and failure behavior

Do not add Cloudflare or `cloudflared` state to core `/health`, scheduler readiness, update acceptance, maintenance readiness, installer acceptance, or rollback decisions.

If Cloudflare, DNS, the Internet, or the tunnel is unavailable, local RoomGoblin operation, schedules, announcements, Background Music, displays, managed devices, Veyon, and appliance maintenance must continue.

## Rollback

Disable only the connector:

```bash
sudo systemctl disable --now cloudflared-roomgoblin.service
sudo rm -f /etc/systemd/system/cloudflared-roomgoblin.service
sudo rm -f /etc/cloudflared/roomgoblin.token
sudo systemctl daemon-reload
```

If no reviewed loopback reverse proxy remains:

```bash
cd /opt/classroom-hub
sudo sed -i 's/^TRUST_PROXY_HOPS=.*/TRUST_PROXY_HOPS=0/' .env
sudo docker compose up -d --force-recreate classroom-hub
```

Remove Cloudflare DNS, Access, and Tunnel resources separately and only after confirming ownership. Do not delete an adopted or unrelated resource merely because its name resembles a RoomGoblin resource.

## References

- Cloudflare Tunnel: <https://developers.cloudflare.com/tunnel/>
- Cloudflare Tunnel API: <https://developers.cloudflare.com/api/resources/zero_trust/subresources/tunnels/subresources/cloudflared/>
- API token permissions: <https://developers.cloudflare.com/fundamentals/api/reference/permissions/>
- Cloudflare Access policies: <https://developers.cloudflare.com/cloudflare-one/access-controls/policies/>
- Universal SSL: <https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/>
- Always Use HTTPS: <https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/>
- HTTP/3: <https://developers.cloudflare.com/speed/optimization/protocol/http3/>
