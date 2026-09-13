"""Real operator HTML/CSS/JS with deterministic HTTP/WebSocket transports.

Run with the existing Playwright requirements and DISPLAY_TEST_BROWSER setting.
Optional integrations deliberately return 503: their unavailable presentation is
part of the layout contract. JavaScript exceptions are never filtered out.
"""
import base64
import json
import mimetypes
import os
from pathlib import Path
import unittest
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'test-results' / 'workspaces'
DEVICE = {'id': 'fixture-tv', 'name': 'Classroom display', 'host': '192.0.2.50',
          'serial': '192.0.2.50:5555', 'profileId': 'default', 'school': 'Example School',
          'room': '101', 'lastStatus': {'online': False}, 'displayUrl': ''}
FIXTURES = {
    '/health': {'ok': True, 'version': 'browser-fixture'},
    '/api/v1/branding': {'branding': {}},
    '/api/v1/status': {'ok': True, 'displays': {}},
    '/api/v1/admin/config': {'site': {}, 'devices': {'devices': {}, 'displayGroups': {}}, 'hardware': {}},
    '/api/v1/devices': {'devices': {}, 'status': {}, 'groups': {}},
    '/api/v1/class-schedules': {'classes': []},
    '/api/v1/media': {'files': []},
    '/api/v1/scenes': {'scenes': {}},
    '/api/v1/govee': {'devices': {}, 'groups': {}},
    '/api/v1/lab/computers': {'configured': True, 'retentionHours': 168, 'computers': [], 'groups': [], 'summary': {'total': 0, 'online': 0, 'offline': 0}},
    '/api/v1/lab/ai-monitor': {'enabled': True, 'alerts': [], 'summary': {'new': 0, 'total': 0}},
    '/api/v1/veyon/computers': {'computers': []},
    '/api/v1/maintenance/modules': {'modules': []},
    '/api/v1/maintenance/android/status': {'ok': True, 'adbAvailable': False, 'devices': [DEVICE], 'profiles': []},
    '/api/v1/maintenance/android/agent/artifact': {'artifact': {'available': False}},
}


class WorkspaceBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        OUTPUT.mkdir(parents=True, exist_ok=True)
        cls.pw = sync_playwright().start()
        cls.engine = os.getenv('DISPLAY_TEST_BROWSER', 'chromium')
        launch = {'headless': True}
        if os.getenv('DISPLAY_TEST_EXECUTABLE'):
            launch['executable_path'] = os.environ['DISPLAY_TEST_EXECUTABLE']
        cls.browser = getattr(cls.pw, cls.engine).launch(**launch)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def page(self, path, width=1440, role='admin', overrides=None, theme=None, devices=None, transport=None):
        fixtures = {**FIXTURES, **(overrides or {})}
        if theme:
            fixtures['/api/v1/branding'] = {'branding': {'theme': theme}}
            fixtures['/api/v1/admin/config'] = {**fixtures['/api/v1/admin/config'], 'site': {'theme': theme}}
        context = self.browser.new_context(viewport={'width': width, 'height': 1000})
        self.addCleanup(context.close)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page._fixture_dialog_handler = lambda dialog: dialog.dismiss()
        page.on('dialog', page._fixture_dialog_handler)
        def route(req):
            target = urlparse(req.request.url).path
            if transport and transport(req, target):
                return
            if target == '/api/v1/auth/status':
                user = None if role is None else {'username': 'fixture', 'displayName': 'Test operator',
                       'role': role, 'capabilities': ['*'] if role == 'admin' else ['classroom.read']}
                return req.fulfill(json={'authEnabled': True, 'userCount': 1, 'user': user})
            if target in fixtures:
                return req.fulfill(json=fixtures[target])
            if target.startswith('/api/'):
                return req.fulfill(status=503, json={'error': 'Optional integration unavailable in browser fixture'})
            if target.endswith('/'):
                target += 'index.html'
            file = ROOT / 'public' / target.lstrip('/')
            if not file.is_file():
                return req.fulfill(status=404, body='Not found')
            mime = {'.js': 'text/javascript', '.mjs': 'text/javascript'}.get(file.suffix)
            return req.fulfill(content_type=mime or mimetypes.guess_type(str(file))[0] or 'application/octet-stream', body=file.read_bytes())
        context.route('**/*', route)
        # The socket is real browser WebSocket; only transport replies are fixtures.
        def socket(ws):
            def receive(message):
                value = json.loads(message)
                if value.get('type') == 'hello':
                    ws.send(json.dumps({'type': 'hello.ack', 'devices': devices or {}, 'groups': {}, 'runtime': {'displays': {}}}))
            ws.on_message(receive)
        context.route_web_socket('**/*', socket)
        page.goto('http://127.0.0.1:31337' + path)
        page.wait_for_function("document.readyState === 'complete'")
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        return page, errors

    def evidence(self, page, errors, label):
        page.screenshot(path=str(OUTPUT / f'{self.engine}-{label}.png'), full_page=True)
        geometry = page.evaluate('''() => ({viewport: innerWidth, document: document.documentElement.scrollWidth,
          overflowing: [...document.querySelectorAll('body *')].filter(el => {
            const r = el.getBoundingClientRect(); return r.width && r.right > innerWidth + 1;
          }).slice(0,12).map(el => ({tag:el.tagName,id:el.id,class:el.className}))})''')
        (OUTPUT / f'{self.engine}-{label}.json').write_text(json.dumps({'geometry': geometry, 'errors': errors}, indent=2))
        self.assertFalse(errors, errors)
        self.assertLessEqual(geometry['document'], geometry['viewport'] + 1, geometry)

    def test_operator_pages_at_mobile_and_desktop(self):
        for width in (390, 1440):
            for path in ('/controller/', '/controller/display.html', '/controller/lab.html',
                         '/controller/veyon.html', '/setup/', '/managed-displays/'):
                with self.subTest(width=width, path=path):
                    page, errors = self.page(path, width)
                    self.evidence(page, errors, f'{path.strip("/").replace("/", "-")}-{width}')

    def test_controller_navigation_search_and_sections(self):
        for width in (390, 1440):
            page, errors = self.page('/controller/', width)
            page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
            buttons = page.locator('#workspaceSidebar nav button[data-page]')
            ids = buttons.evaluate_all('(items) => items.map(item => item.dataset.page)')
            for page_id in ids:
                if width == 390:
                    page.locator('#workspaceMenu').click()
                search = page.locator('#workspaceSearch')
                label = page.locator(f'nav button[data-page="{page_id}"]').inner_text()
                search.fill(label)
                page.locator(f'nav button[data-page="{page_id}"]').click()
                self.assertEqual(page.locator('.page.active').get_attribute('id'), page_id)
                if width == 390:
                    self.assertEqual(page.locator('#workspaceMenu').get_attribute('aria-expanded'), 'false')
                self.evidence(page, errors, f'section-{page_id}-{width}')
            if width == 390:
                page.locator('#workspaceMenu').click()
                page.keyboard.press('Escape')
                self.assertEqual(page.locator('#workspaceMenu').get_attribute('aria-expanded'), 'false')

    def test_search_does_not_reveal_unauthorized_navigation(self):
        page, errors = self.page('/controller/', role='teacher')
        page.wait_for_function("window.AUTH_STATUS?.user?.role === 'teacher'")
        for query in ('Settings', 'Infrastructure', 'Managed', ''):
            page.locator('#workspaceSearch').fill(query)
            self.assertFalse(page.locator('nav button[data-page="settings"]').is_visible())
            self.assertFalse(page.locator('nav button[data-page="system"]').is_visible())
            for link in page.locator('[data-workspace-link="settings"], [data-workspace-link="system"]').all():
                self.assertFalse(link.is_visible())
            for link in page.locator('#workspaceSidebar [data-managed-displays-link]').all():
                self.assertFalse(link.is_visible())
        self.assertFalse(errors, errors)
        locked, locked_errors = self.page('/controller/', width=390, role=None)
        self.assertTrue(locked.locator('#loginOverlay').is_visible())
        self.assertIn('auth-locked', locked.locator('body').get_attribute('class'))
        self.evidence(locked, locked_errors, 'login-390')

    def test_managed_disclosure_and_offline_inventory(self):
        page, errors = self.page('/managed-displays/', width=390)
        page.locator('#devices .card').wait_for()
        self.assertEqual(page.locator('#devices .card').count(), 1)
        for selector in ('.enroll-panel', '#remoteShell', '[data-disclosure="device-tools"]', '.agent-v2-panel'):
            detail = page.locator(selector).first
            self.assertFalse(detail.evaluate('(el) => el.open'))
            detail.locator(':scope > summary').click()
            self.assertTrue(detail.evaluate('(el) => el.open'))
        self.assertTrue(page.locator('#devices button[data-op="edit"]').is_enabled())
        self.assertTrue(page.locator('#devices button[data-action="wake"]').is_disabled())
        page.locator('#refresh').click()
        page.wait_for_function("document.querySelector('[data-disclosure=\"device-tools\"]').open")
        self.evidence(page, errors, 'managed-expanded-390')

    def test_setup_optional_fields_expand_without_losing_inputs(self):
        page, errors = self.page('/setup/', width=390)
        page.locator('#school').fill('Example School')
        detail = page.locator('.setup-advanced').first
        self.assertFalse(detail.evaluate('(el) => el.open'))
        detail.locator('summary').click()
        self.assertTrue(page.locator('#themeMode').is_visible())
        detail.locator('summary').click()
        self.assertEqual(page.locator('#school').input_value(), 'Example School')
        self.assertFalse(errors, errors)

    def test_populated_mobile_cards_and_display_targets(self):
        computers = [{'id': 'fixture-computer', 'name': 'Networking and cybersecurity laboratory workstation 21',
                      'hostname': 'networking-laboratory-workstation-21', 'ip': '192.0.2.121', 'online': False,
                      'user': 'Example Student', 'os': 'Windows 11 Education', 'uptimeSeconds': 7200,
                      'latestWebsite': {'title': 'Routing and switching laboratory reference materials',
                                        'domain': 'learning-resources.example.edu', 'browser': 'Edge',
                                        'visitTime': '2026-09-13T12:00:00Z'},
                      'lastCommand': {'action': 'message', 'status': 'completed',
                                      'message': 'Prepare your network topology and save your laboratory notes.'}}]
        page, errors = self.page('/controller/lab.html', 390, overrides={
            '/api/v1/lab/computers': {'configured': True, 'retentionHours': 168, 'computers': computers,
                                     'summary': {'total': 1, 'online': 0, 'offline': 1}}})
        page.locator('#computerGrid .card').wait_for()
        self.assertEqual(page.locator('#computerGrid .card').count(), 1)
        self.assertIn('OFFLINE', page.locator('#computerGrid').inner_text())
        self.evidence(page, errors, 'lab-populated-390')
        devices = {'fixture-display': {'name': 'Networking laboratory collaborative project display', 'enabled': True}}
        files = [{'name': 'Network topology and classroom laboratory instructions - September.pdf',
                  'type': 'pdf', 'url': '/fixture/network-laboratory.pdf', 'size': 1200000},
                 {'name': 'Classroom network security and equipment care reminders.pdf',
                  'type': 'pdf', 'url': '/fixture/security-reminders.pdf', 'size': 240000}]
        page, errors = self.page('/controller/display.html', 390, devices=devices, overrides={
            '/api/v1/media': {'files': files},
            '/api/v1/devices': {'devices': devices, 'groups': {}, 'status': {}}})
        page.locator('#targets .target').wait_for()
        page.locator('button[data-work="media"]').click()
        page.locator('#mediaGrid .mediaCard').first.wait_for()
        self.assertEqual(page.locator('#mediaGrid .mediaCard').count(), 2)
        self.assertIn('Networking laboratory', page.locator('#targets').inner_text())
        self.evidence(page, errors, 'studio-populated-media-390')

    def test_light_branding_operator_pages(self):
        theme = {'mode': 'light', 'primary': '#0F766E', 'accent': '#15803D',
                 'background': '#F8FAFC', 'surface': '#FFFFFF', 'text': '#1E293B'}
        for path in ('/controller/', '/controller/display.html', '/controller/lab.html',
                     '/controller/veyon.html', '/setup/', '/managed-displays/'):
            with self.subTest(path=path):
                page, errors = self.page(path, 390, theme=theme)
                page.wait_for_function("document.documentElement.dataset.brandMode === 'light'")
                self.assertEqual(page.evaluate("getComputedStyle(document.body).color"), 'rgb(30, 41, 59)')
                if path == '/controller/veyon.html':
                    contrast = page.locator('#showStudents').evaluate(r"""(button) => {
                      const css = getComputedStyle(button);
                      const luminance = color => {
                        const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => {
                          x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
                        });
                        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
                      };
                      const values = [luminance(css.color), luminance(css.backgroundColor)].sort((a,b) => b-a);
                      return {ratio: (values[0] + .05) / (values[1] + .05),
                              foreground: css.color, background: css.backgroundColor};
                    }""")
                    self.assertGreaterEqual(contrast['ratio'], 4.5, contrast)
                self.evidence(page, errors, 'light-' + path.strip('/').replace('/', '-') + '-390')

    def veyon_page(self, width=1440, broken=False):
        # Real browser image decoding, with only the upstream transport simulated.
        # Valid IDAT CRC is required: Firefox rejects a corrupt PNG that Chromium accepts.
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=')
        computers = [
            {'id': 'student-a', 'name': 'Workstation A', 'ip': '192.0.2.21', 'role': 'student',
             'online': True, 'authenticated': True, 'user': {'login': 'student'}, 'featureState': {}},
            {'id': 'student-b', 'name': 'Workstation B', 'ip': '192.0.2.22', 'role': 'student',
             'online': False, 'authenticated': False, 'user': {}, 'featureState': {}},
            {'id': 'teacher', 'name': 'Teacher computer', 'ip': '192.0.2.23', 'role': 'teacher',
             'online': True, 'authenticated': True, 'user': {}, 'featureState': {}}]
        state = {'broken': broken, 'requests': 0, 'commands': [], 'computers': computers}
        def transport(route, path):
            if path.endswith('/framebuffer'):
                state['requests'] += 1
                if state['broken'] == 'malformed':
                    route.fulfill(content_type='image/png', body=b'not a decoded image')
                elif state['broken'] == 'json':
                    route.fulfill(json={'error': 'Unexpected JSON in image response'})
                elif state['broken']:
                    route.fulfill(status=502, json={'error': 'Fixture screen capture unavailable'})
                else:
                    route.fulfill(content_type='image/png', body=png)
                return True
            if path == '/api/v1/veyon/computers':
                route.fulfill(json={'computers': state['computers']})
                return True
            if path == '/api/v1/veyon/feature':
                state['commands'].append(route.request.post_data_json)
                route.fulfill(json={'results': [], 'summary': {'succeeded': 1, 'failed': 0}})
                return True
            return False
        page, errors = self.page('/controller/veyon.html', width, transport=transport, overrides={
            '/api/v1/veyon/status': {'keyName': 'fixture', 'scanSubnet': '192.0.2'}})
        page.locator('[data-select="student-a"]').wait_for()
        return page, errors, state

    def test_veyon_decoded_preview_survives_refresh_and_filter(self):
        page, errors, state = self.veyon_page()
        page.wait_for_function("document.querySelector('[data-thumb=student-a]')?.naturalWidth > 0")
        page.locator('[data-select="student-a"]').check()
        original = page.locator('[data-thumb="student-a"]').get_attribute('src')
        page.locator('#refresh').click()
        page.wait_for_function("document.querySelector('[data-thumb=student-a]')?.naturalWidth > 0")
        self.assertTrue(page.locator('[data-select="student-a"]').is_checked())
        self.assertEqual(page.locator('[data-thumb="student-a"]').get_attribute('src'), original)
        page.locator('#deviceSearch').fill('Workstation B')
        self.assertEqual(page.locator('[data-select="student-a"]').count(), 0)
        page.locator('#deviceSearch').fill('')
        self.assertTrue(page.locator('[data-select="student-a"]').is_checked())
        page.wait_for_function("document.querySelector('[data-thumb=student-a]')?.naturalWidth > 0")
        self.assertIn('1 selected', page.locator('#selectionCount').inner_text())
        self.evidence(page, errors, 'veyon-decoded-refresh')

    def test_veyon_failed_preview_retries_and_live_modal_recovers(self):
        page, errors, state = self.veyon_page(broken=True)
        page.locator('[data-retry="student-a"]').wait_for(state='visible')
        self.assertFalse(page.locator('[data-thumb="student-a"]').is_visible())
        state['broken'] = False
        page.locator('[data-retry="student-a"]').click()
        page.wait_for_function("document.querySelector('[data-thumb=student-a]')?.naturalWidth > 0")
        page.locator('[data-live="student-a"]').click()
        page.wait_for_function("document.querySelector('#liveImg').naturalWidth > 0")
        state['broken'] = True
        page.locator('#liveRetry').click()
        page.wait_for_function("/unavailable|failed|error|retry/i.test(document.querySelector('#liveStatus').textContent)")
        # The most recent valid frame remains visible, explicitly marked stale/error.
        self.assertGreater(page.locator('#liveImg').evaluate('(image) => image.naturalWidth'), 0)
        state['broken'] = False
        page.locator('#liveRetry').click()
        page.wait_for_function("!/unavailable|failed|error|retrying/i.test(document.querySelector('#liveStatus').textContent)")
        self.evidence(page, errors, 'veyon-live-recovered')
        page.keyboard.press('Escape')
        self.assertNotIn('open', page.locator('#modal').get_attribute('class'))
        self.assertEqual(page.locator(':focus').get_attribute('data-live'), 'student-a')

    def test_veyon_mobile_density_filters_and_all_commands_reachable(self):
        page, errors, state = self.veyon_page(width=390)
        page.locator('#showAll').click()
        self.assertEqual(page.locator('[data-select]').count(), 3)
        page.locator('#connectionFilter').select_option('offline')
        self.assertEqual(page.locator('[data-select]').count(), 1)
        self.assertEqual(page.locator('[data-select]').get_attribute('data-select'), 'student-b')
        page.locator('#connectionFilter').select_option('all')
        for layout in ('compact', 'comfortable', 'list'):
            page.locator('#deviceLayout').select_option(layout)
            self.assertEqual(page.locator('#grid').get_attribute('data-layout'), layout)
            self.evidence(page, errors, 'veyon-' + layout + '-390')
        page.locator('#pausePreviews').click()
        self.assertEqual(page.locator('#pausePreviews').get_attribute('aria-pressed'), 'true')
        for detail in page.locator('details').all():
            if not detail.evaluate('(el) => el.open'):
                detail.locator(':scope > summary').click()
        for command in ('message', 'lock', 'unlock', 'openSite', 'startApp', 'broadcastFull',
                        'broadcastWindow', 'stopBroadcast', 'screenshot', 'inputLock', 'inputUnlock',
                        'login', 'logoff', 'reboot', 'shutdown', 'markStudent', 'markTeacher', 'features', 'pool'):
            self.assertTrue(page.locator('#' + command).is_visible(), command)
        self.evidence(page, errors, 'veyon-all-commands-390')

    def test_veyon_commands_preserve_targets_and_power_confirmation(self):
        page, errors, state = self.veyon_page()
        page.locator('[data-select="student-a"]').check()
        with page.expect_response('**/api/v1/veyon/feature'):
            page.locator('#lock').click()
        self.assertEqual(state['commands'][-1]['targets'], ['student-a'])
        self.assertEqual(state['commands'][-1]['feature'], 'screenLock')
        for detail in page.locator('details').all():
            if not detail.evaluate('(el) => el.open'):
                detail.locator(':scope > summary').click()
        count = len(state['commands'])
        page.locator('#shutdown').click()  # Harness dismisses the native confirmation.
        self.assertEqual(len(state['commands']), count)
        page.remove_listener('dialog', page._fixture_dialog_handler)
        page.once('dialog', lambda dialog: dialog.accept())
        with page.expect_response('**/api/v1/veyon/feature'):
            page.locator('#shutdown').click()
        self.assertEqual(state['commands'][-1]['feature'], 'powerDown')
        self.assertEqual(state['commands'][-1]['targets'], ['student-a'])
        self.assertFalse(errors, errors)

    def test_managed_inventory_filter_retained_after_refresh(self):
        online = {**DEVICE, 'id': 'second-tv', 'name': 'Second display', 'lastStatus': {'online': True}}
        page, errors = self.page('/managed-displays/', width=390, overrides={
            '/api/v1/maintenance/android/status': {'ok': True, 'adbAvailable': False,
                                                   'devices': [DEVICE, online], 'profiles': []}})
        page.locator('#devices .card').first.wait_for()
        page.locator('#deviceSearch').fill('Second')
        self.assertEqual(page.locator('#devices .card:visible').count(), 1)
        page.locator('#deviceDensity').select_option('compact')
        page.locator('#refresh').click()
        self.assertEqual(page.locator('#deviceSearch').input_value(), 'Second')
        self.assertEqual(page.locator('#devices .card:visible').count(), 1)
        page.locator('#deviceSearch').fill('')
        page.locator('#deviceFilter').select_option('offline')
        self.assertEqual(page.locator('#devices .card:visible').count(), 1)
        self.assertIn('Classroom display', page.locator('#devices .card:visible').inner_text())
        self.evidence(page, errors, 'managed-filter-390')

    def test_default_brand_logo_decodes_and_custom_error_falls_back(self):
        for branding in ({}, {'logoUrl': '/missing-custom-school-logo.png'}):
            page, errors = self.page('/controller/veyon.html', overrides={
                '/api/v1/branding': {'branding': branding}})
            page.wait_for_function("[...document.querySelectorAll('[data-brand-logo]')].some(img => img.complete && img.naturalWidth > 0)")
            self.assertIn('RoomGoblin', page.locator('[data-brand-lockup]').inner_text())
            self.assertFalse(errors, errors)

    def test_lab_selection_respects_visible_inventory(self):
        computers = [{'id': 'lab-a', 'name': 'Alpha workstation', 'online': True},
                     {'id': 'lab-b', 'name': 'Beta workstation', 'online': True},
                     {'id': 'lab-c', 'name': 'Offline workstation', 'online': False}]
        page, errors = self.page('/controller/lab.html', 390, overrides={
            '/api/v1/lab/computers': {'configured': True, 'retentionHours': 168,
                                     'computers': computers, 'summary': {'total': 3, 'online': 2, 'offline': 1}}})
        page.locator('[data-computer-id="lab-a"]').wait_for()
        page.locator('#computerSearch').fill('Alpha')
        page.locator('button[onclick="selectOnline()"]').click()
        self.assertIn('1 selected', page.locator('#selectionCount').inner_text())
        page.locator('#computerSearch').fill('')
        page.locator('#computerStatus').select_option('selected')
        self.assertEqual(page.locator('#computerGrid .card').count(), 1)
        self.assertEqual(page.locator('#computerGrid .card').get_attribute('data-computer-id'), 'lab-a')
        page.locator('#computerDensity').select_option('compact')
        self.evidence(page, errors, 'lab-filtered-selection-390')

    def test_focus_workspace_keeps_embedded_session_and_mobile_menu_is_modal(self):
        page, errors = self.page('/controller/')
        page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
        page.evaluate("window.fixtureLabFrame = document.getElementById('labWindowsFrame')")
        page.locator('#workspaceFocus').click()
        self.assertEqual(page.locator('#workspaceFocus').get_attribute('aria-pressed'), 'true')
        self.assertTrue(page.evaluate("window.fixtureLabFrame === document.getElementById('labWindowsFrame')"))
        page.locator('#workspaceFocus').click()
        self.assertEqual(page.locator('#workspaceFocus').get_attribute('aria-pressed'), 'false')
        self.assertFalse(errors, errors)
        mobile, errors = self.page('/controller/', 390)
        mobile.locator('#workspaceMenu').click()
        self.assertTrue(mobile.locator('#workspaceMain').evaluate('(el) => el.inert'))
        mobile.locator('#workspaceBackdrop').click(position={'x': 385, 'y': 500})
        self.assertFalse(mobile.locator('#workspaceMain').evaluate('(el) => el.inert'))
        self.assertEqual(mobile.locator('#workspaceMenu').get_attribute('aria-expanded'), 'false')
        self.assertFalse(errors, errors)

    def test_veyon_rejects_malformed_image_and_json_success_payload(self):
        for failure in ('malformed', 'json'):
            with self.subTest(payload=failure):
                page, errors, state = self.veyon_page(broken=failure)
                page.locator('[data-retry="student-a"]').wait_for(state='visible')
                self.assertFalse(page.locator('[data-thumb="student-a"]').is_visible())
                state['broken'] = False
                page.locator('[data-retry="student-a"]').click()
                page.wait_for_function("document.querySelector('[data-thumb=student-a]')?.naturalWidth > 0")
                self.assertFalse(errors, errors)
