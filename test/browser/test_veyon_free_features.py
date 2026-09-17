"""Free-feature UI and real browser recorder, with fixture endpoint images."""
import unittest
import test_workspaces as harness


class VeyonFreeFeaturesTests(unittest.TestCase):
    setUpClass = classmethod(harness.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.WorkspaceBrowserTests.tearDownClass.__func__)
    page = harness.WorkspaceBrowserTests.page
    evidence = harness.WorkspaceBrowserTests.evidence
    veyon_page = harness.WorkspaceBrowserTests.veyon_page

    def pilot_page(self, width=1440):
        page, errors, state = self.veyon_page(width)
        page.locator('#pausePreviews').click()
        page.locator('[data-select="student-a"]').check()
        page.evaluate("document.querySelectorAll('#freeFeatureTools, #freeFeatureTools details').forEach(el=>el.open=true)")
        page.remove_listener('dialog', page._fixture_dialog_handler)
        return page, errors, state

    def test_native_launchers_absent_and_device_features_use_web_catalog(self):
        page, errors, state = self.pilot_page()
        self.assertEqual(page.locator('#nativeView, #nativeControl, #nativeMaster').count(), 0)
        page.route('**/api/v1/veyon/computers/*/catalog', lambda route: route.fulfill(json={
            'features': [{'name': 'RemoteView', 'label': 'Remote view', 'provider': 'web',
                          'detail': 'Open Live View', 'advertised': True}]}))
        page.evaluate("document.querySelectorAll('details').forEach(el=>el.open=true)")
        page.locator('#features').click()
        page.locator('#infoBody .featureRow').wait_for()
        self.assertIn('Browser workflows only', page.locator('#infoBody').inner_text())
        self.assertIn('Remote view', page.locator('#infoBody').inner_text())
        self.assertFalse(errors, errors)

    def test_shutdown_cancel_and_delay_arguments(self):
        page, errors, state = self.pilot_page(390)
        page.once('dialog', lambda dialog: dialog.dismiss())
        page.locator('#powerNow').click()
        self.assertEqual(state['commands'], [])
        answers = iter(['90', None])
        page.on('dialog', lambda dialog: dialog.accept(next(answers)))
        page.locator('#powerDelay').click()
        page.wait_for_function("document.querySelector('#commandFeedback').textContent.startsWith('Queued:')")
        self.assertEqual(state['commands'][0]['arguments'], {'shutdownTimeout': 90})
        self.assertEqual(state['commands'][0]['feature'], 'powerDownDelayed')
        self.assertEqual(state['commands'][0]['targets'], ['student-a'])
        self.evidence(page, errors, 'veyon-free-features-mobile')

    def test_clipboard_form_target_content_and_missing_bridge(self):
        page, errors, state = self.pilot_page(390)
        page.route('**/api/v1/veyon/computers/*/catalog', lambda route: route.fulfill(json={
            'features': [{'name': 'RoomGoblinClipboardWrite', 'advertised': True}]}))
        page.locator('#sendClipboard').click()
        page.locator('#clipboardText').fill('Clipboard sample é\nSecond line')
        self.evidence(page, errors, 'veyon-clipboard-mobile')
        # A changed selection must not redirect the open form.
        page.locator('[data-select="student-a"]').evaluate("el => { el.checked=false; el.dispatchEvent(new Event('change', {bubbles:true})); }")
        page.locator('#clipboardForm button').click()
        page.wait_for_function("document.querySelector('#commandFeedback').textContent.startsWith('Queued:')")
        self.assertEqual(state['commands'][-1]['targets'], ['student-a'])
        self.assertEqual(state['commands'][-1]['feature'], 'clipboardWrite')
        self.assertEqual(state['commands'][-1]['arguments'], {'clipboardText': 'Clipboard sample é\nSecond line'})
        self.assertEqual(page.locator('#clipboardText').count(), 0)
        page.locator('[data-select="student-a"]').evaluate("el => { el.checked=true; el.dispatchEvent(new Event('change', {bubbles:true})); }")
        page.unroute('**/api/v1/veyon/computers/*/catalog')
        page.route('**/api/v1/veyon/computers/*/catalog', lambda route: route.fulfill(json={'features': []}))
        page.once('dialog', lambda dialog: dialog.accept())
        with page.expect_event('dialog') as blocked:
            page.locator('#sendClipboard').click()
        self.assertIn('requires the RoomGoblinWebBridge', blocked.value.message)
        self.assertEqual(len(state['commands']), 1)
        self.assertFalse(errors, errors)

    def test_key_sequence_is_an_explicit_single_target_action(self):
        page, errors, state = self.pilot_page()
        page.route('**/api/v1/veyon/computers/*/catalog', lambda route: route.fulfill(json={
            'features': [{'name': 'RoomGoblinKeySequence', 'advertised': True}]}))
        page.locator('#sendKey').click()
        page.locator('#keySequence').select_option('Ctrl+V')
        page.locator('#keyForm button').click()
        page.wait_for_function("document.querySelector('#commandFeedback').textContent.startsWith('Queued:')")
        self.assertEqual(state['commands'][-1]['targets'], ['student-a'])
        self.assertEqual(state['commands'][-1]['feature'], 'keySequence')
        self.assertEqual(state['commands'][-1]['arguments'], {'sequence': 'Ctrl+V'})
        self.assertFalse(errors, errors)

    def test_record_stop_download_discard_and_capture_failure(self):
        page, errors, state = self.pilot_page()
        page.on('dialog', lambda dialog: dialog.accept())
        page.locator('#startRecording').click()
        page.wait_for_function("document.querySelector('#recordingStatus').textContent.startsWith('Recording 1 screens')")
        page.wait_for_timeout(1200)
        page.locator('#stopRecording').click()
        page.wait_for_function("!document.querySelector('#downloadRecording').disabled")
        with page.expect_download() as download:
            page.locator('#downloadRecording').click()
        self.assertTrue(download.value.suggested_filename.endswith('.webm'))
        self.assertGreater(download.value.path().stat().st_size, 0)
        page.locator('#discardRecording').click()
        self.assertTrue(page.locator('#downloadRecording').is_disabled())
        state['broken'] = True
        page.locator('#startRecording').click()
        page.wait_for_function("document.querySelector('#recordingStatus').textContent.includes('Capture stopped')")
        self.assertFalse(page.locator('#startRecording').is_disabled())
        self.assertTrue(page.locator('#stopRecording').is_disabled())
        self.assertFalse(errors, errors)
