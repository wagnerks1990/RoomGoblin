"""Real learning routes and UI with synthetic local timetable/identity fixtures.

No Schoology service, production data, or physical devices are contacted.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
SERVER = r"""
const fs=require('node:fs');
const {fixture}=require('./test/helpers/learning-fixture');
(async()=>{
 let now=Date.now();
 const source={day:new Date(now).toISOString().slice(0,10),
  classes:[{id:'p7',title:'Planning Period 7',enabled:true},{id:'p8',title:'Planning Period 8',enabled:true}],
  active:[{scheduleId:'p7',key:'period-seven',startAt:now-60000,endAt:now+3600000}]};
 const f=await fixture({platformOptions:{clock:()=>now,scheduleSource:()=>source}});
 f.app.post('/fixture/fresh-start',(_req,res)=>{require('./tools/reset-learning.cjs').reset(f.store.db,{confirm:'RESET_LEARNING_DATA'});res.json({ok:true});});
 f.app.post('/fixture/next-period',(_req,res)=>{
  now+=3600000;source.active=[{scheduleId:'p8',key:'period-eight',startAt:now,endAt:now+3600000}];
  f.learning.schedule.reconcile();res.json({ok:true});
 });
 fs.writeFileSync(process.env.LEARNING_FIXTURE_READY,JSON.stringify({base:f.base,classId:f.classId,cookie:f.cookies[f.admin.id]}));
 process.on('SIGTERM',async()=>{await f.close();process.exit(0)});
})().catch(e=>{console.error(e);process.exit(1)});
"""


class LearningScheduleBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
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

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='learning-browser-')
        self.addCleanup(self.temp.cleanup)
        ready = Path(self.temp.name) / 'ready.json'
        log = open(Path(self.temp.name) / 'server.log', 'w+', encoding='utf-8')
        self.addCleanup(log.close)
        self.server = subprocess.Popen(
            ['node', '-e', SERVER], cwd=ROOT,
            env={**os.environ, 'LEARNING_FIXTURE_READY': str(ready)},
            stdout=log, stderr=log,
        )
        self.addCleanup(self.stop_server)
        deadline = time.monotonic() + 20
        while not ready.exists() and self.server.poll() is None and time.monotonic() < deadline:
            time.sleep(0.05)
        if not ready.exists():
            log.seek(0)
            self.fail('Synthetic learning fixture did not start: ' + log.read()[-2000:])
        self.info = json.loads(ready.read_text(encoding='utf-8'))
        self.context = self.browser.new_context(viewport={'width': 1400, 'height': 1000})
        self.addCleanup(self.context.close)
        self.context.add_cookies([{'name': 'classroom_hub_session',
                                  'value': self.info['cookie'].split('=', 1)[1],
                                  'url': self.info['base']}])
        self.page = self.context.new_page()
        self.page.clock.install()
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))

    def stop_server(self):
        if self.server.poll() is None:
            self.server.terminate()
            try:
                self.server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.server.kill()
                self.server.wait(timeout=5)

    def open(self):
        self.page.goto(self.info['base'] + '/learn?view=classroom')
        expect(self.page.locator('#workspace')).to_be_visible()
        self.page.locator('[data-tab="setup"]').click()
        expect(self.page.locator('#schedule-save')).to_be_enabled()

    def test_root_workspace_starts_empty_without_redirects_or_retired_apps(self):
        self.context.request.post(self.info['base'] + '/fixture/fresh-start')
        response = self.page.goto(self.info['base'] + '/learn')
        self.assertEqual(response.status, 200)
        self.assertIsNone(response.request.redirected_from)
        expect(self.page.locator('#workspace')).to_be_visible()
        expect(self.page.locator('h1')).to_have_text('Teacher portal')
        expect(self.page.locator('#class-select option')).to_have_count(0)
        for path in ['/learn/teacher', '/learn/teacher/', '/learn/platform/',
                     '/learn/connect/', '/learn/presence/', '/learn/scorm/bridge.js']:
            retired = self.context.request.get(self.info['base'] + path, max_redirects=0)
            self.assertEqual(retired.status, 404, path)
            self.assertNotIn('location', retired.headers)
        self.page.get_by_role('button', name='Classes & accounts', exact=True).click()
        expect(self.page.locator('#management-content input[type=\"password\"]')).to_have_count(0)
        self.page.get_by_label('Class title', exact=True).fill('Fresh API class')
        self.page.get_by_role('button', name='Create class', exact=True).click()
        expect(self.page.locator('#class-select option:checked')).to_have_text('Fresh API class')
        self.page.get_by_role('button', name='Assignments', exact=True).click()
        self.page.get_by_text('Add an assignment', exact=True).click()
        self.page.get_by_label('Assignment title', exact=True).fill('Fresh evidence task')
        self.page.get_by_role('button', name='Create assignment', exact=True).click()
        self.page.locator('#assignment-list > details > summary').filter(has_text='Fresh evidence task').click()
        expect(self.page.get_by_role('button', name='Download direct API starter', exact=True)).to_be_visible()
        self.assertEqual(len(self.errors), 0, self.errors)

    def test_configure_once_sync_pause_resume_and_follow_next_period(self):
        self.open()
        self.page.get_by_text('Class mappings', exact=True).click()
        self.page.locator('[data-schedule-id="p7"]').select_option(self.info['classId'])
        self.page.locator('#schedule-enabled').check()
        self.page.locator('#schedule-save').click()
        expect(self.page.locator('#status')).to_have_text('Saved to RoomGoblin.')
        self.page.locator('[data-tab="classroom"]').click()
        expect(self.page.locator('#session-label')).to_have_text('Automatic classroom session')
        expect(self.page.locator('#class-select option')).to_have_count(2)
        expect(self.page.locator('#manual-session')).to_be_hidden()
        expect(self.page.locator('#manual-attendance')).to_be_hidden()
        expect(self.page.locator('#automatic-attendance')).to_contain_text('Students enroll through signed Schoology')
        self.page.reload()
        expect(self.page.locator('#session-label')).to_have_text('Automatic classroom session')
        expect(self.page.locator('#class-select')).to_have_value(self.info['classId'])
        self.page.get_by_role('button', name='Pause this class today', exact=True).click()
        expect(self.page.locator('#session-label')).to_have_text('Paused for today')
        self.page.reload()
        expect(self.page.locator('#session-label')).to_have_text('Paused for today')
        self.page.get_by_role('button', name='Resume automatic mode', exact=True).click()
        expect(self.page.locator('#session-label')).to_have_text('Automatic classroom session')
        self.page.locator('[data-tab="assignments"]').click()
        self.page.get_by_text('Add an assignment', exact=True).click()
        self.page.get_by_label('Assignment title', exact=True).fill('Unfinished teacher draft')
        expect(self.page.locator('#follow-current')).not_to_be_checked()
        with urlopen(Request(self.info['base'] + '/fixture/next-period', data=b'{}',
                             headers={'Content-Type': 'application/json'}), timeout=5) as response:
            self.assertEqual(response.status, 200)
        self.page.locator('[data-tab="classroom"]').click()
        self.page.clock.fast_forward(32000)
        expect(self.page.locator('#session-label')).to_have_text('Waiting for scheduled class')
        expect(self.page.locator('#class-select')).to_have_value(self.info['classId'])
        expect(self.page.get_by_label('Assignment title', exact=True)).to_have_value('Unfinished teacher draft')
        self.page.once('dialog', lambda dialog: dialog.accept())
        self.page.locator('#refresh').click()
        expect(self.page.locator('#status')).to_have_text('Refreshed from RoomGoblin.')
        self.page.locator('#follow-current').check()
        self.page.clock.fast_forward(32000)
        expect(self.page.locator('#class-select')).not_to_have_value(self.info['classId'])
        expect(self.page.locator('#class-select option:checked')).to_have_text('Planning Period 8')
        expect(self.page.locator('#session-label')).to_have_text('Automatic classroom session')
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        output = ROOT / 'test-results' / 'workspaces'
        output.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=str(output / ('learning-automatic-' + self.engine + '.png')), full_page=True)
        self.assertEqual(self.errors, [])

    def test_optional_sync_failure_keeps_manual_workspace_and_drafts_available(self):
        self.page.route('**/api/v1/learning/platform/schedule',
                        lambda route: route.fulfill(status=503, json={'error': 'Synthetic unavailable source'}))
        self.page.goto(self.info['base'] + '/learn?view=classroom')
        expect(self.page.locator('#start')).to_be_enabled()
        self.page.locator('[data-tab="setup"]').click()
        expect(self.page.get_by_text('This setting could not be loaded. Existing configuration is unchanged.', exact=True)).to_be_visible()
        self.page.locator('[data-tab="classroom"]').click()
        expect(self.page.locator('#login')).to_be_hidden()
        self.page.locator('#start').click()
        expect(self.page.locator('#session-label')).to_have_text('Classroom session active')
        first = self.page.locator('#attendance input').first
        first.check()
        self.page.clock.fast_forward(16000)
        expect(first).to_be_checked()
        self.assertEqual(self.errors, [])


if __name__ == '__main__':
    unittest.main()
