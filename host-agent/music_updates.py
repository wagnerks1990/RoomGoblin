"""Fixed Music Assistant stable upgrades with a cold snapshot and durable rollback.

Only an explicitly selected existing Compose deployment is supported. No caller
supplies Docker arguments, a repository, a data path, or a download URL.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import threading
import time
import urllib.request

IMAGE = "ghcr.io/music-assistant/server"
VERSION = re.compile(r"2\.\d+\.\d+")
ROOTS = (Path("/opt/music-assistant"), Path("/opt/services/music-assistant"))
TERMINAL = {"succeeded", "rolled-back", "failed"}


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_suffix(".tmp")
    with open(temporary, "w", encoding="utf-8") as stream:
        os.chmod(temporary, 0o600)
        json.dump(value, stream)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)
    fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def public_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": "RoomGoblin", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read(1024 * 1024 + 1)
    if len(raw) > 1024 * 1024:
        raise RuntimeError("Release response too large")
    return json.loads(raw)


def release():
    data = public_json("https://api.github.com/repos/music-assistant/server/releases/latest")
    version = str(data.get("tag_name", ""))
    if not VERSION.fullmatch(version) or data.get("draft") or data.get("prerelease"):
        raise RuntimeError("The latest release needs a compatibility review")
    return {"version": version, "url": "https://github.com/music-assistant/server/releases/tag/" + version}


def replace_image(source, old, new):
    # Deliberately reject YAML anchors/interpolation and ambiguous multi-service
    # images instead of serializing resolved Compose secrets back into a file.
    pattern = re.compile(r"^(\s*image:\s*)([\"']?)" + re.escape(old) + r"\2(\s*(?:#.*)?)$", re.M)
    result, count = pattern.subn(lambda m: m[1] + m[2] + new + m[2] + m[3], source)
    if count != 1:
        raise RuntimeError("The Compose image must be a single explicit Music Assistant image")
    return result


def copy_data(source, destination):
    shutil.copytree(source, destination, symlinks=True)
    for original in [source, *source.rglob("*")]:
        copied = destination / original.relative_to(source)
        identity = original.lstat()
        os.chown(copied, identity.st_uid, identity.st_gid, follow_symlinks=False)


class MusicUpdates:
    def __init__(self, core, root=Path("/var/lib/classroom-hub/music-updates")):
        self.core, self.root = core, Path(root)
        self.journal = self.root / "job.json"
        self.guard = threading.Lock()
        self.thread = None
        self.catalog = None
        self.catalog_at = 0
        self.checking = False
        self.check_error = ""

    def read(self):
        return json.loads(self.journal.read_text()) if self.journal.exists() else {}

    def save(self, job, stage, **fields):
        job.update(fields, stage=stage, updatedAt=int(time.time() * 1000))
        atomic_json(self.journal, job)

    def status(self):
        job = self.read()
        return {"ok": True, "running": bool(job and job.get("stage") not in TERMINAL),
                "job": {k: job[k] for k in ("id", "stage", "version", "previousVersion", "startedAt", "updatedAt", "error") if k in job}}

    def recover(self, body):
        if body != {"confirm": "RECOVER_MUSIC_ASSISTANT"}:
            raise RuntimeError("Explicit service recovery policy is required")
        with self.guard:
            if self.status()["running"]:
                raise RuntimeError("Integration maintenance is active")
            ledger = self.root / "recovery.json"
            previous = json.loads(ledger.read_text()) if ledger.exists() else {}
            now = int(time.time())
            attempts = [value for value in previous.get("attempts", []) if now - value < 86400]
            if len(attempts) >= 3 or (attempts and now - attempts[-1] < 1800):
                raise RuntimeError("Music Assistant recovery is cooling down; inspect the persistent failure")
            handle = self.lock()
            try:
                # Claim before dispatch. An interrupted restart is never replayed.
                atomic_json(ledger, {"attempts": attempts + [now]})
                job = {"id": str(time.time_ns()), "startedAt": now * 1000, "operation": "recover"}
                self.save(job, "recovering")
                self.thread = threading.Thread(target=self.execute_recovery, args=(job, handle), daemon=True)
                self.thread.start()
                return self.status()
            except BaseException:
                handle.close()
                raise

    def execute_recovery(self, job, handle):
        try:
            current = self.inspect()
            if not current["running"]:
                raise RuntimeError("A stopped service is not automatically started")
            try:
                info = public_json("http://127.0.0.1:8095/info")
            except Exception:
                info = None
            if info and info.get("server_version"):
                self.save(job, "succeeded", error="The service is responding. Check the Hub connection or provider credentials; no restart was needed.")
                return
            version = current["image"].split(":", 1)[1].split("@", 1)[0]
            self.run(["docker", "restart", "--time", "30", "music-assistant-server"], 60)
            self.healthy(version, current["imageId"])
            self.save(job, "succeeded", version=version)
        except Exception:
            self.save(job, "failed", error="Service recovery did not establish health. Inspect Music Assistant; no additional restart will be replayed.")
        finally:
            handle.close()

    def run(self, args, timeout=60):
        result = self.core.run(args, timeout, False)
        if result.returncode:
            # Docker/Compose output can include credentials. Never forward it.
            raise RuntimeError("Music Assistant host operation failed")
        return result.stdout

    def inspect(self):
        rows = json.loads(self.run(["docker", "inspect", "music-assistant-server"], 15))
        if len(rows) != 1:
            raise RuntimeError("Music Assistant container is missing")
        item = rows[0]
        image = item["Config"]["Image"]
        if not re.fullmatch(re.escape(IMAGE) + r":2\.\d+\.\d+(?:@sha256:[a-f0-9]{64})?", image):
            raise RuntimeError("Music Assistant image is outside the stable compatibility boundary")
        labels = item["Config"].get("Labels") or {}
        root = Path(labels.get("com.docker.compose.project.working_dir", "/invalid"))
        if root not in ROOTS or root.resolve() != root:
            raise RuntimeError("Automatic upgrades require the existing supported Compose deployment")
        files = labels.get("com.docker.compose.project.config_files", "").split(",")
        if len(files) != 1:
            raise RuntimeError("Multiple Compose files require a deployment review")
        compose = Path(files[0])
        if compose.parent != root or compose.name not in ("docker-compose.yml", "compose.yml", "compose.yaml", "docker-compose.yaml") or compose.resolve() != compose:
            raise RuntimeError("Compose identity is outside the supported deployment")
        service = labels.get("com.docker.compose.service", "")
        project = labels.get("com.docker.compose.project", "")
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", service) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", project):
            raise RuntimeError("Compose service identity is missing")
        data = root / "data"
        mounts = item.get("Mounts", [])
        if data.resolve() != data or not any(m.get("Type") == "bind" and m.get("Source") == str(data) and m.get("Destination") == "/data" and m.get("RW") for m in mounts):
            raise RuntimeError("Music Assistant persistent data does not match its Compose deployment")
        if item.get("HostConfig", {}).get("NetworkMode") != "host":
            raise RuntimeError("Music Assistant requires its reviewed host network")
        environment = item["Config"].get("Env") or []
        command = (item["Config"].get("Entrypoint") or []) + (item["Config"].get("Cmd") or [])
        if "PYTHONPATH=/data/.roomgoblin-compat" not in environment or command != ["/bin/sh", "/data/.roomgoblin-compat/wait-for-lan.sh"]:
            raise RuntimeError("Music Assistant must retain the reviewed LAN startup compatibility gate")
        source = compose.read_text()
        replace_image(source, image, image)
        return {"containerId": item["Id"], "image": image, "imageId": item["Image"],
                "compose": str(compose), "root": str(root), "data": str(data),
                "service": service, "project": project, "running": item["State"]["Running"],
                "composeHash": hashlib.sha256(compose.read_bytes()).hexdigest()}

    def check_now(self):
        current = self.inspect()
        latest = release()
        version = current["image"].split(":", 1)[1].split("@", 1)[0]
        available = tuple(map(int, latest["version"].split("."))) > tuple(map(int, version.split(".")))
        return {"ok": True, "currentVersion": version, "latestVersion": latest["version"],
                "releaseUrl": latest["url"], "available": available, "running": current["running"]}

    def check(self):
        # Keep the single socket listener available for health while the public
        # release API or Docker is slow.
        with self.guard:
            if not self.checking and (not self.catalog_at or time.monotonic() - self.catalog_at > 60):
                self.checking = True
                def work():
                    try:
                        self.catalog = self.check_now()
                        self.check_error = ""
                    except Exception:
                        self.catalog = None
                        self.check_error = "Release check failed or this deployment needs a Compose compatibility review."
                    finally:
                        self.catalog_at = time.monotonic()
                        self.checking = False
                threading.Thread(target=work, daemon=True).start()
            return {"ok": True, **(self.catalog or {}), "checking": self.checking, "error": self.check_error}

    def compose(self, job):
        return ["docker", "compose", "--project-directory", job["root"], "-p", job["project"], "-f", job["compose"]]

    def lock(self):
        handle = open(self.core.APPLIANCE_MUTATION_LOCK, "a+b")
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BaseException:
            handle.close()
            raise RuntimeError("Another appliance update or recovery is active")
        return handle

    def start(self, body):
        if set(body) - {"version", "confirm"} or body.get("confirm") != "UPDATE_MUSIC_ASSISTANT":
            raise RuntimeError("Explicit Music Assistant update selection is required")
        with self.guard:
            if self.status()["running"]:
                raise RuntimeError("A Music Assistant update is already active")
            selected = str(body.get("version", ""))
            if not VERSION.fullmatch(selected) or not self.catalog or self.catalog.get("latestVersion") != selected or time.monotonic() - self.catalog_at > 900:
                raise RuntimeError("Selected stable release is no longer current")
            handle = self.lock()
            try:
                job = {"id": str(time.time_ns()), "version": selected,
                       "startedAt": int(time.time() * 1000)}
                self.save(job, "preparing")
                self.thread = threading.Thread(target=self.execute, args=(job, handle), daemon=True)
                self.thread.start()
                return self.status()
            except BaseException:
                handle.close()
                raise

    def check_databases(self, data):
        for path in data.glob("*.db"):
            if path.is_symlink():
                raise RuntimeError("Database symlinks are not supported")
            with sqlite3.connect(path.as_uri() + "?mode=ro", uri=True) as connection:
                if connection.execute("PRAGMA quick_check").fetchall() != [("ok",)]:
                    raise RuntimeError("Music Assistant database integrity check failed")

    def write_compose(self, path, content):
        temporary = path.with_name(path.name + ".roomgoblin-tmp")
        identity = path.stat()
        shutil.copy2(path, temporary)
        os.chown(temporary, identity.st_uid, identity.st_gid)
        with open(temporary, "w", encoding="utf-8") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)

    def healthy(self, version, image_id, timeout=120):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                item = json.loads(self.run(["docker", "inspect", "music-assistant-server"], 10))[0]
                info = public_json("http://127.0.0.1:8095/info")
                if item["State"]["Running"] and item["Image"] == image_id and info.get("server_version") == version:
                    return
            except Exception:
                pass
            time.sleep(3)
        raise RuntimeError("Music Assistant did not become healthy at the selected image and version")

    def execute(self, job, handle):
        try:
            if release()["version"] != job["version"]:
                raise RuntimeError("Selected stable release changed")
            identity = self.inspect()
            previous = identity["image"].split(":", 1)[1].split("@", 1)[0]
            if not identity["running"] or tuple(map(int, job["version"].split("."))) <= tuple(map(int, previous.split("."))):
                raise RuntimeError("Only a running older deployment may be upgraded")
            self.save(job, "preparing", **identity, previousVersion=previous)
            tag = IMAGE + ":" + job["version"]
            self.run(["docker", "pull", tag], 600)
            image = json.loads(self.run(["docker", "image", "inspect", tag], 15))[0]
            digests = [d for d in image.get("RepoDigests", []) if re.fullmatch(re.escape(IMAGE) + r"@sha256:[a-f0-9]{64}", d)]
            if len(digests) != 1:
                raise RuntimeError("Pulled Music Assistant image has no unique immutable identity")
            current = self.inspect()
            if current != {k: job[k] for k in current}:
                raise RuntimeError("Music Assistant deployment changed during preflight")
            data, compose = Path(job["data"]), Path(job["compose"])
            size = sum(p.stat().st_size for p in data.rglob("*") if p.is_file() and not p.is_symlink())
            self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
            if shutil.disk_usage(self.root).free < size * 3 + 1024 ** 3:
                raise RuntimeError("Insufficient space for the cold snapshot and rollback")
            backup = self.root / job["id"]
            backup.mkdir(mode=0o700)
            shutil.copy2(compose, backup / "compose")
            self.save(job, "stopping", newImage=tag + "@" + digests[0].split("@", 1)[1], newImageId=image["Id"])
            self.run(["docker", "stop", "--time", "30", "music-assistant-server"], 60)
            self.check_databases(data)
            copy_data(data, backup / "data")
            self.check_databases(backup / "data")
            self.run(["sync", "-f", str(backup)], 60)
            self.save(job, "backed-up")
            new_source = replace_image((backup / "compose").read_text(), job["image"], job["newImage"])
            self.save(job, "applying")
            self.write_compose(compose, new_source)
            self.run(self.compose(job) + ["up", "-d", "--no-deps", "--force-recreate", job["service"]], 120)
            self.save(job, "verifying")
            self.healthy(job["version"], job["newImageId"])
            self.check_databases(data)
            self.save(job, "succeeded")
        except Exception:
            try:
                self.rollback(job)
            except Exception:
                self.save(job, "rollback-required", error="Automatic rollback could not finish. The cold snapshot is retained; administrator recovery is required.")
        finally:
            handle.close()

    def rollback(self, job):
        stage = job["stage"]
        if stage == "preparing":
            self.save(job, "failed", error="Update preflight failed; the running deployment was preserved.")
            return
        if stage in ("stopping", "backed-up"):
            self.run(["docker", "start", "music-assistant-server"], 30)
        else:
            backup, data = self.root / job["id"], Path(job["data"])
            self.check_databases(backup / "data")
            self.save(job, "restoring")
            self.run(["docker", "stop", "--time", "30", "music-assistant-server"], 60)
            restore = data.with_name("data.roomgoblin-restore-" + job["id"])
            if restore.exists():
                shutil.rmtree(restore)
            copy_data(backup / "data", restore)
            self.check_databases(restore)
            failed = data.with_name("data.roomgoblin-failed-" + job["id"])
            if data.exists():
                if failed.exists():
                    # A previous restore already preserved the migrated data.
                    shutil.rmtree(data)
                else:
                    data.rename(failed)
            restore.rename(data)
            self.write_compose(Path(job["compose"]), (backup / "compose").read_text())
            self.run(self.compose(job) + ["up", "-d", "--no-deps", "--force-recreate", job["service"]], 120)
        self.healthy(job["previousVersion"], job["imageId"])
        self.save(job, "rolled-back", error="Update failed or was interrupted. The previous image and its matching data were restored.")

    def startup_recover(self):
        job = self.read()
        if not job or job.get("stage") in TERMINAL:
            return
        if job.get("operation") == "recover":
            self.save(job, "failed", error="Service recovery was interrupted; restart delivery is uncertain and was not replayed.")
            return
        handle = self.lock()
        try:
            self.rollback(job)
        finally:
            handle.close()
