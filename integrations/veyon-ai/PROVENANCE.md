# Local AI pilot provenance

Upstream: https://github.com/vainmari/Veyon-detection at
`db02a70439aad0c21e93de51d37761e082a9c393` (AGPL-3.0-or-later).
The preparer retains the full upstream source and license. It verifies the
bundled `weights/yolo26n.onnx` SHA-256
`06e0beb4adecd05a6d04f5dd9d42669dc3020fe6669f68302ac0ff85e1600b6c`.
The model metadata itself declares AGPL-3.0 and Ultralytics authorship.

RoomGoblin's separate AGPL adapter runs this exact end-to-end detector with CPU
ONNX Runtime, fixed 480-square letterboxing and a 0.5 confidence threshold.
It preserves original model labels, including Lithuanian labels. No accuracy,
cheating determination or disciplinary conclusion is established by detection.
It is not the complete upstream NiceGUI dashboard, scheduler or training service.
No screenshots or detections are retained, and no automatic enforcement is added.

The MIT Hub communicates with this separate authenticated loopback process via
HTTP. Distribute the complete corresponding source, this adapter and COPYING
with the pilot. Source links remain visible in the browser result.
