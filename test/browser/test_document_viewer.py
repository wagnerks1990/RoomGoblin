"""Exercise the actual document viewer with the locked PDF.js build and worker.

The local HTTP fixture stands in for media authorization; it is not a live Hub,
scheduler, or physical-receiver acceptance test. No PDF decoder is mocked.
"""
import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import unittest
from urllib.parse import parse_qs, quote, unquote, urlencode, urlparse

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "test-results" / "documents"
ASSET_PATH = "/media/lesson + handout.pdf"
ASSET_QUERY = {"v": "fixture-1", "access_token": "test-document-token"}


def fixture_pdf():
    """Small three-page PDF with distinct solid colors and a valid xref."""
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>",
    ]
    for index, color in enumerate(("1 0 0", "0 1 0", "0 0 1")):
        stream = (color + " rg 0 0 200 200 re f\n").encode("ascii")
        content_id = 4 + index * 2
        objects.append(
            ("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] "
             "/Resources << >> /Contents %d 0 R >>" % content_id).encode("ascii"))
        objects.append(b"<< /Length " + str(len(stream)).encode("ascii")
                       + b" >>\nstream\n" + stream + b"endstream")
    data = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data.extend(("%d 0 obj\n" % number).encode("ascii") + obj + b"\nendobj\n")
    xref = len(data)
    data.extend(("xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)).encode("ascii"))
    for offset in offsets:
        data.extend(("%010d 00000 n \n" % offset).encode("ascii"))
    data.extend(("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n"
                 % (len(objects) + 1, xref)).encode("ascii"))
    return bytes(data)


PDF = fixture_pdf()


class DocumentHandler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def send_bytes(self, body, content_type, status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path == ASSET_PATH:
            if parse_qs(parsed.query) != {key: [value] for key, value in ASSET_QUERY.items()}:
                self.send_bytes(b"Unauthorized fixture request", "text/plain", 401)
                return
            self.send_bytes(PDF, "application/pdf")
            return
        # Attribution/branding is unrelated to PDF decoding and page controls.
        if path == "/shared/attribution.js":
            self.send_bytes(b"", "text/javascript")
            return
        if path.startswith("/vendor/pdfjs/"):
            root = ROOT / "node_modules" / "pdfjs-dist" / "build"
            relative = path.removeprefix("/vendor/pdfjs/")
        else:
            root = ROOT / "public"
            relative = path.lstrip("/")
        target = (root / relative).resolve()
        if target.is_dir():
            target /= "index.html"
        if not target.is_relative_to(root.resolve()) or not target.is_file():
            self.send_bytes(b"Not found", "text/plain", 404)
            return
        content_type = "text/javascript" if target.suffix == ".mjs" else (
            mimetypes.guess_type(str(target))[0] or "application/octet-stream")
        self.send_bytes(target.read_bytes(), content_type)


class DocumentViewerBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        build = ROOT / "node_modules" / "pdfjs-dist" / "build"
        if not (build / "pdf.mjs").is_file() or not (build / "pdf.worker.mjs").is_file():
            raise RuntimeError("Run npm ci --ignore-scripts before the document browser tests")
        OUTPUT.mkdir(parents=True, exist_ok=True)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), DocumentHandler)
        cls.server_thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        cls.origin = "http://127.0.0.1:%d" % cls.server.server_port
        cls.pw = sync_playwright().start()
        cls.engine = os.getenv("DISPLAY_TEST_BROWSER", "chromium")
        launch = {"headless": True}
        if os.getenv("DISPLAY_TEST_EXECUTABLE"):
            launch["executable_path"] = os.environ["DISPLAY_TEST_EXECUTABLE"]
        cls.browser = getattr(cls.pw, cls.engine).launch(**launch)
        cls.evidence = []

    @classmethod
    def tearDownClass(cls):
        (OUTPUT / (cls.engine + "-results.json")).write_text(json.dumps(cls.evidence, indent=2))
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.server_thread.join(timeout=5)

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 900, "height": 600})
        self.addCleanup(self.context.close)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))

    def open_document(self, absolute=False, authorized=True, **options):
        file = quote(ASSET_PATH, safe="/") + "?" + urlencode(
            ASSET_QUERY if authorized else {"v": "fixture-1"})
        if absolute:
            file = self.origin + file
        query = urlencode({"file": file, **options})
        self.page.goto(self.origin + "/document-viewer/?" + query)
        self.page.wait_for_function("document.getElementById('status').textContent !== 'Loading…'")
        if authorized and self.page.locator("#error").is_visible():
            self.fail(self.page.locator("#error").inner_text())

    def assert_page(self, number):
        expect(self.page.locator("#status")).to_have_text("Page %d / 3" % number)
        expect(self.page.locator("#error")).to_be_hidden()
        pixel = self.page.locator("#canvas").evaluate(
            "c => Array.from(c.getContext('2d').getImageData(c.width/2,c.height/2,1,1).data)")
        self.assertEqual(pixel, {1: [255, 0, 0, 255], 2: [0, 255, 0, 255], 3: [0, 0, 255, 255]}[number])
        self.assertEqual(self.errors, [])

    def test_signed_relative_and_absolute_urls_render_with_real_pdfjs(self):
        for absolute in (False, True):
            with self.subTest(absolute=absolute):
                self.open_document(absolute=absolute)
                self.assert_page(1)
        self.page.screenshot(path=str(OUTPUT / (self.engine + "-pdf-rendered.png")))
        self.evidence.append({"test": "real-pdf-render", "status": "passed"})

    def test_buttons_keyboard_and_non_looping_boundaries(self):
        self.open_document(loop=0)
        self.assert_page(1)
        self.page.locator("#next").click()
        self.assert_page(2)
        self.page.locator("#prev").click()
        self.assert_page(1)
        self.page.keyboard.press("PageDown")
        self.assert_page(2)
        self.page.keyboard.press("ArrowRight")
        self.assert_page(3)
        self.page.locator("#next").click()
        self.assert_page(3)
        self.page.keyboard.press("PageUp")
        self.assert_page(2)
        self.page.keyboard.press("ArrowLeft")
        self.assert_page(1)
        self.page.locator("#prev").click()
        self.assert_page(1)

    def test_auto_advance_stops_at_final_page(self):
        self.open_document(auto=500, loop=0)
        expect(self.page.locator("#status")).to_have_text("Page 3 / 3", timeout=15000)
        expect(self.page.locator("#play")).to_have_text("Auto")
        self.assert_page(3)

    def test_loop_pause_and_resume(self):
        self.open_document(auto=1500, page=3, loop=1)
        self.assert_page(3)
        self.page.locator("#play").click()
        expect(self.page.locator("#play")).to_have_text("Auto")
        self.page.wait_for_timeout(1700)
        self.assert_page(3)
        self.page.locator("#play").click()
        expect(self.page.locator("#status")).to_have_text("Page 1 / 3", timeout=10000)
        self.page.locator("#play").click()
        self.assert_page(1)

    def test_missing_url_and_denied_media_show_errors(self):
        self.page.goto(self.origin + "/document-viewer/")
        expect(self.page.locator("#error")).to_have_text("Unable to display document: No PDF specified")
        expect(self.page.locator("#canvas")).to_be_hidden()
        self.open_document(authorized=False)
        expect(self.page.locator("#status")).to_have_text("Error")
        expect(self.page.locator("#error")).to_be_visible()
        expect(self.page.locator("#error")).to_contain_text("401")
        expect(self.page.locator("#canvas")).to_be_hidden()
        self.assertEqual(self.errors, [])
