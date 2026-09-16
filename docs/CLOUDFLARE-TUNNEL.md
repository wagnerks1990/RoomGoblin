# Cloudflare Tunnel integration

RoomGoblin supports an optional **remotely-managed Cloudflare Tunnel** for HTTPS remote access without opening an inbound firewall port to the appliance. This is an optional edge-access layer; it must not become a dependency for local classroom operation, Morning Announcements, Background Music, scheduling, managed displays, maintenance, updates, or recovery.

## Architecture

```text
Remote administrator
  -> HTTPS / Cloudflare edge
  -> optional Cloudflare Access policy
  -> outbound Cloudflare Tunnel
  -> cloudflared-roomgoblin.service on the RoomGoblin host
  -> http://127.0.0.1:3000
  -> RoomGoblin Hub
```

The Hub remains the application authentication and authorization authority. Cloudflare Access is recommended as an additional remote-access gate, not as a replacement for RoomGoblin accounts/capabilities.

The tunnel must never expose the maintenance service on `127.0.0.1:3010`, the Host Agent Unix socket, Docker, SSH, Veyon, MQTT, Music Assistant, or other appliance-local integrations.

## Why the origin is loopback

Full Recovery passphrases have a stricter transport boundary than ordinary RoomGoblin administration. `src/recovery-transport-policy.js` accepts forwarded HTTPS only when:

1. `TRUST_PROXY_HOPS` is explicitly enabled; and
2. the immediate TCP peer is loopback.

A same-host `cloudflared` process connecting to `127.0.0.1:3000` satisfies that model. A direct LAN client cannot spoof `X-Forwarded-Proto` into becoming a trusted recovery transport because its immediate peer is not loopback.

For the Cloudflare connector, use:

```env
TRUST_PROXY_HOPS=1
```

Do not increase the hop count unless the topology is deliberately changed and covered by transport-policy tests.

## Cloudflare configuration

Cloudflare recommends remotely-managed tunnels for most deployments. Create a dedicated tunnel for this appliance and configure a public hostname whose origin service is:

```text
http://127.0.0.1:3000
```

Do not configure a public hostname for any other local RoomGoblin port.

Recommended controls:

- require Cloudflare Access for the controller/admin hostname;
- use the organization's normal identity provider and MFA where available;
- keep RoomGoblin's own authentication enabled;
- do not cache authenticated controller/API responses;
- retain WebSocket support;
- scope Cloudflare administrators and tunnel-management permissions narrowly;
- enable tunnel-health notifications;
- rotate the tunnel token if disclosure is suspected.

Cloudflare Tunnel is outbound-only from the appliance. The host must be able to reach Cloudflare; no inbound NAT/port-forward is required.

## Install the connector

Create the remotely-managed tunnel and obtain its tunnel token in Cloudflare. On the RoomGoblin appliance:

```bash
cd /opt/classroom-hub
sudo bash deploy/configure-cloudflare-tunnel.sh
```

The script:

- verifies RoomGoblin is healthy at `127.0.0.1:${HUB_PORT:-3000}`;
- installs `cloudflared` from Cloudflare's signed Debian/Ubuntu APT repository when missing;
- requires a `cloudflared` release with `--token-file` support;
- prompts for the token without echoing it, or accepts `--token-file PATH`;
- stores the token only at `/etc/cloudflared/roomgoblin.token` with mode `0600`;
- creates `cloudflared-roomgoblin.service` rather than taking ownership of a generic `cloudflared.service`;
- sets `TRUST_PROXY_HOPS=1` in the existing runtime `.env` without storing the tunnel token there;
- force-recreates only the Hub so the trust setting is loaded;
- verifies both RoomGoblin health and the tunnel connector service.

The token must not be committed, copied into `.env`, placed in shell history, written into documentation, or exposed in diagnostic bundles.

For an already installed current `cloudflared`:

```bash
sudo bash deploy/configure-cloudflare-tunnel.sh --skip-install
```

To stage configuration without recreating the Hub immediately:

```bash
sudo bash deploy/configure-cloudflare-tunnel.sh --no-restart
```

