"""Public CI diagnostics only; image revisions remain the deployment authority."""
import json
import re
import sys
import urllib.request

REQUIRED = {"Validate", "Display browser regression", "Android TV Display Agent",
            "Restrictive image permissions", "Security gates", "Publish Main Images"}
FAILED = {"failure", "cancelled", "timed_out", "action_required", "stale", "skipped"}


def classify_runs(payload, revision):
    if not isinstance(payload, dict) or not isinstance(payload.get("workflow_runs", []), list):
        raise ValueError("invalid CI response")
    latest = {}
    for run in payload.get("workflow_runs", []):
        if not isinstance(run, dict):
            raise ValueError("invalid workflow response")
        name = run.get("name")
        event = "workflow_run" if name == "Publish Main Images" else "push"
        if name not in REQUIRED or run.get("head_sha") != revision or run.get("event") != event:
            continue
        rank = (run.get("id", 0), run.get("run_attempt", 1))
        if name not in latest or rank > latest[name][0]:
            latest[name] = (rank, run)
    for name in sorted(latest):
        run = latest[name][1]
        if run.get("status") == "completed" and run.get("conclusion") in FAILED:
            return 2, f"Publication blocked: {name} {run['conclusion']}."
    return 0, "Images are not available yet; waiting for CI publication."


def main():
    revision = sys.argv[1] if len(sys.argv) == 2 else ""
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        return 1
    url = ("https://api.github.com/repos/wagnerks1990/RoomGoblin/actions/runs"
           f"?head_sha={revision}&per_page=100")
    try:
        request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json",
                                                       "User-Agent": "RoomGoblin-installer"})
        with urllib.request.urlopen(request, timeout=8) as response:
            data = response.read(2_000_001)
        if len(data) > 2_000_000:
            raise ValueError("oversize CI response")
        code, message = classify_runs(json.loads(data), revision)
    except (OSError, ValueError, TypeError, KeyError):
        code, message = 0, "CI status unavailable; still checking the exact image pair."
    print(message)
    if code == 2:
        print("See https://github.com/wagnerks1990/RoomGoblin/actions")
    return code


if __name__ == "__main__":
    sys.exit(main())
