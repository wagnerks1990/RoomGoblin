# Cloudflare Tunnel

RoomGoblin supports an optional remotely-managed Cloudflare Tunnel for HTTPS remote administration without opening an inbound firewall port to the appliance.

## Supported topology

```text
Remote administrator
  -> HTTPS / Cloudflare edge
  -> optional Cloudflare Access
  -> cloudflared-roomgoblin.service on the RoomGoblin host
  -> http://127.0.0.1:3000
  -> RoomGoblin Hub
```

Use a dedicated Cloudflare tunnel and configure its public hostname to send traffic only to:

```text
http://127.0.0.1:3000
```

Do not publish maintenance (`3010`), the Host Agent, Docker, MQTT, Veyon, Music Assistant, SSH, or other appliance-local services.

## Install

After creating the remotely-managed tunnel in Cloudflare and obtaining its tunnel token:

```bash
cd /opt/classroom-hub
sudo bash deploy/configure-cloudflare-tunnel.sh
```

The installer keeps the token outside Git and `.env`, stores it at `/etc/cloudflared/roomgoblin.token` with mode `0600`, creates the dedicated `cloudflared-roomgoblin.service`, sets `TRUST_PROXY_HOPS=1`, and verifies the Hub and connector.

Cloudflare Access is recommended as an additional remote gate. RoomGoblin authentication and capability checks remain required.

## Security model

RoomGoblin accepts Full Recovery passphrases through forwarded HTTPS only when the immediate peer is loopback. Since `cloudflared` runs on the same host and connects to `127.0.0.1:3000`, the Cloudflare path fits the existing transport-policy model. A direct LAN client cannot make itself trusted by supplying `X-Forwarded-Proto` because its immediate peer is not loopback.

Keep the tunnel token out of shell history, logs, support bundles, `.env`, Git and documentation. Rotate the token in Cloudflare if it may have been exposed.

## Availability

Cloudflare is deliberately outside the classroom-control availability chain. A tunnel outage must not stop local schedules, Morning Announcements, Background Music, managed displays, maintenance, updates, or other local integrations.

Existing LAN access can remain enabled with `HUB_BIND_ADDRESS=0.0.0.0`; the tunnel itself still connects through loopback.

## Verify

```bash
curl -fsS http://127.0.0.1:3000/health
systemctl is-active cloudflared-roomgoblin.service
systemctl status cloudflared-roomgoblin.service --no-pager
journalctl -u cloudflared-roomgoblin.service -n 100 --no-pager
```

Then verify the remote hostname uses HTTPS, Access is enforced if configured, RoomGoblin login still applies, WebSockets work, and Full Recovery is accepted only through the secure tunnel/loopback path rather than direct remote HTTP.

For architecture, token rotation and rollback details, see `docs/CLOUDFLARE-TUNNEL.md` in the Git repository.