`TRUST_PROXY_HOPS=1` does not take effect until the Hub is restarted/recreated.

## Verification

On the appliance:

```bash
curl -fsS http://127.0.0.1:3000/health
systemctl is-active cloudflared-roomgoblin.service
systemctl status cloudflared-roomgoblin.service --no-pager
journalctl -u cloudflared-roomgoblin.service -n 100 --no-pager
```

From an authorized remote client, verify:

1. the Cloudflare hostname uses HTTPS;
2. Cloudflare Access is enforced when configured;
3. RoomGoblin login still occurs;
4. controller navigation and WebSockets remain functional;
5. Full Recovery transport checks accept the HTTPS tunnel path;
6. direct HTTP access from the LAN does **not** become an accepted remote Full Recovery passphrase path;
7. displays, announcements, Background Music, scheduler state and managed-device connectivity are unchanged.

Do not consider the tunnel production-ready until these checks pass on the actual appliance and hostname.

## LAN access

The tunnel does not require removing trusted-LAN access. Keeping `HUB_BIND_ADDRESS=0.0.0.0` allows existing displays, lab agents and trusted administrators to continue using the local service while `cloudflared` connects through loopback.

If a deployment intentionally changes the Hub to `127.0.0.1` only, LAN displays and agents will lose direct access. Treat that as a separate architecture change with migration testing rather than a Cloudflare default.

## Failure behavior

Cloudflare is not part of RoomGoblin's classroom-control availability chain. If the tunnel or Cloudflare edge is unavailable:

- local RoomGoblin operation must continue;
- schedules continue to run;
- Morning Announcements priority/recovery remains unchanged;
- Background Music reconciliation remains unchanged;
- local managed displays and lab integrations remain unchanged;
- only the remote Cloudflare access path is unavailable.

Do not add tunnel health to core RoomGoblin `/health`, installer acceptance, updater acceptance, scheduler readiness, maintenance readiness, or rollback decisions.

## Token rotation

Cloudflare tunnel tokens grant the ability to run a connector for that tunnel. Rotate a token in Cloudflare when required, then rerun:

```bash
sudo bash deploy/configure-cloudflare-tunnel.sh --skip-install
```

The script replaces `/etc/cloudflared/roomgoblin.token` and restarts the dedicated connector service. If a token is suspected compromised, rotate it in Cloudflare first so the previous token can no longer establish new connections.

## Removal / rollback

To remove only the RoomGoblin Cloudflare connector:

```bash
sudo systemctl disable --now cloudflared-roomgoblin.service
sudo rm -f /etc/systemd/system/cloudflared-roomgoblin.service
sudo rm -f /etc/cloudflared/roomgoblin.token
sudo systemctl daemon-reload
```

Then restore the runtime proxy setting if no other reviewed loopback reverse proxy remains:

```bash
cd /opt/classroom-hub
sudo sed -i 's/^TRUST_PROXY_HOPS=.*/TRUST_PROXY_HOPS=0/' .env
sudo docker compose up -d --force-recreate classroom-hub
```

Removing the connector does not require uninstalling the `cloudflared` package. Remove the Cloudflare tunnel/DNS/Access configuration separately in Cloudflare when it is no longer needed.

## Upgrades

RoomGoblin source updates must preserve the runtime `.env` and therefore the explicit `TRUST_PROXY_HOPS=1` value. The tunnel token and systemd unit are host state outside the Git checkout and must not be overwritten by application updates.

Cloudflare connector upgrades are independent of RoomGoblin releases. Update `cloudflared` with the operating-system package manager and verify `cloudflared-roomgoblin.service` afterward.

## References

- Cloudflare Tunnel get started: <https://developers.cloudflare.com/tunnel/get-started/>
- Tunnel tokens: <https://developers.cloudflare.com/tunnel/reference/tunnel-tokens/>
- Tunnel run parameters / `--token-file`: <https://developers.cloudflare.com/tunnel/reference/run-parameters/>
- Cloudflare Tunnel configuration: <https://developers.cloudflare.com/tunnel/configuration/>
