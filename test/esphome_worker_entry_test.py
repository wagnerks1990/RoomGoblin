"""Regression tests for the production ESPHome worker entry point."""
import json
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]


class WorkerEntryTests(unittest.TestCase):
    def test_blank_key_configuration_does_not_recurse(self):
        request = {
            "op": "configure",
            "requestId": "entry-blank-key",
            "devices": [{
                "id": "fixture",
                "generation": "fixture-generation",
                "address": "10.200.0.8",
                "port": 6053,
                "key": "",
                "mac": "02:00:00:00:00:01",
            }],
        }
        result = subprocess.run(
            [sys.executable, "-u", str(ROOT / "src/esphome/worker_entry.py")],
            input=json.dumps(request) + "\n",
            text=True,
            capture_output=True,
            timeout=10,
            cwd=ROOT,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        messages = [json.loads(line) for line in result.stdout.splitlines() if line.strip()]
        response = next(message for message in messages if message.get("requestId") == "entry-blank-key")
        self.assertTrue(response["ok"], response)
        self.assertNotIn("RecursionError", result.stderr)


if __name__ == "__main__":
    unittest.main()
