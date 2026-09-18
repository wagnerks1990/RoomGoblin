import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('archive_policy', Path(__file__).with_name('verify-veyon-pilot-archive.py'))
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


class ArchivePolicyTests(unittest.TestCase):
    def make_archive(self, member):
        temp = tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False)
        temp.close()
        with tarfile.open(temp.name, 'w:gz') as archive:
            archive.addfile(member, io.BytesIO(b'x') if member.isfile() else None)
        self.addCleanup(Path(temp.name).unlink)
        return temp.name

    def test_accepts_root_owned_relative_file(self):
        member = tarfile.TarInfo('./usr/bin/veyon-cli')
        member.size = 1
        policy.verify(self.make_archive(member))

    def test_accepts_only_exact_privileged_helper_metadata(self):
        for name in ('veyon-auth-helper', 'veyon-input-helper'):
            member = tarfile.TarInfo('./usr/bin/' + name)
            member.size = 1
            member.mode = 0o4755
            policy.verify(self.make_archive(member))

    def test_rejects_non_root_owner_and_traversal(self):
        member = tarfile.TarInfo('./usr/bin/veyon-cli')
        member.size = 1
        member.uid = 1001
        with self.assertRaises(ValueError):
            policy.verify(self.make_archive(member))
        traversal = tarfile.TarInfo('../../etc/shadow')
        traversal.size = 1
        with self.assertRaises(ValueError):
            policy.verify(self.make_archive(traversal))

    def test_rejects_escaping_symlink(self):
        member = tarfile.TarInfo('./usr/lib/veyon/plugin.so')
        member.type = tarfile.SYMTYPE
        member.linkname = '../../../../etc/shadow'
        with self.assertRaises(ValueError):
            policy.verify(self.make_archive(member))

    def test_rejects_unexpected_privileged_and_special_entries(self):
        member = tarfile.TarInfo('./usr/bin/unexpected')
        member.size = 1
        member.mode = 0o4755
        with self.assertRaises(ValueError):
            policy.verify(self.make_archive(member))
        device = tarfile.TarInfo('./usr/lib/veyon/device')
        device.type = tarfile.CHRTYPE
        with self.assertRaises(ValueError):
            policy.verify(self.make_archive(device))

    def test_rejects_escaping_or_missing_hardlink_target(self):
        member = tarfile.TarInfo('./usr/bin/link')
        member.type = tarfile.LNKTYPE
        member.linkname = '../../etc/shadow'
        with self.assertRaises(ValueError):
            policy.verify(self.make_archive(member))


if __name__ == '__main__':
    unittest.main()
