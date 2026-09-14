"""Executable native worker tests using the real, pinned API model definitions."""
import asyncio
import base64
import inspect
import json
from pathlib import Path
import subprocess
import sys
import unittest

from aioesphomeapi import APIClient
from aioesphomeapi.model import (APIVersion, DeviceInfo, EntityCategory, LightInfo,
                                NumberInfo, SelectInfo, SwitchInfo, SwitchState, ButtonInfo)
from src.esphome.worker import Worker, command_args, entity_view, safe_error, valid_target

ROOT = Path(__file__).resolve().parents[1]
KEY = base64.b64encode(bytes(range(32))).decode()
MAC = "02:00:00:00:00:01"


def config(identifier="fixture"):
    return {"id": identifier, "generation": "fixture-generation", "address": "10.200.0.8",
            "port": 6053, "key": KEY, "mac": MAC}


class FakeClient:
    active = 0
    peak = 0
    seen = []
    mismatch = False
    count = 1

    def __init__(self, address, port, **kwargs):
        self.address, self.port, self.kwargs = address, port, kwargs
        self.api_version = APIVersion(1, 15)
        self.callback = None
        self.commands = []
        self.stopped = None
        self.closed = False
        FakeClient.seen.append(self)

    async def connect(self, on_stop=None, login=False, log_errors=True):
        self.stopped = on_stop
        FakeClient.active += 1
        FakeClient.peak = max(FakeClient.active, FakeClient.peak)
        await asyncio.sleep(0.01)
        FakeClient.active -= 1
        assert login
        assert not log_errors

    async def device_info(self):
        return DeviceInfo(name="fixture", mac_address="02:00:00:00:00:02" if FakeClient.mismatch else MAC,
                          esphome_version="fixture-version")

    async def list_entities_services(self):
        return [SwitchInfo(name="Relay", key=42+i, device_id=7) for i in range(FakeClient.count)], []

    def subscribe_states(self, callback):
        self.callback = callback
        callback(SwitchState(key=42, device_id=7, state=False))

    async def disconnect(self, force=False):
        self.closed = True

    def switch_command(self, **kwargs):
        inspect.signature(APIClient.switch_command).bind(self, **kwargs)
        self.commands.append(("switch", kwargs))
        if self.callback:
            self.callback(SwitchState(key=kwargs["key"], device_id=kwargs["device_id"], state=kwargs["state"]))

    def light_command(self, **kwargs):
        inspect.signature(APIClient.light_command).bind(self, **kwargs)
        self.commands.append(("light", kwargs))

    def number_command(self, **kwargs):
        inspect.signature(APIClient.number_command).bind(self, **kwargs)

    def select_command(self, **kwargs):
        inspect.signature(APIClient.select_command).bind(self, **kwargs)

    def button_command(self, **kwargs):
        inspect.signature(APIClient.button_command).bind(self, **kwargs)
        self.commands.append(("button", kwargs))


class ModelTests(unittest.TestCase):
    def test_private_target_and_encryption_required(self):
        self.assertEqual(valid_target(config())["port"], 6053)
        for address in ("127.0.0.1", "169.254.169.254", "example.test", "::1", "192.0.2.1", "224.0.0.1"):
            with self.assertRaises(ValueError):
                valid_target({**config(), "address": address})
        for key in ("", KEY+"\n", "malformed"):
            with self.assertRaises(ValueError):
                valid_target({**config(), "key": key})
        with self.assertRaises(ValueError):
            valid_target({**config(), "port": True})

    def test_model_projection_and_dispatch_validation(self):
        api_version = APIVersion(1, 15)
        entity = entity_view(SwitchInfo(key=42, device_id=7, name="Relay"), api_version)
        self.assertEqual(entity["id"], "7:42")
        self.assertEqual(command_args(entity, {"state": False}), {"state": False})
        for command in ({"state": "OFF"}, {"state": 1}, {"toggle": True}, {"state": True, "service": "restart"}):
            with self.assertRaises(ValueError):
                command_args(entity, command)
        maintenance = entity_view(ButtonInfo(key=1, name="Restart"), api_version)
        self.assertTrue(maintenance["adminOnly"])
        with self.assertRaises(ValueError):
            command_args(maintenance, {"press": True})
        self.assertEqual(command_args(maintenance, {"press": True, "confirm": True}), {})
        disabled = entity_view(SwitchInfo(key=1, disabled_by_default=True), api_version)
        with self.assertRaises(ValueError):
            command_args(disabled, {"state": True})
        diagnostic = entity_view(SwitchInfo(key=1, entity_category=EntityCategory.DIAGNOSTIC), api_version)
        self.assertTrue(diagnostic["adminOnly"])
        number = entity_view(NumberInfo(key=1, min_value=0, max_value=10, step=0.5), api_version)
        self.assertEqual(command_args(number, {"state": 2.5}), {"state": 2.5})
        for value in (0.1, 11, True, "2", float("nan")):
            with self.assertRaises(ValueError):
                command_args(number, {"state": value})
        select = entity_view(SelectInfo(key=1, options=["one", "two"]), api_version)
        with self.assertRaises(ValueError):
            command_args(select, {"state": "other"})
        light = entity_view(LightInfo(key=1, supported_color_modes=[3]), api_version)
        self.assertEqual(command_args(light, {"brightness": 0.4}), {"brightness": 0.4})
        with self.assertRaises(ValueError):
            command_args(light, {"brightness": 4})

    def test_upstream_errors_never_expose_details(self):
        self.assertNotIn(KEY, safe_error(RuntimeError("connection key "+KEY)))
        self.assertEqual(safe_error(ValueError("identity-mismatch")), "identity-mismatch")

    def test_real_worker_ipc_startup_and_eof(self):
        result = subprocess.run([sys.executable, "-u", str(ROOT / "src/esphome/worker.py")],
                                input=json.dumps({"op": "configure", "requestId": "1", "devices": []})+"\n",
                                text=True, capture_output=True, timeout=10, cwd=ROOT)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)["ok"])
        self.assertEqual(result.stderr, "")


class WorkerTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        FakeClient.active = FakeClient.peak = 0
        FakeClient.seen = []
        FakeClient.mismatch = False
        FakeClient.count = 1
        self.events = []
        self.worker = Worker(self.events.append, FakeClient)

    async def asyncTearDown(self):
        await asyncio.gather(*(node.stop() for node in self.worker.nodes.values()))

    async def until(self, condition):
        async with asyncio.timeout(3):
            while not condition():
                await asyncio.sleep(0.01)

    async def test_connection_concurrency_persistent_subscription_and_removal(self):
        await self.worker.configure([config(str(i)) for i in range(20)])
        await self.until(lambda: all(n.online for n in self.worker.nodes.values()))
        self.assertEqual(FakeClient.peak, 6)
        self.assertEqual(len(FakeClient.seen), 20)
        node = self.worker.nodes["0"]
        self.assertFalse(node.states["7:42"]["state"])
        self.assertEqual(node.client.kwargs["expected_mac"], MAC.replace(":", ""))
        self.assertFalse(node.client.kwargs["provide_time"])
        before = node.client
        await self.worker.configure([config(str(i)) for i in range(20)])
        self.assertIs(node.client, before)
        await self.worker.configure([config("0")])
        self.assertEqual(len(self.worker.nodes), 1)
        self.assertTrue(all(c.closed for c in FakeClient.seen[1:]))

    async def test_identity_and_entity_limits_fail_closed(self):
        FakeClient.mismatch = True
        await self.worker.configure([config()])
        node = self.worker.nodes["fixture"]
        await self.until(lambda: node.error == "identity-mismatch")
        self.assertFalse(node.online)
        self.assertFalse(node.entities)
        await self.worker.configure([])
        FakeClient.mismatch = False
        FakeClient.count = 129
        await self.worker.configure([config()])
        node = self.worker.nodes["fixture"]
        await self.until(lambda: node.error == "too-many-entities")
        self.assertFalse(node.online)

    async def test_readback_subdevice_routing_offline_and_no_replay(self):
        await self.worker.configure([config()])
        node = self.worker.nodes["fixture"]
        await self.until(lambda: node.online)
        result = await node.command("7:42", {"state": True})
        self.assertTrue(result["confirmed"])
        self.assertEqual(node.client.commands, [("switch", {"key": 42, "device_id": 7, "state": True})])
        node.client.callback = None
        result = await node.command("7:42", {"state": False})
        self.assertFalse(result["confirmed"])
        self.assertEqual(len(node.client.commands), 2)
        await node.client.stopped(False)
        with self.assertRaises(ValueError):
            await node.command("7:42", {"state": True})

    async def test_button_and_stale_generation_authorization_checked_at_dispatch(self):
        await self.worker.configure([config()])
        node = self.worker.nodes["fixture"]
        await self.until(lambda: node.online)
        node.entities["0:9"] = entity_view(ButtonInfo(key=9, name="Fixture button"), node.client.api_version)
        request = {"op": "command", "requestId": "1", "deviceId": "fixture", "generation": "fixture-generation",
                   "entityId": "0:9", "command": {"press": True, "confirm": True}, "admin": False}
        await self.worker.handle(request)
        self.assertFalse(self.events[-1]["ok"])
        self.assertFalse(node.client.commands)
        await self.worker.handle({**request, "admin": True, "generation": "old"})
        self.assertFalse(self.events[-1]["ok"])
        await self.worker.handle({**request, "admin": True})
        self.assertTrue(self.events[-1]["ok"])
        self.assertFalse(self.events[-1]["confirmed"])
        self.assertEqual(len(node.client.commands), 1)

    async def test_enrollment_probe_is_read_only_and_closes_connection(self):
        result = await self.worker.probe(config())
        self.assertEqual(result["info"]["mac_address"], MAC)
        self.assertTrue(FakeClient.seen[0].closed)
        self.assertFalse(FakeClient.seen[0].commands)
        self.assertEqual(self.worker.probes, 0)

    async def test_pinned_client_constructor_accepts_security_contract(self):
        worker = Worker(self.events.append)
        client = worker.client(config())
        self.assertIsInstance(client, APIClient)
        await client.disconnect(force=True)


if __name__ == "__main__":
    unittest.main()
