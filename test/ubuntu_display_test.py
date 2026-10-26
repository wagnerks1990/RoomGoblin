import copy
import importlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src' / 'ubuntu-display'))
from probe import parse_outputs
from session import resolve_screens, audio_route
from control import validate_config, safe_read, command


class UbuntuScreens(unittest.TestCase):
    def setUp(self):
        self.config = {'hubUrl': 'http://10.0.0.2:3000', 'screens': [
            {'connector': 'HDMI-1', 'monitorId': 'a' * 64, 'receiverId': 'screen1', 'name': 'One', 'mode': 'auto', 'rotation': 'normal', 'enabled': True},
            {'connector': 'DP-1', 'monitorId': 'a' * 64, 'receiverId': 'screen2', 'name': 'Two', 'mode': 'auto', 'rotation': 'normal', 'enabled': True}]}
        self.outputs = [dict(s, connected=True, modes=['1920x1080'], geometry={'x': i * 1920, 'y': 0, 'width': 1920, 'height': 1080}) for i, s in enumerate(self.config['screens'])]

    def test_xrandr_parser_connected_disconnected_edid_and_modes(self):
        value = 'HDMI-1 connected primary 1920x1080+0+0 (normal)\n\tEDID:\n\t\t00ffffffffffff0010ac34a04c303030\n\t\t0c200103804628780a00000000000000\n   1920x1080 60.00*+\n   1280x720 60.00\nDP-1 disconnected (normal)\n'
        outputs = parse_outputs(value)
        self.assertEqual(len(outputs), 2)
        self.assertEqual(outputs[0]['geometry']['width'], 1920)
        self.assertEqual(outputs[0]['modes'], ['1920x1080', '1280x720'])
        self.assertEqual(len(outputs[0]['monitorId']), 64)
        self.assertFalse(outputs[1]['connected'])

    def test_identical_monitors_are_distinguished_by_connector(self):
        resolved = resolve_screens(self.config, self.outputs)
        self.assertEqual([s['error'] for s in resolved], ['', ''])
        self.assertEqual([s['receiverId'] for s in resolved], ['screen1', 'screen2'])

    def test_hot_unplug_never_moves_a_receiver_to_another_output(self):
        self.outputs[0]['connected'] = False
        resolved = resolve_screens(self.config, self.outputs)
        self.assertEqual(resolved[0]['error'], 'disconnected')
        self.assertEqual(resolved[1]['receiverId'], 'screen2')
        self.assertEqual(resolved[1]['error'], '')

    def test_unavailable_audio_sink_fails_muted_instead_of_using_another_output(self):
        self.assertEqual(audio_route('hdmi-one', {'hdmi-two'}), {'muted': True, 'missing': True, 'sink': None})
        self.assertEqual(audio_route('hdmi-one', {'hdmi-one', 'hdmi-two'}), {'muted': False, 'missing': False, 'sink': 'hdmi-one'})
        self.assertEqual(audio_route('muted', {'hdmi-one'})['muted'], True)

    def test_connector_or_monitor_change_requires_explicit_remapping(self):
        self.outputs[0]['connector'] = 'HDMI-2'
        self.assertEqual(resolve_screens(self.config, self.outputs)[0]['error'], 'disconnected')
        self.outputs[0]['connector'] = 'HDMI-1'
        self.outputs[0]['monitorId'] = 'b' * 64
        self.assertEqual(resolve_screens(self.config, self.outputs)[0]['error'], 'monitor-changed')

    def test_root_boundary_rejects_path_shell_mode_and_duplicate_receiver_inputs(self):
        self.assertEqual(len(validate_config(self.config)['screens']), 2)
        for key, value in [('connector', '../../etc/passwd'), ('receiverId', 'a;id'), ('mode', '1920x1080;id'), ('monitorId', ''), ('rotation', '--off')]:
            data = copy.deepcopy(self.config)
            data['screens'][0][key] = value
            with self.assertRaises(ValueError):
                validate_config(data)
        self.config['screens'][1]['receiverId'] = 'screen1'
        with self.assertRaises(ValueError):
            validate_config(self.config)

    def test_runtime_read_rejects_symlink_and_size_overflow(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'state').write_text('{}')
            self.assertEqual(safe_read(root / 'state'), {})
            with self.assertRaises(ValueError):
                safe_read(root / 'state', 1)
            try:
                (root / 'link').symlink_to(root / 'state')
            except OSError:
                return
            with self.assertRaises(OSError):
                safe_read(root / 'link')

    def test_root_helper_does_not_execute_unknown_or_unconfirmed_commands(self):
        with patch('control.safe_read', return_value={'id': 'fixture'}):
            for request in ({'id': 'wrong', 'action': 'status'}, {'id': 'fixture', 'action': 'shell', 'command': 'id'}, {'id': 'fixture', 'action': 'reboot'}):
                with self.assertRaises(ValueError):
                    command(request)


if __name__ == '__main__':
    unittest.main()
