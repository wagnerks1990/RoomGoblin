"""Exercise cold snapshot rollback with real SQLite and a fake Docker boundary."""
import importlib.util
import ast
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import urllib.parse

SPEC = importlib.util.spec_from_file_location("music_updates", Path(__file__).resolve().parents[1] / "host-agent/music_updates.py")
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)
IMAGE = module.IMAGE


class HostMusicUpdatesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.deployment = self.root / "deployment"
        self.data = self.deployment / "data"
        self.data.mkdir(parents=True)
        self.compose = self.deployment / "docker-compose.yml"
        self.compose.write_text("services:\n  music:\n    image: " + IMAGE + ":2.10.8\n    network_mode: host\n")
        with sqlite3.connect(self.data / "library.db") as db:
            db.execute("CREATE TABLE saved (name TEXT)")
            db.execute("INSERT INTO saved VALUES ('original')")
        (self.data / "queue.json").write_text('["preserved-item"]')
        self.item = {"Id": "container-1", "Image": "sha256:old", "State": {"Running": True},
            "Config": {"Image": IMAGE + ":2.10.8", "Env": ["PYTHONPATH=/data/.roomgoblin-compat"], "Entrypoint": ["/bin/sh"], "Cmd": ["/data/.roomgoblin-compat/wait-for-lan.sh"],
              "Labels": {"com.docker.compose.project.working_dir": str(self.deployment), "com.docker.compose.project.config_files": str(self.compose), "com.docker.compose.project": "music", "com.docker.compose.service": "music"}},
            "Mounts": [{"Type": "bind", "Source": str(self.data), "Destination": "/data", "RW": True}], "HostConfig": {"NetworkMode": "host"}}
        self.commands = []
        def run(args, timeout, check):
            self.commands.append(args)
            output = ""
            if args[:2] == ["docker", "inspect"]:
                output = json.dumps([self.item])
            elif args[:3] == ["docker", "image", "inspect"]:
                output = json.dumps([{"Id": "sha256:new", "RepoDigests": [IMAGE + "@sha256:" + "a" * 64]}])
            elif args[:2] == ["docker", "stop"]:
                self.item["State"]["Running"] = False
            elif args[:2] == ["docker", "start"]:
                self.item["State"]["Running"] = True
            elif args[:2] == ["docker", "compose"] and "up" in args:
                self.item["State"]["Running"] = True
                if ":2.10.9" in self.compose.read_text():
                    self.item["Image"] = "sha256:new"
                    with sqlite3.connect(self.data / "library.db") as db:
                        db.execute("UPDATE saved SET name='migrated'")
                    (self.data / "new-schema.json").write_text("new")
                else:
                    self.item["Image"] = "sha256:old"
            return SimpleNamespace(returncode=0, stdout=output)
        self.core = SimpleNamespace(run=run, APPLIANCE_MUTATION_LOCK=self.root / "lock")
        self.manager = module.MusicUpdates(self.core, self.root / "journal")
        self.allowed = patch.object(module, "ROOTS", (self.deployment,))
        self.allowed.start()
        self.addCleanup(self.allowed.stop)

    def job(self):
        job = {**self.manager.inspect(), "id": "123", "version": "2.10.9", "previousVersion": "2.10.8", "startedAt": 1}
        self.manager.save(job, "preparing")
        return job

    def execute(self, healthy):
        self.manager.healthy = healthy
        with patch.object(module, "release", return_value={"version": "2.10.9"}):
            self.manager.execute(self.job(), SimpleNamespace(close=lambda: None))

    def test_failed_upgrade_restores_old_database_and_exact_compose(self):
        original = self.compose.read_bytes()
        def healthy(version, image_id):
            if version == "2.10.9":
                raise RuntimeError("injected unhealthy image")
            self.assertEqual(image_id, "sha256:old")
        self.execute(healthy)
        self.assertEqual(self.manager.read()["stage"], "rolled-back")
        self.assertEqual(self.compose.read_bytes(), original)
        with sqlite3.connect(self.data / "library.db") as db:
            self.assertEqual(db.execute("SELECT name FROM saved").fetchone()[0], "original")
        self.assertFalse((self.data / "new-schema.json").exists())
        self.assertEqual(json.loads((self.data / "queue.json").read_text()), ["preserved-item"])
        self.assertTrue((self.deployment / "data.roomgoblin-failed-123/new-schema.json").exists())

    def test_success_pins_digest_and_retains_cold_snapshot(self):
        self.execute(lambda *_: None)
        self.assertEqual(self.manager.read()["stage"], "succeeded")
        self.assertIn(IMAGE + ":2.10.9@sha256:" + "a" * 64, self.compose.read_text())
        with sqlite3.connect(self.manager.root / "123/data/library.db") as db:
            self.assertEqual(db.execute("SELECT name FROM saved").fetchone()[0], "original")

    def test_restart_recovers_interruption_after_new_schema_without_downgrade_in_place(self):
        self.execute(lambda *_: None)
        job = self.manager.read()
        self.manager.save(job, "verifying")
        self.manager.healthy = lambda *_: None
        self.manager.startup_recover()
        self.assertEqual(self.manager.read()["stage"], "rolled-back")
        self.assertFalse((self.data / "new-schema.json").exists())

    def test_preflight_failure_does_not_stop_service(self):
        with patch.object(module, "release", side_effect=RuntimeError("unreachable")):
            self.manager.execute(self.job(), SimpleNamespace(close=lambda: None))
        self.assertEqual(self.manager.read()["stage"], "failed")
        self.assertFalse(any(command[:2] == ["docker", "stop"] for command in self.commands))

    def test_foreign_mount_image_network_and_lan_gate_fail_closed(self):
        for key, value in [("Image", "other/image:2.10.8"), ("Entrypoint", ["other"]), ("Env", [])]:
            original = self.item["Config"][key]
            self.item["Config"][key] = value
            with self.assertRaises(RuntimeError):
                self.manager.inspect()
            self.item["Config"][key] = original
        self.item["Mounts"][0]["Source"] = "/other/data"
        with self.assertRaises(RuntimeError):
            self.manager.inspect()

    def test_image_edit_rejects_ambiguous_and_interpolated_yaml(self):
        for source in ["image: ${IMAGE}", "image: " + IMAGE + ":2.10.8\nimage: " + IMAGE + ":2.10.8"]:
            with self.assertRaises(RuntimeError):
                module.replace_image(source, IMAGE + ":2.10.8", IMAGE + ":2.10.9")

    def test_recovery_does_not_restart_healthy_or_intentionally_stopped_service(self):
        for running in (True, False):
            self.item["State"]["Running"] = running
            job = {"id": "recovery", "operation": "recover", "startedAt": 1}
            self.manager.save(job, "recovering")
            with patch.object(module, "public_json", return_value={"server_version": "2.10.8"}):
                self.manager.execute_recovery(job, SimpleNamespace(close=lambda: None))
        self.assertFalse(any(command[:2] == ["docker", "restart"] for command in self.commands))

    def test_interrupted_service_restart_is_not_replayed(self):
        self.manager.save({"id": "recovery", "operation": "recover", "startedAt": 1}, "recovering")
        self.manager.startup_recover()
        self.assertEqual(self.manager.read()["stage"], "failed")
        self.assertEqual(self.commands, [])

    def test_native_recovery_budget_survives_process_restart(self):
        module.atomic_json(self.manager.root / "recovery.json", {"attempts": [int(module.time.time())]})
        with self.assertRaisesRegex(RuntimeError, "cooling down"):
            self.manager.recover({"confirm": "RECOVER_MUSIC_ASSISTANT"})

    def host_handler(self, running=False, pending=False):
        source = ast.parse((Path(__file__).resolve().parents[1] / "host-agent/server.py").read_text())
        handler = next(node for node in source.body if isinstance(node, ast.ClassDef) and node.name == "Handler")
        method = next(node for node in handler.body if isinstance(node, ast.FunctionDef) and node.name == "do_POST")
        context = {"urllib": urllib, "STARTUP_RECOVERY_ACTIVE": False,
                   "MUSIC_UPDATES": SimpleNamespace(status=lambda: {"running": running}),
                   "APP_UPDATE_REQUEST_FILE": SimpleNamespace(exists=lambda: pending),
                   "release_export_freeze": lambda *_: True}
        exec(compile(ast.Module(body=[method], type_ignores=[]), "host-dispatch", "exec"), context)
        result = []
        fake = SimpleNamespace(path="", auth=lambda: True, body=lambda: {"freezeToken": "fixture"}, send_json=lambda code, body: result.append((code, body)))
        return lambda path: (setattr(fake, "path", path), context["do_POST"](fake), result[-1])[-1]

    def test_unfinished_music_job_blocks_host_mutations_but_allows_export_thaw(self):
        invoke = self.host_handler(running=True)
        for path in ("/docker/exec", "/app-updates/start", "/recovery/full/start", "/recovery/export/freeze", "/service/example/restart"):
            self.assertEqual(invoke(path)[0], 423)
        self.assertEqual(invoke("/recovery/export/thaw")[0], 200)

    def test_pending_application_journal_prevents_new_music_jobs(self):
        invoke = self.host_handler(pending=True)
        for path in ("/music-updates/start", "/music-updates/recover"):
            self.assertEqual(invoke(path)[0], 423)


if __name__ == "__main__":
    unittest.main()
