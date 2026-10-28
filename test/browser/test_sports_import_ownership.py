"""Import review belongs to the exact visible draft and submitted input."""
import copy
import unittest
from playwright.sync_api import expect
import test_sports as sports
import test_workspaces as workspaces


class SportsImportBrowserTests(unittest.TestCase):
    setUpClass = classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
    page = workspaces.WorkspaceBrowserTests.page
    sports = sports.SportsBrowserTests.sports

    def roster(self):
        page, errors, commands, data = self.sports()
        page.get_by_role('button', name='Teams & rosters', exact=True).click()
        page.get_by_text('Import and review a roster', exact=True).click()
        page.get_by_label('Roster CSV (name,number,grade,position,level,role)', exact=True).fill('name,level\nReviewed athlete,varsity')
        return page, errors, commands, data

    def hold(self, page, endpoint, button):
        held = []
        page.route('**/api/v1/sports/import/'+endpoint, lambda route: held.append(route))
        page.get_by_role('button', name=button, exact=True).click()
        return workspaces.WorkspaceBrowserTests.held_route(self, page, held)

    def rows(self):
        return {'rows': [{'name': 'Reviewed athlete', 'level': 'varsity'}]}

    def test_roster_response_rejects_changed_team_context(self):
        page, errors, _, _ = self.roster()
        pending = self.hold(page, 'roster', 'Read roster')
        page.get_by_label('Team level', exact=True).select_option('jv')
        pending.fulfill(json=self.rows())
        page.wait_for_function("/review|Review/.test(document.querySelector('.sportsNotice').textContent)")
        page.get_by_role('button', name='Apply reviewed roster', exact=True).click()
        page.get_by_text('Read and review a roster for this team first', exact=True).wait_for()
        self.assertEqual(page.get_by_label('Team level', exact=True).input_value(), 'jv')
        self.assertEqual(errors, [])

    def test_roster_response_rejects_changed_import_text(self):
        page, errors, _, _ = self.roster()
        pending = self.hold(page, 'roster', 'Read roster')
        page.get_by_label('Roster CSV (name,number,grade,position,level,role)', exact=True).fill('name,level\nDifferent athlete,jv')
        pending.fulfill(json=self.rows())
        page.wait_for_function("/review|Review/.test(document.querySelector('.sportsNotice').textContent)")
        page.get_by_role('button', name='Apply reviewed roster', exact=True).click()
        page.get_by_text('Read and review a roster for this team first', exact=True).wait_for()
        self.assertEqual(errors, [])

    def test_hidden_roster_review_cannot_survive_tab_redraw(self):
        page, errors, _, _ = self.roster()
        pending = self.hold(page, 'roster', 'Read roster')
        pending.fulfill(json=self.rows())
        page.get_by_text('Review the imported roster before applying it.', exact=True).wait_for()
        page.get_by_role('button', name='Boards', exact=True).click()
        page.get_by_role('button', name='Teams & rosters', exact=True).click()
        page.get_by_text('Import and review a roster', exact=True).click()
        page.get_by_role('button', name='Apply reviewed roster', exact=True).click()
        page.get_by_text('Read and review a roster for this team first', exact=True).wait_for()
        self.assertEqual(errors, [])

    def test_changed_event_text_requires_fresh_review(self):
        page, errors, _, _ = self.sports()
        page.get_by_role('button', name='Results & schedules', exact=True).click()
        page.get_by_text('Import schedule / results', exact=True).click()
        raw = page.get_by_label('Event CSV (opponent,startAt,status,homeAway,venue,score,opponentScore,recap)', exact=True)
        raw.fill('opponent,startAt\nReviewed opponent,2026-11-01T20:00Z')
        pending = self.hold(page, 'events', 'Review events')
        pending.fulfill(json={'events': [{'opponent': 'Reviewed opponent', 'startAt': '2026-11-01T20:00Z'}]})
        page.get_by_role('cell', name='Reviewed opponent', exact=True).wait_for()
        raw.fill('opponent,startAt\nDifferent opponent,2026-11-02T20:00Z')
        page.get_by_role('button', name='Apply reviewed events', exact=True).click()
        page.get_by_text('Review the events first', exact=True).wait_for()
        self.assertEqual(errors, [])

    def test_workspace_import_preserves_newer_draft(self):
        page, errors, _, data = self.sports()
        page.get_by_role('button', name='Sources', exact=True).click()
        page.get_by_text('Import a Sports workspace', exact=True).click()
        page.get_by_label('Sports workspace JSON', exact=True).fill('{}')
        pending = self.hold(page, 'workspace', 'Load workspace into draft')
        page.get_by_label('School / athletics title', exact=True).fill('Newer school title')
        result = copy.deepcopy(data['config'])
        result['school'] = 'Imported school title'
        pending.fulfill(json={'config': result})
        page.wait_for_function("/import|Import/.test(document.querySelector('.sportsNotice').textContent)")
        self.assertEqual(page.get_by_label('School / athletics title', exact=True).input_value(), 'Newer school title')
        self.assertEqual(errors, [])

    def test_roster_read_is_single_flight_and_failed_read_releases_retry(self):
        page, errors, _, _ = self.roster()
        pending = self.hold(page, 'roster', 'Read roster')
        expect(page.get_by_role('button', name='Read roster', exact=True)).to_be_disabled()
        pending.fulfill(status=503, json={'error': 'Fixture import failure'})
        page.get_by_text('Fixture import failure', exact=True).wait_for()
        expect(page.get_by_role('button', name='Read roster', exact=True)).to_be_enabled()
        self.assertEqual(errors, [])

    def test_reviewed_csv_and_pdf_rosters_apply_only_after_review(self):
        for pdf in (False, True):
            with self.subTest(pdf=pdf):
                page, errors, commands, data = self.roster()
                if pdf:
                    page.get_by_label('Roster PDF', exact=True).set_input_files({'name': 'fixture.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-fixture'})
                pending = self.hold(page, 'roster', 'Read roster')
                pending.fulfill(json=self.rows())
                page.get_by_text('Review the imported roster before applying it.', exact=True).wait_for()
                self.assertEqual(len(data['config']['teams'][0]['roster']), 12)
                page.get_by_role('button', name='Apply reviewed roster', exact=True).click()
                page.get_by_text('Reviewed roster applied to the draft. Save Sports to keep it.', exact=True).wait_for()
                self.assertEqual(page.get_by_label('Reviewed athlete name', exact=True).input_value(), 'Reviewed athlete')
                self.assertEqual(len(data['config']['teams'][0]['roster']), 12, 'Apply changes only the draft')
                self.assertEqual(commands, [])
                self.assertEqual(errors, [])

    def test_unchanged_workspace_import_updates_only_the_draft(self):
        page, errors, commands, data = self.sports()
        page.get_by_role('button', name='Sources', exact=True).click()
        page.get_by_text('Import a Sports workspace', exact=True).click()
        page.get_by_label('Sports workspace JSON', exact=True).fill('{}')
        pending = self.hold(page, 'workspace', 'Load workspace into draft')
        result = copy.deepcopy(data['config'])
        result['school'] = 'Reviewed workspace'
        pending.fulfill(json={'config': result})
        page.get_by_text('Imported workspace draft. Review all tabs, then Save Sports.', exact=True).wait_for()
        self.assertEqual(page.get_by_label('School / athletics title', exact=True).input_value(), 'Reviewed workspace')
        self.assertEqual(data['config']['school'], 'Example Athletics')
        self.assertEqual(commands, [])
        self.assertEqual(errors, [])

    def test_changing_pdf_during_read_retires_its_review(self):
        page, errors, _, _ = self.roster()
        pdf = page.get_by_label('Roster PDF', exact=True)
        pdf.set_input_files({'name': 'first.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-first'})
        pending = self.hold(page, 'roster', 'Read roster')
        pdf.set_input_files({'name': 'second.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-second'})
        pending.fulfill(json=self.rows())
        page.get_by_text('Sports changed while importing; review again.', exact=True).wait_for()
        page.get_by_role('button', name='Apply reviewed roster', exact=True).click()
        page.get_by_text('Read and review a roster for this team first', exact=True).wait_for()
        self.assertEqual(errors, [])
