"""Bounded, read-only ESPHome mDNS discovery for RoomGoblin.

No credentials are read or emitted. Discovery only reports ESPHome native API
advertisements and private addresses visible from the appliance network namespace.
"""
import asyncio
import ipaddress
import json
import re
from contextlib import suppress

from zeroconf import IPVersion, ServiceStateChange
from zeroconf.asyncio import AsyncServiceBrowser, AsyncServiceInfo, AsyncZeroconf

SERVICE = "_esphomelib._tcp.local."
MAX_RESULTS = 128
RESOLVE_CONCURRENCY = 16
PRIVATE_NETS = tuple(ipaddress.ip_network(n) for n in (
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"
))


def private_address(value):
    try:
        address = ipaddress.ip_address(value.split("%", 1)[0])
    except ValueError:
        return False
    if address.version == 4:
        return any(address in network for network in PRIVATE_NETS)
    return address.is_private and not (address.is_loopback or address.is_link_local)


def decode_properties(properties):
    result = {}
    for raw_key, raw_value in (properties or {}).items():
        key = raw_key.decode("utf-8", "ignore") if isinstance(raw_key, bytes) else str(raw_key)
        value = raw_value.decode("utf-8", "ignore") if isinstance(raw_value, bytes) else str(raw_value or "")
        if key in {"version", "mac", "platform", "board", "network", "api_encryption"}:
            result[key] = value[:160]
    return result


def clean_instance(name):
    suffix = "." + SERVICE
    value = name[:-len(suffix)] if name.endswith(suffix) else name
    return value[:100]


async def scan(window=2.5):
    zeroconf = AsyncZeroconf(ip_version=IPVersion.All)
    names = set()

    def changed(_zc, _type, name, state):
        if state in (ServiceStateChange.Added, ServiceStateChange.Updated) and len(names) < MAX_RESULTS * 2:
            names.add(name)

    browser = AsyncServiceBrowser(zeroconf.zeroconf, [SERVICE], handlers=[changed])
    try:
        await asyncio.sleep(window)
        semaphore = asyncio.Semaphore(RESOLVE_CONCURRENCY)

        async def resolve(name):
            async with semaphore:
                info = AsyncServiceInfo(SERVICE, name)
                try:
                    if not await info.async_request(zeroconf.zeroconf, 900):
                        return None
                    addresses = [item for item in info.parsed_addresses(IPVersion.All) if private_address(item)]
                    if not addresses:
                        return None
                    props = decode_properties(info.properties)
                    mac = props.get("mac", "").lower().replace("-", ":")
                    if mac and not re.fullmatch(r"(?:[0-9a-f]{2}:){5}[0-9a-f]{2}", mac):
                        mac = ""
                    return {
                        "name": clean_instance(name),
                        "host": str(info.server or "").rstrip(".")[:253],
                        "addresses": addresses[:8],
                        "port": int(info.port or 6053),
                        "mac": mac,
                        "version": props.get("version", ""),
                        "platform": props.get("platform", ""),
                        "board": props.get("board", ""),
                        "apiEncryption": props.get("api_encryption", ""),
                    }
                except Exception:
                    return None

        resolved = await asyncio.gather(*(resolve(name) for name in sorted(names)[:MAX_RESULTS]))
        return [item for item in resolved if item is not None]
    finally:
        with suppress(Exception):
            await browser.async_cancel()
        await zeroconf.async_close()


async def main():
    results = await scan()
    print(json.dumps({"ok": True, "devices": results}, separators=(",", ":")))


if __name__ == "__main__":
    asyncio.run(main())
