"""Attach workspace scenes to saved routines without dispatch or schedule changes."""
import copy
import unittest
import test_workspaces as harness
import test_sports
import test_weather_workspace


def routine():
    return {'id': 'saved-routine', 'name': 'Existing class routine', 'revision': 8,
            'enabled': True, 'time': '10:30', 'scheduleMode': 'schoolcycle',
            'days': [1, 2, 3, 4, 5], 'cycleDays': ['A'], 'anchorDate': '2027-10-18',
            'classIds': ['class-one'], 'classId': 'class-one', 'classTimeReference': 'start',
            'classTimeOffsetMinutes': 3, 'useClassTargets': False, 'targets': ['tv2'],
            'scheduleWindow': {'startDate': '2027-10-18', 'endDate': '2027-12-20',
                               'excludedDates': ['2027-11-22'], 'repeatEveryMinutes': 0, 'endTime': ''},
            'overlayPolicy': 'inherit', 'timerOverlay': {'enabled': True, 'source': 'class-end', 'label': 'Class ends'},
            'actionSequence': [
                {'id': 'power', 'action': 'tv.power', 'payload': {'state': 'on'}, 'targets': ['tv2'],
                 'useEventTargets': False, 'executionMode': 'once', 'delaySeconds': 0, 'continueOnError': True},
                {'id': 'content', 'action': 'display.text', 'payload': {'text': 'Original content'}, 'targets': ['tv1'],
                 'useEventTargets': False, 'executionMode': 'once', 'delaySeconds': 5, 'continueOnError': False},
                {'id': 'lights', 'action': 'govee.power', 'payload': {'state': 'on'}, 'targets': ['fixture-light'],
                 'useEventTargets': False, 'executionMode': 'once', 'delaySeconds': 2, 'continueOnError': True}]}


