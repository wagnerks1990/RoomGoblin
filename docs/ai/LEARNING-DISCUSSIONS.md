# Learning discussion implementation context

Read [operator documentation](../LEARNING-DISCUSSIONS.md) before modifying learning.
`src/learning.js` owns additive SQLite tables, class ACLs, moderation, snapshots,
automatic publication, teacher overrides, budgets, and receipt/download routes.
`src/learning-grader.js` owns the fixed activity, rubric schema, reference facts,
prompt, provider transport, deadlines, and validation. `/public/learn/` is isolated
from the appliance controller; `/public/learn/scorm/` is a credential-free launcher.

Preserve restricted profile denial even if profile configuration contains `*`.
Keep the global student gate before appliance routes. Membership alone must not
preserve teacher access after an account is downgraded. No student-authored teacher
or automatic posts, browser-supplied final grades, self enrollment, or cross-class
queries. Normal native login, password security, CSRF protections, and recovery
writer drain remain in effect. Only `/learn` relaxes COOP to retain a companion
window opener; controller headers and frame restrictions remain unchanged.

Automatic replies use the administrator-configured public response name,
with automatic rubric publication when enabled. Never hardcode a deployment identity. Directions disclose automatic processing; teacher provenance
and correction remain available. Do not invent personal teacher observations or
claim the model has tested network devices. Keep scoring separate from misconduct,
authorship, disability, and writing dialect. Public response generation must not
expose private grades. Prompt defenses are not proof of perfect injection resistance.

Use native Ollama `/api/chat` for `ollama`, OpenAI-compatible chat for `local`,
and Responses for `openai`. Local-only URLs are literal loopback, with no redirects.
Never forward the cloud key to a local provider or silently fall back to cloud.
Ollama server-side cloud disabling is a separate deployment requirement.
Thinking output is neither shown nor persisted. Invalid/overlong/incomplete results
leave writing saved without a fabricated grade. Maintain model calibration fixtures.

SCORM is percentage reporting to a separately configured 20-point LMS activity.
It is not LTI authentication or signed SIS passback. The separate `learning-lti.js`
module implements signed External Tool launches and server-to-server outcomes;
read [its setup and security contract](../LEARNING-SCHOOLOGY-LTI.md). Preserve exact
Origin/signature checks, persistent nonce rejection, teacher-first course binding,
restricted learning-only sessions, administrator-approved outcome origins, public
DNS pinning and serialized current-grade delivery. Never treat a signed instructor
role as a native administrator session or let stale responses confirm new targets.
Every signed activity in a RoomGoblin class must bind to the same LMS platform and
course; verify this within the enrollment transaction before granting membership.
No real learner data belongs
in repository tests, screenshots, logs, or calibration fixtures. Preserve the
native Linux suite and focused access/race/provider/browser regressions.


The model evaluates initial writing and replies separately. Missing replies are zero;
full reasoning credit needs a verbatim limitation quote from the initial writing.
Keep this separation and evidence validation. Treat the calibration report as
version-specific evidence, not a guarantee. Inference tests were paused after a
94 C GPU reading; final full-model qualification remains incomplete.

Optional SCORM names update only the authenticated student's class alias.
Check popup source, exact allowlisted origin, nonce and activity; keep names out
of URLs, model prompts and audit details. Names are untrusted display data, never
authentication, account matching, roster enrollment or permission evidence.
Unsupported names must not block participation.
