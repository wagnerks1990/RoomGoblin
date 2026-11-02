"""Late board reads cannot restore content invalidated by settings or auth."""
import copy
import unittest
import test_sports as sports
import test_workspaces as workspaces


class SportsCacheBrowserTests(unittest.TestCase):
    setUpClass = classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
    page = workspaces.WorkspaceBrowserTests.page
    sports = sports.SportsBrowserTests.sports

    def retired(self, event):
        page, errors, commands, data = self.sports()
        held = []
        page.route('**/api/v1/sports/boards/b/display', lambda route: held.append(route))
        page.get_by_role('button', name='Preview board', exact=True).click()
        pending = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        page.evaluate('(name)=>window.dispatchEvent(new Event(name))', event)
        pending.fulfill(json=data['display'])
        page.wait_for_function("document.querySelector('.sportsPreviewCanvas .rg-sports-heading h2')?.textContent || document.querySelector('.sportsPreviewCanvas footer')?.textContent.includes('refresh unavailable')")
        self.assertEqual(page.locator('.sportsPreviewCanvas .rg-sports-heading h2').inner_text(), '', 'Retired read must not render after invalidation')
        current = copy.deepcopy(data['display'])
        current['pages'][0]['name'] = 'Current soccer'
        page.route('**/api/v1/sports/boards/b/display', lambda route: route.fulfill(json=current))
        page.get_by_role('button', name='Preview board', exact=True).click()
        page.get_by_role('heading', name='Current soccer', exact=True).wait_for()
        self.assertEqual(commands, [])
        self.assertEqual(errors, [])

    def test_late_source_read_cannot_repopulate_invalidated_board_cache(self):
        self.retired('roomgoblin:sportschange')

    def test_late_authenticated_read_cannot_repopulate_retired_auth_cache(self):
        self.retired('roomgoblin:authchange')
