# Learning discussions and SCORM

Development feature: `/learn/` provides a shared discussion board, automatic
writing feedback, rubric scores, and teacher corrections. This first activity is
**Subnet Case Files**, IT II Unit 3 Class 02, worth **20 points**. The server stores
the discussion in RoomGoblin's existing SQLite database; SCORM is a launcher and
grade bridge, not the discussion database. No production deployment is implied.

## Classroom workflow

1. Sign in at `/learn/` with an existing administrator account. Create a class,
   restricted student accounts, and class memberships. Use discussion aliases;
   distribute credentials privately. Students can change their own password.
2. Add the discussion and set the actual due time and next-class cutoff, including
   timezone. Blank dates do not invent a deadline. Per-member exemptions represent
   the teacher's preapproved exceptions. Closing an activity stops new student work.
3. Configure the grading service as an administrator. Automatic publication is
   enabled by default when the service is enabled. A student explanation or reply
   triggers a rubric assessment and a short public response under **Mr. Wagner**.
   Directions disclose automatic feedback; no AI Coach persona appears on the board.
4. Students write a 4–6 sentence explanation and a 2–3 sentence peer reply. When no
   peer initial post is available, the alternate gateway critique is available.
   Progress markers recognize evidence, a response, and a published score. Speed,
   likes, and post volume never add points.
5. Teachers can reply, hide/restore posts, correct automatic responses, and override
   scores with criterion feedback. Automatic provenance remains visible to teachers.
   There is no required approval queue unless automatic grade publication is disabled.

The rubric is claim **0/3/6**, evidence **0/3/6**, reasoning and limit **0/2/5**,
and reply **0/1/3**. Missing replies earn zero even if a provider returns another
value. Late work receives half the earned score once; possible points remain 20.
The grading request time is used for the late calculation. A revised submission
after the deadline may therefore be late. Teacher overrides can waive the penalty.

## Ollama on the RoomGoblin host

Recommended starting configuration for the owner's RTX 3060 12 GB is
`qwen3.5:9b`, subject to actual calibration and concurrent classroom workload tests.
Open WebUI is optional for administrator experimentation; the discussion service
connects directly to Ollama, without sending posts through Open WebUI.

In **Grading service settings**, use:

| Setting | Value |
|---|---|
| Provider | `ollama` |
| Endpoint | `http://127.0.0.1:11434/api` |
| Model | `qwen3.5:9b` |
| API key | Blank for the normal local Ollama service |
| Automatic publication | `true` after calibration |
| Enable service | `true` after qualification |

The native adapter sends an explicit JSON schema, temperature 0, `think:false`,
a 16,384-token context, and a 2,500-token output ceiling. It ignores thinking
output, has a 60-second deadline per inference, rejects incomplete/invalid scores, and
never silently switches to a cloud provider. A conservative byte budget rejects
overlong input before inference instead of silently truncating student evidence.
The saved work remains available for teacher review.

For local-only processing, the Ollama service must disable cloud features with
`OLLAMA_NO_CLOUD=1`. Loopback alone does not guarantee that an Ollama model is local:
Ollama can also forward cloud-model requests. Preserve existing model storage and
service ownership. Suggested starting resource controls are one parallel request,
one loaded model, and a small bounded queue. Deployment and service restarts require
the owner's authorization and must not interrupt classroom controls.

RoomGoblin's documented host-network core can reach the host loopback listener.
Other container arrangements require an explicitly reviewed network path. Do not
expose the Ollama API publicly or broaden RoomGoblin control access for students.
Only literal loopback HTTP endpoints with a nonprivileged port are accepted.

Other explicit choices remain available: `local` uses an OpenAI-compatible
`/v1/chat/completions` endpoint, and `openai` uses OpenAI Responses with `store:false`.
Compatible local services must configure adequate context themselves. Provider
keys are encrypted in RoomGoblin secret storage, never embedded in SCORM or sent
to students. Selecting a local provider never sends the OpenAI key to it.

