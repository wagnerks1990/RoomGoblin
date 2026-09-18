# Auxiliary Host Tools

## Purpose

This page records host-level utility services that may coexist on a RoomGoblin appliance but are **not part of the core RoomGoblin application stack**.

These services are informational inventory only. RoomGoblin health, update, rollback, backup, and recovery logic must not assume they are present unless they are deliberately promoted into a reviewed first-class integration later.

## Current host inventory

As of 2026-09-18, the RoomGoblin host at the live-test site also runs the following auxiliary download tools:

| Service | Runtime | Port | Bind / exposure | Persistent path | Notes |
| --- | --- | ---: | --- | --- | --- |
| qBittorrent-nox | native systemd service | TCP 8080 WebUI | LAN listener | `/var/lib/qbittorrent`, `/srv/torrents` | Fresh local configuration; not copied from L127 |
| qBittorrent BitTorrent listener | native qBittorrent process | dynamic unless explicitly pinned | LAN/WAN according to host/network policy | `/srv/torrents` | Do not assume historical L127 port 54620 unless explicitly configured |
| MeTube | Docker container `metube` using `ghcr.io/alexta69/metube:latest` | TCP 8081 | `0.0.0.0:8081` and IPv6 equivalent | `/opt/services/metube/downloads` | Fresh RoomGoblin-host deployment; direct port access, no Caddy prefix |
| Torrent file browser | native Python/Flask systemd service `torrent-files.service` | TCP 8090 | `0.0.0.0:8090` | Reads `/srv/torrents/downloads` | Lightweight browser/download UI; currently uses Flask development server |

Direct LAN URLs:

```text
RoomGoblin controller:  http://APPLIANCE-IP:3000
qBittorrent WebUI:      http://APPLIANCE-IP:8080
MeTube:                 http://APPLIANCE-IP:8081
Torrent file browser:   http://APPLIANCE-IP:8090
```

## Storage layout

```text
/opt/services/metube/
├── compose.yml
└── downloads/

/opt/services/torrent-files/
└── app.py

/var/lib/qbittorrent/

/srv/torrents/
├── downloads/
└── incomplete/
```

The RoomGoblin repository itself remains in `/opt/classroom-hub`.

## Service ownership and management boundaries

These tools are currently external/host auxiliary services:

- they are not declared in the core RoomGoblin `docker-compose.yml`;
- they are not required for `/health` readiness;
- RoomGoblin production updates must not stop, recreate, delete, or prune them as an incidental side effect;
- RoomGoblin Full Recovery must not claim they are included unless support is explicitly implemented and documented;
- the Host Agent managed-container allowlist must not be expanded merely because these processes exist on the host;
- failures in these tools must not mark the core RoomGoblin application unhealthy.

The existing RoomGoblin managed-service root remains `/opt/services`, but directory placement alone does not make an auxiliary service first-class RoomGoblin-managed state.

## Network notes

The RoomGoblin appliance remains direct HTTP on port `3000`; Caddy is not required for these auxiliary services.

MeTube is intentionally served directly on port `8081`. The older L127 deployment used a Caddy `/metube/` prefix; that prefix is not used on RoomGoblin.

qBittorrent's WebUI uses port `8080`. Its peer-listening port should be treated as runtime configuration and discovered from qBittorrent rather than assumed to be `54620`.

The torrent file browser listens on `8090`.

## Terminal remains on L127

The custom L127 student terminal remains on the separate L127 host. It was **not migrated** to RoomGoblin.

Its historical components include:

- ttyd on port `7681`;
- a dedicated `student` account;
- custom L127 web assets;
- Caddy path routing on the L127 appliance.

Do not infer that port `7681`, ttyd, or the L127 student console is a RoomGoblin service from the presence of the `ttyd` package or an unused preparation directory on the RoomGoblin host.

## Operational checks

Useful host-level checks:

```bash
systemctl status qbittorrent.service --no-pager -l
systemctl status torrent-files.service --no-pager -l
docker ps --filter name=metube
ss -lntup | grep -E ':(8080|8081|8090)([^0-9]|$)'
curl -fsS http://127.0.0.1:3000/health
```

A healthy auxiliary-tool deployment does not change the core RoomGoblin acceptance criteria.
