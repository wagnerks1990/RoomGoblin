"""Real Today UI with deterministic API responses and lightweight preview frames."""
import unittest
import test_workspaces as harness


class TodayDashboardBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.WorkspaceBrowserTests.tearDownClass.__func__)
    page = harness.WorkspaceBrowserTests.page
    evidence = harness.WorkspaceBrowserTests.evidence

    def today(self, hold_optional=False, initial=None):
        state = {'fail_inventory': False, 'fail_status': False, 'fail_classes': False, 'fail_commands': False, 'previews': 0, 'held': [], 'commands': [], 'probes': 0, **(initial or {})}
        devices = {'screen-a': {'name': 'Front display', 'enabled': True, 'avOutput': 1}}
        status = {'screen-a': {'online': True, 'lastSeen': '2026-10-27T12:00:00Z',
                               'meta': {'resolution': '1920x1080'}}}
        state['devices'], state['statuses'] = devices, status
        fixtures = {
            '/api/v1/status': {'ok': True, 'state': {'displays': {'screen-a': {'title': 'Current lesson'}}},
                               'runtime': {'displays': status, 'mqtt': {'configured': True, 'connected': True}}},
            '/api/v1/class-schedules': {'schoolCycle': {'isStudentSchoolDay': True, 'dayColor': 'Blue', 'cycleDay': 2},
                                        'activeClass': {'name': 'Networking', 'endTime': '09:00'}},
            '/api/v1/integrations/check': {'mqtt': {'connected': True}, 'hardware': {'pluto': {'reachable': True}}},
            '/api/v1/pluto/status': {'videoStatus': {'allsource': [1]}, 'labels': {'inputs': ['Classroom source']}, 'systemStatus': {'uptime': 1}},
        }
        def transport(route, target):
            if target == '/api/v1/status' and state['fail_status'] or target == '/api/v1/class-schedules' and state['fail_classes']:
                route.fulfill(status=503, json={'error': 'Fixture read unavailable'})
                return True
            if target in ('/api/v1/commands', '/api/v1/pluto'):
                state['commands'].append((target, route.request.post_data_json))
                route.fulfill(status=503 if state['fail_commands'] else 200,
                              json={'error': 'Fixture command rejected'} if state['fail_commands'] else {'ok': True, 'data': {'result': 1}})
                return True
            if target == '/api/v1/pluto/status':
                state['probes'] += 1

            if target == '/api/v1/devices':
                route.fulfill(status=503 if state['fail_inventory'] else 200,
                              json={'error': 'Fixture inventory unavailable'} if state['fail_inventory']
                              else {'devices': devices, 'status': status})
                return True
            if hold_optional and target in ('/api/v1/integrations/check', '/api/v1/pluto/status'):
                state['held'].append(route)
                return True
            if target.startswith('/display/'):
                state['previews'] += 1
                route.fulfill(content_type='text/html', body='<p>Fixture receiver preview</p>')
                return True
            return False
        page, errors = self.page('/controller/', overrides=fixtures, transport=transport)
        return page, errors, state

    def test_core_overview_does_not_wait_for_optional_probes(self):
        page, errors, state = self.today(hold_optional=True)
        page.wait_for_function("document.getElementById('overviewDisplaySummary').textContent.includes('1 / 1')", timeout=1500)
        self.assertIn('Networking', page.locator('#overviewClassStatus').inner_text())
        self.assertTrue(state['held'])
        page.evaluate('Promise.all([refreshOverview(), refreshOverview()])')
        self.assertEqual(state['probes'], 1)
        self.assertEqual(page.locator('#mqttState').inner_text(), 'ONLINE')
        for route in state['held']:
            route.fulfill(status=503, json={'error': 'Fixture AV unavailable'})
        page.wait_for_function("document.getElementById('plutoState').textContent === 'UNAVAILABLE'")
        self.assertEqual(page.locator('#mqttState').inner_text(), 'ONLINE')
        self.assertFalse(errors, errors)

    def test_status_refresh_keeps_preview_session_and_focused_control(self):
        page, errors, state = self.today()
        page.locator('[data-overview-preview="screen-a"]').wait_for()
        page.evaluate("""() => {
          window.savedTodayFrame=document.querySelector('[data-overview-preview="screen-a"]');
          window.savedTodayControl=document.querySelector('#overviewDisplays button');
          savedTodayControl.focus();
        }""")
        before = state['previews']
        page.evaluate('refreshOverview()')
        self.assertTrue(page.evaluate('savedTodayFrame === document.querySelector(\'[data-overview-preview="screen-a"]\')'))
        self.assertTrue(page.evaluate('document.activeElement === savedTodayControl'))
        self.assertEqual(state['previews'], before)
        self.assertFalse(errors, errors)

    def test_failed_inventory_is_not_reported_as_an_empty_room(self):
        page, errors, state = self.today()
        page.locator('[data-overview-preview="screen-a"]').wait_for()
        state['fail_inventory'] = True
        page.evaluate('refreshOverview()')
        self.assertEqual(page.locator('.displayOverviewCard').count(), 1)
        self.assertNotIn('No displays configured', page.locator('#overviewDisplayDetail').inner_text())
        self.assertIn('unavailable', page.locator('#overviewDisplayDetail').inner_text().lower())
        self.assertFalse(errors, errors)

    def test_initial_failed_reads_are_unknown_not_empty_or_idle(self):
        page, errors, state = self.today(initial={'fail_inventory': True, 'fail_status': True, 'fail_classes': True})
        page.evaluate('refreshOverview()')
        self.assertEqual(page.locator('#overviewDisplaySummary').inner_text(), 'Unavailable')
        self.assertIn('inventory unavailable', page.locator('#overviewDisplays').inner_text())
        self.assertEqual(page.locator('#hubState').inner_text(), 'UNAVAILABLE')
        self.assertEqual(page.locator('#mqttState').inner_text(), 'UNAVAILABLE')
        self.assertIn('unavailable', page.locator('#overviewSchoolDay').inner_text())
        self.assertIn('unavailable', page.locator('#overviewClassStatus').inner_text())
        self.assertFalse(errors, errors)

    def test_inventory_changes_preserve_other_frames_and_dom_order(self):
        page, errors, state = self.today()
        page.locator('[data-overview-preview="screen-a"]').wait_for()
        page.evaluate("window.savedTodayFrame=document.querySelector('[data-overview-preview=screen-a]')")
        state['devices']['aaa-new'] = {'enabled': True, 'name': 'New receiver'}
        page.evaluate('refreshOverview()')
        self.assertEqual(page.locator('.displayOverviewCard').evaluate_all('(cards)=>cards.map(c=>c.dataset.overviewId)'), ['aaa-new', 'screen-a'])
        self.assertTrue(page.evaluate("savedTodayFrame === document.querySelector('[data-overview-preview=screen-a]')"))
        del state['devices']['aaa-new']
        page.evaluate('refreshOverview()')
        self.assertEqual(page.locator('.displayOverviewCard').count(), 1)
        self.assertTrue(page.evaluate("savedTodayFrame === document.querySelector('[data-overview-preview=screen-a]')"))
        page.evaluate('refreshOverviewDisplayPreviews()')
        page.wait_for_function("document.querySelector('[data-overview-preview]').src.includes('overview=')")
        self.assertFalse(errors, errors)

    def test_mapping_guards_and_offline_power_report_command_results(self):
        page, errors, state = self.today()
        page.locator('[data-overview-preview="screen-a"]').wait_for()
        state['devices']['duplicate'] = {'enabled': True, 'avOutput': 1}
        state['statuses']['screen-a']['online'] = False
        page.evaluate('refreshOverview()')
        card = page.locator('[data-overview-id="screen-a"]')
        self.assertTrue(card.locator('[data-overview-test]').is_disabled())
        page.evaluate("overviewTestImage('screen-a', 1)")
        self.assertEqual(state['commands'], [])
        self.assertIn('unique AV output', page.locator('#hubToast').inner_text())
        self.assertTrue(card.get_by_role('button', name='Power On', exact=True).is_enabled())
        card.get_by_role('button', name='Power On', exact=True).click()
        page.wait_for_function("document.getElementById('hubToast').textContent.includes('confirmed')")
        self.assertEqual(state['commands'][-1], ('/api/v1/pluto', {'action': 'cecOutput', 'output': 1, 'connection': 'hdbt', 'index': 0}))
        state['fail_commands'] = True
        card.get_by_role('button', name='Power Off', exact=True).click()
        page.wait_for_function("document.getElementById('hubToast').textContent === 'Fixture command rejected'")
        del state['devices']['duplicate']
        page.evaluate('refreshOverview()')
        card.locator('[data-overview-test]').click()
        page.wait_for_function("document.getElementById('hubToast').textContent === 'Fixture command rejected'")
        self.assertEqual(state['commands'][-1][1]['target'], 'screen-a')
        self.assertFalse(errors, errors)

    def test_today_cards_fit_phone_and_keep_receiver_and_power_distinct(self):
        page, errors, state = self.today()
        page.set_viewport_size({'width': 390, 'height': 1000})
        page.locator('[data-overview-preview="screen-a"]').wait_for()
        self.assertIn('RECEIVER ONLINE', page.locator('[data-overview-connection]').inner_text())
        self.assertNotIn('Loading displays', page.locator('#overviewDisplays').inner_text())
        self.assertIn('does not confirm TV power', page.locator('#overviewDisplayDetail').inner_text())
        state['statuses']['screen-a']['meta']['resolution'] = '999999999x0'
        page.evaluate('refreshOverview()')
        self.assertEqual(page.locator('[data-overview-preview]').get_attribute('data-logical-width'), '1920')
        self.evidence(page, errors, 'today-phone')

    def test_automation_error_and_capabilities_are_visible_on_today(self):
        page, errors, state = self.today()
        page.wait_for_function("document.getElementById('todayAutomationState').textContent === 'Automation unavailable'")
        self.assertTrue(page.locator('#todayAutomationToggle').is_disabled())
        page.evaluate("paintAutomationControl({enabled:true});applyAuthUi({authEnabled:true,user:{role:'teacher',capabilities:['classroom.read']}})")
        self.assertTrue(page.locator('#todayAutomationToggle').is_disabled())
        self.assertTrue(page.get_by_role('button', name='Resume Schedule', exact=True).is_disabled())
        page.evaluate("applyAuthUi({authEnabled:true,user:{role:'teacher',capabilities:['classroom.read','classroom.control']}})")
        self.assertTrue(page.locator('#todayAutomationToggle').is_disabled())
        self.assertTrue(page.get_by_role('button', name='Resume Schedule', exact=True).is_enabled())
        page.evaluate("applyAuthUi({authEnabled:true,user:{role:'admin',capabilities:['*']}})")
        self.assertTrue(page.locator('#todayAutomationToggle').is_enabled())
        self.assertFalse(errors, errors)
