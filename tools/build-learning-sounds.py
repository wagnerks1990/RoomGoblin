"""Generate small original celebration cues without external media dependencies."""
from pathlib import Path
import math
import struct
import wave

destination = Path(__file__).resolve().parents[1] / 'public/learn/effects'
destination.mkdir(parents=True, exist_ok=True)
for name, notes in {'chime': [660, 880], 'success': [523.25, 659.25, 783.99], 'milestone': [392, 523.25, 659.25, 783.99]}.items():
    samples = []
    rate = 22050
    duration = .22
    for frequency in notes:
        for i in range(int(rate * duration)):
            seconds = i / rate
            envelope = min(1, seconds / .015) * max(0, 1 - seconds / duration) ** 2
            samples.append(int(6500 * envelope * math.sin(2 * math.pi * frequency * seconds)))
    with wave.open(str(destination / (name + '.wav')), 'wb') as sound:
        sound.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        sound.writeframes(struct.pack('<' + 'h' * len(samples), *samples))
