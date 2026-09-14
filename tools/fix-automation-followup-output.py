#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "public/controller/index.html"
text = path.read_text()

if "morningWatchOfflineConfirmations" not in text:
    marker = '''<label>Announcement Volume<div class="toolbar" style="margin-top:5px"><input id="morningWatchVolume" type="range" min="0" max="100" value="100" style="flex:1" oninput="morningWatchVolumeValue.textContent=this.value+'%'"><span id="morningWatchVolumeValue" class="pill">100%</span></div></label>'''
    advanced = marker + '''<label>Offline confirmations<input id="morningWatchOfflineConfirmations" type="number" min="1" max="8" value="2"></label><label>Check interval (seconds)<input id="morningWatchCheckInterval" type="number" min="10" max="120" value="15"></label><div><label>Announcement targets</label><div id="morningWatchTargets" class="panel" style="box-shadow:none;padding:10px;margin-top:4px"></div></div>'''
    if marker not in text:
        raise SystemExit("Morning Announcements volume marker not found")
    text = text.replace(marker, advanced, 1)

path.write_text(text)
print("follow-up output compatibility fix applied")
