import fcntl
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('admission', Path(__file__).resolve().parents[1] / 'deploy/installer-transaction.py')
admission = importlib.util.module_from_spec(spec)
spec.loader.exec_module(admission)


class InstallerTransactionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.lock = self.root / 'lock'
        self.lock.touch()
        self.fd = os.open(self.lock, os.O_RDWR)
        try:
            previous = os.dup(9)
        except OSError:
            previous = None
        os.dup2(self.fd, 9)
        self.addCleanup(self.restore, previous)
        fcntl.flock(self.fd, fcntl.LOCK_EX)
        self.request = dict(action='published', forceFull=True, mutationStarted='true', targetCommit='a'*40,
                            rollbackCommit='b'*40, rollbackHubImage='sha256:'+'c'*64,
                            rollbackMaintenanceImage='sha256:'+'d'*64, backupName='pre-test.zip',
                            backupSha256='e'*64, failureBackupName='pre-test.zip', failureBackupSha256='e'*64)
        self.write()
        (self.root / 'app-update.env').write_text('synthetic=true')
        (self.root / 'app-update.env').chmod(0o600)

    def restore(self, previous):
        os.close(9)
        os.close(self.fd)
        if previous is not None:
            os.dup2(previous, 9)
            os.close(previous)

    def write(self):
        self.journal = self.root / 'app-update-request.json'
        self.journal.write_text(json.dumps(self.request))
        self.journal.chmod(0o600)

    def admit(self):
        admission.admit(self.root, self.root, 'a'*40, self.root, self.lock, os.getuid())

    def test_complete_owned_transaction_is_admitted_without_changing_journal(self):
        original = self.journal.read_bytes()
        self.admit()
        self.request['forceFull'] = False
        self.write()
        self.admit()
        self.write()
        self.request['forceFull'] = True
        self.write()
        self.assertEqual(original, self.journal.read_bytes())

    def test_rejects_every_incomplete_or_unmatched_snapshot(self):
        for key in [key for key in self.request if key != 'forceFull']:
            with self.subTest(key=key):
                saved = self.request.pop(key)
                self.write()
                with self.assertRaises(RuntimeError):
                    self.admit()
                self.request[key] = saved
        self.write()
        admission.admit(self.root, self.root, 'a'*40, self.root, self.lock, os.getuid())
        with self.assertRaises(RuntimeError):
            admission.admit(self.root, self.root / 'other', 'a'*40, self.root, self.lock, os.getuid())

    def test_rejects_unheld_lock_and_private_snapshot_permissions(self):
        fcntl.flock(self.fd, fcntl.LOCK_UN)
        with self.assertRaisesRegex(RuntimeError, 'not held'):
            self.admit()
        fcntl.flock(self.fd, fcntl.LOCK_EX)
        self.journal.chmod(0o644)
        with self.assertRaises(RuntimeError):
            self.admit()
        self.journal.chmod(0o600)
        (self.root / 'app-update.env').chmod(0o644)
        with self.assertRaises(RuntimeError):
            self.admit()

    def test_verified_selective_deployment_is_accepted_but_drift_is_rejected(self):
        planner_spec = importlib.util.spec_from_file_location('test_plan', Path(__file__).resolve().parents[1] / 'deploy/update-plan.py')
        real = importlib.util.module_from_spec(planner_spec)
        planner_spec.loader.exec_module(real)
        changed_paths = []
        planner = SimpleNamespace(layout_digest=lambda: 'synthetic-layout',
                                  run=lambda *args: 'b'*40,
                                  plan=real.plan, changed=lambda *args: changed_paths)
        saved = self.root / 'deployment.json'
        saved.write_text(json.dumps(dict(host='a'*40, layout='synthetic-layout')))
        saved.chmod(0o600)
        cwd = Path.cwd()
        admission.baseline(self.root, 'a'*40, self.root, os.getuid(), planner)
        self.assertEqual(Path.cwd(), cwd)
        changed_paths.append('src/server.js')
        with self.assertRaises(RuntimeError):
            admission.baseline(self.root, 'a'*40, self.root, os.getuid(), planner)
        self.assertEqual(Path.cwd(), cwd)
        changed_paths.clear()
        planner.layout_digest = lambda: 'changed-layout'
        with self.assertRaises(RuntimeError):
            admission.baseline(self.root, 'a'*40, self.root, os.getuid(), planner)
        with self.assertRaises(RuntimeError):
            admission.baseline(self.root, 'c'*40, self.root, os.getuid(), planner)

    def test_rejects_symlinked_snapshot_and_replaced_lock_identity(self):
        real = self.root / 'real-journal'
        self.journal.rename(real)
        self.journal.symlink_to(real)
        with self.assertRaises(RuntimeError):
            self.admit()
        self.journal.unlink()
        real.rename(self.journal)
        self.lock.rename(self.root / 'old-lock')
        self.lock.touch()
        with self.assertRaises(RuntimeError):
            self.admit()


if __name__ == '__main__':
    unittest.main()
