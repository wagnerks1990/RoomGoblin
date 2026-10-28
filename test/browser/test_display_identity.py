"""Receiver URL identity reaches the actual browser hello without case folding."""
import unittest
import test_display as harness


class DisplayIdentityBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.DisplayBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.DisplayBrowserTests.tearDownClass.__func__)
    page = harness.DisplayBrowserTests.page
    open_renderer = harness.DisplayBrowserTests.open_renderer

    def check_identity(self, url, expected):
        page = self.page()
        page.route('**/display/Screen-A*', lambda route: route.fulfill(
            content_type='text/html', body=(harness.ROOT/'public/display/index.html').read_bytes()))
        page.route('**/display/screen.dot*', lambda route: route.fulfill(
            content_type='text/html', body=(harness.ROOT/'public/display/index.html').read_bytes()))
        page.goto('http://127.0.0.1:31337'+url+'#enrollmentToken=fixture-one-use-enrollment')
        page.wait_for_function("window.__sent?.some(message=>message.type==='hello')")
        hello = page.evaluate("__sent.find(message=>message.type==='hello')")
        self.assertEqual(hello['deviceId'], expected)
        self.assertEqual(hello['enrollmentToken'], 'fixture-one-use-enrollment')
        self.assertFalse(self.errors, self.errors)

    def test_canonical_receiver_url_retains_exact_case(self):
        self.check_identity('/display/Screen-A', 'Screen-A')

    def test_legacy_query_receiver_url_retains_exact_case(self):
        self.check_identity('/display/?id=Screen-A', 'Screen-A')

    def test_legacy_dotted_receiver_url_is_preserved(self):
        self.check_identity('/display/screen.dot', 'screen.dot')


if __name__ == '__main__':
    unittest.main()
