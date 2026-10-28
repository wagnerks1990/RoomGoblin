"""Sports drafts and sends retain ownership across delayed API responses."""
import unittest
from playwright.sync_api import expect
import test_sports as sports
import test_workspaces as workspaces


class SportsOwnershipBrowserTests(unittest.TestCase):
    setUpClass = classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
    page = workspaces.WorkspaceBrowserTests.page
    sports = sports.SportsBrowserTests.sports

    def pending_save(self):
        page, errors, commands, data = self.sports()
        page.get_by_label('Board name', exact=True).fill('Submitted board')
        held = []
        page.route('**/api/v1/sports', lambda route: held.append(route) if route.request.method == 'PUT' else route.fallback())
        page.get_by_role('button', name='Save Sports', exact=True).click()
        pending = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        return page, errors, commands, data, pending

    def test_save_completion_preserves_newer_draft_and_rebases_its_revision(self):
        page, errors, _, _, pending = self.pending_save()
        saved = pending.request.post_data_json
        saved['revision'] += 1
        page.get_by_label('Board name', exact=True).fill('Newer unsaved board')
        pending.fulfill(json={'ok': True, 'config': saved, 'sources': {}})
        page.wait_for_function("/Sports saved/.test(document.querySelector('.sportsNotice').textContent)")
        self.assertEqual(page.get_by_label('Board name', exact=True).input_value(), 'Newer unsaved board')
        second = []
        page.route('**/api/v1/sports', lambda route: second.append(route) if route.request.method == 'PUT' else route.fallback())
        page.get_by_role('button', name='Save Sports', exact=True).click()
        again = workspaces.WorkspaceBrowserTests.held_route(self, page, second)
        self.assertEqual(again.request.post_data_json['revision'], saved['revision'])
        self.assertEqual(again.request.post_data_json['boards'][0]['name'], 'Newer unsaved board')
        again.fulfill(status=503, json={'ok': False, 'error': 'Fixture second save failed'})
        page.get_by_text('Fixture second save failed', exact=True).wait_for()
        self.assertEqual(errors, [])

    def test_pending_save_stays_disabled_after_edit_and_tab_redraw(self):
        page, errors, _, _, pending = self.pending_save()
        page.get_by_label('Board name', exact=True).fill('Newer board')
        page.get_by_role('button', name='Sources', exact=True).click()
        self.assertTrue(page.get_by_role('button', name='Save Sports', exact=True).is_disabled())
        pending.fulfill(status=503, json={'ok': False, 'error': 'Fixture save failed'})
        page.get_by_text('Fixture save failed', exact=True).wait_for()
        expect(page.get_by_role('button', name='Save Sports', exact=True)).to_be_enabled()
        self.assertEqual(errors, [])

    def test_save_failure_keeps_draft_and_releases_retry(self):
        page, errors, _, _, pending = self.pending_save()
        pending.fulfill(status=503, json={'ok': False, 'error': 'Fixture save failed'})
        page.get_by_text('Fixture save failed', exact=True).wait_for()
        expect(page.get_by_role('button', name='Save Sports', exact=True)).to_be_enabled()
        self.assertEqual(page.get_by_label('Board name', exact=True).input_value(), 'Submitted board')
        self.assertEqual(errors, [])

    def test_send_cannot_dispatch_a_scene_that_predates_a_draft_edit(self):
        page, errors, commands, data = self.sports()
        held = []
        page.route('**/api/v1/sports/boards/b/scene', lambda route: held.append(route))
        page.get_by_label('Example display', exact=True).check()
        page.get_by_role('button', name='Send to selected displays', exact=True).click()
        pending = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        page.get_by_label('Board name', exact=True).fill('Newer unsaved board')
        pending.fulfill(json={'ok': True, 'scene': data['scene']})
        page.wait_for_function("/changed|Sports sent/.test(document.querySelector('.sportsNotice').textContent)")
        self.assertFalse(commands)
        self.assertEqual(errors, [])

    def test_send_cannot_dispatch_after_leaving_the_originating_board_view(self):
        page, errors, commands, data = self.sports()
        held = []
        page.route('**/api/v1/sports/boards/b/scene', lambda route: held.append(route))
        page.get_by_label('Example display', exact=True).check()
        page.get_by_role('button', name='Send to selected displays', exact=True).click()
        pending = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        page.get_by_role('button', name='Teams & rosters', exact=True).click()
        pending.fulfill(json={'ok': True, 'scene': data['scene']})
        page.wait_for_function("/changed|Sports sent/.test(document.querySelector('.sportsNotice').textContent)")
        self.assertFalse(commands)
        self.assertEqual(errors, [])
