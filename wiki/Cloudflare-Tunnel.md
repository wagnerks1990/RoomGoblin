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

## Credential choice

Use a scoped API Token whenever possible. Global API Key + account email is a broader legacy alternative.

Full provisioning needs Zone Read, DNS Write, Zone Settings Edit/Write, and Tunnel/Cloudflare One Connectors Write. Add Access Apps and Policies Write only when Access is enabled.

The API credential is encrypted in RoomGoblin's secret store and is never returned to the browser.

## Safety

The tunnel origin is loopback only:

```text
http://127.0.0.1:3000
```

Port 3000 is the default; RoomGoblin follows the configured `HUB_PORT`. Never publish maintenance 3010, Host Agent, Docker, SSH, Veyon, MQTT, Music Assistant, or arbitrary lab services.

A same-name existing tunnel is not adopted automatically because adoption replaces its ingress rules. Conflicting DNS is not replaced automatically either. Both require explicit administrator choices.

Cloudflare Access cannot be enabled without an explicit allowed email domain.

The safe preset deliberately avoids Bot Fight Mode, authenticated-page caching, HSTS, and private-network/WARP routing.

## Connector secret

The browser never receives the tunnel connector token. RoomGoblin retrieves it server-side and sends it through the authenticated local maintenance/Host Agent path. The durable token is stored only at:

```text
/etc/cloudflared/roomgoblin.token
```

with mode `0600`.

The GUI installs the connector without restarting the requesting Hub and then offers a separate **Restart RoomGoblin** action so `TRUST_PROXY_HOPS=1` can take effect cleanly.

## Availability

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
