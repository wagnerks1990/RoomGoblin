"""Real maintenance controls with fake transports; no physical update commands."""
import unittest
import test_workspaces as workspaces


class IntegrationUpdateBrowserTests(unittest.TestCase):
    setUpClass = classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
    page = workspaces.WorkspaceBrowserTests.page
    evidence = workspaces.WorkspaceBrowserTests.evidence

    def open_panel(self, width=1440):
        state = {"ok": True, "policy": {"musicAssistant": False, "recoverMusicAssistant": False, "apollo": []},
                 "window": {"start": "02:00", "end": "04:00"}, "busy": False, "outputs": [{"id": "speaker", "name": "Test speaker"}],
                 "devices": [{"id": "test-apollo", "name": "Test Apollo", "online": True, "version": "26.9.21.1",
                              "candidate": {"available": True, "latestVersion": "26.10.30.1"}}],
                 "catalog": {"musicAssistant": {"available": True, "currentVersion": "2.10.8", "latestVersion": "2.10.9"}, "apollo": {"version": "26.10.30.1"}}}
        requests = []
        def transport(route, target):
            if target.startswith('/api/v1/admin/music-maintenance'):
                if route.request.method == 'PUT':
                    requests.append(route.request.post_data_json)
                    state['policy'] = dict(route.request.post_data_json)
                    state['policy']['outputBindings'] = {key: {'playerId': value} for key, value in state['policy'].get('playbackOutputs', {}).items() if value}
                if target.endswith('/install'):
                    requests.append(route.request.post_data_json)
                    route.fulfill(status=409, json={'ok': False, 'error': 'Playback is active; wait until idle.'})
                else:
                    route.fulfill(json=state)
                return True
            return False
        page, errors = self.page('/controller/', width, transport=transport)
        page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
        page.evaluate("showPage('esphome')")
        panel = page.locator('#esphome details').filter(has=page.locator('summary', has_text='Updates & recovery'))
        panel.locator('summary').click()
        panel.get_by_text('Music Assistant 2.10.8;', exact=False).wait_for()
        return page, errors, panel, requests

    def test_policy_draft_survives_refresh_and_saves_selected_device(self):
        page, errors, panel, requests = self.open_panel(390)
        panel.get_by_label('Automatically update Music Assistant to stable releases').check()
        panel.get_by_label('Automatically update Test Apollo').check()
        panel.get_by_label('Playback health output for Test Apollo').select_option('speaker')
        panel.get_by_role('button', name='Check stable updates', exact=True).click()
        page.wait_for_function("[...document.querySelectorAll('#esphome details p')].some(p=>p.textContent.includes('Stable release check requested.'))")
        self.assertTrue(panel.get_by_label('Automatically update Test Apollo').is_checked())
        panel.get_by_role('button', name='Save maintenance policy', exact=True).click()
        page.wait_for_function("[...document.querySelectorAll('#esphome details p')].some(p=>p.textContent==='Maintenance policy saved.')")
        self.assertEqual(requests[-1], {'musicAssistant': True, 'recoverMusicAssistant': False, 'apollo': ['test-apollo'], 'playbackOutputs': {'test-apollo': 'speaker'}})
        self.assertEqual(panel.get_by_label('Playback health output for Test Apollo').input_value(), 'speaker')
        self.evidence(page, errors, 'integration-maintenance-mobile')

    def test_update_error_survives_poll_and_non_admin_controls_are_hidden(self):
        page, errors, panel, requests = self.open_panel()
        page.remove_listener('dialog', page._fixture_dialog_handler)
        page.once('dialog', lambda dialog: dialog.accept())
        panel.get_by_role('button', name='Update firmware now', exact=True).click()
        panel.get_by_text('Playback is active; wait until idle.', exact=True).wait_for()
        self.assertEqual(requests[-1], {'kind': 'apollo', 'deviceId': 'test-apollo', 'version': '26.10.30.1'})
        panel.get_by_text('Playback is active; wait until idle.', exact=True).wait_for()
        self.evidence(page, errors, 'integration-maintenance-desktop')
        page.evaluate("AUTH_STATUS.user.role='viewer'; AUTH_STATUS.user.capabilities=[]; dispatchEvent(new Event('roomgoblin:authchange'))")
        self.assertFalse(panel.is_visible())


if __name__ == '__main__':
    unittest.main()
