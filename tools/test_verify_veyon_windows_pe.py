import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest


MODULE_PATH = Path(__file__).with_name('verify-veyon-windows-pe.py')
SPEC = importlib.util.spec_from_file_location('verify_veyon_windows_pe', MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
verify = MODULE.verify


def fixture(machine=0x8664, signature=b'PE\0\0', optional_size=0xF0):
    data = bytearray(0x200)
    data[:2] = b'MZ'
    struct.pack_into('<I', data, 0x3C, 0x80)
    data[0x80:0x84] = signature
    struct.pack_into('<H', data, 0x84, machine)
    struct.pack_into('<H', data, 0x86, 5)
    struct.pack_into('<H', data, 0x94, optional_size)
    return bytes(data)


class VerifyWindowsPeTests(unittest.TestCase):
    def run_verify(self, data, allow_x86=False):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'pilot.exe'
            path.write_bytes(data)
            verify(path, allow_x86=allow_x86)

    def test_accepts_x86_64_pe(self):
        self.run_verify(fixture())

    def test_rejects_non_pe_data(self):
        with self.assertRaisesRegex(ValueError, 'MZ'):
            self.run_verify(b'not a windows executable')

    def test_rejects_32_bit_machine(self):
        with self.assertRaisesRegex(ValueError, 'x86-64'):
            self.run_verify(fixture(machine=0x14C))

    def test_allows_32_bit_installer_bootstrap_explicitly(self):
        self.run_verify(fixture(machine=0x14C), allow_x86=True)

    def test_rejects_truncated_metadata(self):
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            self.run_verify(fixture(optional_size=1))


if __name__ == '__main__':
    unittest.main()
