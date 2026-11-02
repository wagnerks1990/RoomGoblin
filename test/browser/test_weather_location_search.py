"""Location search responses belong to their current input and visible session."""
import unittest
from playwright.sync_api import expect
import test_weather_workspace as weather
import test_workspaces as workspaces


class WeatherLocationSearchTests(unittest.TestCase):
    setUpClass = classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
    page = workspaces.WorkspaceBrowserTests.page

    def search_page(self):
        page, errors, commands = weather.weather_page(self)
        page.get_by_text('Location, units & weather sources', exact=True).click()
        page.evaluate("""() => {
          const original = window.api;
          window.locationSearchSettled = 0;
          window.api = async (...args) => {
            try { return await original(...args); }
            finally { if (args[0].startsWith('/api/v1/weather/locations?')) window.locationSearchSettled++; }
          };
        }""")
        return page, errors, commands

    def result(self, label='Current location'):
        return {'locations': [{'label': label, 'latitude': 41, 'longitude': -78}]}

    def begin(self, page, text='First search'):
        page.get_by_label('Find a city or postal location', exact=True).fill(text)
        page.get_by_role('button', name='Find location', exact=True).click()

    def test_late_result_cannot_replace_newer_search(self):
        page, errors, _ = self.search_page()
        held = []
        page.route('**/api/v1/weather/locations?*', lambda route: held.append(route))
        self.begin(page)
        old = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        self.begin(page, 'Second search')
        current = workspaces.WorkspaceBrowserTests.held_route(self, page, held, 1)
        current.fulfill(json=self.result())
        page.get_by_role('button', name='Current location', exact=True).wait_for()
        old.fulfill(json=self.result('Retired location'))
        page.wait_for_function('window.locationSearchSettled === 2')
        expect(page.get_by_role('button', name='Current location', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Retired location', exact=True)).to_have_count(0)
        self.assertEqual(errors, [])

    def test_editing_query_clears_previous_choices(self):
        page, errors, _ = self.search_page()
        page.route('**/api/v1/weather/locations?*', lambda route: route.fulfill(json=self.result()))
        self.begin(page)
        page.get_by_role('button', name='Current location', exact=True).wait_for()
        page.get_by_label('Find a city or postal location', exact=True).fill('Changed query')
        expect(page.locator('.weatherLocations button')).to_have_count(0)
        self.assertEqual(errors, [])

    def test_retired_error_preserves_current_selection_notice(self):
        page, errors, _ = self.search_page()
        held = []
        page.route('**/api/v1/weather/locations?*', lambda route: held.append(route))
        self.begin(page)
        old = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        self.begin(page, 'Second search')
        current = workspaces.WorkspaceBrowserTests.held_route(self, page, held, 1)
        current.fulfill(json=self.result())
        page.get_by_role('button', name='Current location', exact=True).click()
        old.fulfill(status=503, json={'ok': False, 'error': 'Retired search unavailable'})
        page.wait_for_function('window.locationSearchSettled === 2')
        expect(page.locator('.weatherNotice')).to_have_text('Location selected in draft. Save to apply.')
        expect(page.get_by_label('Weather location label', exact=True)).to_have_value('Current location')
        self.assertEqual(errors, [])

    def test_navigation_retires_pending_search(self):
        page, errors, _ = self.search_page()
        held = []
        page.route('**/api/v1/weather/locations?*', lambda route: held.append(route))
        self.begin(page)
        pending = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        page.get_by_role('button', name='Today', exact=True).click()
        page.get_by_role('button', name='Weather', exact=True).click()
        page.get_by_role('heading', name='Example School', exact=True).wait_for()
        pending.fulfill(json=self.result())
        page.wait_for_function('window.locationSearchSettled === 1')
        expect(page.locator('.weatherLocations button')).to_have_count(0)
        self.assertEqual(errors, [])

    def test_authentication_change_retires_pending_search(self):
        page, errors, _ = self.search_page()
        held = []
        page.route('**/api/v1/weather/locations?*', lambda route: held.append(route))
        self.begin(page)
        pending = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        page.evaluate("window.dispatchEvent(new Event('roomgoblin:authchange'))")
        pending.fulfill(json=self.result())
        page.wait_for_function('window.locationSearchSettled === 1')
        expect(page.locator('.weatherLocations button')).to_have_count(0)
        self.assertEqual(errors, [])

    def test_pending_search_survives_refresh_and_failure_allows_retry(self):
        page, errors, _ = self.search_page()
        held = []
        page.route('**/api/v1/weather/locations?*', lambda route: held.append(route))
        self.begin(page)
        pending = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        find = page.get_by_role('button', name='Find location', exact=True)
        with page.expect_response(lambda r: r.url.endswith('/api/v1/weather')):
            page.get_by_role('button', name='Refresh weather', exact=True).click()
        self.assertTrue(find.is_disabled())
        pending.fulfill(status=503, json={'ok': False, 'error': 'Current search unavailable'})
        page.get_by_text('Current search unavailable', exact=True).wait_for()
        expect(find).to_be_enabled()
        find.click()
        retry = workspaces.WorkspaceBrowserTests.held_route(self, page, held, 1)
        retry.fulfill(json=self.result())
        page.get_by_role('button', name='Current location', exact=True).wait_for()
        self.assertEqual(errors, [])

    def test_current_choice_changes_only_draft(self):
        page, errors, commands = self.search_page()
        writes = []
        page.route('**/api/v1/weather/config', lambda route: (writes.append(route.request.method), route.fulfill(json={'ok': True})))
        page.route('**/api/v1/weather/locations?*', lambda route: route.fulfill(json=self.result()))
        self.begin(page)
        page.get_by_role('button', name='Current location', exact=True).click()
        expect(page.get_by_label('Weather latitude', exact=True)).to_have_value('41')
        expect(page.get_by_label('Weather longitude', exact=True)).to_have_value('-78')
        expect(page.get_by_label('Weather location label', exact=True)).to_have_value('Current location')
        self.assertEqual(writes, [])
        self.assertEqual(commands, [])
        self.assertEqual(errors, [])
