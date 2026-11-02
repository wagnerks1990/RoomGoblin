"""Diagnostic labels reflect the evidence actually returned by each integration."""
import unittest
import test_workspaces as harness


class DiagnosticEvidenceBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.WorkspaceBrowserTests.tearDownClass.__func__)
    page = harness.WorkspaceBrowserTests.page

    def diagnostics(self, services):
        page, errors = self.page('/controller/', overrides={
            '/api/v1/diagnostics': {'ok': True, 'services': services}})
        page.evaluate("showPage('diagnostics')")
        page.wait_for_function("document.querySelector('#diagServices').textContent.includes('pluto')")
        return page, errors

    def test_unobserved_is_neutral_in_summary_and_details(self):
        page, errors = self.diagnostics({'pluto': {'ok': None, 'status': 'not-observed'}})
        self.assertIn('NOT CHECKED', page.locator('#diagSummary').inner_text())
        self.assertIn('NOT CHECKED', page.locator('#diagServices').inner_text())
        self.assertNotIn('Healthy', page.locator('#diagSummary').inner_text())
        self.assertFalse(errors, errors)

    def test_unconfigured_is_not_an_integration_failure(self):
        page, errors = self.diagnostics({'pluto': {'ok': None, 'status': 'not-configured'},
                                        'govee': {'ok': None, 'status': 'not-configured'}})
        self.assertEqual(page.locator('#diagSummary .kpi').filter(has_text='NOT CONFIGURED').count(), 2)
        self.assertFalse(errors, errors)

    def test_reachability_is_not_presented_as_authenticated_control(self):
        page, errors = self.diagnostics({'pluto': {'ok': None, 'status': 'not-observed'},
            'veyon': {'ok': True, 'serviceReachable': True, 'verification': 'reachability-only', 'pool': {'size': 0, 'max': 24}}})
        self.assertIn('REACHABLE', page.locator('#diagSummary').inner_text())
        self.assertIn('Authentication not verified', page.locator('#diagSummary').inner_text())
        self.assertIn('REACHABLE', page.locator('#diagServices').inner_text())
        self.assertFalse(errors, errors)

    def test_transport_success_retains_its_timestamp_and_limit(self):
        page, errors = self.diagnostics({'pluto': {'ok': True, 'status': 'observed', 'lastSuccessAt': '2026-01-01T00:00:00.000Z'},
            'govee': {'ok': True, 'status': 'observed', 'verification': 'mqtt-publish', 'configuredDevices': 1}})
        self.assertIn('OBSERVED', page.locator('#diagSummary').inner_text())
        self.assertIn('2026-01-01', page.locator('#diagSummary').inner_text())
        self.assertIn('PUBLISHED', page.locator('#diagSummary').inner_text())
        self.assertIn('Device acknowledgment not verified', page.locator('#diagSummary').inner_text())
        self.assertFalse(errors, errors)


if __name__ == '__main__':
    unittest.main()