Official references: [Ollama chat API](https://docs.ollama.com/api/chat),
[structured outputs](https://docs.ollama.com/capabilities/structured-outputs),
[local-only configuration](https://docs.ollama.com/faq), and
[Qwen 3.5 9B](https://ollama.com/library/qwen3.5:9b). A model's download size is not
its complete GPU runtime requirement.

## Qualification before student use

From this checkout, with Ollama reachable on the same host:

```sh
node tools/calibrate-learning.cjs --model qwen3.5:9b --warmup
```

This sends six synthetic examples: complete work, no reply, agreement only,
incorrect reasoning, attempted grading instructions, and missing limitations.
It prints criterion matches, duration, and the public response. It makes no
database or gradebook changes. Review both rubric judgments and response wording;
repeat the calibration and test concurrent load before enabling student use.
Fixture checks and mocked provider tests do not establish semantic grading quality.
Changing the model, quantization, prompt, or Ollama version requires recalibration.

The initial explanation and reply are evaluated in separate inference calls, so
reply quality cannot replace initial-post points. Full reasoning credit also
requires a literal evidence-limit quote from the initial writing; invented quotes
are rejected. One graded submission uses one call, or two when it includes a reply.
This reduces one observed failure mode; it does not prove all judgments correct.

Automatic grading is triggered by saved submissions/revisions; this is not
continuous surveillance or an autonomous misconduct detector. It does not inspect
other websites, devices, private messages, or unrelated classes. Teacher moderation
is available; no automatic safety classification or authorship detection is claimed.

## Schoology setup

Download the configured ZIP from the activity's teacher controls. Import it as
SCORM 1.2, configure **20 possible points** and a numeric score, and set availability
and attempt settings in Schoology. The bridge reports 0–100: **14/20 becomes 70**.
Keep the separate Do Now, lab, CFU, and provider reviews as separate activities.

The launcher opens the authenticated RoomGoblin activity in a companion window.
This avoids third-party cookie and iframe restrictions. Allow the exact launcher
origin shown in the SCORM page in the administrator settings; Schoology content
may have a different origin from the course page. Wildcards are not allowed.
Both windows must remain open. The student selects **Send published grade to
Schoology**, returns to the launcher, and waits for the LMS saved confirmation.
Failed commits remain retryable. Reopen and sync again after a teacher correction.
No automatic background SIS or LMS grade passback is implemented.

The bridge validates popup source, exact origin, random nonce, activity, and score
range. It uses the authenticated user's server receipt, never a browser-submitted
rubric score. Nevertheless SCORM runs in the learner's browser: this is not
cryptographic grade attestation or an LTI identity binding. Confirm the assigned
RoomGoblin account and LMS learner match. Live Schoology popup, resume, latest-score,
grade mapping, and Student View acceptance remain separate required checks.

## Access, persistence, and failure behavior

- Restricted student profiles can only access assigned learning classes and their
  own authentication endpoints. Editing that profile cannot grant appliance rights.
  Administrators create accounts and assign teachers; teachers operate only in
  classes to which they belong. Removed membership takes effect immediately.
- Student posts are plain text. No roster/account names go into model prompts,
  but anything students themselves type can be included. Initial writing, the
  chosen reply, and its peer context go to the explicitly configured provider.
  Scores and criterion feedback are private; board responses are public to class members.
- SQLite retains posts, current revisions, immutable grading snapshots, model IDs,
  results, teacher overrides, and metadata audit events. Hiding/removing access is
  not deletion. There is no automatic retention purge; agree on school retention
  and backup access before real student data enters this feature.
- Concurrency is bounded to two grading requests and one per student. Limits are
  five graded submissions per student per 24 hours plus a configurable deployment
  budget in submissions (up to two inference calls each). Busy submissions stay saved and retry while the activity remains open
  in the browser. Service failures and exhausted budgets require a later retry or
  teacher review. There is no durable unattended background job worker.
- Revision fingerprints prevent stale results from grading newer writing. Hidden
  evidence invalidates receipts. A process restart preserves work but marks any
  interrupted request unavailable, avoiding automatic duplicate calls.
- All mutations honor the existing Full Recovery freeze and active request drain.
  Tables are additive within the existing database; whole-database backups include
  learning data. Do not downgrade the existing core schema or delete these tables.

## Release and rollback

Before deploying, retain a verified full recovery backup and the previous application
version. Keep grading disabled until calibration and student/LMS qualification pass.
The immediate rollback is to disable the learning service and activity availability;
if application rollback is necessary, redeploy the previous reviewed application
without replacing the database, master key, or model storage. Keep saved learning
tables intact. No production database restore or destructive migration is needed
merely to hide this additive feature.

Local checks: `npm run check`, `node --test test/learning.test.js`,
`node test/browser/learning-smoke.cjs`, and `node tools/calibrate-learning.cjs --check-fixtures`.
On Windows run the supported full suite through
`py -3.11 C:\ChatGPT\Workspace\Tools\RoomGoblin-LinuxTests.py`.
Browser tests use synthetic accounts, a synthetic model, and a synthetic LMS.

