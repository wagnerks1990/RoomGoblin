# Auxiliary Host Tools

The RoomGoblin host may also run local utility services that are not part of the core RoomGoblin stack.

Current auxiliary download tools documented on the live-test host:

| Tool | Port | State location |
| --- | ---: | --- |
| qBittorrent WebUI | 8080 | `/var/lib/qbittorrent`, `/srv/torrents` |
| MeTube | 8081 | `/opt/services/metube/downloads` |
| Torrent file browser | 8090 | reads `/srv/torrents/downloads` |

These are direct-port services. They do not require Caddy and are not dependencies of RoomGoblin port `3000`.

MeTube runs as Docker container `metube` from `ghcr.io/alexta69/metube:latest`. qBittorrent and the torrent file browser run as native systemd services.

These tools are informational host inventory only. Their failure must not fail RoomGoblin health, updates, rollback, or recovery.

The custom student terminal remains on the separate L127 host and was not migrated to RoomGoblin.

See `docs/AUXILIARY-HOST-TOOLS.md` for the detailed operational boundary and paths.
