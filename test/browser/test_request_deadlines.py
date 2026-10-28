"""Real operator controls release stalled requests without replaying mutations."""
import unittest
import test_workspaces as harness


class RequestDeadlineBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.WorkspaceBrowserTests.tearDownClass.__func__)
    page = harness.WorkspaceBrowserTests.page
    held_route = harness.WorkspaceBrowserTests.held_route
    ubuntu_fixture_computer = harness.WorkspaceBrowserTests.ubuntu_fixture_computer

    def test_veyon_inventory_deadline_releases_reads_and_preserves_cards(self):
        pending, control = [], {'hold': False, 'name': 'Previous computer'}
        def transport(route, target):
            if target != '/api/v1/veyon/computers':
                return False
            if control['hold']:
                pending.append(route)
            else:
                route.fulfill(json={'computers': [{'id': 'fixture', 'name': control['name'],
                    'role': 'student', 'online': False, 'ip': '192.0.2.88'}]})
            return True
        page, errors = self.page('/controller/veyon.html', transport=transport)
        page.locator('#grid .card').wait_for()
        page.clock.install()
        control['hold'] = True
        page.locator('#refresh').click()
        self.held_route(page, pending)
        page.clock.fast_forward(60001)
        page.wait_for_function("document.getElementById('inventoryStatus').textContent.includes('last available inventory')")
        self.assertIn('Previous computer', page.locator('#grid').inner_text())
        control.update(hold=False, name='Refreshed computer')
        for route in pending:
            route.fulfill(json={'computers': []})
        page.locator('#refresh').click()
        page.wait_for_function("document.getElementById('grid').textContent.includes('Refreshed computer')")
        self.assertFalse(errors, errors)

    def test_controller_timeout_rejects_once_and_ignores_a_late_success(self):
        pending = []
        def transport(route, target):
            if target == '/api/v1/fixture-command':
                pending.append(route)
                return True
            return False
        page, errors = self.page('/controller/', transport=transport)
        page.clock.install()
        page.evaluate("void api('/api/v1/fixture-command',{method:'POST'}).then(()=>window.fixtureResult='success',e=>window.fixtureResult=e.message)")
        self.held_route(page, pending)
        page.clock.fast_forward(600001)
        page.wait_for_function("window.fixtureResult?.includes('outcome is unconfirmed')")
        pending[0].fulfill(json={'ok': True})
        page.wait_for_timeout(30)
        self.assertIn('unconfirmed', page.evaluate('fixtureResult'))
        self.assertEqual(len(pending), 1)
        self.assertFalse(errors, errors)

    def test_ubuntu_command_timeout_releases_the_card_without_replay(self):
        pending, device = [], self.ubuntu_fixture_computer()
        def transport(route, target):
            if not target.startswith('/api/v1/ubuntu-displays'):
                return False
            if target.endswith('/command'):
                pending.append(route)
            else:
                route.fulfill(json={'devices': [device], 'receivers': {}})
            return True
        page, errors = self.page('/managed-displays/', transport=transport)
        page.clock.install()
        button = page.locator('#ubuntuComputers [data-action="identify"]')
        button.click()
        self.held_route(page, pending)
        self.assertTrue(button.is_disabled())
        page.clock.fast_forward(60001)
        page.wait_for_function("document.querySelector('.ubuntu-card-message').textContent.includes('unconfirmed')")
        self.assertFalse(button.is_disabled())
        self.assertEqual(len(pending), 1)
        pending[0].fulfill(json={'ok': True, 'accepted': True})
        self.assertFalse(errors, errors)

    def test_ubuntu_stalled_inventory_preserves_its_previous_cards(self):
        pending, device, control = [], self.ubuntu_fixture_computer(), {'hold': False}
        def transport(route, target):
            if target != '/api/v1/ubuntu-displays':
                return False
            if control['hold']:
                pending.append(route)
            else:
                route.fulfill(json={'devices': [device], 'receivers': {}})
            return True
        page, errors = self.page('/managed-displays/', transport=transport)
        page.locator('#ubuntuComputers h3').wait_for()
        page.clock.install()
        control['hold'] = True
        page.locator('#refresh').click()
        self.held_route(page, pending)
        page.clock.fast_forward(60001)
        page.wait_for_function("document.getElementById('ubuntuStatus').textContent.includes('last available inventory')")
        self.assertIn('Computer fixture', page.locator('#ubuntuComputers').inner_text())
        control['hold'] = False
        for route in pending:
            route.fulfill(json={'devices': [device], 'receivers': {}})
        self.assertFalse(errors, errors)

    def test_android_enrollment_timeout_keeps_newer_draft_and_releases_submit(self):
        pending = []
        def transport(route, target):
            if target == '/api/v1/maintenance/android/enroll':
                pending.append(route)
                return True
            if target == '/api/v1/maintenance/android/status':
                route.fulfill(json={'ok': True, 'adbAvailable': True, 'devices': [],
                                    'profiles': [{'id': 'default', 'name': 'Default'}]})
                return True
            return False
        page, errors = self.page('/managed-displays/', transport=transport)
        page.clock.install()
        page.locator('.enroll-panel > summary').click()
        page.locator('#enroll [name="host"]').fill('192.0.2.50')
        page.locator('#enroll [name="name"]').fill('Fixture')
        page.locator('#enroll [name="pairingCode"]').fill('123456')
        button = page.locator('#enroll button[type="submit"]')
        button.click()
        self.held_route(page, pending)
        self.assertTrue(button.is_disabled())
        page.locator('#enroll [name="host"]').fill('192.0.2.51')
        page.clock.fast_forward(600001)
        page.wait_for_function("document.getElementById('enrollMsg').textContent.includes('unconfirmed')")
        self.assertFalse(button.is_disabled())
        self.assertEqual(page.locator('#enroll [name="host"]').input_value(), '192.0.2.51')
        self.assertEqual(page.locator('#enroll [name="pairingCode"]').input_value(), '')
        self.assertEqual(len(pending), 1)
        pending[0].fulfill(json={'ok': False, 'error': 'Fixture operation retired'})
        self.assertFalse(errors, errors)


if __name__ == '__main__':
    unittest.main()
