# Learning discussions

Subnet Case Files adds a 20-point shared IPv4 discussion at `/learn/`. Students use
restricted assigned accounts, publish explanations and peer responses, receive
automatic Mr. Wagner feedback, and can sync a published rubric score through a
SCORM 1.2 launcher. Teachers can participate, moderate, correct feedback, and override
scores. Activity directions disclose automatic processing.

Ollama is the preferred local service for this deployment; Open WebUI is optional.
Use the native `ollama` provider, a loopback `/api` endpoint, and a calibrated model.
The first candidate is `qwen3.5:9b`. No model is assumed trustworthy for grading
solely because it returns valid JSON. Synthetic rubric calibration and live
Schoology acceptance are separate checks.

See the repository's `docs/LEARNING-DISCUSSIONS.md` for full setup, privacy,
late-policy behavior, resource limits, qualification, failure behavior, and rollback.
The implementation is additive and must not grant students appliance access or
alter classroom displays. Source documentation does not imply live deployment.
