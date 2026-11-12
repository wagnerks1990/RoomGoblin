# Data-defined SCORM discussion

Create discussion and written assignments through the reusable assignment API.
Prompts, rubric, feedback display name and clipboard policy are authored data;
new lesson content needs no assignment-specific backend code. Private grading
references stay server-side; existing templates remain supported.

The password-storage example supplies the scenario, peer/independent route and
8/6/2/4 rubric totaling 20. Instructions disclose automatic processing; internal
records preserve provenance and detailed grade feedback stays private. Conversation
follow-ups do not replace scored replies or trigger unrestricted AI chat.

Clipboard restrictions are a deterrent, not proof of authorship. SCORM identity is
reported attribution. LMS score saves require the SCO to be open or reopened.

See docs/LEARNING-CRYPTO-DISCUSSION.md and examples/assignments/it3-password-storage.json
for authoring, API routes, testing and rollback. Fixture ZIPs are local tests only.
Export a live package after authorized deployment and check Schoology Student View.
