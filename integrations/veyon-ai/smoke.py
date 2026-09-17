# SPDX-License-Identifier: AGPL-3.0-or-later
"""Load the exact model and test the real CPU inference/output contract."""
import io
import sys
from PIL import Image
from server import Detector

image = io.BytesIO()
Image.new('RGB', (640, 360), 'white').save(image, format='PNG')
result = Detector(sys.argv[1]).detect(image.getvalue())
assert result['ok'] and result['retained'] is False
assert result['width'] == 640 and result['height'] == 360
assert isinstance(result['detections'], list)
print('Pinned model CPU inference passed; classroom accuracy unverified.')
