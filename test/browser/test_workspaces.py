"""Real operator HTML/CSS/JS with deterministic HTTP/WebSocket transports.

Run with the existing Playwright requirements and DISPLAY_TEST_BROWSER setting.
Optional integrations deliberately return 503: their unavailable presentation is
part of the layout contract. JavaScript exceptions are never filtered out.
"""
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
    '/api/v1/media': {'items': [], 'media': []},
    '/api/v1/scenes': {'scenes': []},
    '/api/v1/govee': {'devices': {}, 'groups': {}},
    '/api/v1/lab/computers': {'computers': [], 'groups': [], 'summary': {'total': 0, 'online': 0, 'offline': 0}},
    '/api/v1/lab/ai-monitor': {'events': [], 'summary': {}},
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

    def page(self, path, width=1440, role='admin'):
        context = self.browser.new_context(viewport={'width': width, 'height': 1000})
        self.addCleanup(context.close)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('dialog', lambda dialog: dialog.dismiss())
        def route(req):
            target = urlparse(req.request.url).path
            if target == '/api/v1/auth/status':
                user = None if role is None else {'username': 'fixture', 'displayName': 'Test operator',
                       'role': role, 'capabilities': ['*'] if role == 'admin' else ['classroom.read']}
                return req.fulfill(json={'authEnabled': True, 'userCount': 1, 'user': user})
            if target in FIXTURES:
                return req.fulfill(json=FIXTURES[target])
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
                    ws.send(json.dumps({'type': 'hello.ack', 'devices': {}, 'groups': {}, 'runtime': {'displays': {}}}))
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
        detail = page.locator('.setup-advanced')
        self.assertFalse(detail.evaluate('(el) => el.open'))
        detail.locator('summary').click()
        self.assertTrue(page.locator('#themeMode').is_visible())
        detail.locator('summary').click()
        self.assertEqual(page.locator('#school').input_value(), 'Example School')
        self.assertFalse(errors, errors)