class ExistingAutomationContentTests(unittest.TestCase):
    setUpClass = classmethod(harness.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.WorkspaceBrowserTests.tearDownClass.__func__)
    page = harness.WorkspaceBrowserTests.page
    evidence = harness.WorkspaceBrowserTests.evidence

    def workspace(self, kind='sports', event=None, width=1440):
        event = copy.deepcopy(event or routine())
        weather = test_weather_workspace.forecast()
        sports = test_sports.data()
        requests = []
        profile = {'anchorDate': '2027-10-18', 'cycleDays': ['A', 'B'], 'dayGroups': []}
        classes = [{'id': 'class-one', 'name': 'Example class', 'startTime': '10:30', 'endTime': '11:30'}]

        def transport(route, target):
            method = route.request.method
            if target == '/api/v1/sports/boards/b/scene':
                route.fulfill(json={'ok': True, 'scene': sports['scene']})
                return True
            if target == '/api/v1/weather/scene':
                scene = {'version': 1, 'transparent': kind == 'overlay', 'layers': [
                    {'id': 'weather', 'type': 'widget', 'widget': 'weather', 'name': 'Weather',
                     'x': 5, 'y': 5, 'w': 90, 'h': 20}]}
                route.fulfill(json={'ok': True, 'scene': scene})
                return True
            if target.startswith('/api/') and method in ('POST', 'PUT'):
                body = route.request.post_data_json
                requests.append((target, body))
                if target == '/api/v1/automations/draft/simulate':
                    route.fulfill(json={'ok': True, 'resolved': {'targets': ['tv1']}})
                elif target == '/api/v1/planning/studio/preview':
                    route.fulfill(json={'ok': True, 'previewHash': 'reviewed', 'matches': []})
                else:
                    route.fulfill(json={'ok': True})
                return True
            return False

        page, errors = self.page('/controller/', width, overrides={
            '/api/v1/automations': {'events': [event], 'scheduler': {'timezone': 'America/New_York'}},
            '/api/v1/automations/calendar': {'calendar': {}, 'scheduleProfile': profile},
            '/api/v1/planning': {'today': '2027-10-18', 'scheduleProfile': profile, 'classes': classes},
            '/api/v1/class-schedules': {'classes': classes},
            '/api/v1/planning/studio': {'config': {'version': 1, 'overlays': []}},
            '/api/v1/sports': {'ok': True, 'config': sports['config'], 'sources': {}},
            '/api/v1/sports/boards/b/display': sports['display'],
            '/api/v1/devices': {'devices': {'tv1': {'name': 'Display one'}, 'tv2': {'name': 'Display two'}}},
            '/api/v1/weather': {'ok': True, 'config': {'enabled': True, 'latitude': 40, 'longitude': -77},
                                'weather': weather, 'status': {}}}, transport=transport)
        page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
        if width < 1000:
            page.locator('#workspaceMenu').click()
        page.get_by_role('button', name='Sports' if kind == 'sports' else 'Weather', exact=True).click()
        if kind == 'sports':
            page.get_by_label('Board name', exact=True).wait_for()
        else:
            page.get_by_role('heading', name='Example School', exact=True).wait_for()
        if kind == 'overlay':
            page.get_by_label('Weather display type', exact=True).select_option('overlay')
        page.get_by_role('button', name='Add to existing automation', exact=True).click()
        picker = page.get_by_role('dialog', name='Add to existing automation', exact=True)
        picker.wait_for()
        self.assertFalse(requests, requests)
        picker.get_by_label('Existing automation', exact=True).select_option(event['id'])
        return page, errors, requests, event, picker

    def save_draft(self, page, name):
        draft = page.get_by_role('dialog', name='Edit ' + name, exact=True)
        draft.get_by_role('button', name='Preview & validate', exact=True).click()
        draft.get_by_text('Ready to save', exact=False).wait_for()
        draft.get_by_role('button', name='Save automation', exact=True).click()
        draft.wait_for(state='hidden')

    def test_sports_append_preserves_mixed_targets_schedule_and_actions(self):
        page, errors, requests, event, picker = self.workspace()
        picker.get_by_role('button', name='Open automation draft', exact=True).click()
        self.assertFalse(requests)
        self.save_draft(page, event['name'])
        target, saved = next(r for r in requests if r[0].endswith('/saved-routine'))
        self.assertEqual(target, '/api/v1/automations/saved-routine')
        for key in ('id', 'name', 'revision', 'time', 'scheduleMode', 'classIds', 'targets', 'scheduleWindow'):
            self.assertEqual(saved[key], event[key], key)
        self.assertEqual(saved['actionSequence'][:3], event['actionSequence'])
        added = saved['actionSequence'][3]
        self.assertEqual(added['targets'], ['tv1'])
        self.assertFalse(added['useEventTargets'])
        self.assertEqual(added['payload']['scene']['layers'][0]['sportsBoardId'], 'b')
        self.assertFalse(any(t == '/api/v1/commands' or t == '/api/v1/automations' for t, _ in requests))
        self.evidence(page, errors, 'sports-existing-automation')

    def test_sports_replaces_only_the_selected_visual_action(self):
        page, errors, requests, event, picker = self.workspace(width=390)
        picker.get_by_label('Apply as', exact=True).select_option('replace')
        picker.get_by_label('Display action to replace', exact=True).select_option('content')
        picker.get_by_role('button', name='Open automation draft', exact=True).click()
        self.save_draft(page, event['name'])
        saved = next(b for t, b in requests if t.endswith('/saved-routine'))
        seq = saved['actionSequence']
        self.assertEqual(len(seq), 3)
        self.assertEqual(seq[0], event['actionSequence'][0])
        self.assertEqual(seq[2], event['actionSequence'][2])
        for key in ('id', 'targets', 'delaySeconds', 'continueOnError'):
            self.assertEqual(seq[1][key], event['actionSequence'][1][key])
        self.assertEqual(seq[1]['payload']['scene']['layers'][0]['widget'], 'sports-board')
        self.evidence(page, errors, 'sports-existing-replace-mobile')

    def test_append_keeps_explicit_display_targets_after_a_clear_action(self):
        event = routine()
        event['actionSequence'][0]['action'] = 'display.clear'
        page, errors, requests, event, picker = self.workspace(event=event)
        picker.get_by_role('button', name='Open automation draft', exact=True).click()
        self.save_draft(page, event['name'])
        saved = next(b for t, b in requests if t.endswith('/saved-routine'))
        self.assertEqual(saved['actionSequence'][-1]['targets'], ['tv1'])
        self.assertFalse(saved['actionSequence'][-1]['useEventTargets'])
        self.assertEqual(errors, [])

    def test_control_only_routine_requires_explicit_display_targets(self):
        event = routine()
        event['actionSequence'] = [event['actionSequence'][2]]
        event['targets'] = ['fixture-light']
        page, errors, requests, event, picker = self.workspace(event=event)
        picker.get_by_role('button', name='Open automation draft', exact=True).click()
        draft = page.get_by_role('dialog', name='Edit ' + event['name'], exact=True)
        draft.get_by_role('button', name='Preview & validate', exact=True).click()
        draft.get_by_text('Choose explicit targets for action 2; it controls a different device type', exact=True).wait_for()
        self.assertFalse(requests)
        self.assertEqual(errors, [])

    def test_weather_replaces_a_legacy_action_without_a_primary_action_id(self):
        event = {'id': 'saved-routine', 'name': 'Legacy display routine', 'enabled': True,
                 'time': '12:00', 'scheduleMode': 'weekly', 'days': [1, 2, 3, 4, 5],
                 'targets': ['tv1'], 'action': 'display.text', 'payload': {'text': 'Old content'}}
        page, errors, requests, event, picker = self.workspace('weather', event)
        picker.get_by_label('Apply as', exact=True).select_option('replace')
        picker.get_by_role('button', name='Open automation draft', exact=True).click()
        self.save_draft(page, event['name'])
        saved = next(b for t, b in requests if t.endswith('/saved-routine'))
        self.assertEqual(len(saved['actionSequence']), 1)
        self.assertEqual(saved['targets'], ['tv1'])
        self.assertEqual(saved['actionSequence'][0]['payload']['scene']['layers'][0]['widget'], 'weather')
        self.assertEqual(errors, [])

    def test_weather_overlay_is_scoped_to_the_chosen_existing_routine(self):
        page, errors, requests, event, picker = self.workspace('overlay')
        picker.get_by_role('button', name='Review shared weather layer', exact=True).click()
        rule = page.get_by_role('dialog', name='Edit Weather overlay', exact=True)
        scope = rule.get_by_role('group', name='Apply to automations (none = all)', exact=True)
        self.assertTrue(scope.get_by_label(event['name'], exact=True).is_checked())
        self.assertFalse(requests)
        rule.get_by_role('button', name='Preview rule', exact=True).click()
        rule.get_by_role('button', name='Save shared layer', exact=True).click()
        rule.wait_for(state='hidden')
        saved = next(b for t, b in requests if t == '/api/v1/planning/studio')['config']
        self.assertEqual(saved['overlays'][-1]['automationIds'], [event['id']])
        self.assertTrue(saved['overlays'][-1]['scene']['transparent'])
        self.assertFalse(any(t.startswith('/api/v1/automations/') or t == '/api/v1/commands' for t, _ in requests))
        self.assertEqual(errors, [])

    def test_custom_overlay_policy_is_not_silently_overridden(self):
        event = routine()
        event['overlayPolicy'] = 'none'
        page, errors, requests, _, picker = self.workspace('overlay', event)
        picker.get_by_role('button', name='Review shared weather layer', exact=True).click()
        picker.get_by_text('This automation uses a custom shared-layer policy.', exact=False).wait_for()
        self.assertFalse(requests)
        self.assertEqual(errors, [])

    def test_cancel_existing_picker_does_not_write_or_dispatch(self):
        page, errors, requests, _, picker = self.workspace()
        picker.get_by_role('button', name='Close', exact=True).click()
        self.assertFalse(requests)
        self.assertEqual(errors, [])
