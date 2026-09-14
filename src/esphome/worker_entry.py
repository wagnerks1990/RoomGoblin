"""RoomGoblin ESPHome worker entry point.

Extends the locked native worker with support for ESPHome nodes whose API is
intentionally configured without Noise encryption. Encrypted nodes still require
the exact 32-byte key; an unknown key is never guessed, replaced, or bypassed.
"""
import asyncio
import base64
from contextlib import suppress

from aioesphomeapi import APIClient

import worker as core


def valid_target(config):
    # Preserve the worker's private-address/port boundary while allowing an empty
    # key to mean the device's native API is intentionally unencrypted.
    address = dict(config)
    key = address.get("key", "")
    address["key"] = "A" * 43 + "="
    core.valid_target(address)
    if key:
        if len(key) != 44 or len(base64.b64decode(key, validate=True)) != 32:
            raise ValueError("encryption-key-required")
    return config


def client(self, config):
    valid_target(config)
    return APIClient(
        config["address"],
        config["port"],
        noise_psk=config.get("key") or None,
        client_info="RoomGoblin",
        keepalive=10,
        provide_time=False,
        expected_mac=config.get("mac", "").replace(":", "") or None,
    )


core.valid_target = valid_target
core.Worker.client = client


if __name__ == "__main__":
    with suppress(KeyboardInterrupt, BrokenPipeError):
        asyncio.run(core.main())
