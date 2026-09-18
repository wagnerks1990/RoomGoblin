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

    def test_community_chat_is_target_bound_and_renders_reply_as_text(self):
        page, errors, state = self.pilot_page(390)
        requests = []
        def respond(route):
            action = route.request.url.rsplit('/', 1)[-1]
            data = route.request.post_data_json
            requests.append((action, data))
            reply = {'ok': True}
            if action == 'open':
                reply.update(session='fixture-session', kind='chat')
            if action == 'state':
                reply.update(messages=[{'from': 'student', 'text': '<img src=x onerror=alert(1)>'}], entries=[])
            route.fulfill(json=reply)
        page.route('**/api/v1/veyon/computers/student-a/browser/*', respond)
        page.locator('#communityChat').click()
        page.locator('#communityDialog[open]').wait_for()
        self.assertIn('<img src=x', page.locator('#communityBody pre').inner_text())
        self.assertEqual(page.locator('#communityBody img').count(), 0)
        page.locator('#communityBody textarea').fill('Hello student')
        page.locator('#communityBody button[type="submit"]').click()
        page.wait_for_function("document.querySelector('#communityBody textarea').value === ''")
        page.locator('#communityClose').click()
        page.wait_for_timeout(200)
        self.assertTrue(any(a == 'send' and d.get('text') == 'Hello student' for a, d in requests))
        self.assertTrue(any(a == 'close' for a, d in requests))
        self.assertFalse(errors, errors)

    def test_community_download_requires_complete_file(self):
        import base64
        page, errors, state = self.pilot_page()
        downloaded = False
        def respond(route):
            nonlocal downloaded
            action = route.request.url.rsplit('/', 1)[-1]
            reply = {'ok': True}
            if action == 'open':
                reply.update(session='file-fixture', kind='files')
            elif action == 'download':
                downloaded = True
            elif action == 'state':
                reply.update(messages=[], entries=[] if downloaded else [{'name': 'sample.txt', 'dir': False, 'size': 6}],
                             path='/home/student/RoomGoblin-Pilot', pending=False,
                             complete=downloaded, size=6, fileName='sample.txt', error='')
            elif action == 'chunk':
                reply['data'] = base64.b64encode(b'sample').decode()
            route.fulfill(json=reply)
        page.route('**/api/v1/veyon/computers/student-a/browser/*', respond)
        page.locator('#communityFiles').click()
        page.locator('#communityDialog[open]').wait_for()
        self.assertEqual(page.locator('#communityBody a[download]').count(), 0)
        page.get_by_role('button', name='Download: sample.txt', exact=True).click()
        page.locator('#communityBody a[download]').wait_for()
        with page.expect_download() as saved:
            page.locator('#communityBody a[download]').click()
        self.assertEqual(saved.value.path().read_bytes(), b'sample')
        page.locator('#communityClose').click()
        self.assertFalse(errors, errors)

    def test_community_upload_is_chunked_and_waits_for_endpoint_completion(self):
        import base64
        page, errors, state = self.pilot_page()
        requests = []
        finished = False
        def respond(route):
            nonlocal finished
            action = route.request.url.rsplit('/', 1)[-1]
            data = route.request.post_data_json
            requests.append((action, data))
            if action == 'uploadFinish':
                finished = True
            reply = {'ok': True}
            if action == 'open':
                reply.update(session='upload-fixture', kind='files', upload=True)
            elif action == 'state':
                reply.update(messages=[], entries=[], path='/home/student/RoomGoblin-Pilot',
                             pending=False, complete=finished, size=6, fileName='sample.txt', error='')
            route.fulfill(json=reply)
        page.route('**/api/v1/veyon/computers/student-a/browser/*', respond)
        page.locator('#communityFiles').click()
        page.locator('#communityDialog[open]').wait_for()
        page.locator('#communityBody input[type="file"]').set_input_files({
            'name': 'sample.txt', 'mimeType': 'text/plain', 'buffer': b'sample'
        })
        page.once('dialog', lambda dialog: dialog.accept())
        page.get_by_role('button', name='Send file to Pilot Inbox', exact=True).click()
        page.wait_for_function("document.querySelector('#communityStatus').textContent.includes('uploaded atomically')")
        starts = [data for action, data in requests if action == 'uploadStart']
        chunks = [data for action, data in requests if action == 'uploadChunk']
        self.assertEqual(starts[0]['name'], 'sample.txt')
        self.assertEqual(starts[0]['size'], 6)
        self.assertEqual(chunks[0]['offset'], 0)
        self.assertEqual(base64.b64decode(chunks[0]['data']), b'sample')
        self.assertTrue(any(action == 'uploadFinish' for action, _ in requests))
        page.locator('#communityClose').click()
        self.assertFalse(errors, errors)

    def test_browser_control_sends_leased_input_reads_clipboard_and_closes(self):
        page, errors, state = self.pilot_page()
        requests = []
        def respond(route):
            action = route.request.url.rsplit('/', 1)[-1]
            data = route.request.post_data_json
            requests.append((action, data))
            reply = {'ok': True}
            if action == 'open':
                reply.update(session='control-fixture', kind='control')
            elif action == 'state':
                reply.update(frameWidth=100, frameHeight=100, ready=True,
                             lease='123e4567-e89b-12d3-a456-426614174000',
                             frameRevision=7, topology='a' * 64,
                             screens=[{'index': 0, 'name': 'Main', 'x': 0, 'y': 0, 'width': 100, 'height': 100}],
                             messages=[], entries=[])
            elif action == 'clipboard':
                reply.update(pending=False, text='remote é')
            route.fulfill(json=reply)
        page.route('**/api/v1/veyon/computers/student-a/browser/*', respond)
        page.locator('[data-live="student-a"]').click()
        page.wait_for_function("document.querySelector('#liveImg').naturalWidth > 0")
        page.once('dialog', lambda dialog: dialog.accept())
        page.locator('#startBrowserControl').click()
        page.locator('#controlCanvas').wait_for(state='visible')
        page.wait_for_function("document.querySelector('#controlCanvas').dataset.ready === 'true'")
        page.locator('#controlCanvas').click()
        page.locator('#controlCanvas').press('a')
        page.once('dialog', lambda dialog: dialog.accept())
        page.locator('#readRemoteClipboard').click()
        page.locator('#remoteClipboard').wait_for(state='visible')
        self.assertEqual(page.locator('#remoteClipboard').input_value(), 'remote é')
        page.keyboard.press('Escape')
        page.wait_for_function("document.querySelector('#controlCanvas').hidden")
        self.assertEqual(page.locator('#startBrowserControl').evaluate("e => document.activeElement === e && !e.hidden"), True)
        leased = [data for action, data in requests if action in ('pointer', 'key')]
        self.assertTrue(leased)
        self.assertTrue(all(data.get('lease') == '123e4567-e89b-12d3-a456-426614174000' and
                            data.get('revision') == 7 and data.get('sequence', 0) > 0 for data in leased))
        self.assertTrue(any(action == 'clipboard' for action, _ in requests))
        self.assertTrue(any(action == 'close' for action, _ in requests))
        self.assertFalse(errors, errors)

    def test_live_terminal_uses_admin_route_and_renders_output_as_text(self):
        page, errors, state = self.pilot_page()
        requests = []
        def respond(route):
            action = route.request.url.rsplit('/', 1)[-1]
            data = route.request.post_data_json
            requests.append((action, data))
            reply = {'ok': True}
            if action == 'open':
                reply.update(session='terminal-fixture', kind='terminal')
            elif action == 'state':
                reply.update(terminalReady=True, terminalExited=False, shell='powershell',
                             terminalBase=0, terminalEnd=28, error='', messages=[], entries=[])
            elif action == 'read':
                reply.update(text='<img src=x onerror=alert(1)>', cursor=28, reset=False,
                             ready=True, exited=False, error='')
            route.fulfill(json=reply)
        page.route('**/api/v1/veyon/computers/student-a/terminal/*', respond)
        answers = iter(['powershell', None])
        page.on('dialog', lambda dialog: dialog.accept(next(answers)))
        page.locator('#liveTerminal').click()
        page.locator('#terminalDialog[open]').wait_for()
        page.wait_for_function("document.querySelector('#terminalOutput').textContent.includes('<img src=x')")
        self.assertEqual(page.locator('#terminalOutput img').count(), 0)
        page.locator('#terminalInput').fill('Get-Date')
        page.locator('#terminalForm button[type="submit"]').click()
        page.wait_for_timeout(100)
        with page.expect_request('**/api/v1/veyon/computers/student-a/terminal/close'):
            page.locator('#terminalClose').click()
        self.assertTrue(any(action == 'write' and data.get('text') == 'Get-Date\r\n' for action, data in requests))
        self.assertTrue(any(action == 'close' for action, _ in requests))
        self.assertFalse(errors, errors)

    def test_local_ai_is_explicit_and_labels_are_plain_text(self):
        page, errors, state = self.pilot_page()
        requests = []
        def respond(route):
            requests.append(route.request.url)
            route.fulfill(json={'ok': True, 'detections': [{'label': '<img src=x>', 'confidence': 0.75, 'box': [0, 0, 5, 5]}]})
        page.route('**/api/v1/veyon/computers/student-a/analyze', respond)
        page.once('dialog', lambda dialog: dialog.dismiss())
        page.locator('#analyzeScreen').click()
        self.assertEqual(requests, [])
        page.once('dialog', lambda dialog: dialog.accept())
        page.locator('#analyzeScreen').click()
        page.locator('#infoModal.open').wait_for()
        self.assertIn('<img src=x> — 75%', page.locator('#infoBody').inner_text())
        self.assertEqual(page.locator('#infoBody img').count(), 0)
        self.assertEqual(len(requests), 1)
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
