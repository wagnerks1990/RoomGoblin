# Learning discussions

Subnet Case Files adds a 20-point shared IPv4 discussion at `/learn/`. Students use
restricted accounts, publish explanations and peer responses, receive
automatic feedback under the configured teacher response name, and receive a
published rubric score. Signed Schoology External Tool launches automatically supply
student access and names, with server-side grade return. SCORM remains a separate
delivery option for assigned accounts. Teachers can participate, moderate, correct feedback, and override
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

See `docs/LEARNING-SCHOOLOGY-LTI.md` for the one-time provider configuration,
teacher-first launch, name sharing, grade-service approval, acceptance and rollback.
Student password prompts are unnecessary on the signed-launch route; an uploaded
SCORM ZIP alone does not authenticate a student.
