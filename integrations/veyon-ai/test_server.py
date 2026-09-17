# SPDX-License-Identifier: AGPL-3.0-or-later
import http.client
import json
import threading
import unittest
from http.server import HTTPServer
from server import handler


class FakeDetector:
    def __init__(self):
        self.calls = 0
    def detect(self, raw):
        self.calls += 1
        return {'ok': True, 'bytes': len(raw), 'retained': False}


class ServiceTests(unittest.TestCase):
    def test_authenticated_bounded_protocol(self):
        detector = FakeDetector()
        token = 'fixture-token-not-a-secret-000000000'
        service = HTTPServer(('127.0.0.1', 0), handler(detector, token))
        thread = threading.Thread(target=service.serve_forever, daemon=True)
        thread.start()
        def request(path, data, authorized=True):
            connection = http.client.HTTPConnection(*service.server_address, timeout=3)
            connection.request('POST', path, data, headers={'Authorization': 'Bearer ' + token} if authorized else {})
            response = connection.getresponse()
            status, body = response.status, json.loads(response.read())
            connection.close()
            return status, body
        try:
            self.assertEqual(request('/analyze', b'png', False)[0], 401)
            self.assertEqual(request('/models', b'png')[0], 400)
            self.assertEqual(detector.calls, 0)
            status, body = request('/analyze', b'png')
            self.assertEqual(status, 200)
            self.assertFalse(body['retained'])
            self.assertEqual(detector.calls, 1)
        finally:
            service.shutdown()
            service.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
