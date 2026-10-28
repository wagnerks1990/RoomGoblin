"""Source refresh and undo do not replace edits made during their requests."""
import copy
import unittest
from playwright.sync_api import expect
import test_sports as sports
import test_workspaces as workspaces


class SportsRefreshBrowserTests(unittest.TestCase):
    setUpClass = classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
    page = workspaces.WorkspaceBrowserTests.page
    sports = sports.SportsBrowserTests.sports

    def pending(self, action):
        page, errors, commands, data = self.sports()
        page.get_by_role('button', name='Sources', exact=True).click()
        held = []
        page.route('**/api/v1/sports/'+action, lambda route: held.append(route))
        page.get_by_role('button', name='Refresh approved sources' if action == 'refresh' else 'Undo last Sports save', exact=True).click()
        return page, errors, commands, data, workspaces.WorkspaceBrowserTests.held_route(self, page, held)

    def newer_draft(self, action):
        page, errors, _, data, pending = self.pending(action)
        page.get_by_role('button', name='Boards', exact=True).click()
        page.get_by_label('Board name', exact=True).fill('Newer local board')
        result = copy.deepcopy(data['config'])
        result['revision'] += 1
        result['school'] = 'Changed on server'
        pending.fulfill(json={'ok': True, 'config': result, 'status': {}})
        page.wait_for_function("/completed|No enabled|restored/.test(document.querySelector('.sportsNotice').textContent)")
        self.assertEqual(page.get_by_label('Board name', exact=True).input_value(), 'Newer local board')
        held = []
        page.route('**/api/v1/sports', lambda route: held.append(route) if route.request.method == 'PUT' else route.fallback())
        page.get_by_role('button', name='Save Sports', exact=True).click()
        save = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        self.assertEqual(save.request.post_data_json['revision'], data['config']['revision'], 'Do not silently rebase over source/undo changes')
        save.fulfill(status=409, json={'ok': False, 'error': 'Reload to reconcile server changes'})
        page.get_by_text('Reload to reconcile server changes', exact=True).wait_for()
        self.assertEqual(page.get_by_label('Board name', exact=True).input_value(), 'Newer local board')
        self.assertEqual(errors, [])

    def test_source_refresh_preserves_newer_draft_without_rebasing(self):
        self.newer_draft('refresh')

    def test_undo_preserves_newer_draft_without_rebasing(self):
        self.newer_draft('undo')

    def test_pending_refresh_blocks_save_and_another_server_mutation(self):
        page, errors, _, data, pending = self.pending('refresh')
        page.get_by_label('School / athletics title', exact=True).fill('Newer title')
        self.assertTrue(page.get_by_role('button', name='Save Sports', exact=True).is_disabled())
        undos = []
        page.route('**/api/v1/sports/undo', lambda route: undos.append(route))
        page.get_by_role('button', name='Undo last Sports save', exact=True).click()
        page.get_by_text('A Sports update is already running', exact=True).wait_for()
        self.assertEqual(undos, [])
        pending.fulfill(status=503, json={'ok': False, 'error': 'Fixture source failure'})
        page.get_by_text('Fixture source failure', exact=True).wait_for()
        expect(page.get_by_role('button', name='Save Sports', exact=True)).to_be_enabled()
        self.assertEqual(page.get_by_label('School / athletics title', exact=True).input_value(), 'Newer title')
        self.assertEqual(errors, [])

    def test_unchanged_draft_accepts_undo_and_source_status(self):
        page, errors, _, data, pending = self.pending('undo')
        result = copy.deepcopy(data['config'])
        result['revision'] += 1
        result['school'] = 'Restored title'
        pending.fulfill(json={'ok': True, 'config': result, 'sources': {}})
        page.get_by_text('Previous Sports configuration restored.', exact=True).wait_for()
        self.assertEqual(page.get_by_label('School / athletics title', exact=True).input_value(), 'Restored title')
        expect(page.get_by_role('button', name='Save Sports', exact=True)).to_be_enabled()
        self.assertEqual(errors, [])
