"""Retired Weather scene work must not render, dispatch or open another workflow."""
import unittest
from playwright.sync_api import expect
import test_weather_workspace as weather
import test_workspaces as workspaces

SCENE = {'layers': [{'id': 'fixture-weather', 'type': 'text', 'text': 'Fixture forecast',
                     'x': 0, 'y': 0, 'width': 500, 'height': 100}]}


class WeatherSceneOwnershipTests(unittest.TestCase):
    setUpClass = classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
    page = workspaces.WorkspaceBrowserTests.page

    def pending_scene(self, action='Preview weather layout', overlay=False):
        page, errors, commands = weather.weather_page(self, devices={
            'tv1': {'name': 'Example display', 'enabled': True},
            'tv2': {'name': 'Other display', 'enabled': True}})
        page.get_by_label('Example display', exact=True).check()
        if overlay:
            page.get_by_label('Weather display type', exact=True).select_option('overlay')
        page.evaluate("""() => {
          window.weatherWorkflowCalls = [];
          window.startWeatherAutomation = () => window.weatherWorkflowCalls.push('automation');
          window.startWeatherOverlay = () => window.weatherWorkflowCalls.push('overlay');
        }""")
        held = []
        page.route('**/api/v1/weather/scene', lambda route: held.append(route))
        page.get_by_role('button', name=action, exact=True).click()
        pending = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        return page, errors, commands, pending

    def finish(self, page, pending):
        pending.fulfill(json={'ok': True, 'scene': SCENE})
        page.wait_for_function("/changed|Preview ready|Weather sent/.test(document.querySelector('.weatherNotice').textContent)")

    def test_preview_cannot_render_after_leaving_weather(self):
        page, errors, commands, pending = self.pending_scene()
        page.get_by_role('button', name='Today', exact=True).click()
        self.finish(page, pending)
        self.assertEqual(page.locator('.weatherPreviewCanvas .rg-scene-layer').count(), 0)
        self.assertFalse(any('target' in r for r in commands))
        self.assertEqual(errors, [])

    def test_send_cannot_dispatch_after_leaving_weather(self):
        page, errors, commands, pending = self.pending_scene('Send full-screen weather')
        page.get_by_role('button', name='Today', exact=True).click()
        self.finish(page, pending)
        self.assertFalse(any('target' in r for r in commands))
        self.assertEqual(errors, [])

    def test_authentication_change_retires_pending_send(self):
        page, errors, commands, pending = self.pending_scene('Send full-screen weather')
        refreshes = []
        page.route('**/api/v1/weather', lambda route: refreshes.append(route))
        page.evaluate("window.dispatchEvent(new Event('roomgoblin:authchange'))")
        refresh = workspaces.WorkspaceBrowserTests.held_route(self, page, refreshes)
        self.finish(page, pending)
        self.assertFalse(any('target' in r for r in commands))
        refresh.fulfill(json={'ok': True, 'config': {'enabled': True, 'latitude': 40,
            'longitude': -77, 'unit': 'fahrenheit', 'label': 'Example School'},
            'weather': weather.forecast(), 'status': {}})
        self.assertEqual(errors, [])

    def test_changed_targets_require_a_new_send(self):
        page, errors, commands, pending = self.pending_scene('Send full-screen weather')
        page.get_by_label('Example display', exact=True).uncheck()
        page.get_by_label('Other display', exact=True).check()
        self.finish(page, pending)
        self.assertFalse(any('target' in r for r in commands))
        self.assertEqual(errors, [])

    def test_schedule_cannot_open_after_leaving_weather(self):
        page, errors, _, pending = self.pending_scene('Schedule this screen')
        page.get_by_role('button', name='Today', exact=True).click()
        self.finish(page, pending)
        self.assertEqual(page.evaluate('window.weatherWorkflowCalls'), [])
        self.assertEqual(errors, [])

    def test_overlay_cannot_open_after_leaving_weather(self):
        page, errors, _, pending = self.pending_scene('Create shared weather overlay', overlay=True)
        page.get_by_role('button', name='Today', exact=True).click()
        self.finish(page, pending)
        self.assertEqual(page.evaluate('window.weatherWorkflowCalls'), [])
        self.assertEqual(errors, [])

    def test_current_send_keeps_explicit_targets(self):
        page, errors, commands, pending = self.pending_scene('Send full-screen weather')
        self.finish(page, pending)
        page.get_by_text('Weather sent to 1 selected display(s).', exact=True).wait_for()
        self.assertEqual([r['target'] for r in commands if 'target' in r], [['tv1']])
        self.assertEqual(errors, [])

    def test_navigation_preserves_an_already_completed_preview(self):
        page, errors, _, pending = self.pending_scene()
        self.finish(page, pending)
        layer = page.locator('.weatherPreviewCanvas .rg-scene-layer').first
        expect(layer).to_be_visible()
        before = layer.element_handle()
        page.get_by_role('button', name='Today', exact=True).click()
        page.get_by_role('button', name='Weather', exact=True).click()
        expect(layer).to_be_visible()
        self.assertTrue(before.evaluate('(node) => node.isConnected'))
        self.assertEqual(errors, [])

    def test_retired_renderer_load_cannot_leave_a_reusable_scene(self):
        page, errors, commands, pending = self.pending_scene('Send full-screen weather')
        modules = []
        page.route('**/display/layout.mjs?v=dynamic-fit-20261027-1', lambda route: modules.append(route))
        pending.fulfill(json={'ok': True, 'scene': SCENE})
        module = workspaces.WorkspaceBrowserTests.held_route(self, page, modules)
        page.get_by_role('button', name='Today', exact=True).click()
        module.fulfill(content_type='text/javascript', body=(workspaces.ROOT / 'public/display/layout.mjs').read_text())
        page.wait_for_function("/changed/.test(document.querySelector('.weatherNotice').textContent)")
        self.assertFalse(any('target' in r for r in commands))
        self.assertEqual(page.locator('.weatherPreviewCanvas .rg-scene-layer').count(), 0)
        page.get_by_role('button', name='Weather', exact=True).click()
        retries = []
        page.route('**/api/v1/weather/scene', lambda route: retries.append(route))
        page.get_by_role('button', name='Send full-screen weather', exact=True).click()
        retry = workspaces.WorkspaceBrowserTests.held_route(self, page, retries)
        retry.fulfill(json={'ok': True, 'scene': SCENE})
        page.get_by_text('Weather sent to 1 selected display(s).', exact=True).wait_for()
        self.assertEqual([r['target'] for r in commands if 'target' in r], [['tv1']])
        self.assertEqual(errors, [])
