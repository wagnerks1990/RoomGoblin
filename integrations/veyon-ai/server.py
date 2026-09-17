# SPDX-License-Identifier: AGPL-3.0-or-later
"""Separate local inference service for the pinned Veyon-detection ONNX model."""
import ast
import hashlib
import hmac
import io
import json
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer

MODEL_SHA256 = '06e0beb4adecd05a6d04f5dd9d42669dc3020fe6669f68302ac0ff85e1600b6c'
MAX_IMAGE = 4 * 1024 * 1024
SOURCE = 'https://github.com/wagnerks1990/RoomGoblin/tree/main/integrations/veyon-ai'


class Detector:
    def __init__(self, path):
        import onnxruntime as ort
        if hashlib.sha256(Path(path).read_bytes()).hexdigest() != MODEL_SHA256:
            raise ValueError('Model identity mismatch')
        options = ort.SessionOptions()
        options.intra_op_num_threads = 2
        options.inter_op_num_threads = 1
        self.session = ort.InferenceSession(str(path), sess_options=options, providers=['CPUExecutionProvider'])
        self.names = ast.literal_eval(self.session.get_modelmeta().custom_metadata_map['names'])
        if set(self.names) != set(range(7)):
            raise ValueError('Unexpected model classes')

    def detect(self, raw):
        import numpy as np
        from PIL import Image
        Image.MAX_IMAGE_PIXELS = 8_000_000
        with Image.open(io.BytesIO(raw)) as original:
            if original.format not in ('JPEG', 'PNG') or original.width * original.height > 8_000_000:
                raise ValueError('Unsupported image')
            image = original.convert('RGB')
        width, height = image.size
        scale = min(480 / width, 480 / height)
        resized = image.resize((round(width * scale), round(height * scale)), Image.Resampling.BILINEAR)
        left, top = (480 - resized.width) // 2, (480 - resized.height) // 2
        padded = Image.new('RGB', (480, 480), (114, 114, 114))
        padded.paste(resized, (left, top))
        tensor = np.asarray(padded, dtype=np.float32).transpose(2, 0, 1)[None] / 255
        output = self.session.run(None, {'images': tensor})[0]
        if output.shape != (1, 300, 6):
            raise ValueError('Unexpected model output')
        detections = []
        for x1, y1, x2, y2, confidence, category in output[0]:
            if not np.isfinite([x1, y1, x2, y2, confidence, category]).all() or confidence < 0.5:
                continue
            index = int(category)
            if index not in self.names or category != index:
                continue
            box = [max(0, min(width, round((float(x1) - left) / scale))),
                   max(0, min(height, round((float(y1) - top) / scale))),
                   max(0, min(width, round((float(x2) - left) / scale))),
                   max(0, min(height, round((float(y2) - top) / scale)))]
            if box[2] <= box[0] or box[3] <= box[1]:
                continue
            detections.append({'label': self.names[index], 'confidence': round(float(confidence), 3), 'box': box})
            if len(detections) >= 100:
                break
        return {'ok': True, 'detections': detections, 'width': width, 'height': height,
                'modelSha256': MODEL_SHA256, 'source': SOURCE, 'retained': False}


def handler(detector, token):
    class Handler(BaseHTTPRequestHandler):
        timeout = 10
        def log_message(self, *_args):
            pass  # Never log tokens, paths or student screen data.

        def reply(self, status, result):
            data = json.dumps(result).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Connection', 'close')
            self.end_headers()
            self.wfile.write(data)
            self.close_connection = True

        def do_POST(self):
            if not hmac.compare_digest(self.headers.get('Authorization', '').encode('utf-8'), ('Bearer ' + token).encode('ascii')):
                return self.reply(401, {'ok': False})
            if self.path != '/analyze' or self.headers.get('Transfer-Encoding'):
                return self.reply(400, {'ok': False})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= MAX_IMAGE:
                    return self.reply(413, {'ok': False})
                raw = self.rfile.read(length)
                if len(raw) != length:
                    raise ValueError('Incomplete input')
                self.reply(200, detector.detect(raw))
            except Exception:
                self.reply(422, {'ok': False, 'error': 'Image analysis failed'})
    return Handler


if __name__ == '__main__':
    token_path = Path(os.environ['ROOMGOBLIN_AI_TOKEN_FILE'])
    token = token_path.read_text().strip()
    if len(token) < 32 or len(token) > 256 or not token.isascii():
        raise ValueError('Use a separate random ASCII token of 32–256 characters')
    model = Path(__file__).parent / 'upstream/weights/yolo26n.onnx'
    # One request at a time; fixed loopback listener, no model/path upload API.
    HTTPServer(('127.0.0.1', 3025), handler(Detector(model), token)).serve_forever()
