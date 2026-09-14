"""Parent-owned scrolling for embedded consoles, using real nested browser documents."""
import base64
import unittest
import test_workspaces as harness


class EmbeddedWorkspaceBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.WorkspaceBrowserTests.tearDownClass.__func__)
    page = harness.WorkspaceBrowserTests.page
    evidence = harness.WorkspaceBrowserTests.evidence

    def embedded_page(self, width):
        computers = [{'id': f'student-{n}', 'name': f'Workstation {n}', 'role': 'student',
                      'online': False, 'authenticated': False, 'user': {}, 'featureState': {}} for n in range(24)]
        page, errors = self.page('/controller/', width, overrides={
            '/api/v1/veyon/computers': {'computers': computers},
            '/api/v1/veyon/status': {'keyName': 'fixture'},
            '/api/v1/lab/computers': {'configured': True, 'computers': computers, 'summary': {'total': 24, 'online': 0, 'offline': 24}, 'groups': []}})
        page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
        page.evaluate("showPage('lab')")
        frame = page.frame_locator('#labVeyonFrame')
        frame.locator('[data-select="student-23"]').wait_for()
        page.wait_for_function("document.querySelector('#labVeyonFrame').dataset.naturalHeight === 'true'")
        page.wait_for_timeout(100)
        return page, frame, errors

    def assert_single_scroll(self, page, selector):
        metrics = page.locator(selector).evaluate('''frame => ({
          innerScroll: frame.contentWindow.scrollY,
          client: frame.contentDocument.documentElement.clientHeight,
          content: frame.contentDocument.documentElement.scrollHeight,
          body: frame.contentDocument.body.getBoundingClientRect().height,
          frame: frame.getBoundingClientRect().height,
          overflow: getComputedStyle(frame.contentDocument.documentElement).overflowY
        })''')
        self.assertEqual(metrics['innerScroll'], 0, metrics)
        self.assertLessEqual(metrics['content'], metrics['client'] + 2, metrics)
        self.assertLessEqual(abs(metrics['frame'] - metrics['body']), 4, metrics)
        self.assertEqual(metrics['overflow'], 'clip')

    def test_embedded_labs_have_one_scroll_owner_and_keep_sessions(self):
        for width in (390, 1440):
            with self.subTest(width=width):
                page, frame, errors = self.embedded_page(width)
                self.assert_single_scroll(page, '#labVeyonFrame')
                page.locator('#labVeyonFrame').evaluate('el => el.contentWindow.__sessionMarker = "retained"')
                frame.locator('[data-select="student-23"]').scroll_into_view_if_needed()
                self.assertGreater(page.evaluate('scrollY'), 500)
                self.assert_single_scroll(page, '#labVeyonFrame')
                before = page.evaluate('scrollY')
                page.mouse.move(width // 2, 500)
                page.mouse.wheel(0, -250)
                page.wait_for_timeout(100)
                self.assertLess(page.evaluate('scrollY'), before)
                frame.locator('[data-select="student-23"]').check()
                page.evaluate("showLabConsole('windows')")
                windows = page.frame_locator('#labWindowsFrame')
                windows.locator('#computerGrid .card').first.wait_for()
                page.wait_for_timeout(100)
                self.assert_single_scroll(page, '#labWindowsFrame')
                page.locator('#lab > details > summary').click()
                page.locator('#labEnrollmentId').scroll_into_view_if_needed()
                self.assertTrue(page.locator('#labEnrollmentId').is_visible())
                windows.locator('#presetDialog').evaluate('el => el.showModal()')
                dialog = windows.locator('#presetDialog').bounding_box()
                self.assertGreaterEqual(dialog['y'], 0, dialog)
                self.assertLessEqual(dialog['y'] + dialog['height'], 1001, dialog)
                windows.locator('#presetDialog').evaluate('el => el.close()')
                page.locator('#lab > details > summary').click()
                page.evaluate("showLabConsole('veyon')")
                self.assertEqual(page.locator('#labVeyonFrame').evaluate('el => el.contentWindow.__sessionMarker'), 'retained')
                self.assertTrue(frame.locator('[data-select="student-23"]').is_checked())
                page.evaluate("showPage('overview')")
                page.wait_for_function("document.querySelector('#labVeyonFrame').contentWindow.RoomGoblinEmbeddedViewport.visible === false")
                page.evaluate("showPage('lab')")
                page.evaluate('window.scrollTo(0,0)')
                if width == 1440:
                    page.locator('#workspaceFocus').click()
                frame.locator('#deviceSearch').fill('Workstation 23')
                page.wait_for_timeout(100)
                self.assert_single_scroll(page, '#labVeyonFrame')
                page.evaluate('window.scrollTo(0,0)')
                self.evidence(page, errors, f'embedded-lab-{width}')

    def test_embedded_live_modal_stays_in_parent_viewport(self):
        for width in (390, 1440):
            with self.subTest(width=width):
                page, frame, errors = self.embedded_page(width)
                frame.locator('[data-live="student-23"]').scroll_into_view_if_needed()
                frame.locator('[data-live="student-23"]').click()
                frame.locator('#modal.open').wait_for()
                page.wait_for_timeout(100)
                box = frame.locator('#liveModalBox').bounding_box()
                self.assertGreaterEqual(box['y'], 0, box)
                self.assertLessEqual(box['y'] + box['height'], 1001, box)
                self.assertLessEqual(box['x'] + box['width'], width + 1, box)
                page.screenshot(path=str(harness.OUTPUT / f'{self.engine}-embedded-live-modal-{width}.png'))
                frame.locator('#closeLive').click()
                self.assertTrue(frame.locator('[data-live="student-23"]').evaluate('el => el === document.activeElement'))
                self.assert_single_scroll(page, '#labVeyonFrame')
                self.assertFalse(errors, errors)

    def test_preview_requests_follow_parent_viewport_and_stop_when_hidden(self):
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=')
        computers = [{'id': f'online-{n}', 'name': f'Online workstation {n}', 'role': 'student',
                      'online': True, 'authenticated': True, 'user': {'login': 'fixture'},
                      'featureState': {}} for n in range(24)]
        for width in (390, 1440):
            with self.subTest(width=width):
                requests = []
                def transport(route, target):
                    if target.endswith('/framebuffer'):
                        requests.append(target.split('/')[-2])
                        route.fulfill(content_type='image/png', body=png)
                        return True
                    return False
                page, errors = self.page('/controller/', width, transport=transport, overrides={
                    '/api/v1/veyon/computers': {'computers': computers},
                    '/api/v1/veyon/status': {'keyName': 'fixture'}})
                page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
                page.evaluate("showPage('lab')")
                frame = page.frame_locator('#labVeyonFrame')
                frame.locator('[data-thumb="online-23"]').wait_for(state='attached')
                page.wait_for_function("document.querySelector('#labVeyonFrame').contentWindow.RoomGoblinEmbeddedViewport?.visible")
                frame.locator('[data-select="online-0"]').scroll_into_view_if_needed()
                page.wait_for_function("document.querySelector('#labVeyonFrame').contentDocument.querySelector('[data-thumb=online-0]').naturalWidth > 0")
                page.wait_for_timeout(100)
                allowed = page.locator('#labVeyonFrame').evaluate("""frame => {
                  const viewport = frame.contentWindow.RoomGoblinEmbeddedViewport;
                  return [...frame.contentDocument.querySelectorAll('[data-thumb]')].filter(el => {
                    const rect = el.closest('.card').getBoundingClientRect();
                    return rect.bottom >= viewport.top - 120 && rect.top <= viewport.bottom + 240;
                  }).map(el => el.dataset.thumb);
                }""")
                self.assertGreater(len(requests), 0)
                self.assertLess(len(set(requests)), 24)
                self.assertTrue(set(requests).issubset(set(allowed)), (requests, allowed))
                self.assertNotIn('online-23', requests)
                frame.locator('[data-select="online-23"]').scroll_into_view_if_needed()
                page.wait_for_function("document.querySelector('#labVeyonFrame').contentDocument.querySelector('[data-thumb=online-23]').naturalWidth > 0")
                self.assertIn('online-23', requests)
                page.evaluate("showPage('overview')")
                page.wait_for_function("document.querySelector('#labVeyonFrame').contentWindow.RoomGoblinEmbeddedViewport.visible === false")
                page.wait_for_timeout(100)
                before = len(requests)
                # Make every cached frame due, then allow a real polling tick.
                # Hidden-parent gating must prevent requests even when nothing is cached.
                frame.locator('body').evaluate("() => {for (const state of thumbState.values()) state.nextTry = 0;}")
                page.wait_for_timeout(2200)
                self.assertEqual(len(requests), before)
                self.assertFalse(errors, errors)
