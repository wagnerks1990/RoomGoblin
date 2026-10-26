import copy
import importlib
import json
import hashlib
import types
import time
import uuid
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src' / 'ubuntu-display'))
from probe import parse_outputs
from session import resolve_screens, audio_route
from control import validate_config, safe_read, command, session_state
import lifecycle


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

    def test_unprivileged_session_state_is_bounded_and_projected(self):
        raw = {'at': time.time(), 'online': True, 'private': 'hidden', 'screens': [{'receiverId': 'screen1', 'browserRunning': True, 'geometry': None, 'error': 'private upstream text'}]}
        result = session_state(raw)
        self.assertNotIn('private', result)
        self.assertEqual(result['screens'][0]['error'], 'runtime-diagnostic-unavailable')
        self.assertEqual(session_state({**raw, 'at': float('nan')})['error'], 'session-stale')
        with self.assertRaises(ValueError):
            session_state({**raw, 'screens': raw['screens'] * 17})


class Maintenance(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.lib, self.data, self.root = [self.base / name for name in ('lib', 'data', 'root')]
        for folder in (self.lib, self.data, self.root):
            folder.mkdir()
        for name in lifecycle.FILES:
            (self.lib / name).write_text('# old ' + name + '\n')
        (self.root / 'identity.json').write_text(json.dumps({'id': 'fixture', 'version': 'old'}))
        for name, value in [('LIB', self.lib), ('DATA', self.data), ('ROOT', self.root), ('LOCK', self.base / 'lock')]:
            patcher = patch.object(lifecycle, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_fixed_operation_boundary_deduplicates_request_and_rejects_concurrent_jobs(self):
        request = {'operation': 'update-browser', 'confirm': True, 'requestId': str(uuid.uuid4())}
        with patch('lifecycle.active', return_value=False), patch('lifecycle.run') as run:
            result = lifecycle.begin(request)
            self.assertEqual(result['job']['state'], 'queued')
            self.assertEqual(lifecycle.begin(request)['job']['id'], result['job']['id'])
            self.assertEqual(run.call_count, 2)
            with self.assertRaises(ValueError):
                lifecycle.begin({**request, 'requestId': str(uuid.uuid4())})
            for change in ({'operation': 'shell'}, {'confirm': False}, {'requestId': '../x'}):
                with self.assertRaises(ValueError):
                    lifecycle.begin({**request, **change})

    def test_activating_service_is_busy_and_interrupted_jobs_are_not_replayed(self):
        with patch('lifecycle.subprocess.run', return_value=types.SimpleNamespace(stdout=b'activating\n')):
            self.assertTrue(lifecycle.active())
        lifecycle.save(self.data / 'maintenance.json', {'id': 'job', 'state': 'running', 'operation': 'update-os', 'updatedAt': time.time() - 90})
        with patch('lifecycle.active', return_value=False), patch('lifecycle.execute') as execute:
            self.assertEqual(lifecycle.status()['job']['state'], 'interrupted')
            lifecycle.worker()
            execute.assert_not_called()

    def test_restored_hub_schedule_cannot_replay_a_previous_device_request(self):
        request = {'operation': 'check-updates', 'confirm': True, 'requestId': str(uuid.uuid4())}
        with patch('lifecycle.active', return_value=False), patch('lifecycle.run') as run:
            lifecycle.begin(request)
            # A later operation replaces the visible current job, as after Hub restore.
            lifecycle.save(self.data / 'maintenance.json', {'id': 'newer', 'state': 'completed'})
            result = lifecycle.begin(request)
            self.assertEqual(result['job']['id'], request['requestId'])
            self.assertEqual(run.call_count, 2)

    def test_apt_plans_reject_removals_and_identify_security_packages(self):
        plan = lifecycle.apt_plan('Inst openssl [3.0.1] (3.0.2 Ubuntu:24.04/noble-security [amd64])\n')
        self.assertEqual(plan[0]['candidate'], '3.0.2')
        self.assertTrue(plan[0]['security'])
        with self.assertRaises(ValueError):
            lifecycle.apt_plan('Remv lightdm [1.0]\n')
        with self.assertRaises(ValueError):
            lifecycle.apt_plan('Inst cannot parse this\n')

    def test_package_update_uses_fixed_nonremoving_upgrade_and_never_reboots(self):
        with patch('lifecycle.check_updates'), patch('lifecycle.run', return_value='') as run:
            lifecycle.execute({'operation': 'update-os'})
            calls = [call.args[0] for call in run.call_args_list]
            self.assertEqual(calls[-1][0], 'apt-get')
            self.assertIn('--no-remove', calls[-1])
            self.assertEqual(calls[-1][-1], 'upgrade')
            self.assertFalse(any('reboot' in call or 'dist-upgrade' in call or 'autoremove' in call for call in calls))

    def test_browser_update_recovers_graphical_session_when_snap_fails(self):
        calls = []
        def run(args, **kwargs):
            calls.append(args)
            if args[0] == 'snap':
                raise RuntimeError('fixture')
        with patch('lifecycle.subprocess.run', return_value=types.SimpleNamespace(returncode=0)), patch('lifecycle.run', side_effect=run):
            with self.assertRaises(RuntimeError):
                lifecycle.execute({'operation': 'update-browser'})
        self.assertEqual(calls, [['systemctl', 'stop', 'lightdm'], ['snap', 'refresh', 'chromium'], ['systemctl', 'start', 'lightdm']])

    def test_agent_source_is_fixed_main_and_digest_must_match_installed_hub(self):
        stage = self.base / 'stage'
        stage.mkdir()
        urls = []
        commit = 'a' * 40
        def download(url, limit):
            urls.append(url)
            if url.endswith('/commits/main'):
                return json.dumps({'sha': commit}).encode()
            if url.endswith('/VERSION'):
                return b'1.0.0-alpha.85'
            return b'# reviewed source\n'
        for name in lifecycle.FILES:
            (stage / name).write_bytes(b'# reviewed source\n')
        expected = lifecycle.digest(stage)
        with patch('lifecycle.download', side_effect=download):
            self.assertEqual(lifecycle.prepare_agent(stage, expected), ('1.0.0-alpha.85', commit))
            with self.assertRaises(ValueError):
                lifecycle.prepare_agent(stage, '0' * 64)
        self.assertTrue(all(url.startswith('https://api.github.com/repos/wagnerks1990/RoomGoblin/') or url.startswith('https://raw.githubusercontent.com/wagnerks1990/RoomGoblin/' + commit + '/') for url in urls))

    def test_failed_agent_verification_restores_every_file_and_identity(self):
        old = {name: (self.lib / name).read_bytes() for name in lifecycle.FILES}
        identity = (self.root / 'identity.json').read_bytes()
        def prepare(stage, expected):
            for name in lifecycle.FILES:
                (stage / name).write_text('# new ' + name + '\n')
            return 'new', 'a' * 40
        def atomic(path, value):
            path.write_text(json.dumps(value))
        # Import check succeeds; post-write health fails, exercising real backup/restore.
        with patch('lifecycle.prepare_agent', side_effect=prepare), patch('control.atomic_json', side_effect=atomic), patch('lifecycle.run', side_effect=['', '{}']), patch('lifecycle.os.chown'), patch('lifecycle.pwd.getpwnam', return_value=types.SimpleNamespace(pw_gid=1000)):
            with self.assertRaises(KeyError):
                lifecycle.update_agent('f' * 64, 'new')
        self.assertEqual({name: (self.lib / name).read_bytes() for name in lifecycle.FILES}, old)
        self.assertEqual((self.root / 'identity.json').read_bytes(), identity)
        self.assertFalse((self.data / 'agent-transaction.json').exists())
        self.assertTrue((self.data / 'previous-agent' / 'manifest.json').exists())

    def test_recovery_rejects_corrupt_backup_and_worker_records_sanitized_failure(self):
        backup = self.data / 'previous-agent'
        backup.mkdir()
        for name in lifecycle.FILES:
            (backup / name).write_text('# backup\n')
        (backup / 'identity.json').write_text('{}')
        lifecycle.save(backup / 'manifest.json', {'digest': 'invalid'})
        with self.assertRaises(ValueError):
            lifecycle.restore_agent()
        lifecycle.save(self.data / 'maintenance.json', {'id': 'job', 'state': 'queued', 'operation': 'update-os'})
        with patch('lifecycle.execute', side_effect=RuntimeError('private upstream output')):
            lifecycle.worker()
        result = lifecycle.read(self.data / 'maintenance.json')
        self.assertEqual(result['state'], 'failed')
        self.assertNotIn('private upstream', json.dumps(lifecycle.status()))
        self.assertEqual(lifecycle.read(self.data / 'maintenance-history.json')[0]['state'], 'failed')


if __name__ == '__main__':
    unittest.main()
