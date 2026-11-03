import unittest
from urllib.parse import urlparse, parse_qs
import test_workspaces as workspaces


class AnnouncementStartBrowserTests(unittest.TestCase):
    setUpClass = classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
    page = workspaces.WorkspaceBrowserTests.page
    evidence = workspaces.WorkspaceBrowserTests.evidence

    def setup_page(self, configured=True, hold=False, width=1440):
        calls, reads = [], []
        config = {'streamUrl': '••••••••' if configured else '', 'streamUrlConfigured': configured, 'volumePercent': 30}

        def transport(route, target):
            if not target.startswith('/api/v1/automations/morning-announcements'):
                return False
            if route.request.method == 'GET':
                if hold:
                    reads.append(route)
                else:
                    route.fulfill(json={'ok': True, 'config': config})
            else:
                calls.append((route.request.method, target, route.request.post_data_json))
                route.fulfill(json={'ok': True, 'config': config, 'targets': ['screen']})
            return True

        devices = {'screen': {'id': 'screen', 'name': 'Classroom display', 'enabled': True}}
        page, errors = self.page('/controller/display.html', width, devices=devices, transport=transport,
                                 overrides={'/api/v1/devices': {'devices': devices, 'groups': {}, 'status': {}}})
        page.locator('#targets input[type=checkbox]').check()
        page.locator('button[data-work="media"]').click()
        if not hold:
            page.wait_for_function("!document.getElementById('announcementsStreamStatus').textContent.startsWith('Loading')")
        return page, errors, calls, reads, config

    def start(self, page):
        page.locator('#resultSummary').evaluate("el => el.textContent='Waiting'")
        page.get_by_role('button', name='Play Announcements • Audio On', exact=True).click()
        page.wait_for_function("document.getElementById('resultSummary').textContent.includes('Morning Announcements')")

    def test_saved_stream_start_omits_url_and_keeps_selected_targets(self):
        p, e, calls, _, _ = self.setup_page()
        self.assertEqual(p.locator('#announcementsUrl').input_value(), '')
        self.assertIn('Saved stream ready', p.locator('#announcementsStreamStatus').inner_text())
        self.assertEqual(calls, [])
        self.start(p)
        self.assertEqual(calls, [('POST', '/api/v1/automations/morning-announcements/start', {'targets': 'screen'})])
        self.assertEqual(p.locator('#mediaUrl').input_value(), '')
        self.assertFalse(e, e)

    def test_missing_configuration_and_invalid_urls_never_dispatch(self):
        p, e, calls, _, _ = self.setup_page(configured=False)
        for value in ('', '••••••••', '/play.html', 'javascript:alert(1)'):
            p.locator('#announcementsUrl').fill(value)
            self.start(p)
            self.assertIn('failed', p.locator('#resultSummary').inner_text())
        self.assertEqual(calls, [])
        self.assertFalse(e, e)

    def test_explicit_absolute_override_keeps_playback_parameters(self):
        p, e, calls, _, _ = self.setup_page(configured=False)
        p.locator('#announcementsUrl').fill('https://stream.example.test/play?id=morning&playOrder=hls')
        self.start(p)
        self.assertEqual(calls[0][2]['targets'], 'screen')
        url = urlparse(calls[0][2]['url'])
        self.assertEqual(url.netloc, 'stream.example.test')
        self.assertEqual(parse_qs(url.query), {'id': ['morning'], 'playOrder': ['hls'], 'autoplay': ['true'], 'mute': ['false']})
        self.assertFalse(e, e)

    def test_delayed_settings_read_preserves_typed_override(self):
        p, e, calls, reads, config = self.setup_page(hold=True)
        p.locator('#announcementsUrl').fill('https://stream.example.test/alternate')
        self.assertEqual(len(reads), 1)
        reads[0].fulfill(json={'ok': True, 'config': config})
        p.wait_for_function("document.getElementById('announcementsStreamStatus').textContent.startsWith('Saved stream ready')")
        self.assertEqual(p.locator('#announcementsUrl').input_value(), 'https://stream.example.test/alternate')
        self.start(p)
        self.assertIn('/alternate?', calls[0][2]['url'])
        self.assertFalse(e, e)

    def test_failed_settings_read_explains_recovery_without_dispatch(self):
        p, e, calls, reads, _ = self.setup_page(hold=True)
        reads[0].fulfill(status=503, json={'error': 'Fixture unavailable'})
        p.wait_for_function("document.getElementById('announcementsStreamStatus').textContent.includes('could not be loaded')")
        self.start(p)
        self.assertEqual(calls, [])
        p.locator('#announcementsUrl').fill('https://stream.example.test/play')
        self.start(p)
        self.assertEqual(len(calls), 1)
        self.assertFalse(e, e)

    def test_mobile_saved_stream_control_is_readable(self):
        p, e, _, _, _ = self.setup_page(width=390)
        self.evidence(p, e, 'announcement-saved-stream')
