"""Daily-code disclosure and enrollment use the real operator page with fixture APIs."""
import unittest
from playwright.sync_api import expect
import test_workspaces as workspaces

BASE = '/api/v1/admin/daily-signin'
GROUPS = [{'id': '00112233-4455-4677-8899-aabbccddeeff', 'name': 'Esports fixture', 'timeZone': 'America/New_York'},
          {'id': '00112233-4455-4677-8899-aabbccddee00', 'name': 'Other fixture', 'timeZone': 'UTC'}]


class DailySignInTests(unittest.TestCase):
    setUpClass = classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
    page = workspaces.WorkspaceBrowserTests.page

    def open_page(self, transport=None, width=1440):
        result = self.page('/controller/daily-signin.html', width=width,
                           overrides={BASE: {'ok': True, 'groups': GROUPS}}, transport=transport)
        page = result[0]
        expect(page.locator('#groups option')).to_have_count(2)
        return result

    def test_code_is_hidden_until_requested_and_cleared_on_group_change(self):
        page, errors = self.open_page()
        page.route('**/groups/*/code', lambda route: route.fulfill(json={'ok': True, 'code': '01234567', 'day': '2026-10-29', 'timeZone': 'America/New_York'}))
        expect(page.locator('#code')).to_be_empty()
        page.get_by_role('button', name="Show today's code", exact=True).click()
        expect(page.locator('#code')).to_have_text('01234567')
        page.locator('#groups').select_option(GROUPS[1]['id'])
        expect(page.locator('#code')).to_be_empty()
        self.assertEqual(errors, [])

    def test_authentication_change_discards_pending_code(self):
        page, errors = self.open_page()
        held = []
        page.route('**/groups/*/code', lambda route: held.append(route))
        page.get_by_role('button', name="Show today's code", exact=True).click()
        pending = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        page.evaluate("window.dispatchEvent(new Event('roomgoblin:authchange'))")
        pending.fulfill(json={'ok': True, 'code': '01234567', 'day': '2026-10-29', 'timeZone': 'UTC'})
        expect(page.locator('#controls')).to_be_hidden()
        expect(page.locator('#code')).to_be_empty()
        self.assertEqual(errors, [])

    def test_enrollment_clears_passphrase_and_does_not_repeat_failed_write(self):
        page, errors = self.open_page()
        calls = []
        def fail(route):
            calls.append(route.request.post_data_json)
            route.fulfill(status=503, json={'ok': False, 'error': 'Fixture unavailable'})
        page.route('**/groups/*/enrollment', fail)
        page.get_by_label('Windows computer name', exact=True).fill('TEST-PC')
        page.get_by_label('Local esports account', exact=True).fill('esports')
        page.get_by_label('Enrollment file passphrase', exact=True).fill('synthetic test passphrase')
        page.get_by_role('button', name='Download encrypted enrollment', exact=True).click()
        expect(page.locator('#status')).to_have_text('Fixture unavailable')
        expect(page.locator('#passphrase')).to_have_value('')
        self.assertEqual(len(calls), 1)
        self.assertEqual(errors, [])

    def test_transport_denial_hides_controls(self):
        def transport(route, target):
            if target == BASE:
                route.fulfill(status=426, json={'ok': False, 'error': 'HTTPS required'})
                return True
            return False
        page, errors = self.page('/controller/daily-signin.html', transport=transport)
        expect(page.locator('#controls')).to_be_hidden()
        expect(page.locator('#status')).to_have_text('HTTPS required')
        self.assertEqual(errors, [])

    def test_mobile_layout_and_labels(self):
        page, errors = self.open_page(width=390)
        self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'), 390)
        for label in ['Computer group', 'Windows computer name', 'Local esports account', 'Enrollment file passphrase']:
            expect(page.get_by_label(label, exact=True)).to_be_visible()
        page.screenshot(path=str(workspaces.OUTPUT / 'daily-signin-mobile.png'), full_page=True)
        self.assertEqual(errors, [])


if __name__ == '__main__':
    unittest.main()
