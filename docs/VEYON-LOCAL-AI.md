# Local Veyon-detection pilot

**Analyze screen locally** captures one selected computer on explicit confirmation
and sends it to a separate authenticated service bound to `127.0.0.1:3025`. The
browser shows the model's class labels and confidence estimates. No screenshot,
result archive, cloud upload, background monitoring or automatic student action
is added. Both `lab.control` and `lab.sensitive.read` are required. The Hub allows
one analysis at a time and six requests per minute; input is at most 4 MiB and
output at most 100 detections. Analysis is disabled without a separately configured
token. Do not use model output alone to make disciplinary decisions.

This integrates the pinned model from **vainmari/Veyon-detection**, using a separate
AGPL service. It is a bounded inference adapter, not that project's full NiceGUI
application, reports, scheduler or model-training UI. The native Veyon WebAPI
framebuffer is sufficient; this addon does not require RoomGoblinWebBridge.
Original labels are retained, including Lithuanian labels. No accuracy or
classroom suitability claim is made. The service uses CPU inference with two
threads and a fixed model identity. Arbitrary model uploads are not supported.

## Prepare a disposable pilot

Use Python 3.12 on the same disposable Linux host as the Hub and Veyon WebAPI:

```bash
python3 integrations/veyon-ai/prepare.py /tmp/roomgoblin-ai-pilot
python3 -m venv /tmp/roomgoblin-ai-pilot/.venv
/tmp/roomgoblin-ai-pilot/.venv/bin/pip install -r /tmp/roomgoblin-ai-pilot/requirements.txt
```

The preparer verifies upstream source and model hashes and retains corresponding
source/licenses. It never installs a service, copies Veyon keys or starts the
upstream application. Dependency versions are pinned. The service and model stay
outside the MIT Hub image. Keep the full prepared source alongside any deployment
and make the corresponding modified source available to service users under AGPL.

Create a separate random token of at least 32 ASCII characters in a private file.
Set the same value as `VEYON_AI_TOKEN` in the disposable Hub's protected environment
and recreate the Hub through its normal deployment process. Do not reuse Veyon
keys, login passwords or the maintenance token. Start the service as an unprivileged
user, supplying only the token file path:

```bash
ROOMGOBLIN_AI_TOKEN_FILE=/path/to/private/ai-token \
  /tmp/roomgoblin-ai-pilot/.venv/bin/python /tmp/roomgoblin-ai-pilot/server.py
```

The service listens only on fixed loopback port 3025 and serves one request at a
time. Host-networked Hub containers can reach it; do not expose it through a public
proxy. Keep the console process visible during testing. Stop it with Ctrl+C and
clear `VEYON_AI_TOKEN` to disable the integration. There is no production service
installer or automatic managed-container deployment in this change.

Select one test computer, press Analyze screen locally and confirm. Compare the
result with its physical screen. Test missing service, wrong token, unsupported
image, timeout and access denial. No result is proof of cheating or a substitute
for human review. Model training, continuous observation and storage/retention
would need separate operator controls and validation before being enabled.

## Verification

The actual pinned ONNX model was loaded with the pinned CPU runtime and run on a
synthetic white image; it returned no detections. This verifies loading and output
shape, not detection accuracy. Unit tests exercise service authentication, fixed
routes, input/output bounds, concurrency, model identity and disabled configuration.
CI also runs the real model smoke test. Real classroom and Windows endpoint tests
remain outstanding.

See [service provenance](../integrations/veyon-ai/PROVENANCE.md) for hashes, licenses
and the preserved upstream source. The GUI displays the source link with results.
