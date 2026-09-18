# AI Context: Auxiliary Host Tools

RoomGoblin hosts may contain auxiliary utilities outside the first-class application/integration contract.

Current documented auxiliary services:

- qBittorrent WebUI: TCP `8080`; native `qbittorrent.service`; state under `/var/lib/qbittorrent` and `/srv/torrents`.
- MeTube: TCP `8081`; Docker container `metube`; image `ghcr.io/alexta69/metube:latest`; persistent downloads under `/opt/services/metube/downloads`.
- Torrent file browser: TCP `8090`; native `torrent-files.service`; source under `/opt/services/torrent-files`; reads `/srv/torrents/downloads`.

Important invariants:

1. These are not core RoomGoblin Compose services.
2. They are not required for RoomGoblin `/health`.
3. Do not silently add them to Host Agent managed-container/image allowlists, recovery archives, update reconciliation, or release gates.
4. Directory placement beneath `/opt/services` does not by itself make a service RoomGoblin-owned.
5. The appliance remains direct HTTP on port `3000`; these tools use direct ports and do not require Caddy.
6. Do not assume qBittorrent peer port `54620`; discover its current runtime configuration.
7. The L127 ttyd/student terminal was intentionally left on L127 and is not part of the RoomGoblin host migration.

Primary reference: `docs/AUXILIARY-HOST-TOOLS.md`.
