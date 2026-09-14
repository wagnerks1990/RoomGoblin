"""Compact lighting controls with real browser rendering and deterministic MQTT API fixtures."""
import unittest
import test_workspaces as harness


def inventory():
    devices = {f'light-{n}': {'id': f'fixture-{n}', 'name': f'Desk light {n}', 'sku': 'H-fixture'} for n in range(1, 13)}
    return {'devices': devices, 'groups': {'all': list(devices), 'front': ['light-1', 'light-2']},
            'states': {alias: {'state': 'ON', 'brightness': 55, 'color': {'r': 10, 'g': 100, 'b': 90}} for alias in devices},
            'presence': {alias: {'online': n % 2 == 0} for n, alias in enumerate(devices)},
            'meta': {alias: {'groups': ['front'] if alias in ('light-1', 'light-2') else []} for alias in devices},
            'discovery': {'autoAdd': True, 'totalCount': 12}}


class LightingBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.WorkspaceBrowserTests.tearDownClass.__func__)
    page = harness.WorkspaceBrowserTests.page
    evidence = harness.WorkspaceBrowserTests.evidence

    def lighting(self, width=1440, fail_scenes=False):
        data, calls = inventory(), []
        def transport(route, target):
            if target.startswith('/api/v1/govee/'):
                request = route.request
                calls.append((target, request.method, request.post_data_json if request.post_data else None))
                if target.endswith('/scenes'):
                    route.fulfill(status=503 if fail_scenes else 200, json={'error': 'Scene bridge unavailable'} if fail_scenes else {'scenes': ['Focus', 'Reading']})
                else:
                    alias, action = target.split('/')[-2:]
                    if alias in data['states'] and action == 'brightness':
                        data['states'][alias]['brightness'] = request.post_data_json['level']
                    if '/device/' in target:
                        alias = target.rsplit('/', 1)[-1]
                        data['devices'][alias]['name'] = request.post_data_json['name']
                        data['meta'][alias]['groups'] = request.post_data_json['groups']
                    route.fulfill(json={'ok': True})
                return True
            if target == '/api/v1/govee':
                route.fulfill(json=data)
                return True
        page, errors = self.page('/controller/', width, transport=transport)
        page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
        page.evaluate("showPage('lights')")
        page.wait_for_selector('#lightDevices .lightCard')
        return page, errors, data, calls

    def test_compact_lighting_responsive_filters_and_disclosures(self):
        for width in (390, 1440):
            with self.subTest(width=width):
                page, errors, _, calls = self.lighting(width)
                self.assertEqual(page.locator('#lightDevices .lightCard:visible').count(), 12)
                self.assertEqual(page.locator('#lightDevices .lightTools[open]').count(), 0)
                self.assertFalse(any(target.endswith('/scenes') for target, _, _ in calls))
                card = page.locator('#lightDevices .lightCard').first
                self.assertLess(card.bounding_box()['height'], 230)
                page.locator('#goveeSearch').fill('Desk light 1')
                self.assertEqual(page.locator('#lightDevices .lightCard:visible').count(), 4)
                page.locator('#goveeStatusFilter').select_option('online')
                self.assertEqual(page.locator('#lightDevices .lightCard:visible').count(), 2)
                page.locator('#goveeGroupFilter').select_option('front')
                self.assertEqual(page.locator('#lightDevices .lightCard:visible').count(), 1)
                self.assertEqual(page.locator('#lightGroups .lightCard:visible').count(), 2)
                page.evaluate('clearGoveeFilters()')
                card.locator('.lightTools > summary').click()
                page.wait_for_function("document.querySelector('#lightDevices [data-light-control=s]').options.length === 2")
                page.evaluate('window.scrollTo(0, 0)')
                self.evidence(page, errors, f'lighting-tools-{width}')

    def test_lighting_commands_and_refresh_preserve_drafts_and_focus(self):
        page, errors, data, calls = self.lighting()
        card = page.locator('#lightDevices [data-light-target="light-1"]')
        card.locator('.lightPower .on').click()
        page.wait_for_timeout(300)
        self.assertIn(('/api/v1/govee/light-1/on', 'POST', {}), calls)
        card.locator('[data-light-control=b]').fill('72')
        card.locator('button[aria-label="Apply brightness to Desk light 1"]').click()
        card.locator('.lightTools > summary').click()
        page.wait_for_function("document.querySelector('#lightDevices [data-light-control=s]').options.length === 2")
        card.locator('[data-light-control=c]').fill('#112233')
        card.locator('button[aria-label="Apply color to Desk light 1"]').click()
        card.locator('[data-light-control=t]').fill('4200')
        card.locator('button[aria-label="Apply temp to Desk light 1"]').click()
        card.locator('[data-light-control=s]').select_option('Reading')
        card.locator('[data-light-scene-apply]').click()
        card.locator('.lightEdit > summary').click()
        name = card.locator('[data-light-edit=name]')
        name.fill('New desk name')
        name.focus()
        page.evaluate('loadGovee()')
        self.assertTrue(name.evaluate('(el) => el === document.activeElement'))
        self.assertEqual(name.input_value(), 'New desk name')
        self.assertEqual(card.locator('[data-light-control=b]').input_value(), '72')
        data['states']['light-1']['brightness'] = 33
        page.evaluate('loadGovee()')
        self.assertEqual(card.locator('[data-light-control=b]').input_value(), '33')
        card.locator('[data-light-control=b]').fill('81')
        page.evaluate('loadGovee()')
        self.assertEqual(card.locator('[data-light-control=b]').input_value(), '81')
        self.assertEqual(card.locator('[data-light-control=s]').input_value(), 'Reading')
        self.assertTrue(card.locator('.lightEdit').evaluate('(el) => el.open'))
        card.get_by_role('button', name='Save device', exact=True).click()
        page.wait_for_function("document.querySelector('#lightDevices [data-light-name]').textContent === 'New desk name'")
        for action, body in [('brightness', {'level': 72}), ('color', {'color': '#112233'}), ('temp', {'kelvin': 4200}), ('scene', {'scene': 'Reading'})]:
            self.assertIn((f'/api/v1/govee/light-1/{action}', 'POST', body), calls)
        self.assertFalse(errors, errors)

    def test_refresh_does_not_move_a_command_during_click(self):
        page, errors, _, calls = self.lighting()
        card = page.locator('#lightDevices [data-light-target="light-1"]')
        card.locator('.lightTools > summary').click()
        page.wait_for_function("document.querySelector('#lightDevices [data-light-control=s]').options.length === 2")
        card.locator('[data-light-control=t]').fill('4200')
        button = card.locator('button[aria-label="Apply temp to Desk light 1"]')
        page.evaluate("document.getElementById('goveeMessage').textContent = 'light-1: color command sent.'")
        button.scroll_into_view_if_needed()
        before = button.bounding_box()
        page.mouse.move(before['x'] + before['width']/2, before['y'] + before['height'] - 2)
        page.mouse.down()
        page.evaluate('loadGovee()')
        after = button.bounding_box()
        page.mouse.up()
        self.assertAlmostEqual(before['y'], after['y'], delta=1)
        page.wait_for_function("document.getElementById('goveeMessage').textContent.includes('temp command sent')")
        self.assertIn(('/api/v1/govee/light-1/temp', 'POST', {'kelvin': 4200}), calls)
        self.assertFalse(errors, errors)

    def test_lighting_scene_failure_retry_and_empty_filter(self):
        page, errors, _, calls = self.lighting(fail_scenes=True)
        card = page.locator('#lightDevices .lightCard').first
        card.locator('.lightTools > summary').click()
        card.locator('[data-light-scenes-retry]').wait_for(state='visible')
        self.assertIn('Scene bridge unavailable', card.locator('[data-light-scenes-status]').inner_text())
        self.assertTrue(card.locator('[data-light-scene-apply]').is_disabled())
        card.locator('[data-light-scenes-retry]').click()
        page.wait_for_timeout(100)
        self.assertEqual(sum(target.endswith('/scenes') for target, _, _ in calls), 2)
        page.locator('#goveeSearch').fill('missing')
        self.assertTrue(page.locator('#goveeEmpty').is_visible())
        page.locator('#goveeEmpty button').click()
        self.assertEqual(page.locator('#lightDevices .lightCard:visible').count(), 12)
        self.assertFalse(errors, errors)
