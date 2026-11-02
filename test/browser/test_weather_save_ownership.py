"""Weather saves preserve newer drafts and retire reads predating a write."""
import unittest
from playwright.sync_api import expect
import test_weather_workspace as weather
import test_workspaces as workspaces


class WeatherSaveBrowserTests(unittest.TestCase):
    setUpClass = classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
    page = workspaces.WorkspaceBrowserTests.page

    def test_save_completion_preserves_newer_location_edits(self):
        page, errors, _ = weather.weather_page(self)
        page.get_by_text('Location, units & weather sources', exact=True).click()
        label = page.get_by_label('Weather location label', exact=True)
        label.fill('Saved location')
        held = []
        page.route('**/api/v1/weather/config', lambda route: held.append(route))
        page.get_by_role('button', name='Save weather location & units', exact=True).click()
        pending = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        saved = pending.request.post_data_json
        label.fill('Newer unsaved location')
        page.route('**/api/v1/weather', lambda route: route.fulfill(json={
            'ok': True, 'config': saved, 'weather': weather.forecast(), 'status': {}}))
        pending.fulfill(json={'ok': True, 'config': saved})
        page.wait_for_function("/Weather settings saved/.test(document.querySelector('.weatherNotice').textContent)")
        self.assertEqual(label.input_value(), 'Newer unsaved location')
        page.get_by_role('button', name='Refresh weather', exact=True).click()
        expect(label).to_have_value('Newer unsaved location')
        self.assertEqual(errors, [])

    def test_pending_save_stays_disabled_across_refresh_and_failure_releases_it(self):
        page, errors, _ = weather.weather_page(self)
        page.get_by_text('Location, units & weather sources', exact=True).click()
        held = []
        page.route('**/api/v1/weather/config', lambda route: held.append(route))
        save = page.get_by_role('button', name='Save weather location & units', exact=True)
        save.click()
        pending = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        self.assertTrue(save.is_disabled())
        with page.expect_response(lambda r: r.url.endswith('/api/v1/weather')):
            page.get_by_role('button', name='Refresh weather', exact=True).click()
        self.assertTrue(save.is_disabled())
        pending.fulfill(status=503, json={'ok': False, 'error': 'Fixture save unavailable'})
        page.get_by_text('Fixture save unavailable', exact=True).wait_for()
        expect(save).to_be_enabled()
        self.assertEqual(len(held), 1)
        self.assertEqual(errors, [])

    def test_read_started_before_save_cannot_restore_old_configuration(self):
        page, errors, _ = weather.weather_page(self)
        page.get_by_text('Location, units & weather sources', exact=True).click()
        old = {'enabled': True, 'latitude': 40, 'longitude': -77,
               'unit': 'fahrenheit', 'label': 'Example School'}
        state = {'config': old}
        held = []
        calls = []
        def read(route):
            calls.append(route)
            if len(calls) == 1:
                held.append(route)
            else:
                forecast = weather.forecast()
                forecast['label'] = state['config']['label']
                route.fulfill(json={'ok': True, 'config': state['config'],
                                    'weather': forecast, 'status': {}})
        def save(route):
            state['config'] = route.request.post_data_json
            route.fulfill(json={'ok': True, 'config': state['config']})
        page.route('**/api/v1/weather', read)
        page.route('**/api/v1/weather/config', save)
        page.get_by_role('button', name='Refresh weather', exact=True).click()
        pending = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        page.get_by_label('Weather location label', exact=True).fill('Saved location')
        with page.expect_response(lambda r: r.url.endswith('/api/v1/weather/config')):
            page.get_by_role('button', name='Save weather location & units', exact=True).click()
        with page.expect_response(lambda r: r.url.endswith('/api/v1/weather')):
            pending.fulfill(json={'ok': True, 'config': old, 'weather': weather.forecast(), 'status': {}})
        expect(page.get_by_role('heading', name='Saved location', exact=True)).to_be_visible(timeout=5000)
        expect(page.get_by_label('Weather location label', exact=True)).to_have_value('Saved location')
        self.assertGreaterEqual(len(calls), 2)
        self.assertEqual(errors, [])
