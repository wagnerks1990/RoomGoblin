"""RoomGoblin ESPHome worker entry point.

The native worker itself supports both encrypted ESPHome native API connections
and intentionally unencrypted native API connections. This entry point remains
as the stable process boundary used by the Node manager.
"""
import asyncio
from contextlib import suppress

import worker as core


if __name__ == "__main__":
    with suppress(KeyboardInterrupt, BrokenPipeError):
        asyncio.run(core.main())
