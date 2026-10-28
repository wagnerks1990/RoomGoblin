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
    '/api/v1/veyon/jobs': {'jobs': []},
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

    def test_ubuntu_wizard_assigns_outputs_independently_and_keeps_drafts(self):
        monitor = 'a' * 64
        outputs = [{'connector': name, 'connected': True, 'monitorId': monitor, 'modes': ['1920x1080']} for name in ('HDMI-1', 'DP-1')]
        requests = []
        def transport(route, target):
            if not target.startswith('/api/v1/ubuntu-displays'):
                return False
            requests.append((target, route.request.method))
            if target.endswith('/host-key'):
                self.assertNotIn('password', route.request.post_data_json)
                self.assertNotIn('privateKey', route.request.post_data_json)
                route.fulfill(json={'fingerprint': 'SHA256:' + 'A' * 43})
            elif target.endswith('/probe'):
                route.fulfill(json={'ok': True, 'hostname': 'fixture-computer', 'version': '24.04', 'graphics': 'x11', 'outputs': outputs})
            else:
                route.fulfill(json={'ok': True, 'devices': [], 'receivers': {'screen1': {'name': 'Existing screen'}}})
            return True
        for width in (390, 1440):
            page, errors = self.page('/managed-displays/', width, transport=transport)
            page.locator('#ubuntuAdd').click()
            page.locator('#ubuntuName').fill('Fixture computer')
            page.locator('#ubuntuAddress').fill('10.0.0.8')
            page.locator('#ubuntuPassword').fill('fixture-password')
            page.locator('#ubuntuGetFingerprint').click()
            page.wait_for_function("document.getElementById('ubuntuFingerprint').value.startsWith('SHA256:')")
            page.locator('#ubuntuNext').click()
            self.assertIn('Verify', page.locator('#ubuntuMessage').inner_text())
            page.locator('#ubuntuHostVerified').check()
            page.locator('#ubuntuNext').click()
            page.locator('[data-connector="HDMI-1"]').wait_for()
            rows = page.locator('#ubuntuOutputRows [name="receiver"]')
            rows.nth(0).fill('screen1')
            rows.nth(1).fill('screen1')
            page.locator('#ubuntuNext').click()
            self.assertIn('different receiver', page.locator('#ubuntuMessage').inner_text())
            rows.nth(1).fill('screen2')
            page.locator('#ubuntuNext').click()
            self.assertIn('HDMI-1', page.locator('#ubuntuReview').inner_text())
            self.assertIn('DP-1', page.locator('#ubuntuReview').inner_text())
            page.locator('#ubuntuBack').click()
            self.assertEqual(rows.nth(1).input_value(), 'screen2')
            self.evidence(page, errors, f'ubuntu-multi-output-{width}')
            page.locator('#ubuntuClose').click()
            self.assertEqual(page.locator('#ubuntuPassword').input_value(), '')

    def test_ubuntu_wizard_ignores_closed_installation_jobs(self):
        pending, commands = [], []
        installs = 0
        finish_second = False
        def transport(route, target):
            nonlocal installs
            if not target.startswith('/api/v1/ubuntu-displays'):
                return False
            if target.endswith('/host-key'):
                route.fulfill(json={'fingerprint': 'SHA256:' + 'A' * 43})
            elif target.endswith('/probe'):
                route.fulfill(json={'ok': True, 'hostname': 'fixture', 'version': '24.04', 'graphics': 'session-unavailable', 'outputs': []})
            elif target.endswith('/jobs/job1'):
                pending.append(route)
            elif target.endswith('/jobs/job2'):
                route.fulfill(json={'job': {'id': 'job2', 'deviceId': 'computer2', 'state': 'completed' if finish_second else 'running', 'stage': 'Second installation'}})
            elif target.endswith('/command'):
                commands.append(target)
                route.fulfill(json={'ok': True, 'accepted': True})
            elif route.request.method == 'POST':
                installs += 1
                route.fulfill(json={'ok': True, 'job': {'id': f'job{installs}'}})
            else:
                route.fulfill(json={'ok': True, 'devices': [], 'receivers': {}})
            return True
        page, errors = self.page('/managed-displays/', transport=transport)
        page.clock.install()
        for number in (1, 2):
            page.locator('#ubuntuAdd').click()
            page.locator('#ubuntuName').fill(f'Computer {number}')
            page.locator('#ubuntuAddress').fill(f'10.0.0.{number}')
            page.locator('#ubuntuPassword').fill('fixture-password')
            page.locator('#ubuntuGetFingerprint').click()
            page.wait_for_function("document.getElementById('ubuntuFingerprint').value.startsWith('SHA256:')")
            page.locator('#ubuntuHostVerified').check()
            page.locator('#ubuntuNext').click()
            page.locator('#ubuntuNext').click()
            page.locator('#ubuntuConsent').check()
            with page.expect_request(f'**/jobs/job{number}'):
                page.locator('#ubuntuNext').click()
            if number == 1:
                page.locator('#ubuntuClose').click()
        self.assertEqual(len(pending), 1)
        page.wait_for_function("document.getElementById('ubuntuJobStatus').textContent === 'Second installation'")
        pending[0].fulfill(json={'job': {'id': 'job1', 'deviceId': 'computer1', 'state': 'completed', 'stage': 'Old installation'}})
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        self.assertEqual(page.locator('#ubuntuJobStatus').inner_text(), 'Second installation')
        self.assertTrue(page.locator('#ubuntuActivate').is_hidden())
        finish_second = True
        page.clock.fast_forward(3100)
        page.locator('#ubuntuActivate').wait_for(state='visible')
        self.assertEqual(page.locator('#ubuntuActivate').get_attribute('data-device'), 'computer2')
        page.remove_listener('dialog', page._fixture_dialog_handler)
        page.on('dialog', lambda dialog: dialog.accept())
        page.locator('#ubuntuActivate').click()
        page.wait_for_function("document.getElementById('ubuntuActivate').hidden")
        self.assertEqual(commands, ['/api/v1/ubuntu-displays/computer2/command'])
        page.keyboard.press('Escape')
        page.locator('#ubuntuAdd').click()
        self.assertTrue(page.locator('#ubuntuActivate').is_hidden())
        self.assertIsNone(page.locator('#ubuntuActivate').get_attribute('data-device'))
        self.assertEqual(page.locator('#ubuntuJobStatus').inner_text(), '')
        self.assertFalse(errors, errors)

    def test_ubuntu_fleet_health_updates_scheduling_and_polling_preserve_drafts(self):
        monitor = 'a' * 64
        screen = {'connector': 'HDMI-1', 'monitorId': monitor, 'receiverId': 'screen1', 'name': 'Hallway screen', 'mode': '1920x1080', 'rotation': 'normal', 'audioSink': 'missing-hdmi', 'enabled': True}
        status = {'protocolVersion': '2', 'identity': 'fixture', 'version': '24.04', 'kernel': '6.8.0', 'agentVersion': 'fixture', 'packageDigest': 'a' * 64,
                  'outputs': [{'connector': 'HDMI-1', 'monitorId': monitor, 'connected': True, 'modes': ['1920x1080']}], 'audio': {'sinks': []},
                  'session': {'online': True, 'screens': [{'receiverId': 'screen1', 'browserRunning': True}]},
                  'health': {'cpuPercent': 12, 'memoryTotalKiB': 100, 'memoryAvailableKiB': 50, 'diskFreeBytes': 50000000000, 'uptimeSeconds': 5000},
                  'maintenance': {'updates': {'count': 1, 'securityCount': 1, 'checkedAt': 1750000000, 'packages': [{'name': 'openssl', 'installed': '3.0', 'candidate': '3.1', 'security': True}]}}}
        device = {'id': 'fixture', 'name': 'Hallway computer', 'address': '10.0.0.8', 'port': 22, 'location': 'Hallway', 'config': {'hubUrl': 'http://10.0.0.2:3000', 'screens': [screen]},
                  'health': {'state': 'attention', 'alerts': [{'code': 'reboot', 'text': 'Ubuntu requires a reboot.'}]}, 'live': {'online': True, 'at': 1750000000000, 'status': status}}
        sent = []
        unavailable = [False]
        def transport(route, target):
            if not target.startswith('/api/v1/ubuntu-displays'):
                return False
            if route.request.method in ('POST', 'PUT') and not target.endswith('/refresh'):
                sent.append((target, route.request.post_data_json))
                if unavailable[0]:
                    route.fulfill(status=503, content_type='text/html', body='<!DOCTYPE html><title>Unavailable</title>')
                else:
                    route.fulfill(json={'ok': True, 'accepted': True})
            else:
                route.fulfill(json={'ok': True, 'devices': [device], 'receivers': {'screen1': {'name': 'Hallway screen'}}})
            return True
        for width, theme in ((390, "dark"), (1440, "dark"), (390, "light"), (1440, "light")):
            page, errors = self.page('/managed-displays/', width, transport=transport, theme={'mode': theme})
            page.clock.install()
            page.locator('[data-id="fixture"]').wait_for()
            self.assertIn('12%', page.locator('.ubuntu-metrics').inner_text())
            colors = page.locator('.ubuntu-screen').evaluate('(element) => ({background:getComputedStyle(element).backgroundColor,color:getComputedStyle(element).color})')
            self.assertEqual(colors['background'], 'rgb(243, 246, 249)' if theme == 'light' else 'rgb(11, 19, 32)')
            self.assertEqual(colors['color'], 'rgb(30, 41, 59)' if theme == 'light' else 'rgb(248, 250, 252)')
            page.locator('#ubuntuSearch').fill('does not exist')
            self.assertEqual(page.locator('.ubuntu-computer').count(), 0)
            page.locator('#ubuntuSearch').fill('Hallway')
            page.locator('summary', has_text='Software & updates').click()
            page.locator('[data-action="maintenance"]').click()
            page.locator('#ubuntuOperation').select_option('update-os')
            self.assertIn('automatic OS rollback', page.locator('#ubuntuOperationDetail').inner_text())
            page.locator('#ubuntuMaintenanceWhen').select_option('later')
            page.locator('#ubuntuScheduleAt').fill('2027-01-01T21:00')
            page.clock.fast_forward(16000)
            self.assertEqual(page.locator('#ubuntuOperation').input_value(), 'update-os')
            self.assertEqual(page.locator('#ubuntuScheduleAt').input_value(), '2027-01-01T21:00')
            page.locator('#ubuntuMaintenanceConfirm').check()
            page.locator('#ubuntuMaintenanceSubmit').click()
            page.locator('#ubuntuMaintenance').wait_for(state='hidden')
            self.assertEqual(sent[-1][1]['operation'], 'update-os')
            self.assertIn('scheduleAt', sent[-1][1])
            unavailable[0] = True
            page.locator('[data-action="maintenance"]').click()
            page.locator('#ubuntuMaintenanceConfirm').check()
            page.locator('#ubuntuMaintenanceSubmit').click()
            page.wait_for_function("document.querySelector('#ubuntuMaintenanceMessage').textContent.includes('Request failed (503)')")
            self.assertIn('delivery may be unconfirmed', page.locator('#ubuntuMaintenanceMessage').inner_text())
            count = len(sent)
            page.clock.fast_forward(16000)
            self.assertEqual(len(sent), count)
            self.assertTrue(page.locator('#ubuntuMaintenanceConfirm').is_checked())
            page.locator('#ubuntuMaintenanceClose').click()
            unavailable[0] = False
            page.locator('[data-action="details"]').click()
            page.locator('#ubuntuDetailNotes').fill('Retain this unsaved note')
            page.clock.fast_forward(16000)
            self.assertEqual(page.locator('#ubuntuDetailNotes').input_value(), 'Retain this unsaved note')
            page.locator('#ubuntuDetailsClose').click()
            page.locator('[data-action="edit"]').click()
            page.locator('[name="audioSink"]').wait_for()
            self.assertEqual(page.locator('[name="audioSink"]').input_value(), 'missing-hdmi')
            self.assertEqual(page.locator('[name="graphicsMode"]').input_value(), 'software')
            page.locator('#ubuntuClose').click()
            self.evidence(page, errors, f'ubuntu-fleet-{theme}-{width}')

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

    def test_navigation_yields_to_account_and_expired_session(self):
        page, errors = self.page('/controller/', width=390)
        page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
        page.locator('#workspaceMenu').click()
        page.locator('#authAccount button').first.click()
        page.locator('#currentPassword').wait_for()
        self.assertEqual(page.locator('#workspaceMenu').get_attribute('aria-expanded'), 'false')
        page.locator('#accountModal button').last.focus()
        page.keyboard.press('Tab')
        self.assertEqual(page.locator(':focus').get_attribute('aria-label'), 'Close account dialog')
        page.keyboard.press('Shift+Tab')
        self.assertEqual(page.locator(':focus').inner_text(), 'Sign out others')
        page.locator('#currentPassword').fill('temporary fixture value')
        page.keyboard.press('Escape')
        self.assertFalse(page.locator('#accountModal').is_visible())
        self.assertEqual(page.locator('#currentPassword').input_value(), '')
        self.assertEqual(page.locator(':focus').get_attribute('id'), 'workspaceMenu')
        page.locator('#workspaceMenu').click()
        page.evaluate("applyAuthUi({authEnabled:true,user:null}); showLogin()")
        self.assertEqual(page.locator('#workspaceMenu').get_attribute('aria-expanded'), 'false')
        self.assertFalse(page.locator('#workspaceMain').evaluate('(el) => el.inert'))
        self.assertFalse(page.locator('nav button[data-page="settings"]').is_visible())
        page.wait_for_function("document.activeElement.id === 'loginUser'")
        page.locator('#loginOverlay button').last.focus()
        page.keyboard.press('Tab')
        self.assertEqual(page.locator(':focus').get_attribute('id'), 'loginUser')
        page.locator('#loginPassword').fill('unfinished fixture login')
        page.evaluate('showLogin()')
        page.wait_for_timeout(100)
        self.assertEqual(page.locator(':focus').get_attribute('id'), 'loginPassword')
        self.assertEqual(page.locator('#loginPassword').input_value(), 'unfinished fixture login')
        self.assertFalse(errors, errors)

    def test_shared_workspace_code_warning_and_focus_contrast(self):
        for mode in ('light', 'dark', 'system'):
            page, errors = self.page('/controller/', theme={'mode': mode})
            if mode == 'system':
                page.emulate_media(color_scheme='light')
            page.wait_for_function(f"document.documentElement.dataset.brandMode === '{mode}'")
            self.assertEqual(page.evaluate('getComputedStyle(document.body).backgroundColor'),
                             'rgb(11, 19, 32)' if mode == 'dark' else 'rgb(243, 246, 249)')
            self.assertEqual(page.evaluate('getComputedStyle(document.body).color'),
                             'rgb(248, 250, 252)' if mode == 'dark' else 'rgb(30, 41, 59)')
            page.evaluate("""() => {
              const panel=document.createElement('section');
              panel.className='panel'; panel.id='contrastFixture';
              panel.innerHTML='<code>main</code><span class="rg-update-status rg-update-status--warning">running</span><div data-brand-lockup>RoomGoblin</div><button>Keyboard focus</button>';
              document.getElementById('workspaceMain').prepend(panel);
              notify('Fixture status message');
              panel.querySelector('button').focus();
            }""")
            page.keyboard.press('Tab')
            page.keyboard.press('Shift+Tab')
            values = page.locator('#contrastFixture').evaluate(r"""panel => {
              const luminance=color=>{
                const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{
                  x/=255; return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
                });
                return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
              };
              const ratio=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
              const surface=luminance(getComputedStyle(panel).backgroundColor);
              const toast=getComputedStyle(document.getElementById('hubToast'));
              return {
                code:ratio(luminance(getComputedStyle(panel.querySelector('code')).color),surface),
                warning:ratio(luminance(getComputedStyle(panel.querySelector('span')).color),surface),
                focus:ratio(luminance(getComputedStyle(panel.querySelector('button')).outlineColor),surface),
                brand:ratio(luminance(getComputedStyle(panel.querySelector('[data-brand-lockup]')).color),surface),
                toast:ratio(luminance(toast.color),luminance(toast.backgroundColor))
              };
            }""")
            self.assertGreaterEqual(values['code'], 4.5, (mode, values))
            self.assertGreaterEqual(values['warning'], 4.5, (mode, values))
            self.assertGreaterEqual(values['focus'], 3, (mode, values))
            self.assertGreaterEqual(values['brand'], 4.5, (mode, values))
            self.assertGreaterEqual(values['toast'], 4.5, (mode, values))
            self.assertFalse(errors, errors)

    def test_controller_feature_modules_keep_enrollment_and_update_bindings(self):
        writes = []
        enrollment = {'agentId': 'fixture-pc', 'token': "fixture-'opaque-token",
                      'installerUrl': 'https://hub.example.test/install.ps1',
                      'preferredOrigin': 'https://hub.example.test',
                      'requestOrigin': 'http://127.0.0.1:31337',
                      'expiresAt': '2030-01-01T00:00:00Z',
                      'installCommand': 'legacy fixture command'}
        def transport(route, target):
            if target == '/api/v1/admin/lab-agents/fixture-pc/enrollment':
                writes.append((target, route.request.post_data_json))
                route.fulfill(json={'enrollment': enrollment})
            elif target == '/api/v1/admin/lab-agent-credentials':
                route.fulfill(json={'credentials': [], 'policy': {}})
            elif target == '/api/v1/admin/app-updates/settings':
                if route.request.method == 'PUT':
                    writes.append((target, route.request.post_data_json))
                route.fulfill(json={'settings': {'repository': 'fixture/roomgoblin'},
                                    'currentVersion': 'fixture', 'currentCommit': 'a' * 40})
            elif target == '/api/v1/admin/app-updates/job':
                route.fulfill(json={'running': False, 'phase': 'idle', 'revertAvailable': False, 'history': []})
            elif target == '/api/v1/admin/app-updates/check':
                route.fulfill(json={'repository': 'fixture/roomgoblin', 'currentVersion': 'fixture',
                                    'currentCommit': 'a' * 40, 'available': {'shortCommit': 'b' * 12}})
            else:
                return False
            return True
        page, errors = self.page('/controller/', transport=transport)
        page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
        page.evaluate("showPage('lab'); revealControllerOutput('labEnrollmentId')")
        page.locator('#labEnrollmentId').fill('fixture-pc')
        page.locator('#labEnrollmentTtl').fill('20')
        page.get_by_role('button', name='Create One-Time Installer', exact=True).click()
        page.locator('[data-native-enrollment-file]').wait_for()
        self.assertEqual(writes, [('/api/v1/admin/lab-agents/fixture-pc/enrollment', {'ttlMinutes': 20})])
        with page.expect_download() as event:
            page.locator('[data-native-enrollment-file]').click()
        download = event.value
        payload = json.loads(Path(download.path()).read_text())
        self.assertEqual(download.suggested_filename, 'roomgoblin-enrollment-fixture-pc.json')
        self.assertEqual(payload['enrollmentToken'], enrollment['token'])
        self.assertEqual(payload['hubUrl'], enrollment['preferredOrigin'])
        self.assertEqual(payload['fallbackHubUrl'], enrollment['requestOrigin'])
        self.assertTrue(payload['allowHttpFallback'])
        self.assertFalse(payload['allowHttp'])
        self.assertIn("fixture-''opaque-token", page.locator('#labEnrollmentResult textarea').first.input_value())
        page.evaluate("showPage('system')")
        page.wait_for_function("!document.getElementById('installAppUpdateBtn').disabled")
        self.assertEqual(page.locator('#rgUpdateAvailableVersion').inner_text(), 'b' * 12)
        self.assertTrue(page.locator('#revertAppUpdateBtn').is_disabled())
        page.locator('#appUpdateInterval').fill('36')
        page.get_by_role('button', name='Save Settings', exact=True).click()
        page.wait_for_function("document.getElementById('hubToast').textContent.includes('settings saved')")
        self.assertEqual(writes[-1][1]['source'], 'main')
        self.assertEqual(writes[-1][1]['checkIntervalHours'], 36)
        self.assertEqual(len(writes), 2)
        self.assertFalse(errors, errors)

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
        state = {'broken': broken, 'requests': 0, 'commands': [], 'computers': computers, 'jobs': []}
        def transport(route, path):
            if path.endswith('/framebuffer'):
                state['requests'] += 1
                if state['broken'] == 'malformed':
                    route.fulfill(content_type='image/png', body=b'not a decoded image')
                elif state['broken'] == 'json':
                    route.fulfill(json={'error': 'Unexpected JSON in image response'})
                elif state['broken']:
                    route.fulfill(status=502, json={'error': 'Fixture screen capture unavailable', 'stage': 'framebuffer', 'code': 10})
                else:
                    route.fulfill(content_type='image/png', body=png)
                return True
            if path == '/api/v1/veyon/computers':
                route.fulfill(json={'computers': state['computers']})
                return True
            if path == '/api/v1/veyon/jobs':
                route.fulfill(json={'jobs': state['jobs']})
                return True
            if path == '/api/v1/veyon/feature':
                state['commands'].append(route.request.post_data_json)
                command = route.request.post_data_json
                job = {'id': f'fixture-job-{len(state["commands"])}', 'sequence': len(state['commands']), 'feature': command['feature'], 'active': command.get('active', True), 'createdAt': '2026-01-01T12:00:00Z', 'state': 'completed', 'results': [{'id': target, 'state': 'succeeded', 'ok': True} for target in command['targets']]}
                state['jobs'].insert(0, job)
                route.fulfill(status=202, json={'job': job})
                return True
            return False
        page, errors = self.page('/controller/veyon.html', width, transport=transport, overrides={
            '/api/v1/veyon/status': {'keyName': 'fixture', 'scanSubnet': '192.0.2', 'httpStatus': 404, 'serviceReachable': True, 'verification': 'reachability-only', 'authenticatedConnections': 0}})
        page.locator('[data-select="student-a"]').wait_for()
        return page, errors, state

    def test_veyon_decoded_preview_survives_refresh_and_filter(self):
        page, errors, state = self.veyon_page()
        page.wait_for_function("document.querySelector('[data-thumb=student-a]')?.naturalWidth > 0")
        page.locator('[data-select="student-a"]').check()
        image_box = page.locator('[data-thumb="student-a"]').bounding_box()
        status_box = page.locator('[data-thumb-status="student-a"]').bounding_box()
        self.assertGreaterEqual(status_box['y'], image_box['y'] + image_box['height'])
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
        self.assertIn('Screen capture · Veyon 10 · HTTP 502', page.locator('[data-thumb-status="student-a"]').inner_text())
        self.assertIn('REACHABLE', page.locator('#apiStatus').inner_text())
        self.assertIn('Screens verified per computer', page.locator('#apiStatus').inner_text())
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

    def test_fixed_branding_ignores_custom_identity_without_requesting_custom_assets(self):
        branding = {'productName': 'Custom portal', 'descriptor': 'Custom description',
                    'tagline': 'Custom tagline', 'logoUrl': '/custom-school-logo.png',
                    'faviconUrl': '/custom-school-icon.png', 'school': 'Example School', 'room': '101'}
        for path in ('/controller/', '/controller/veyon.html', '/setup/'):
            requests = []
            def transport(req, target):
                requests.append(target)
                return False
            page, errors = self.page(path, overrides={
                '/api/v1/branding': {'branding': branding},
                '/api/v1/admin/config': {**FIXTURES['/api/v1/admin/config'], 'site': branding}}, transport=transport)
            page.wait_for_function("window.ROOMGOBLIN_BRANDING?.school === 'Example School'")
            page.wait_for_function("[...document.querySelectorAll('[data-brand-logo], .brandWrap .logo img')].some(img => img.complete && img.naturalWidth > 0)")
            self.assertEqual(page.evaluate('window.ROOMGOBLIN_BRANDING.productName'), 'RoomGoblin')
            self.assertEqual(page.evaluate('window.ROOMGOBLIN_BRANDING.descriptor'), 'Classroom & Lab Management Hub')
            self.assertEqual(page.evaluate('window.ROOMGOBLIN_BRANDING.tagline'), 'Run the room. Manage the lab.')
            self.assertTrue(page.locator("link[rel~='icon']").first.get_attribute('href').endswith('/brand/roomgoblin_app_32x32.png'))
            self.assertEqual(page.locator('#productName, #logoUrl, #faviconUrl, #cfgProductName, #cfgLogoUrl, #cfgFaviconUrl').count(), 0)
            self.assertNotIn('/custom-school-logo.png', requests)
            self.assertNotIn('/custom-school-icon.png', requests)
            self.assertFalse(errors, errors)

    def test_school_settings_save_without_obsolete_brand_inputs(self):
        for path in ('/controller/', '/setup/'):
            writes = []
            def transport(route, target):
                if target == '/api/v1/admin/site' and route.request.method == 'PUT':
                    body = route.request.post_data_json
                    writes.append(body)
                    route.fulfill(json={'ok': True, 'site': {**body, 'revision': 1}})
                    return True
                if target == '/api/v1/admin/displays' and route.request.method == 'PUT':
                    route.fulfill(json={'ok': True})
                    return True
                return False
            page, errors = self.page(path, transport=transport)
            if path == '/controller/':
                page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
                page.evaluate("showPage('settings')")
                page.locator('#cfgSchool').evaluate("el => el.closest('details').open = true")
                page.locator('#cfgSchool').fill('Example Academy')
                page.locator('#cfgRoom').fill('Lab 101')
                page.locator('button[onclick="saveAdminSite()"]').click()
                page.wait_for_function("document.getElementById('cfgSiteMsg').textContent.includes('Saved to database')")
            else:
                page.locator('#school').fill('Example Academy')
                page.locator('#room').fill('Lab 101')
                page.evaluate('save()')
                page.wait_for_function("document.getElementById('msg').textContent === 'Base configuration saved.'")
            self.assertEqual(len(writes), 1)
            self.assertEqual(writes[0]['school'], 'Example Academy')
            self.assertEqual(writes[0]['room'], 'Lab 101')
            self.assertIn('theme', writes[0])
            self.assertIn('timezone', writes[0])
            for obsolete in ('productName', 'logoUrl', 'faviconUrl'):
                self.assertNotIn(obsolete, writes[0])
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

    def test_esphome_inventory_permissions_refresh_and_controls(self):
        entity = {'id': '7:42', 'key': 42, 'deviceId': 7, 'name': 'Fixture brightness',
                  'domain': 'number', 'writable': True, 'adminOnly': False,
                  'min': 0, 'max': 10, 'step': 0.5, 'unit': ''}
        fixture = {'ok': True, 'devices': [{'id': 'fixture-esp', 'generation': 'fixture',
                   'name': 'Lab sensor <not HTML>', 'address': '10.200.0.8', 'port': 6053,
                   'mac': '02:00:00:00:00:01', 'enabled': True, 'hasKey': True, 'online': True,
                   'info': {'model': 'ESP32', 'esphome_version': 'fixture'}, 'entities': [entity],
                   'states': {'7:42': {'state': 2.5, 'updatedAt': 1000}}}]}
        for width in (390, 1440):
            posts = []
            def transport(req, target):
                if target.endswith('/entities/7%3A42/command') or target.endswith('/entities/7:42/command'):
                    posts.append(json.loads(req.request.post_data))
                    req.fulfill(json={'ok': True, 'confirmed': False, 'status': 'sent-unconfirmed'})
                    return True
                return False
            page, errors = self.page('/controller/', width=width,
                overrides={'/api/v1/esphome/devices': fixture}, transport=transport)
            page.evaluate("showPage('esphome')")
            page.locator('#espInventory article').wait_for()
            self.assertEqual(page.locator('#espInventory h2').inner_text(), 'Lab sensor <not HTML>')
            page.locator('#espInventory summary').click()
            number = page.get_by_role('spinbutton', name='Fixture brightness value')
            number.fill('6.5')
            page.locator('#espRefresh').click()
            page.wait_for_timeout(100)
            self.assertEqual(number.input_value(), '6.5')
            page.get_by_role('button', name='Set value', exact=True).click()
            page.get_by_text('Sent, not confirmed. Check the device before repeating.').wait_for()
            self.assertEqual(len(posts), 1)
            self.assertEqual(posts[0]['command'], {'state': 6.5})
            page.get_by_role('button', name='Edit', exact=True).click()
            page.locator('#espName').fill('Unsaved name')
            page.locator('#espRefresh').click()
            self.assertEqual(page.locator('#espName').input_value(), 'Unsaved name')
            self.evidence(page, errors, f'esphome-{width}')
        readonly, errors = self.page('/controller/', role='teacher',
            overrides={'/api/v1/esphome/devices': fixture})
        readonly.evaluate("showPage('esphome')")
        readonly.locator('#espInventory summary').click()
        self.assertTrue(readonly.get_by_role('button', name='Set value', exact=True).is_disabled())
        self.assertFalse(readonly.locator('#espEnrollment').is_visible())
        self.assertFalse(errors, errors)

    def test_esphome_failed_refresh_preserves_inventory_but_disables_commands(self):
        state = {'fail': False}
        def transport(req, target):
            if target == '/api/v1/esphome/devices':
                if state['fail']:
                    req.fulfill(status=503, json={'error': 'Fixture disconnected'})
                else:
                    req.fulfill(json={'ok': True, 'devices': [{'id': 'fixture', 'generation': '1',
                        'name': 'Fixture relay', 'address': '10.200.0.8', 'port': 6053,
                        'mac': '02:00:00:00:00:01', 'enabled': True, 'hasKey': True, 'online': True,
                        'entities': [{'id': '0:1', 'domain': 'switch', 'name': 'Relay', 'writable': True}],
                        'states': {}}]})
                return True
            return False
        page, errors = self.page('/controller/', transport=transport)
        page.evaluate("showPage('esphome')")
        page.locator('#espInventory summary').click()
        self.assertTrue(page.get_by_role('button', name='On', exact=True).is_enabled())
        state['fail'] = True
        page.locator('#espRefresh').click()
        page.get_by_text('Inventory stale — controls paused', exact=True).wait_for()
        self.assertEqual(page.locator('#espInventory article').count(), 1)
        self.assertTrue(page.get_by_role('button', name='On', exact=True).is_disabled())
        self.assertFalse(errors, errors)

    def test_special_day_timetable_draft_save_reuse_and_remove(self):
        profile = {'name': 'School', 'anchorDate': '2027-08-23', 'cycleDays': ['A', 'B'],
                   'dayGroups': [{'id': 'a', 'label': 'Day A', 'cycleDays': ['A']},
                                 {'id': 'b', 'label': 'Day B', 'cycleDays': ['B']}],
                   'specialDaySchedules': []}
        saved = []
        def transport(req, target):
            if target == '/api/v1/automations/calendar':
                if req.request.method == 'PUT':
                    body = req.request.post_data_json
                    saved.append(body)
                    profile.update(body['scheduleProfile'])
                req.fulfill(json={'ok': True, 'calendar': {}, 'scheduleProfile': profile})
                return True
            if target == '/api/v1/automations':
                req.fulfill(json={'events': []})
                return True
            return False
        page, errors = self.page('/controller/', transport=transport, overrides={
            '/api/v1/class-schedules/status': {},
            '/api/v1/class-schedules': {'classes': [
                {'id': 'p4', 'name': 'Period 4', 'period': '4', 'startTime': '13:00', 'endTime': '14:00'},
                {'id': 'p3', 'name': 'Period 3', 'period': '3', 'startTime': '11:00', 'endTime': '12:00'}]}})
        page.evaluate("showPage('schedules')")
        page.evaluate('loadSchedules()')
        page.locator('#schedules details').filter(has=page.locator('#specialDayNew')).first.locator('summary').first.click()
        page.get_by_text('Reusable special-day schedules', exact=True).click()
        page.locator('#specialDayNew').click()
        page.locator('#specialDayName').fill('Pep rally')
        page.locator('#specialDayDates').fill('2027-10-15')
        row = page.locator('[data-class-id="p4"]')
        row.locator('input[type=checkbox]').check()
        row.locator('input[type=time]').nth(0).fill('10:04')
        row.locator('input[type=time]').nth(1).fill('10:58')
        self.evidence(page, errors, 'special-day-desktop')
        page.set_viewport_size({'width': 390, 'height': 1000})
        self.evidence(page, errors, 'special-day-mobile')
        page.set_viewport_size({'width': 1440, 'height': 1000})
        # Refreshing the same stored profile preserves unsaved editor changes.
        page.evaluate('loadSchedules()')
        self.assertEqual(page.locator('#specialDayName').input_value(), 'Pep rally')
        page.get_by_role('button', name='Save School Calendar Rules', exact=True).click()
        page.wait_for_function("document.querySelector('#calendarMsg').textContent.length > 0")
        self.assertIn('saved', page.locator('#calendarMsg').inner_text())
        timetable = saved[-1]['scheduleProfile']['specialDaySchedules'][0]
        self.assertEqual(timetable['classTimes'], {'p4': {'startTime': '10:04', 'endTime': '10:58'}})
        self.assertEqual(timetable['dates'], ['2027-10-15'])
        page.locator('#specialDayDates').fill('2027-10-15\n2027-11-12')
        page.get_by_role('button', name='Save School Calendar Rules', exact=True).click()
        page.wait_for_function("S.scheduleProfile.specialDaySchedules[0].dates.includes('2027-11-12')")
        self.assertEqual(saved[-1]['scheduleProfile']['specialDaySchedules'][0]['dates'], ['2027-10-15', '2027-11-12'])
        page.remove_listener('dialog', page._fixture_dialog_handler)
        page.on('dialog', lambda dialog: dialog.accept())
        page.locator('#specialDayDelete').click()
        self.assertFalse(page.locator('#specialDayFields').is_visible())
        page.get_by_role('button', name='Save School Calendar Rules', exact=True).click()
        page.wait_for_function('S.scheduleProfile.specialDaySchedules.length === 0')
        self.assertEqual(saved[-1]['scheduleProfile']['specialDaySchedules'], [])
        self.assertFalse(errors, errors)

    def test_planning_draft_calendar_timetables_preview_and_stale_save(self):
        profile = {'name': 'School', 'anchorDate': '2027-10-18', 'cycleDays': list('ABCDEFGH'),
                   'dayGroups': [{'id': 'green', 'label': 'Green', 'cycleDays': list('ACEG'), 'color': '#2aa866'},
                                 {'id': 'white', 'label': 'White', 'cycleDays': list('BDFH'), 'color': '#eef4f8'}],
                   'periodCycleDays': {'1': list('ACEG')}, 'updatedAt': 'initial',
                   'planning': {'enabled': False, 'startDate': '', 'endDate': '', 'weekdays': [1, 2, 3, 4, 5],
                                'defaultTimetableId': '', 'timetables': [], 'dates': {}}}
        preset = {key: profile[key] for key in ('cycleDays', 'dayGroups', 'periodCycleDays')}
        preset['periodCycleDays'] = {str(i): list('ACEG') for i in range(1, 5)}
        preset['periodCycleDays'].update({str(i): list('BDFH') for i in range(5, 8)})
        preset['periodCycleDays'].update({f'BISON-{i}': ['BDFH'[(i - 1) // 2]] for i in range(1, 9)})
        classroom = {'id': 'class-1', 'name': 'Example class', 'period': '1', 'startTime': '08:00', 'endTime': '08:45'}
        saved, previews = [], []
        reject = {'once': True}
        def transport(req, target):
            if target == '/api/v1/planning':
                if req.request.method == 'PUT':
                    if reject['once']:
                        reject['once'] = False
                        req.fulfill(status=409, json={'error': 'Review a fresh preview before saving.'})
                        return True
                    body = req.request.post_data_json
                    saved.append(body)
                    profile.update(body['scheduleProfile'])
                    profile['updatedAt'] = 'saved'
                    req.fulfill(json={'ok': True, 'scheduleProfile': profile})
                else:
                    req.fulfill(json={'ok': True, 'scheduleProfile': profile, 'calendar': {}, 'classes': [classroom],
                                      'preset': preset, 'today': '2027-10-18',
                                      'migration': {'status': 'imported', 'counts': {'classes': 1, 'automations': 2, 'timetables': 1, 'dates': 3}}})
                return True
            if target == '/api/v1/planning/preview':
                body = req.request.post_data_json
                previews.append(body)
                plan = body['scheduleProfile']['planning']
                table = plan['timetables'][0] if plan['timetables'] else None
                rows = [{**block, 'name': classroom['name'], 'classId': classroom['id'], 'automations': []}
                        for block in (table['blocks'] if table else [])]
                req.fulfill(json={'ok': True, 'day': {'date': body['date'], 'status': 'school',
                    'cycle': {'cycleDay': 'A', 'dayColor': 'Green'}, 'timetable': table, 'rows': rows,
                    'warnings': [], 'automationSuppressed': False}, 'changes': [], 'previewHash': 'reviewed', 'revision': 'initial'})
                return True
            return False
        page, errors = self.page('/controller/', transport=transport)
        page.evaluate("showPage('planning')")
        page.wait_for_function("document.querySelector('#planningDate').value === '2027-10-18'")
        self.assertTrue(page.locator('#planningImportStatus').is_visible())
        self.assertIn('1 classes, 2 linked/existing automations retained', page.locator('#planningImportStatus').inner_text())
        self.assertIn('previous scheduler remains active', page.locator('#planningImportStatus').inner_text())
        page.locator('#planningRotationTab').click()
        page.locator('#planningPreset').click()
        page.locator('#planningEnabled').select_option('1')
        self.assertEqual(page.locator('[data-period="BISON-8"]').input_value(), 'H')
        page.locator('#planningTimetableTab').click()
        page.locator('#planningTableImport').click()
        page.locator('#planningTableName').fill('Split teaching day')
        table_id = page.locator('#planningTableSelect').input_value()
        page.locator('#planningDefaultTable').select_option(table_id)
        page.locator('#planningBlockAdd').click()
        self.assertEqual(page.locator('#planningBlocks > .planningBlock').count(), 2, errors)
        second = page.locator('#planningBlocks > .planningBlock').nth(1)
        self.assertEqual(second.get_by_label('Period / Bison block', exact=True).count(), 1, second.inner_html())
        second.get_by_label('Period / Bison block', exact=True).select_option('1')
        second.get_by_label('Specific class (optional)', exact=True).select_option('class-1')
        second.get_by_label('Block label', exact=True).fill('After lunch')
        second.get_by_label('Start', exact=True).fill('09:20')
        second.get_by_label('End', exact=True).fill('10:00')
        page.locator('#planningCalendarTab').click()
        page.locator('#planningDayTimetable').select_option(table_id)
        page.locator('#planningStageDate').click()
        page.get_by_text('Example class', exact=True).first.wait_for()
        self.assertEqual(len(saved), 0)
        page.locator('#planningPreview').click()
        page.wait_for_function("!document.querySelector('#planningPublish').disabled")
        page.locator('#planningPublish').click()
        page.get_by_text('Review a fresh preview before saving.', exact=True).wait_for()
        self.assertTrue(page.locator('#planningPublish').is_disabled())
        self.assertEqual(len(saved), 0)
        page.locator('#planningPreview').click()
        page.wait_for_function("!document.querySelector('#planningPublish').disabled")
        page.locator('#planningPublish').click()
        page.wait_for_function("document.querySelector('#planningMessage').textContent.startsWith('Planning saved')")
        self.assertEqual(saved[-1]['scheduleProfile']['planning']['dates']['2027-10-18']['timetableId'], table_id)
        self.assertEqual(saved[-1]['scheduleProfile']['periodCycleDays']['BISON-8'], ['H'])
        self.assertEqual(len(saved[-1]['scheduleProfile']['planning']['timetables'][0]['blocks']), 2)
        # Import is local until review/save and retains explicit cycle letters.
        page.get_by_text('Import school calendar dates (CSV)', exact=True).click()
        page.locator('#planningImport').set_input_files({'name': 'calendar.csv', 'mimeType': 'text/csv',
            'buffer': b'date,status,cycleDay,timetableId,note\n2027-10-19,no-school,,,Closure\n2027-10-20,school,C,,Published cycle'})
        page.get_by_text('2 dates staged; 0 existing overrides replaced in draft. Preview and save to apply.', exact=True).wait_for()
        self.assertEqual(len(saved), 1)
        page.evaluate("""() => {const original=window.fetch;window.fetch=(url,options)=>String(url).endsWith('/planning/preview')?new Promise(resolve=>{window.releasePlanningPreview=()=>original(url,options).then(resolve)}):original(url,options)}""")
        page.locator('#planningPreview').click()
        page.wait_for_function('typeof window.releasePlanningPreview === "function"')
        page.locator('#planningDayNote').fill('Edited during preview')
        page.evaluate('window.releasePlanningPreview()')
        page.wait_for_function("document.querySelector('#planningMessage').textContent.startsWith('The draft changed while preview')")
        self.assertTrue(page.locator('#planningPublish').is_disabled())
        self.evidence(page, errors, 'planning-calendar-desktop')
        page.set_viewport_size({'width': 390, 'height': 1000})
        self.evidence(page, errors, 'planning-calendar-mobile')
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.locator('#planningTimetableTab').click()
        self.evidence(page, errors, 'planning-timetable-desktop')
        page.set_viewport_size({'width': 390, 'height': 1000})
        self.evidence(page, errors, 'planning-timetable-mobile')
        self.assertFalse(errors, errors)

    def test_planning_navigation_remains_capability_hidden(self):
        page, errors = self.page('/controller/', role='viewer')
        self.assertFalse(page.locator('nav button[data-page="planning"]').is_visible())
        page.evaluate("showPage('planning')")
        self.assertFalse(page.locator('#planning').is_visible())
        self.assertFalse(page.locator('[data-planning-page="planning"]').first.is_visible())
        self.assertFalse(errors, errors)

    def planning_draft_page(self):
        from playwright.sync_api import expect
        profile={'name':'School','anchorDate':'2027-10-18','cycleDays':list('ABCDEFGH'),'dayGroups':[{'id':'green','label':'Green','cycleDays':list('ACEG')},{'id':'white','label':'White','cycleDays':list('BDFH')}],'periodCycleDays':{},'updatedAt':'initial','planning':{'enabled':False,'startDate':'','endDate':'','weekdays':[1,2,3,4,5],'defaultTimetableId':'','timetables':[],'dates':{}}}
        source={'scheduleProfile':profile,'calendar':{},'classes':[],'preset':{k:profile[k] for k in ('cycleDays','dayGroups','periodCycleDays')},'today':'2027-10-18'}
        def transport(req,target):
            if target=='/api/v1/planning/preview':
                body=req.request.post_data_json
                req.fulfill(json={'day':{'date':body['date'],'status':'school','cycle':{'cycleDay':'A','dayColor':'Green'},'rows':[],'warnings':[],'automationSuppressed':False},'changes':[],'previewHash':'reviewed'})
                return True
            return False
        page,errors=self.page('/controller/',overrides={'/api/v1/planning':source},transport=transport)
        page.evaluate("showPage('planning')")
        expect(page.locator('#planningDate')).to_have_value('2027-10-18')
        page.locator('#planningRotationTab').click()
        return page,errors,source
    def planning_today_page(self):
        from playwright.sync_api import expect
        page, errors, source = self.planning_draft_page()
        page.locator('#planningCalendarTab').click()
        expect(page.locator('#planningMessage')).to_contain_text('Date preview only')
        return page, errors, source

    def hold_planning_today(self, page):
        import time
        held = []
        page.route('**/api/v1/planning/day', lambda route: held.append(route))
        page.locator('#planning').get_by_role('button', name='Today', exact=True).click()
        deadline = time.monotonic() + 5
        while not held and time.monotonic() < deadline:
            page.wait_for_timeout(10)
        self.assertEqual(len(held), 1, 'Today must read the current appliance date')
        return held

    def test_planning_today_refreshes_appliance_date_without_reloading_draft(self):
        from playwright.sync_api import expect
        page, errors, source = self.planning_today_page()
        page.locator('#planningDayNote').fill('Keep this calendar draft')
        page.locator('#planningStageDate').click()
        expect(page.locator('#planningMessage')).to_contain_text('Date preview only')
        reads, previews = [], []
        page.on('request', lambda request: reads.append(request) if request.url.endswith('/api/v1/planning') else None)
        page.on('request', lambda request: previews.append(request.post_data_json) if request.url.endswith('/api/v1/planning/preview') else None)
        page.route('**/api/v1/planning/day', lambda route: route.fulfill(json={'day': {'date': '2027-10-19'}}))
        page.locator('#planning').get_by_role('button', name='Today', exact=True).click()
        expect(page.locator('#planningDate')).to_have_value('2027-10-19')
        expect(page.locator('#planningMessage')).to_contain_text('Date preview only')
        self.assertEqual(previews[-1]['date'], '2027-10-19')
        self.assertEqual(previews[-1]['scheduleProfile']['planning']['dates']['2027-10-18']['note'], 'Keep this calendar draft')
        self.assertEqual(reads, [])
        self.assertFalse(errors, errors)

    def test_planning_today_keeps_later_manual_date_selection(self):
        from playwright.sync_api import expect
        page, errors, source = self.planning_today_page()
        held = self.hold_planning_today(page)
        page.locator('#planningDate').fill('2027-10-21')
        page.locator('#planningDate').dispatch_event('change')
        expect(page.locator('#planningDayHeading')).to_contain_text('2027-10-21')
        with page.expect_response('**/api/v1/planning/day'):
            held[0].fulfill(json={'day': {'date': '2027-10-19'}})
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        expect(page.locator('#planningDate')).to_have_value('2027-10-21')
        self.assertFalse(errors, errors)

    def test_planning_today_keeps_edits_and_ignores_obsolete_errors(self):
        from playwright.sync_api import expect
        page, errors, source = self.planning_today_page()
        held = self.hold_planning_today(page)
        page.locator('#planningDayNote').fill('A newer unsaved note')
        with page.expect_response('**/api/v1/planning/day'):
            held[0].fulfill(status=503, json={'error': 'Obsolete date lookup'})
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        expect(page.locator('#planningDate')).to_have_value('2027-10-18')
        expect(page.locator('#planningDayNote')).to_have_value('A newer unsaved note')
        expect(page.locator('#planningMessage')).to_contain_text('Unsaved draft')
        self.assertFalse(errors, errors)

    def test_planning_today_failure_preserves_date_and_can_retry(self):
        from playwright.sync_api import expect
        page, errors, source = self.planning_today_page()
        responses = [{'error': 'Date service unavailable'}, {'day': {'date': '2027-10-19'}}]
        def transport(route):
            response = responses.pop(0)
            route.fulfill(status=503 if 'error' in response else 200, json=response)
        page.route('**/api/v1/planning/day', transport)
        today = page.locator('#planning').get_by_role('button', name='Today', exact=True)
        today.click()
        expect(page.locator('#planningMessage')).to_contain_text('Date service unavailable')
        expect(page.locator('#planningDate')).to_have_value('2027-10-18')
        today.click()
        expect(page.locator('#planningDate')).to_have_value('2027-10-19')
        self.assertFalse(errors, errors)

    def test_planning_today_latest_lookup_wins(self):
        from playwright.sync_api import expect
        import time
        page, errors, source = self.planning_today_page()
        held = self.hold_planning_today(page)
        page.locator('#planning').get_by_role('button', name='Today', exact=True).click()
        deadline = time.monotonic() + 5
        while len(held) < 2 and time.monotonic() < deadline:
            page.wait_for_timeout(10)
        self.assertEqual(len(held), 2)
        held[1].fulfill(json={'day': {'date': '2027-10-20'}})
        expect(page.locator('#planningDate')).to_have_value('2027-10-20')
        with page.expect_response('**/api/v1/planning/day'):
            held[0].fulfill(json={'day': {'date': '2027-10-19'}})
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        expect(page.locator('#planningDate')).to_have_value('2027-10-20')
        self.assertFalse(errors, errors)

    def test_planning_today_cannot_replace_pending_save_or_unlock_controls(self):
        from playwright.sync_api import expect
        import time
        page, errors, source = self.planning_today_page()
        page.locator('#planningPreview').click()
        expect(page.locator('#planningPublish')).to_be_enabled()
        held = self.hold_planning_today(page)
        writes = []
        page.route('**/api/v1/planning', lambda route: writes.append(route))
        page.locator('#planningPublish').click()
        deadline = time.monotonic() + 5
        while not writes and time.monotonic() < deadline:
            page.wait_for_timeout(10)
        self.assertEqual(len(writes), 1)
        with page.expect_response('**/api/v1/planning/day'):
            held[0].fulfill(json={'day': {'date': '2027-10-19'}})
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        expect(page.locator('#planningDate')).to_have_value('2027-10-18')
        expect(page.locator('#planningPreview')).to_be_disabled()
        expect(page.locator('#planning').get_by_role('button', name='Today', exact=True)).to_be_disabled()
        writes[0].fulfill(json={'scheduleProfile': {**source['scheduleProfile'], 'updatedAt': 'saved'}})
        expect(page.locator('#planningMessage')).to_contain_text('Planning saved')
        expect(page.locator('#planning').get_by_role('button', name='Today', exact=True)).to_be_enabled()
        self.assertFalse(errors, errors)

    def test_planning_today_cannot_change_an_open_date_range(self):
        from playwright.sync_api import expect
        page, errors, source = self.planning_today_page()
        page.locator('#planningDayNote').fill('Keep this range setup')
        held = self.hold_planning_today(page)
        page.get_by_role('button', name='Apply to a date range', exact=True).click()
        dialog = page.get_by_role('dialog', name='Apply this day setup to a range')
        expect(dialog.get_by_label('First date')).to_have_value('2027-10-18')
        with page.expect_response('**/api/v1/planning/day'):
            held[0].fulfill(json={'day': {'date': '2027-10-19'}})
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        expect(page.locator('#planningDate')).to_have_value('2027-10-18')
        expect(page.locator('#planningDayNote')).to_have_value('Keep this range setup')
        dialog.get_by_role('button', name='Cancel', exact=True).click()
        self.assertFalse(errors, errors)

    def test_planning_pending_reload_preserves_newer_edits(self):
        from playwright.sync_api import expect
        page,errors,source=self.planning_draft_page()
        held=[]
        page.route('**/api/v1/planning',lambda route:held.append(route))
        with page.expect_request('**/api/v1/planning'):page.evaluate('void loadPlanning()')
        page.locator('#planningAnchor').fill('2027-10-20')
        with page.expect_response('**/api/v1/planning'):held[0].fulfill(json=source)
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        expect(page.locator('#planningAnchor')).to_have_value('2027-10-20')
        self.assertFalse(errors,errors)
    def test_planning_latest_reload_wins_out_of_order_responses(self):
        from playwright.sync_api import expect
        import copy, time
        page,errors,source=self.planning_draft_page()
        held=[]
        page.route('**/api/v1/planning',lambda route:held.append(route))
        for _ in range(2):
            with page.expect_request('**/api/v1/planning'):page.evaluate('void loadPlanning()')
        deadline=time.monotonic()+5
        while len(held)<2 and time.monotonic()<deadline:page.wait_for_timeout(10)
        self.assertEqual(len(held),2)
        newer=copy.deepcopy(source);newer['scheduleProfile']['anchorDate']='2027-10-21'
        held[1].fulfill(json=newer)
        expect(page.locator('#planningAnchor')).to_have_value('2027-10-21')
        with page.expect_response('**/api/v1/planning'):held[0].fulfill(json=source)
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        expect(page.locator('#planningAnchor')).to_have_value('2027-10-21')
        self.assertFalse(errors,errors)
    def test_planning_csv_finishing_after_reload_does_not_mutate_the_new_draft(self):
        from playwright.sync_api import expect
        page,errors,source=self.planning_draft_page()
        page.locator('#planningCalendarTab').click()
        page.get_by_text('Import school calendar dates (CSV)',exact=True).click()
        page.evaluate("() => {File.prototype.text=function(){return new Promise(resolve=>{window.releaseCalendarFile=()=>resolve('date,status,cycleDay,timetableId,note\\n2027-10-20,no-school,,,Old import')})};}")
        page.locator('#planningImport').set_input_files({'name':'old.csv','mimeType':'text/csv','buffer':b'fixture'})
        page.wait_for_function('typeof window.releaseCalendarFile === "function"')
        page.evaluate('loadPlanning(true)')
        page.evaluate('window.releaseCalendarFile()')
        page.locator('#planningDate').fill('2027-10-20')
        page.locator('#planningDate').dispatch_event('change')
        expect(page.locator('#planningDayStatus')).to_have_value('school')
        self.assertFalse(errors,errors)

    def test_planning_confirmed_reload_discards_only_the_existing_draft(self):
        from playwright.sync_api import expect
        page, errors, source = self.planning_draft_page()
        page.locator('#planningAnchor').fill('2027-10-22')
        page.remove_listener('dialog', page._fixture_dialog_handler)
        page.once('dialog', lambda dialog: dialog.accept())
        page.locator('#planningReload').click()
        expect(page.locator('#planningAnchor')).to_have_value('2027-10-18')
        expect(page.locator('#planningPublish')).to_be_disabled()
        self.assertFalse(errors, errors)

    def test_planning_obsolete_load_failure_preserves_newer_status(self):
        from playwright.sync_api import expect
        import time
        page, errors, source = self.planning_draft_page()
        held = []
        page.route('**/api/v1/planning', lambda route: held.append(route))
        for _ in range(2):
            with page.expect_request('**/api/v1/planning'):
                page.evaluate('void loadPlanning()')
        deadline = time.monotonic() + 5
        while len(held) < 2 and time.monotonic() < deadline:
            page.wait_for_timeout(10)
        self.assertEqual(len(held), 2)
        held[1].fulfill(json=source)
        expect(page.locator('#planningMessage')).to_contain_text('Date preview only')
        with page.expect_response('**/api/v1/planning'):
            held[0].fulfill(status=503, json={'error': 'Obsolete load failed'})
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        expect(page.locator('#planningMessage')).to_contain_text('Date preview only')
        self.assertFalse(errors, errors)

    def test_planning_load_is_not_admitted_during_save(self):
        from playwright.sync_api import expect
        page, errors, source = self.planning_draft_page()
        page.locator('#planningPreview').click()
        expect(page.locator('#planningPublish')).to_be_enabled()
        held, reads = [], []
        def transport(route):
            if route.request.method == 'PUT':
                held.append(route)
            else:
                reads.append(route.request)
                route.fulfill(json=source)
        page.route('**/api/v1/planning', transport)
        with page.expect_request('**/api/v1/planning'):
            page.locator('#planningPublish').click()
        page.evaluate('loadPlanning(true)')
        held[0].fulfill(json={'scheduleProfile': {**source['scheduleProfile'], 'updatedAt': 'saved'}})
        expect(page.locator('#planningMessage')).to_contain_text('Planning saved')
        self.assertEqual(len(reads), 0)
        expect(page.locator('#planningPreview')).to_be_enabled()
        expect(page.locator('#planningPublish')).to_be_disabled()
        self.assertFalse(errors, errors)

    def test_planning_csv_keeps_edits_made_during_file_read(self):
        from playwright.sync_api import expect
        page, errors, source = self.planning_draft_page()
        page.locator('#planningCalendarTab').click()
        page.get_by_text('Import school calendar dates (CSV)', exact=True).click()
        page.evaluate("""() => {
            window.originalCalendarFileText=File.prototype.text;
            File.prototype.text=function(){return new Promise(resolve=>{
                window.releaseCalendarFile=()=>resolve('date,status,cycleDay,timetableId,note\\n2027-10-20,no-school,,,Old import');
            })};
        }""")
        page.locator('#planningImport').set_input_files({'name': 'old.csv', 'mimeType': 'text/csv', 'buffer': b'fixture'})
        page.wait_for_function('typeof window.releaseCalendarFile === "function"')
        page.locator('#planningDate').fill('2027-10-20')
        with page.expect_response('**/api/v1/planning/preview'):
            page.locator('#planningDate').dispatch_event('change')
        expect(page.locator('#planningMessage')).to_contain_text('Date preview only')
        page.locator('#planningDayStatus').select_option('remote')
        with page.expect_response('**/api/v1/planning/preview'):
            page.locator('#planningStageDate').click()
        expect(page.locator('#planningMessage')).to_contain_text('Date preview only')
        page.evaluate('window.releaseCalendarFile()')
        expect(page.locator('#planningMessage')).to_contain_text('draft changed while the calendar file')
        expect(page.locator('#planningDayStatus')).to_have_value('remote')
        page.evaluate('() => {File.prototype.text=window.originalCalendarFileText}')
        page.locator('#planningImport').set_input_files({'name': 'reviewed.csv', 'mimeType': 'text/csv',
            'buffer': b'date,status,cycleDay,timetableId,note\n2027-10-21,no-school,,,Reviewed import'})
        expect(page.locator('#planningImportSummary')).to_contain_text('1 dates staged')
        page.locator('#planningDate').fill('2027-10-21')
        page.locator('#planningDate').dispatch_event('change')
        expect(page.locator('#planningDayStatus')).to_have_value('no-school')
        self.assertFalse(errors, errors)

    def studio_page(self, width=1440, classes=None):
        profile = {'name': 'School', 'anchorDate': '2027-10-18', 'cycleDays': list('ABCDEFGH'),
                   'dayGroups': [{'id': 'green', 'label': 'Green', 'cycleDays': list('ACEG')},
                                 {'id': 'white', 'label': 'White', 'cycleDays': list('BDFH')}],
                   'periodCycleDays': {'1': list('ACEG')}, 'planning': {'enabled': True,
                   'timetables': [{'id': 'special', 'name': 'Special day', 'blocks': [
                       {'id': 'lunch', 'label': 'Lunch', 'kind': 'break', 'startTime': '11:00', 'endTime': '11:30'}]}]}}
        saved = []
        def transport(req, target):
            if target == '/api/v1/automations/draft/simulate':
                req.fulfill(json={'ok': True, 'resolved': {'targets': ['tv1']}})
                return True
            if target == '/api/v1/class-schedules' and req.request.method == 'POST':
                saved.append({'class': req.request.post_data_json})
                req.fulfill(json={'ok': True, 'class': {**saved[-1]['class'], 'id': 'special-class'}})
                return True
            if target == '/api/v1/automations' and req.request.method == 'POST':
                saved.append(req.request.post_data_json)
                req.fulfill(json={'ok': True, 'event': {**saved[-1], 'id': 'saved'}})
                return True
            return False
        overrides = {'/api/v1/automation-control': {'enabled': True, 'clock': {'schedulerTime': '2027-10-18T16:00:00Z', 'timezone': 'America/New_York'}},
                     '/api/v1/automations': {'events': [], 'scheduler': {'timezone': 'America/New_York'}},
                     '/api/v1/automations/calendar': {'calendar': {}, 'scheduleProfile': profile},
                     '/api/v1/class-schedules': {'classes': classes or []},
                     '/api/v1/planning': {'today': '2027-10-18', 'scheduleProfile': profile, 'classes': classes or []},
                     '/api/v1/planning/studio': {'config': {'version': 1, 'overlays': [], 'weather': {'enabled': False}}}}
        page, errors = self.page('/controller/', width, overrides=overrides, transport=transport)
        page.evaluate("Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true})")
        page.evaluate("showPage('schedules')")
        page.get_by_role('button', name='+ Automation', exact=True).wait_for()
        return page, errors, saved

    def test_linked_class_preview_reports_the_dispatch_date_across_calendar_boundaries(self):
        cases = [
            ('2027-10-18', '00:30', '01:30', 'start', -60, '2027-10-17', '23:30'),
            ('2027-12-31', '22:30', '23:30', 'end', 60, '2028-01-01', '00:30'),
            ('2028-03-01', '00:30', '01:30', 'start', -60, '2028-02-29', '23:30'),
            ('2027-03-14', '00:30', '01:30', 'start', -60, '2027-03-13', '23:30'),
            ('2027-10-18', '08:00', '09:00', 'start', 15, '2027-10-18', '08:15'),
            ('2027-10-18', '08:00', '09:00', 'end', 0, '2027-10-18', '09:00'),
        ]
        for date, start, end, reference, offset, expected_date, expected_time in cases:
            with self.subTest(date=date, reference=reference, offset=offset):
                cls = {'id': 'edge', 'name': 'Boundary class', 'period': '1',
                       'scheduleMode': 'weekly', 'days': [1, 2, 3, 4, 5],
                       'startTime': start, 'endTime': end, 'enabled': True}
                page, errors, saved = self.studio_page(classes=[cls])
                day = {'date': date, 'automationSuppressed': False, 'rows': [
                    {'classId': 'edge', 'name': 'Boundary class', 'startTime': start, 'endTime': end}]}
                page.route('**/api/v1/planning/day*', lambda route: route.fulfill(json={'day': day}))
                page.get_by_role('button', name='+ Automation', exact=True).click()
                page.evaluate('''([reference, offset]) => {
                    document.querySelector('[data-autoclass="edge"]').checked = true;
                    document.getElementById('autoClassRef').value = reference;
                    document.getElementById('autoClassOffset').value = offset;
                    updateAutomationClassPreview();
                }''', [reference, offset])
                page.wait_for_function("document.getElementById('autoClassPreview').textContent.includes('segment')")
                actual = page.locator('#autoClassPreview').text_content()
                self.assertIn(expected_date + ' · Boundary class → ' + expected_time, actual)
                self.assertIn(start + '–' + end, actual)
                if expected_date != date:
                    self.assertIn('segment ' + date + ' ' + start, actual)
                self.assertEqual(saved, [])
                self.assertFalse(errors, errors)

    def test_automation_today_only_refreshes_after_calendar_date_changes(self):
        from playwright.sync_api import expect
        page, errors, saved = self.studio_page()
        page.route('**/api/v1/automation-control', lambda route: route.fulfill(json={'clock': {'schedulerTime': '2027-10-19T16:00:00Z', 'timezone': 'America/New_York'}}))
        page.evaluate('loadSchedules()')
        page.get_by_role('button', name='+ Automation', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.get_by_role('button', name='Today only', exact=True).click()
        expect(editor.get_by_label('Active from (optional)', exact=True)).to_have_value('2027-10-19')
        expect(editor.get_by_label('Active through (optional)', exact=True)).to_have_value('2027-10-19')
        self.assertEqual(saved, [])
        self.assertFalse(errors, errors)

    def test_automation_today_only_uses_appliance_timezone_when_planning_is_unavailable(self):
        from playwright.sync_api import expect
        page, errors, saved = self.studio_page()
        page.route('**/api/v1/planning', lambda route: route.fulfill(status=403, json={'error': 'Permission denied'}))
        page.route('**/api/v1/automation-control', lambda route: route.fulfill(json={
            'clock': {'schedulerTime': '2027-10-19T02:00:00Z', 'timezone': 'America/New_York', 'active': True}}))
        page.evaluate('loadSchedules()')
        page.get_by_role('button', name='+ Automation', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.get_by_role('button', name='Today only', exact=True).click()
        expect(editor.get_by_label('Active from (optional)', exact=True)).to_have_value('2027-10-18')
        expect(editor.get_by_label('Active through (optional)', exact=True)).to_have_value('2027-10-18')
        self.assertEqual(saved, [])
        self.assertFalse(errors, errors)

    def test_automation_today_only_refreshes_an_editor_left_open_overnight(self):
        from playwright.sync_api import expect
        page, errors, saved = self.studio_page()
        page.get_by_role('button', name='+ Automation', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        page.route('**/api/v1/automation-control', lambda route: route.fulfill(json={'clock': {'schedulerTime': '2027-10-19T16:00:00Z', 'timezone': 'America/New_York'}}))
        editor.get_by_role('button', name='Today only', exact=True).click()
        expect(editor.get_by_label('Active from (optional)', exact=True)).to_have_value('2027-10-19')
        self.assertEqual(saved, [])
        self.assertFalse(errors, errors)

    def test_automation_today_only_keeps_dates_when_planning_date_is_unavailable(self):
        from playwright.sync_api import expect
        for response in ({'status': 503, 'json': {'error': 'Planning date unavailable'}},
                         {'json': {'clock': {'schedulerTime': 'invalid', 'timezone': 'America/New_York'}}},
                         {'json': {'clock': {'schedulerTime': '2027-10-19T16:00:00Z', 'timezone': 'invalid'}}}):
            with self.subTest(response=response):
                page, errors, saved = self.studio_page()
                page.get_by_role('button', name='+ Automation', exact=True).click()
                editor = page.locator('dialog.studioDialog[open]').last
                start = editor.get_by_label('Active from (optional)', exact=True)
                end = editor.get_by_label('Active through (optional)', exact=True)
                start.fill('2027-10-21')
                end.fill('2027-10-22')
                page.route('**/api/v1/automation-control', lambda route: route.fulfill(**response))
                editor.get_by_role('button', name='Today only', exact=True).click()
                expect(editor.locator('.studioStatus')).to_contain_text('unavailable')
                expect(start).to_have_value('2027-10-21')
                expect(end).to_have_value('2027-10-22')
                expect(editor.get_by_role('button', name='Save automation', exact=True)).to_be_disabled()
                self.assertEqual(saved, [])
                self.assertFalse(errors, errors)

    def test_automation_today_only_does_not_overwrite_newer_date_edits(self):
        from playwright.sync_api import expect
        page, errors, saved = self.studio_page()
        page.get_by_role('button', name='+ Automation', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.get_by_label('Automation name', exact=True).fill('Date draft')
        held = []
        page.route('**/api/v1/automation-control', lambda route: held.append(route))
        with page.expect_request('**/api/v1/automation-control'):
            editor.get_by_role('button', name='Today only', exact=True).click()
        expect(editor.get_by_role('button', name='Preview & validate', exact=True)).to_be_disabled()
        editor.get_by_label('Active from (optional)', exact=True).fill('2027-10-21')
        editor.get_by_label('Active through (optional)', exact=True).fill('2027-10-22')
        self.assertEqual(len(held), 1)
        held[0].fulfill(json={'clock': {'schedulerTime': '2027-10-19T16:00:00Z', 'timezone': 'America/New_York'}})
        expect(editor.locator('.studioStatus')).to_contain_text('date edits were kept')
        expect(editor.get_by_label('Active from (optional)', exact=True)).to_have_value('2027-10-21')
        expect(editor.get_by_label('Active through (optional)', exact=True)).to_have_value('2027-10-22')
        expect(editor.get_by_role('button', name='Preview & validate', exact=True)).to_be_enabled()
        expect(editor.get_by_role('button', name='Save automation', exact=True)).to_be_disabled()
        self.assertEqual(saved, [])
        self.assertFalse(errors, errors)

    def test_automation_preview_cannot_revalidate_an_edited_draft(self):
        from playwright.sync_api import expect
        page, errors, saved = self.studio_page()
        page.get_by_role('button', name='+ Automation', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.get_by_label('Automation name', exact=True).fill('First draft')
        held = []
        page.route('**/api/v1/automations/draft/simulate', lambda route: held.append(route))
        with page.expect_request('**/api/v1/automations/draft/simulate'):
            editor.get_by_role('button', name='Preview & validate', exact=True).click()
        editor.get_by_label('Automation name', exact=True).fill('Changed draft')
        self.assertEqual(len(held), 1)
        with page.expect_response('**/api/v1/automations/draft/simulate'):
            held[0].fulfill(json={'ok': True, 'resolved': {'targets': ['tv1']}})
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        expect(editor.get_by_role('button', name='Save automation', exact=True)).to_be_disabled()
        expect(editor.locator('.studioStatus')).to_contain_text('Unsaved changes')
        self.assertEqual(saved, [])
        self.assertFalse(errors, errors)

    def test_automation_obsolete_preview_failure_keeps_the_new_review(self):
        import time
        from playwright.sync_api import expect
        page, errors, saved = self.studio_page()
        page.get_by_role('button', name='+ Automation', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.get_by_label('Automation name', exact=True).fill('First draft')
        held = []
        page.route('**/api/v1/automations/draft/simulate', lambda route: held.append(route))
        with page.expect_request('**/api/v1/automations/draft/simulate'):
            editor.get_by_role('button', name='Preview & validate', exact=True).click()
        editor.get_by_label('Automation name', exact=True).fill('Reviewed draft')
        with page.expect_request('**/api/v1/automations/draft/simulate'):
            editor.get_by_role('button', name='Preview & validate', exact=True).click()
        # The request event can arrive before Playwright invokes the route handler.
        deadline = time.monotonic() + 5
        while len(held) < 2 and time.monotonic() < deadline:
            page.wait_for_timeout(10)
        self.assertEqual(len(held), 2)
        held[1].fulfill(json={'ok': True, 'resolved': {'targets': ['tv1']}})
        expect(editor.get_by_role('button', name='Save automation', exact=True)).to_be_enabled()
        with page.expect_response('**/api/v1/automations/draft/simulate'):
            held[0].fulfill(status=503, json={'error': 'Obsolete preview failure'})
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        expect(editor.get_by_role('button', name='Save automation', exact=True)).to_be_enabled()
        expect(editor.locator('.studioStatus')).to_contain_text('Ready to save')
        editor.get_by_role('button', name='Save automation', exact=True).click()
        page.wait_for_function("!document.querySelector('dialog.studioDialog[open]')")
        self.assertEqual(len(saved), 1)
        self.assertEqual(saved[0]['name'], 'Reviewed draft')
        self.assertFalse(errors, errors)



    def test_shared_layer_preview_cannot_revalidate_an_edited_rule(self):
        from playwright.sync_api import expect
        page, errors, saved = self.studio_page()
        page.get_by_role('button', name='Shared layers', exact=True).click()
        page.get_by_role('button', name='+ Shared layer', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.get_by_label('Layer rule name', exact=True).fill('First rule')
        held = []
        page.route('**/api/v1/planning/studio/preview', lambda route: held.append(route))
        with page.expect_request('**/api/v1/planning/studio/preview'):
            editor.get_by_role('button', name='Preview rule', exact=True).click()
        editor.get_by_label('Layer rule name', exact=True).fill('Changed rule')
        self.assertEqual(len(held), 1)
        with page.expect_response('**/api/v1/planning/studio/preview'):
            held[0].fulfill(json={'matches': [], 'previewHash': 'first-rule'})
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        expect(editor.get_by_role('button', name='Save shared layer', exact=True)).to_be_disabled()
        self.assertEqual(saved, [])
        self.assertFalse(errors, errors)

    def test_shared_layer_obsolete_preview_failure_keeps_the_new_review(self):
        import time
        from playwright.sync_api import expect
        page, errors, saved = self.studio_page()
        page.get_by_role('button', name='Shared layers', exact=True).click()
        page.get_by_role('button', name='+ Shared layer', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.get_by_label('Layer rule name', exact=True).fill('First rule')
        held = []
        page.route('**/api/v1/planning/studio/preview', lambda route: held.append(route))
        with page.expect_request('**/api/v1/planning/studio/preview'):
            editor.get_by_role('button', name='Preview rule', exact=True).click()
        editor.get_by_label('Layer rule name', exact=True).fill('Reviewed rule')
        with page.expect_request('**/api/v1/planning/studio/preview'):
            editor.get_by_role('button', name='Preview rule', exact=True).click()
        deadline = time.monotonic() + 5
        while len(held) < 2 and time.monotonic() < deadline:
            page.wait_for_timeout(10)
        self.assertEqual(len(held), 2)
        held[1].fulfill(json={'matches': [], 'previewHash': 'reviewed-rule'})
        expect(editor.get_by_role('button', name='Save shared layer', exact=True)).to_be_enabled()
        with page.expect_response('**/api/v1/planning/studio/preview'):
            held[0].fulfill(status=503, json={'error': 'Obsolete layer preview failure'})
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        expect(editor.get_by_role('button', name='Save shared layer', exact=True)).to_be_enabled()
        expect(editor.locator('.studioStatus')).to_contain_text('Preview ready')
        self.assertEqual(saved, [])
        self.assertFalse(errors, errors)




    def test_automation_pending_save_owns_the_editor_until_failure(self):
        from playwright.sync_api import expect
        page, errors, saved = self.studio_page()
        page.get_by_role('button', name='+ Automation', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.get_by_label('Automation name', exact=True).fill('One intended routine')
        held = []
        page.route('**/api/v1/automations', lambda route: held.append(route) if route.request.method == 'POST' else route.fallback())
        preview = editor.get_by_role('button', name='Preview & validate', exact=True)
        save = editor.get_by_role('button', name='Save automation', exact=True)
        preview.click()
        expect(save).to_be_enabled()
        with page.expect_request('**/api/v1/automations'):
            save.click()
        # Exercise the old duplicate path without waiting on a correctly disabled control.
        blocked = preview.is_disabled()
        inert = editor.locator('.studioDialogBody').evaluate('(node) => node.inert')
        if not blocked:
            preview.click()
            expect(save).to_be_enabled()
            with page.expect_request('**/api/v1/automations'):
                save.click()
        count = len(held)
        for request in held:
            request.fulfill(status=503, json={'error': 'Save temporarily unavailable'})
        expect(editor.locator('.studioStatus')).to_contain_text('temporarily unavailable')
        expect(preview).to_be_enabled()
        expect(save).to_be_disabled()
        self.assertFalse(editor.locator('.studioDialogBody').evaluate('(node) => node.inert'))
        editor.get_by_label('Automation name', exact=True).fill('Editable after failure')
        self.assertEqual(count, 1, 'one pending save must own the dialog')
        self.assertTrue(blocked)
        self.assertTrue(inert)
        self.assertFalse(errors, errors)

    def test_automation_ambiguous_create_retry_keeps_one_identity(self):
        from playwright.sync_api import expect
        page, errors, saved = self.studio_page()
        page.get_by_role('button', name='+ Automation', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.get_by_label('Automation name', exact=True).fill('One intended routine')
        requests, owned = [], {}
        def create(route):
            if route.request.method != 'POST':
                return route.fallback()
            body = route.request.post_data_json
            requests.append(body)
            identity = body.get('id') or 'server-generated-' + str(len(requests))
            if identity in owned:
                return route.fulfill(status=409, json={'error': 'Automation ID already exists'})
            owned[identity] = body
            if len(requests) == 1:
                return route.fulfill(status=503, json={'error': 'The first save reply was lost'})
            route.fulfill(json={'ok': True, 'event': {**body, 'id': identity}})
        page.route('**/api/v1/automations', create)
        preview = editor.get_by_role('button', name='Preview & validate', exact=True)
        save = editor.get_by_role('button', name='Save automation', exact=True)
        preview.click()
        expect(save).to_be_enabled()
        save.click()
        expect(editor.locator('.studioStatus')).to_contain_text('reply was lost')
        preview.click()
        expect(save).to_be_enabled()
        with page.expect_response('**/api/v1/automations'):
            save.click()
        self.assertEqual(len(requests), 2)
        self.assertEqual(len(owned), 1, 'retry must not create another logical routine')
        self.assertTrue(requests[0].get('id'))
        self.assertEqual(requests[0]['id'], requests[1]['id'])
        expect(editor.locator('.studioStatus')).to_contain_text('check the earlier save')
        expect(save).to_be_disabled()
        self.assertFalse(errors, errors)

    def test_automation_separate_new_drafts_have_distinct_create_ids(self):
        from playwright.sync_api import expect
        page, errors, saved = self.studio_page()
        for name in ('First routine', 'Second routine'):
            page.get_by_role('button', name='+ Automation', exact=True).click()
            editor = page.locator('dialog.studioDialog[open]').last
            expect(editor.get_by_role('heading', name='New automation', exact=True)).to_be_visible()
            self.assertEqual(editor.get_by_role('button', name='Delete automation', exact=True).count(), 0)
            editor.get_by_label('Automation name', exact=True).fill(name)
            editor.get_by_role('button', name='Preview & validate', exact=True).click()
            expect(editor.get_by_role('button', name='Save automation', exact=True)).to_be_enabled()
            editor.get_by_role('button', name='Save automation', exact=True).click()
            page.wait_for_function("!document.querySelector('dialog.studioDialog[open]')")
        self.assertEqual(len(saved), 2)
        self.assertTrue(saved[0].get('id'))
        self.assertTrue(saved[1].get('id'))
        self.assertNotEqual(saved[0]['id'], saved[1]['id'])
        self.assertFalse(errors, errors)

    def test_automation_edit_preserves_id_and_duplicate_creates_new_id(self):
        from playwright.sync_api import expect
        page, errors, saved = self.studio_page()
        record = {'id': 'existing-routine', 'name': 'Existing routine', 'enabled': True,
                  'time': '07:45', 'scheduleMode': 'weekly', 'days': [1, 2, 3, 4, 5],
                  'targets': ['all'], 'action': 'display.text', 'payload': {'text': 'Welcome'}}
        page.route('**/api/v1/automations', lambda route: route.fulfill(json={'events': [record], 'scheduler': {'timezone': 'America/New_York'}}) if route.request.method == 'GET' else route.fallback())
        updates = []
        def update(route):
            updates.append(route.request.post_data_json)
            route.fulfill(json={'ok': True, 'event': updates[-1]})
        page.route('**/api/v1/automations/existing-routine', update)
        page.evaluate('loadSchedules()')
        page.locator('.studioCard').get_by_role('button', name='Edit', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        expect(editor.get_by_role('button', name='Delete automation', exact=True)).to_be_visible()
        editor.get_by_label('Automation name', exact=True).fill('Updated routine')
        editor.get_by_role('button', name='Preview & validate', exact=True).click()
        expect(editor.get_by_role('button', name='Save automation', exact=True)).to_be_enabled()
        editor.get_by_role('button', name='Save automation', exact=True).click()
        page.wait_for_function("!document.querySelector('dialog.studioDialog[open]')")
        self.assertEqual(len(updates), 1)
        self.assertEqual(updates[0]['id'], record['id'])
        page.locator('.studioCard').get_by_role('button', name='Duplicate', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        expect(editor.get_by_role('heading', name='New automation', exact=True)).to_be_visible()
        editor.get_by_role('button', name='Preview & validate', exact=True).click()
        expect(editor.get_by_role('button', name='Save automation', exact=True)).to_be_enabled()
        editor.get_by_role('button', name='Save automation', exact=True).click()
        page.wait_for_function("!document.querySelector('dialog.studioDialog[open]')")
        self.assertEqual(len(saved), 1)
        self.assertTrue(saved[0].get('id'))
        self.assertNotEqual(saved[0]['id'], record['id'])
        self.assertFalse(errors, errors)


    def test_shared_layer_save_is_single_flight_and_retains_preview_hash(self):
        from playwright.sync_api import expect
        page, errors, saved = self.studio_page()
        page.get_by_role('button', name='Shared layers', exact=True).click()
        page.get_by_role('button', name='+ Shared layer', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        page.route('**/api/v1/planning/studio/preview', lambda route: route.fulfill(json={'matches': [], 'previewHash': 'reviewed-layer'}))
        held = []
        page.route('**/api/v1/planning/studio', lambda route: held.append(route) if route.request.method == 'PUT' else route.fallback())
        preview = editor.get_by_role('button', name='Preview rule', exact=True)
        save = editor.get_by_role('button', name='Save shared layer', exact=True)
        preview.click()
        expect(save).to_be_enabled()
        with page.expect_request('**/api/v1/planning/studio'):
            save.click()
        blocked = preview.is_disabled()
        inert = editor.locator('.studioDialogBody').evaluate('(node) => node.inert')
        if not blocked:
            with page.expect_request('**/api/v1/planning/studio'):
                save.click()
        count = len(held)
        payloads = [request.request.post_data_json for request in held]
        for request in held:
            request.fulfill(status=503, json={'error': 'Layer save unavailable'})
        expect(editor.locator('.studioStatus')).to_contain_text('Layer save unavailable')
        expect(preview).to_be_enabled()
        expect(save).to_be_disabled()
        self.assertEqual(count, 1)
        self.assertTrue(blocked)
        self.assertTrue(inert)
        self.assertEqual(payloads[0]['previewHash'], 'reviewed-layer')
        self.assertFalse(editor.locator('.studioDialogBody').evaluate('(node) => node.inert'))
        # A newly reviewed retry retains the rule identity and the backend hash.
        retries = []
        def retry_save(route):
            if route.request.method != 'PUT':
                return route.fallback()
            retries.append(route.request.post_data_json)
            route.fulfill(json={'config': retries[-1]['config']})
        page.route('**/api/v1/planning/studio', retry_save)
        preview.click()
        expect(save).to_be_enabled()
        with page.expect_response('**/api/v1/planning/studio'):
            save.click()
        self.assertEqual(len(retries), 1)
        retry = retries[0]
        self.assertEqual(retry['config']['overlays'][0]['id'], payloads[0]['config']['overlays'][0]['id'])
        self.assertEqual(retry['previewHash'], 'reviewed-layer')
        page.wait_for_function("!document.querySelector('dialog.studioDialog[open]')")
        self.assertFalse(errors, errors)

    def test_automation_delete_blocks_competing_save(self):
        from playwright.sync_api import expect
        page, errors, saved = self.studio_page()
        record = {'id': 'existing-routine', 'name': 'Existing routine', 'enabled': True,
                  'time': '07:45', 'scheduleMode': 'weekly', 'days': [1, 2, 3, 4, 5],
                  'targets': ['all'], 'action': 'display.text', 'payload': {'text': 'Welcome'}}
        page.route('**/api/v1/automations', lambda route: route.fulfill(json={'events': [record], 'scheduler': {'timezone': 'America/New_York'}}) if route.request.method == 'GET' else route.fallback())
        held = []
        page.route('**/api/v1/automations/existing-routine', lambda route: held.append(route))
        page.evaluate('loadSchedules()')
        page.locator('.studioCard').get_by_role('button', name='Edit', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        preview = editor.get_by_role('button', name='Preview & validate', exact=True)
        save = editor.get_by_role('button', name='Save automation', exact=True)
        preview.click()
        expect(save).to_be_enabled()
        page.remove_listener('dialog', page._fixture_dialog_handler)
        page.once('dialog', lambda dialog: dialog.accept())
        with page.expect_request('**/api/v1/automations/existing-routine'):
            editor.get_by_role('button', name='Delete automation', exact=True).click()
        blocked = save.is_disabled() and preview.is_disabled()
        self.assertEqual(held[0].request.method, 'DELETE')
        held[0].fulfill(status=503, json={'error': 'Delete unavailable'})
        expect(editor.locator('.studioStatus')).to_contain_text('Delete unavailable')
        expect(preview).to_be_enabled()
        expect(save).to_be_disabled()
        self.assertTrue(blocked)
        self.assertEqual(len(held), 1)
        self.assertFalse(errors, errors)


    def test_automation_date_response_cannot_unlock_a_pending_delete(self):
        from playwright.sync_api import expect
        page, errors, saved = self.studio_page()
        record = {'id': 'existing-routine', 'name': 'Existing routine', 'enabled': True,
                  'time': '07:45', 'scheduleMode': 'weekly', 'days': [1, 2, 3, 4, 5],
                  'targets': ['all'], 'action': 'display.text', 'payload': {'text': 'Welcome'}}
        page.route('**/api/v1/automations', lambda route: route.fulfill(json={'events': [record], 'scheduler': {'timezone': 'America/New_York'}}) if route.request.method == 'GET' else route.fallback())
        page.evaluate('loadSchedules()')
        page.locator('.studioCard').get_by_role('button', name='Edit', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        dates, deletes = [], []
        page.route('**/api/v1/automation-control', lambda route: dates.append(route))
        page.route('**/api/v1/automations/existing-routine', lambda route: deletes.append(route))
        with page.expect_request('**/api/v1/automation-control'):
            editor.get_by_role('button', name='Today only', exact=True).click()
        page.remove_listener('dialog', page._fixture_dialog_handler)
        page.once('dialog', lambda dialog: dialog.accept())
        with page.expect_request('**/api/v1/automations/existing-routine'):
            editor.get_by_role('button', name='Delete automation', exact=True).click()
        dates[0].fulfill(json={'clock': {'schedulerTime': '2027-10-19T16:00:00Z', 'timezone': 'America/New_York'}})
        expect(editor.get_by_label('Active from (optional)', exact=True)).to_have_value('2027-10-19')
        blocked = editor.get_by_role('button', name='Preview & validate', exact=True).is_disabled()
        deletes[0].fulfill(status=503, json={'error': 'Delete unavailable'})
        expect(editor.locator('.studioStatus')).to_contain_text('Delete unavailable')
        expect(editor.get_by_role('button', name='Preview & validate', exact=True)).to_be_enabled()
        self.assertTrue(blocked, 'an earlier date response cannot release mutation ownership')
        self.assertFalse(errors, errors)


    def class_save_editor(self):
        page, errors, saved = self.studio_page()
        page.evaluate("showPage('classes')")
        page.get_by_role('button', name='+ Add Class', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.locator('#className').fill('First class')
        editor.locator('#classScheduleMode').select_option('weekly')
        return page, errors, editor, saved

    def test_class_pending_save_cannot_create_twice(self):
        from playwright.sync_api import expect
        page, errors, editor, saved = self.class_save_editor()
        held = []
        page.route('**/api/v1/class-schedules', lambda route: held.append(route) if route.request.method == 'POST' else route.fallback())
        save = editor.get_by_role('button', name='Save Class', exact=True)
        with page.expect_request('**/api/v1/class-schedules'):
            save.click()
        blocked = save.is_disabled()
        inert = editor.locator('.studioDialogBody').evaluate('(node) => node.inert')
        if not blocked:
            with page.expect_request('**/api/v1/class-schedules'):
                save.click()
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        count = len(held)
        for request in held:
            request.fulfill(status=503, json={'error': 'Class save unavailable'})
        expect(editor.locator('#classEditorMsg')).to_contain_text('Class save unavailable')
        expect(save).to_be_enabled()
        self.assertEqual(count, 1)
        self.assertTrue(blocked)
        self.assertTrue(inert)
        self.assertFalse(editor.locator('.studioDialogBody').evaluate('(node) => node.inert'))
        self.assertFalse(errors, errors)

    def test_class_old_save_cannot_clear_or_close_a_newer_draft(self):
        from playwright.sync_api import expect
        page, errors, editor, saved = self.class_save_editor()
        held = []
        page.route('**/api/v1/class-schedules', lambda route: held.append(route) if route.request.method == 'POST' else route.fallback())
        with page.expect_request('**/api/v1/class-schedules'):
            editor.get_by_role('button', name='Save Class', exact=True).click()
        editor.get_by_role('button', name='Close', exact=True).click()
        page.get_by_role('button', name='+ Add Class', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.locator('#className').fill('Newer unsaved class')
        with page.expect_response('**/api/v1/class-schedules'):
            held[0].fulfill(json={'ok': True, 'classSchedule': {'id': 'created'}})
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        expect(page.locator('#className')).to_have_value('Newer unsaved class')
        self.assertEqual(page.locator('dialog.studioDialog[open]').count(), 1)
        self.assertFalse(editor.locator('.studioDialogBody').evaluate('(node) => node.inert'))
        self.assertFalse(errors, errors)

    def test_class_ambiguous_create_retry_keeps_one_identity(self):
        from playwright.sync_api import expect
        page, errors, editor, saved = self.class_save_editor()
        requests, owned = [], {}
        def create(route):
            if route.request.method != 'POST':
                return route.fallback()
            body = route.request.post_data_json
            requests.append(body)
            identity = body.get('id') or 'server-created-' + str(len(requests))
            if identity in owned:
                return route.fulfill(status=409, json={'error': 'Class ID already exists'})
            owned[identity] = body
            if len(requests) == 1:
                return route.fulfill(status=503, json={'error': 'The first save reply was lost'})
            route.fulfill(json={'ok': True, 'classSchedule': {**body, 'id': identity}})
        page.route('**/api/v1/class-schedules', create)
        save = editor.get_by_role('button', name='Save Class', exact=True)
        save.click()
        expect(editor.locator('#classEditorMsg')).to_contain_text('reply was lost')
        save.click()
        page.wait_for_function("document.querySelector('#classEditorMsg').textContent !== 'The first save reply was lost'")
        self.assertEqual(len(requests), 2)
        self.assertEqual(len(owned), 1)
        self.assertTrue(requests[0].get('id'))
        self.assertEqual(requests[0]['id'], requests[1]['id'])
        expect(editor.locator('#classEditorMsg')).to_contain_text('check the earlier save')
        expect(save).to_be_enabled()
        self.assertFalse(errors, errors)

    def test_class_separate_drafts_keep_distinct_ids_across_mode_changes(self):
        from playwright.sync_api import expect
        page, errors, editor, saved = self.class_save_editor()
        editor.get_by_role('button', name='Save Class', exact=True).click()
        page.wait_for_function("!document.querySelector('dialog.studioDialog[open]')")
        page.get_by_role('button', name='+ Add Class', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.locator('#className').fill('Second class')
        editor.locator('#classScheduleMode').select_option('dates')
        editor.locator('#classIncludeDates').fill('2027-10-18')
        editor.get_by_role('button', name='Save Class', exact=True).click()
        page.wait_for_function("!document.querySelector('dialog.studioDialog[open]')")
        self.assertEqual(len(saved), 2)
        first, second = [entry['class'] for entry in saved]
        self.assertTrue(first.get('id'))
        self.assertTrue(second.get('id'))
        self.assertNotEqual(first['id'], second['id'])
        self.assertEqual(second['includeDates'], ['2027-10-18'])
        self.assertFalse(errors, errors)

    def test_class_existing_edit_preserves_its_id_and_uses_put(self):
        from playwright.sync_api import expect
        record = {'id': 'existing-class', 'name': 'Existing class', 'shortName': 'EC',
                  'period': '1', 'startTime': '08:00', 'endTime': '09:00', 'scheduleMode': 'weekly',
                  'days': [1, 2, 3, 4, 5], 'defaultTargets': ['all'], 'enabled': True}
        page, errors, saved = self.studio_page(classes=[record])
        page.evaluate("showPage('classes')")
        page.locator('.classStudioRow').get_by_role('button', name='Edit', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        updates = []
        def update(route):
            updates.append({'method': route.request.method, 'body': route.request.post_data_json})
            route.fulfill(json={'ok': True, 'classSchedule': updates[-1]['body']})
        page.route('**/api/v1/class-schedules/existing-class', update)
        editor.locator('#className').fill('Renamed class')
        editor.get_by_role('button', name='Save Class', exact=True).click()
        page.wait_for_function("!document.querySelector('dialog.studioDialog[open]')")
        self.assertEqual(len(updates), 1)
        self.assertEqual(updates[0]['method'], 'PUT')
        self.assertEqual(updates[0]['body'].get('id', record['id']), record['id'])
        self.assertEqual(updates[0]['body']['name'], 'Renamed class')
        self.assertEqual(saved, [])
        self.assertFalse(errors, errors)

    def test_class_save_completion_does_not_reopen_a_closed_editor(self):
        from playwright.sync_api import expect
        page, errors, editor, saved = self.class_save_editor()
        held = []
        page.route('**/api/v1/class-schedules', lambda route: held.append(route) if route.request.method == 'POST' else route.fallback())
        with page.expect_request('**/api/v1/class-schedules'):
            editor.get_by_role('button', name='Save Class', exact=True).click()
        editor.get_by_role('button', name='Close', exact=True).click()
        page.evaluate("""() => {
            const dialog=document.querySelector('#classStudioTitle').closest('dialog');
            window.classEditorReopens=0;
            new MutationObserver(records=>{
                window.classEditorReopens+=records.filter(record=>record.attributeName==='open'&&record.oldValue===null).length;
            }).observe(dialog,{attributes:true,attributeOldValue:true,attributeFilter:['open']});
        }""")
        held[0].fulfill(json={'ok': True, 'classSchedule': {'id': 'created'}})
        expect(page.locator('#className')).to_have_value('')
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        self.assertEqual(page.evaluate('window.classEditorReopens'), 0)
        self.assertEqual(page.locator('dialog.studioDialog[open]').count(), 0)
        self.assertFalse(errors, errors)

    def test_scene_studio_drag_edit_widgets_and_reviewed_save(self):
        page, errors, saved = self.studio_page()
        page.get_by_role('button', name='+ Automation', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.get_by_label('Automation name', exact=True).fill('Lunch display')
        editor.get_by_role('checkbox', name='Special day · Lunch · 11:00–11:30', exact=True).check()
        editor.get_by_role('button', name='Actions', exact=True).click()
        editor.get_by_role('button', name='Edit action', exact=True).click()
        action = page.locator('dialog.studioDialog[open]').last
        action.get_by_role('button', name='Design this screen', exact=True).click()
        canvas = page.locator('dialog.sceneEditor[open]')
        canvas.get_by_role('button', name='+ Widget', exact=True).click()
        canvas.get_by_label('Widget', exact=True).select_option('countdown')
        canvas.get_by_label('Glow strength', exact=True).fill('15')
        canvas.get_by_label('Motion', exact=True).select_option('bounce')
        layer = canvas.locator('[data-layer-id]').last
        before = layer.bounding_box()
        page.mouse.move(before['x'] + 10, before['y'] + 10)
        page.mouse.down()
        page.mouse.move(before['x'] + 65, before['y'] + 35, steps=4)
        page.mouse.up()
        after = layer.bounding_box()
        self.assertGreater(after['x'], before['x'] + 40)
        resize=canvas.locator('.sceneResize').bounding_box()
        page.mouse.move(resize['x']+resize['width']/2,resize['y']+resize['height']/2)
        page.mouse.down()
        page.mouse.move(resize['x']+60,resize['y']+20,steps=4)
        page.mouse.up()
        self.assertGreater(layer.bounding_box()['width'],after['width']+35)
        x=layer.bounding_box()['x']
        layer.press('Shift+ArrowRight')
        self.assertGreater(layer.bounding_box()['x'],x+3)
        canvas.get_by_label('Lock position',exact=True).check()
        locked_x=layer.bounding_box()['x']
        layer.press('Shift+ArrowRight')
        self.assertAlmostEqual(layer.bounding_box()['x'],locked_x,delta=0.5)
        canvas.get_by_label('Receiver shape', exact=False).select_option(str(4 / 3))
        metrics=canvas.locator('.rg-scene-layer').evaluate_all('''items => items.map(e=>({id:e.dataset.layerId,font:getComputedStyle(e.firstChild).fontSize,outer:[e.clientWidth,e.clientHeight],inner:[e.firstChild.clientWidth,e.firstChild.clientHeight],rect:e.getBoundingClientRect().toJSON(),text:e.firstChild.textContent}))''')
        (OUTPUT / 'scene-editor-font-metrics.json').write_text(json.dumps(metrics,indent=2))
        self.assertGreaterEqual(float(metrics[-1]['font'].replace('px','')),50)
        self.evidence(page, errors, 'scene-studio-desktop')
        canvas.get_by_role('button', name='Use scene', exact=True).click()
        action.get_by_role('button', name='Use action', exact=True).click()
        editor.get_by_role('button', name='Preview & validate', exact=True).click()
        editor.get_by_role('button', name='Save automation', exact=True).click()
        page.wait_for_function("!document.querySelector('dialog.studioDialog[open]')")
        self.assertEqual(saved[-1]['blockIds'], ['lunch'])
        widgets = [l for l in saved[-1]['actionSequence'][0]['payload']['scene']['layers'] if l['type'] == 'widget']
        self.assertEqual(widgets[0]['widget'], 'countdown')
        self.assertEqual(widgets[0]['effect'], 'bounce')
        self.assertEqual(saved[-1]['actionSequence'][0]['targets'], ['all'])
        self.assertFalse(errors, errors)

    def test_automation_studio_mobile_temporary_timer_and_defaults(self):
        page, errors, saved = self.studio_page(width=390)
        page.get_by_role('button', name='+ Automation', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.get_by_label('Automation name', exact=True).fill('Temporary announcement')
        editor.get_by_role('button', name='Today only', exact=True).click()
        editor.get_by_role('button', name='Timer & advanced', exact=True).click()
        editor.get_by_label('Add timer overlay', exact=True).check()
        editor.get_by_label('Timer source', exact=True).select_option('end-time')
        editor.get_by_label('Countdown ends at', exact=True).fill('11:28')
        self.evidence(page, errors, 'automation-studio-mobile')
        editor.get_by_role('button', name='Actions', exact=True).click()
        editor.get_by_role('button', name='Edit action', exact=True).click()
        action = page.locator('dialog.studioDialog[open]').last
        action.get_by_role('button', name='Use action', exact=True).click()
        editor.get_by_role('button', name='Preview & validate', exact=True).click()
        editor.get_by_role('button', name='Save automation', exact=True).click()
        page.wait_for_function("!document.querySelector('dialog.studioDialog[open]')")
        self.assertEqual(saved[-1]['scheduleWindow']['startDate'], '2027-10-18')
        self.assertEqual(saved[-1]['timerOverlay']['endTime'], '11:28')
        self.assertEqual(saved[-1]['actionSequence'][0]['payload']['background'], '#101d2c')
        self.assertFalse(errors, errors)

    def test_class_studio_date_only_identity_and_availability(self):
        page, errors, saved = self.studio_page()
        page.evaluate("showPage('classes')")
        page.get_by_role('button', name='+ Add Class', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.get_by_label('Name', exact=True).fill('Special homeroom')
        editor.get_by_label('Short Name', exact=True).fill('Homeroom')
        editor.get_by_label('Period / Block', exact=True).fill('Homeroom')
        editor.get_by_label('Schedule', exact=True).select_option('dates')
        editor.locator('#classIncludeDates').fill('2027-10-18')
        editor.locator('#classStudioFrom').fill('2027-10-18')
        editor.locator('#classStudioThrough').fill('2027-10-18')
        editor.get_by_text('Fallback times & timer continuation', exact=True).click()
        editor.get_by_label('Start', exact=True).fill('13:13')
        editor.get_by_label('End', exact=True).fill('14:45')
        self.evidence(page, errors, 'class-studio-date-only')
        editor.get_by_role('button', name='Save Class', exact=True).click()
        page.wait_for_function("!document.querySelector('dialog.studioDialog[open]')")
        self.assertEqual(saved[-1]['class']['scheduleMode'], 'dates')
        self.assertEqual(saved[-1]['class']['includeDates'], ['2027-10-18'])
        self.assertEqual(saved[-1]['class']['scheduleWindow']['endDate'], '2027-10-18')
        self.assertFalse(errors, errors)

    def test_action_studio_keeps_lighting_payloads_compatible(self):
        page, errors, saved = self.studio_page()
        page.get_by_role('button', name='+ Automation', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        editor.get_by_label('Automation name', exact=True).fill('Lighting compatibility')
        editor.get_by_role('button', name='Actions', exact=True).click()
        editor.get_by_role('button', name='Edit action', exact=True).click()
        action = page.locator('dialog.studioDialog[open]').last
        action.get_by_label('Action type', exact=True).select_option('govee.scene')
        action.get_by_label('Lighting scene name', exact=True).fill('Rainbow')
        action.get_by_role('button', name='Use action', exact=True).click()
        editor.get_by_role('button', name='Edit action', exact=True).click()
        action = page.locator('dialog.studioDialog[open]').last
        self.assertEqual(action.get_by_label('Lighting scene name', exact=True).input_value(), 'Rainbow')
        action.get_by_label('Action type', exact=True).select_option('govee.brightness')
        action.get_by_label('Brightness (%)', exact=True).fill('35')
        action.get_by_role('button', name='Use action', exact=True).click()
        editor.get_by_role('button', name='Targets & layers', exact=True).click()
        editor.get_by_role('checkbox', name='All lights', exact=True).check()
        editor.get_by_role('button', name='Preview & validate', exact=True).click()
        editor.get_by_role('button', name='Save automation', exact=True).click()
        page.wait_for_function("!document.querySelector('dialog.studioDialog[open]')")
        self.assertEqual(saved[-1]['actionSequence'][0]['payload']['level'], 35)
        self.assertNotIn('brightness', saved[-1]['actionSequence'][0]['payload'])
        self.assertFalse(errors, errors)

    def test_existing_date_only_class_retains_dates_and_window(self):
        record = {'id': 'homeroom', 'name': 'Homeroom', 'shortName': 'HR', 'period': 'HR',
                  'scheduleMode': 'dates', 'includeDates': ['2027-10-18'], 'enabled': True,
                  'startTime': '13:13', 'endTime': '14:45', 'defaultTargets': ['all'],
                  'scheduleWindow': {'startDate': '2027-10-18', 'endDate': '2027-10-18',
                                     'excludedDates': ['2027-10-19']}}
        page, errors, saved = self.studio_page(classes=[record])
        page.evaluate("showPage('classes')")
        page.get_by_role('button', name='Edit', exact=True).click()
        editor = page.locator('dialog.studioDialog[open]').last
        self.assertEqual(editor.locator('#classIncludeDates').input_value(), '2027-10-18')
        self.assertEqual(editor.locator('#classStudioFrom').input_value(), '2027-10-18')
        self.assertEqual(page.evaluate('currentClassEdit.scheduleWindow.excludedDates'), ['2027-10-19'])
        self.assertFalse(errors, errors)
