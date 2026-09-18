"""Prepare source safely without changing upstream's automatic plugin discovery."""
import contextlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('pilot', Path(__file__).with_name('prepare-veyon-pilot.py'))
pilot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)


class PreparePilotTests(unittest.TestCase):
    def test_existing_directory_is_never_modified(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(pilot.subprocess, 'run') as run:
            with self.assertRaises(ValueError):
                pilot.prepare(temp)
            run.assert_not_called()

    def test_pinned_clone_copies_plugins_without_duplicate_cmake_entries(self):
        original = 'file(GLOB PLUGIN_DIRS * )\n# automatic upstream discovery\n'
        with tempfile.TemporaryDirectory() as temp:
            destination = Path(temp) / 'new'
            def command(args, **_kwargs):
                if args[1] == 'clone':
                    (destination / 'plugins').mkdir(parents=True)
                    (destination / 'plugins' / 'CMakeLists.txt').write_text(original)
                    webapi = destination / 'plugins/webapi'
                    webapi.mkdir()
                    (webapi / 'WebApiController.h').write_text('\tResponse getFramebuffer( const Request& request );')
                    (webapi / 'WebApiHttpServer.cpp').write_text('''{
\tif( response.error == WebApiController::Error::NoError )
\t{
\twaDebug() << "[REQ] [POST]"
\t\t\t  << request.url().toString().toUtf8().constData()
\t\t\t  << toJson(request.headers()).constData()
\t\t\t  << request.body().constData();
\tauto success = true;''')
                    (webapi / 'WebApiController.cpp').write_text('// fixture')
                    core = destination / 'core/src'
                    core.mkdir(parents=True)
                    (destination / 'core/CMakeLists.txt').write_text('target_compile_options(veyon-core PRIVATE -Wno-parentheses)')
                    (core / 'FeatureMessage.cpp').write_text('''\tstream << QStringLiteral("FeatureMessage(%1,%2,%3)")
\t\t\t\t  .arg(VeyonCore::featureManager().feature(message.featureUid()).name())
\t\t\t\t  .arg(FeatureMessage::CommandType(message.command()))
\t\t\t\t  .arg(VeyonCore::stringify(message.arguments())).toUtf8().constData();''')
                    linux = destination / 'plugins/platform/linux'
                    linux.mkdir(parents=True)
                    (linux / 'LinuxServerProcess.cpp').write_text('const auto desktopFile = VeyonCore::applicationsDirectory() + suffix;')
                    x11 = destination / '3rdparty/x11vnc/src'
                    x11.mkdir(parents=True)
                    (x11 / 'userinput.c').write_text('int cnt, iter = 0;')
            with patch.object(pilot.subprocess, 'run', side_effect=command) as run, patch.object(pilot.subprocess, 'check_output', return_value=pilot.REVISION), contextlib.redirect_stdout(io.StringIO()):
                pilot.prepare(destination)
            self.assertEqual((destination / 'plugins' / 'CMakeLists.txt').read_text(), original)
            for name in pilot.PLUGINS:
                self.assertTrue((destination / 'plugins' / name / 'CMakeLists.txt').is_file())
            self.assertTrue((destination / 'ROOMGOBLIN-PILOT.md').is_file())
            webapi_server = (destination / 'plugins/webapi/WebApiHttpServer.cpp').read_text()
            self.assertEqual(webapi_server.count('[redacted]'), 2)
            self.assertIn('request.path.startsWith(QStringLiteral("authentication/"))', webapi_server)
            self.assertIn('request.url().path().startsWith(QStringLiteral("/api/v1/authentication/"))', webapi_server)
            feature_log = (destination / 'core/src/FeatureMessage.cpp').read_text()
            self.assertIn('[arguments redacted]', feature_log)
            self.assertNotIn('stringify(message.arguments())', feature_log)
            self.assertIn('const QString desktopFile', (destination / 'plugins/platform/linux/LinuxServerProcess.cpp').read_text())
            core_cmake = (destination / 'core/CMakeLists.txt').read_text()
            self.assertIn('CMAKE_CXX_COMPILER_VERSION VERSION_GREATER_EQUAL 15', core_cmake)
            self.assertIn('target_compile_options(veyon-core PRIVATE -Wno-error=stringop-overflow)', core_cmake)
            self.assertNotIn('-Wno-stringop-overflow', core_cmake)
            self.assertEqual((destination / '3rdparty/x11vnc/src/userinput.c').read_text(), 'int cnt = 0, iter = 0;')
            commands = [call.args[0] for call in run.call_args_list]
            self.assertIn(['git', '-C', str(destination), 'checkout', '--detach', pilot.REVISION], commands)
            self.assertFalse(any('--remote' in command for command in commands))

    def test_lifetime_patch_refuses_unknown_source(self):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp) / 'plugins/platform/linux'
            p.mkdir(parents=True)
            source = p / 'LinuxServerProcess.cpp'
            source.write_text('unexpected upstream code')
            with self.assertRaises(RuntimeError):
                pilot.patch_linux_string_lifetime(temp)
            self.assertEqual(source.read_text(), 'unexpected upstream code')

    def test_gcc15_patch_refuses_unknown_source(self):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp) / 'core'
            p.mkdir(parents=True)
            source = p / 'CMakeLists.txt'
            source.write_text('unexpected upstream code')
            with self.assertRaises(RuntimeError):
                pilot.patch_gcc15_qt_atomic_false_positive(temp)
            self.assertEqual(source.read_text(), 'unexpected upstream code')
