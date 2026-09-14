"""Unprivileged ESPHome native API worker. Private JSON-lines IPC, never HTTP.

Credentials arrive over stdin, not argv/environment. No firmware, HA actions,
user services, logs, camera streams, or arbitrary method execution are exposed.
"""
import asyncio
import base64
import ipaddress
import json
import logging
import math
import random
import re
import resource
import sys
import time
from contextlib import suppress

from aioesphomeapi import APIClient

MAX_DEVICES = 64
MAX_ENTITIES = 128
MAX_LINE = 1024 * 1024
DOMAINS = {"SensorInfo": "sensor", "BinarySensorInfo": "binary_sensor",
           "TextSensorInfo": "text_sensor", "SwitchInfo": "switch",
           "LightInfo": "light", "NumberInfo": "number", "SelectInfo": "select",
           "ButtonInfo": "button"}
PRIVATE_NETS = tuple(ipaddress.ip_network(n) for n in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"))


def valid_target(config):
    """Require literal RFC1918 IPv4: no DNS rebinding, URLs or local endpoints."""
    ip = ipaddress.ip_address(config["address"])
    if not any(ip in n for n in PRIVATE_NETS):
        raise ValueError("private-address-required")
    port = config.get("port", 6053)
    if type(port) is not int or not 1 <= port <= 65535:
        raise ValueError("invalid-port")
    key = config.get("key", "")
    if key != "":
        if len(key) != 44 or len(base64.b64decode(key, validate=True)) != 32:
            raise ValueError("invalid-encryption-key")
    return config


def text(value, limit=160):
    return str(value or "")[:limit]


def scalar(value):
    if isinstance(value, str):
        return value[:512]
    if isinstance(value, (bool, int)) or value is None:
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    return None


def entity_id(entity):
    return f"{entity.device_id}:{entity.key}"


def info_view(info):
    result = {k: text(getattr(info, k, "")) for k in
              ("name", "friendly_name", "mac_address", "model", "manufacturer", "esphome_version")}
    result["mac_address"] = result["mac_address"].lower()
    if not re.fullmatch(r"(?:[0-9a-f]{2}:){5}[0-9a-f]{2}", result["mac_address"]):
        raise ValueError("invalid-device-identity")
    return result


def entity_view(entity, api_version):
    domain = DOMAINS.get(type(entity).__name__, "unsupported")
    category = int(entity.entity_category) if entity.entity_category is not None else -1
    disabled = bool(entity.disabled_by_default)
    result = {"id": entity_id(entity), "key": entity.key, "deviceId": entity.device_id,
              "name": text(entity.name or entity.object_id), "domain": domain,
              "category": category, "disabledByDefault": disabled,
              "writable": domain in ("switch", "light", "number", "select", "button") and not disabled,
              "adminOnly": category != 0 or domain == "button",
              "unit": text(getattr(entity, "unit_of_measurement", ""), 32)}
    if domain == "number":
        result.update(min=scalar(entity.min_value), max=scalar(entity.max_value), step=scalar(entity.step))
    elif domain == "select":
        # Reject unbounded/oversized option sets rather than changing command values.
        options = entity.options
        result["options"] = options if len(options) <= 64 and all(len(s) <= 160 for s in options) else []
        result["writable"] = result["writable"] and bool(result["options"])
    elif domain == "light":
        result["brightness"] = any(int(mode) & 2 for mode in entity.supported_color_modes_compat(api_version))
    return result


def command_args(entity, command):
    """Validate again at the dispatch boundary; never call arbitrary client methods."""
    if not entity["writable"]:
        raise ValueError("read-only-entity")
    if entity["adminOnly"] and command.get("confirm") is not True:
        raise ValueError("confirmation-required")
    domain = entity["domain"]
    supplied = set(command) - {"confirm"}
    if domain == "button":
        if supplied != {"press"} or command["press"] is not True:
            raise ValueError("invalid-command")
        return {}
    if domain in ("switch", "light"):
        allowed = {"state"} | ({"brightness"} if domain == "light" and entity.get("brightness") else set())
        if not supplied or not supplied <= allowed:
            raise ValueError("invalid-command")
        result = {}
        if "state" in command:
            if type(command["state"]) is not bool:
                raise ValueError("invalid-state")
            result["state"] = command["state"]
        if "brightness" in command:
            value = command["brightness"]
            if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 1:
                raise ValueError("invalid-brightness")
            result["brightness"] = value
        return result
    if supplied != {"state"}:
        raise ValueError("invalid-command")
    value = command["state"]
    if domain == "select":
        if type(value) is not str or value not in entity["options"]:
            raise ValueError("invalid-option")
    elif domain == "number":
        lo, hi, step = entity["min"], entity["max"], entity["step"]
        if any(type(v) not in (int, float) or not math.isfinite(v) for v in (value, lo, hi, step)):
            raise ValueError("invalid-number")
        if step <= 0 or not lo <= value <= hi or abs((value-lo)/step - round((value-lo)/step)) > 0.001:
            raise ValueError("out-of-range-number")
    else:
        raise ValueError("read-only-entity")
    return {"state": value}


def safe_error(error):
    # Never forward upstream exception strings: some include connection material.
    if isinstance(error, ValueError) and str(error) in {
        "identity-mismatch", "invalid-device-identity", "too-many-entities", "read-only-entity",
        "confirmation-required", "invalid-command", "invalid-state", "invalid-brightness",
        "invalid-option", "invalid-number", "out-of-range-number"}:
        return str(error)
    name = type(error).__name__.lower()
    if "encryption" in name or "handshake" in name or "key" in name:
        return "encryption-failed"
    return "connection-unavailable"


class Node:
    def __init__(self, owner, config):
        self.owner, self.config = owner, config
        self.client = None
        self.online = False
        self.error = "connecting"
        self.info = {}
        self.entities = {}
        self.states = {}
        self.versions = {}
        self.dirty = True
        self.busy = False
        self.task = asyncio.create_task(self.run())

    def view(self):
        return {"id": self.config["id"], "generation": self.config["generation"], "online": self.online, "error": self.error,
                "info": self.info, "entities": list(self.entities.values()), "states": self.states}

    def state(self, state):
        key = entity_id(state)
        if key not in self.entities:
            return
        self.states[key] = {field: scalar(getattr(state, field)) for field in
                            ("state", "brightness", "missing_state") if hasattr(state, field)}
        self.states[key]["updatedAt"] = int(time.time() * 1000)
        self.versions[key] = self.versions.get(key, 0) + 1
        self.dirty = True

    async def run(self):
        attempt = 0
        while True:
            lost = asyncio.Event()
            async def stopped(_expected):
                self.online = False
                self.error = "disconnected"
                self.dirty = True
                lost.set()
            try:
                async with self.owner.connections:
                    self.client = self.owner.client(self.config)
                    async with asyncio.timeout(15):
                        await self.client.connect(on_stop=stopped, login=True, log_errors=False)
                        self.info = info_view(await self.client.device_info())
                        if self.info["mac_address"] != self.config["mac"]:
                            raise ValueError("identity-mismatch")
                        entities, _services = await self.client.list_entities_services()
                        if len(entities) > MAX_ENTITIES:
                            raise ValueError("too-many-entities")
                        self.entities = {entity_id(e): entity_view(e, self.client.api_version) for e in entities}
                        self.states = {}
                        self.versions = {}
                        self.client.subscribe_states(self.state)
                        if lost.is_set():
                            raise ConnectionError()
                        self.online = True
                        self.error = ""
                        self.dirty = True
                began = time.monotonic()
                await lost.wait()
                if time.monotonic() - began > 60:
                    attempt = 0
            except asyncio.CancelledError:
                raise
            except Exception as error:
                self.error = safe_error(error)
            finally:
                self.online = False
                self.dirty = True
                if self.client:
                    with suppress(Exception):
                        async with asyncio.timeout(3):
                            await self.client.disconnect(force=True)
                    self.client = None
            attempt = min(attempt + 1, 6)
            await asyncio.sleep(min(60, 2 ** attempt) + random.random())

    async def stop(self):
        self.task.cancel()
        with suppress(asyncio.CancelledError):
            await self.task

    async def command(self, key, command):
        if not self.online or not self.client:
            raise ValueError("offline")
        if self.busy:
            raise ValueError("busy")
        entity = self.entities.get(key)
        if not entity:
            raise ValueError("unknown-entity")
        args = command_args(entity, command)
        self.busy = True
        version = self.versions.get(key, 0)
        try:
            client = self.client
            handlers = {"switch": client.switch_command, "light": client.light_command,
                        "number": client.number_command, "select": client.select_command,
                        "button": client.button_command}
            handlers[entity["domain"]](key=entity["key"], device_id=entity["deviceId"], **args)
            # A socket write is not physical confirmation. One-shot buttons cannot
            # be confirmed through a state subscription and are never retried.
            if entity["domain"] == "button":
                return {"status": "sent-unconfirmed", "confirmed": False}
            deadline = time.monotonic() + 2
            while self.online and self.client is client and time.monotonic() < deadline:
                state = self.states.get(key, {})
                def matches(k, value):
                    observed = state.get(k)
                    if type(value) in (int, float):
                        return type(observed) in (int, float) and abs(observed-value) <= 0.005
                    return observed == value
                if self.versions.get(key, 0) > version and not state.get("missing_state") and all(matches(k, v) for k, v in args.items()):
                    return {"status": "state-confirmed", "confirmed": True}
                await asyncio.sleep(0.05)
            return {"status": "sent-unconfirmed", "confirmed": False}
        finally:
            self.busy = False


class Worker:
    def __init__(self, emit, client_factory=APIClient):
        self.emit = emit
        self.client_factory = client_factory
        self.nodes = {}
        self.connections = asyncio.Semaphore(6)
        self.probes = 0

    def client(self, config):
        valid_target(config)
        return self.client_factory(config["address"], config["port"], noise_psk=config["key"] or None,
                                   client_info="RoomGoblin", keepalive=10, provide_time=False,
                                   expected_mac=config.get("mac", "").replace(":", "") or None)

    async def configure(self, records):
        if not isinstance(records, list) or len(records) > MAX_DEVICES:
            raise ValueError("invalid-config")
        for config in records:
            valid_target(config)
        wanted = {config["id"]: config for config in records}
        for key, node in list(self.nodes.items()):
            if wanted.get(key) != node.config:
                await node.stop()
                del self.nodes[key]
        for key, config in wanted.items():
            if key not in self.nodes:
                self.nodes[key] = Node(self, config)
        return {}

    async def probe(self, config):
        if self.probes >= 4:
            raise ValueError("busy")
        self.probes += 1
        client = None
        try:
            async with self.connections:
                client = self.client(config)
                async with asyncio.timeout(15):
                    await client.connect(login=True, log_errors=False)
                    return {"info": info_view(await client.device_info())}
        finally:
            if client:
                with suppress(Exception):
                    async with asyncio.timeout(3):
                        await client.disconnect(force=True)
            self.probes -= 1

    async def handle(self, request):
        try:
            op = request.get("op")
            if op == "configure":
                value = await self.configure(request["devices"])
            elif op == "probe":
                value = await self.probe(request["device"])
            elif op == "command":
                node = self.nodes.get(request.get("deviceId"))
                if not node:
                    raise ValueError("offline")
                if node.config["generation"] != request.get("generation"):
                    raise ValueError("identity-mismatch")
                entity = node.entities.get(request["entityId"])
                if entity and entity["adminOnly"] and request.get("admin") is not True:
                    raise ValueError("confirmation-required")
                value = await node.command(request["entityId"], request["command"])
            else:
                raise ValueError("unsupported-operation")
            self.emit({"requestId": request.get("requestId"), "ok": True, **value})
        except Exception as error:
            self.emit({"requestId": request.get("requestId"), "ok": False, "error": safe_error(error)})

    async def snapshots(self):
        while True:
            for node in self.nodes.values():
                if node.dirty:
                    self.emit({"event": "device", "device": node.view()})
                    node.dirty = False
            await asyncio.sleep(1)
            self.emit({"event": "heartbeat"})


async def main():
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    logging.disable(logging.CRITICAL)  # IPC only; never leak upstream exception text.
    def emit(value):
        line = json.dumps(value, allow_nan=False, separators=(",", ":"))
        if len(line.encode()) > MAX_LINE:
            raise ValueError("IPC response too large")
        print(line, flush=True)
    worker = Worker(emit)
    reader = asyncio.StreamReader(limit=MAX_LINE)
    protocol = asyncio.StreamReaderProtocol(reader)
    await asyncio.get_running_loop().connect_read_pipe(lambda: protocol, sys.stdin)
    snapshots = asyncio.create_task(worker.snapshots())
    pending = set()
    try:
        while line := await reader.readline():
            if len(pending) >= 72:
                raise ValueError("IPC request limit")
            request = json.loads(line)
            # Serialize registry changes; commands/probes remain bounded concurrent.
            if request.get("op") == "configure":
                await worker.handle(request)
            else:
                task = asyncio.create_task(worker.handle(request))
                pending.add(task)
                task.add_done_callback(pending.discard)
    finally:
        snapshots.cancel()
        for task in pending:
            task.cancel()
        await asyncio.gather(*(node.stop() for node in worker.nodes.values()), return_exceptions=True)
        await asyncio.gather(*pending, snapshots, return_exceptions=True)


if __name__ == "__main__":
    with suppress(KeyboardInterrupt, BrokenPipeError):
        asyncio.run(main())
