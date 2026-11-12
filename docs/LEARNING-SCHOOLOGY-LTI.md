> Historical reference: the hosted student/companion/launcher apps and old teacher
> URLs described here have been retired. Use `/learn` and
> [Direct assignment API](DIRECT-ASSIGNMENT-API.md) for current delivery.

# Schoology sign-in and grade return

The signed launch opens the discussion under the student's LMS name without a
RoomGoblin password prompt. This delivery is a **Schoology External Tool** item,
not a SCORM-only assignment. SCORM remains available for separately assigned
RoomGoblin accounts; do not create two graded copies of the same discussion.

This implements the **LTI 1.1 compatibility flow** supported by Schoology's
course-level External Tool Providers. It is not a claim of LTI certification,
LTI 1.1.2 relaunch support, LTI 1.3, or App Center registration. A future LTI 1.3
integration would require separate platform registration and qualification.

## One-time setup

1. An existing RoomGoblin administrator opens `/learn/`, creates the class and
   discussion, and selects **Connect Schoology**. Existing account and device
   permissions remain unchanged. Do not create a student roster manually for the
   signed-launch route.
2. Set the exact RoomGoblin HTTPS origin and exact Schoology course origin.
   Generate a shared secret, copy it privately, and save the enabled configuration.
   The secret must have at least 32 characters; the generator uses 32 random bytes.
   RoomGoblin encrypts it in its existing secret store and never returns it on reads.
3. In Schoology, choose **Course Options → External Tool Providers → Add External
   Tool Provider** (or have the district administrator configure the provider).
   Enter the launch URL shown in RoomGoblin, the same consumer key and shared
   secret, and **name sharing only**. Email is unnecessary. Match by URL because
   this configuration belongs to one activity.
4. Add an External Tool material using that provider. Alternatively, import the
   **Download Schoology tool** `.imscc` cartridge and associate its item with the
   provider. The cartridge contains the launch link, not credentials. Set
   **20 possible points**, enable grading, and choose a **new-window launch**.
   Existing controller frame restrictions and administrator cookies stay intact.
5. Open the tool once from Schoology as the instructor. This signed launch binds
   the activity to its exact course and resource-link identifiers. It does not
   create a RoomGoblin administrator or teacher session. The teacher desk uses the
   existing RoomGoblin administrator sign-in.
6. Launch with an assigned synthetic Schoology student. No separate password
   should appear. The first valid launch creates a restricted account and class
   membership; future launches reuse it. Names are drawn from signed LMS fields.
7. Check **Connect Schoology** for grade-service origins observed in signed
   launches. Verify the Schoology endpoint and add its exact HTTPS origin to the
   approved grade-service origins. This authorizes credential-bearing requests;
   it is never populated automatically from browser input. Missing configuration
   leaves the grade saved locally with confirmation pending.
8. Verify a teacher-published synthetic grade, a lower corrected grade, and the
   actual Schoology gradebook. A local score of 14/20 sends 0.7 to the LTI outcome
   service and must display as 14 points in the 20-point assignment. Keep model
   grading disabled until the separate model calibration passes.

The original posted due/cutoff rules still apply. Configure actual times rather
than inventing them from the lesson date. Removing a membership or disabling a
student account denies future launches; signed launches never restore that access.
Create a separate RoomGoblin class for another Schoology course. Multiple activities
within one class must bind to the same platform and course. A copied material in
that same course needs a new activity because its resource-link identifier changes.

## Authentication and privacy

Each launch requires the configured exact browser Origin, exact launch URL,
consumer key, HMAC-SHA1 signature, five-minute timestamp window, and a persisted
one-use nonce. Duplicate/nested parameters, unsupported roles, wrong course/link
identifiers, invalid signatures, and replay are rejected. The nonce store survives
restart. Browser Origin is required to reject copied launch forms from other sites.
Only signed instructors may perform the first course binding; only signed learners
receive student sessions. A signed instructor role never grants appliance access.

The LMS subject is hashed with the configured platform identity and scoped to the
RoomGoblin class. No raw LMS user ID or email is retained. A missing LMS name uses
`Student`; full-name sharing must be enabled for named posts. The name is display
data, not a lookup key. Names and outcome identifiers are excluded from model
prompts, URLs, and audit details. Class members can see display names on posts.

LTI creates a separate, HttpOnly learning cookie lasting up to eight hours. It is
Secure on HTTPS and SameSite=Lax for the signed POST/redirect flow. It is honored
only under `/learn/` and `/api/v1/learning/`, and only for enabled restricted student
profiles. It does not replace the native administrator cookie or authenticate
controller, maintenance, device, or native account-management APIs. The normal
learning mutation header and same-origin checks remain required. The dedicated
signed launch is the sole exception to native-cookie CSRF middleware.

Disabling an integration stops new launches; close the activity or remove access
to stop existing sessions from participating. Existing native account disabling
and session revocation controls continue to apply. Integration configuration and
all table writes participate in the existing Full Recovery freeze/drain boundary.

## Grade return

Only a current server-approved rubric grade can be sent. New published grades and
teacher corrections automatically attempt LTI `replaceResult`; browser-supplied
scores are ignored. Requests for one student/activity are serialized and deduplicated
against the review revision and score. There is no detached retry worker. The
student's **Check Schoology grade** action safely retries the current grade.

The signed launch supplies the outcome URL and opaque result target. Before any
network request, the server requires an administrator-approved HTTPS origin, no
credentials in the URL, normal TLS validation, and freshly resolved public IPv4
addresses pinned into the connection. Redirects are never followed. DNS is bounded
to three seconds; the request/body deadline is eight seconds; responses are capped
at 64 KiB. OAuth signs both the URL parameters and XML body hash. XML responses must
be well formed, contain no DTD/entities, and confirm the matching message and
operation. `fast-xml-parser` is pinned in the lockfile for bounded response parsing.
No upstream response body or credentials are exposed to students.

Failure preserves the RoomGoblin grade and shows unconfirmed delivery. No success
is claimed from HTTP status alone. Revisions invalidate a local receipt until a
fresh grade is published; they do not delete a previously delivered LMS grade.

## Validation and rollback

Run the supported Linux full suite and:

```sh
node --test test/learning-lti.test.js test/learning.test.js test/learning-scorm.test.js
node test/browser/learning-lti-smoke.cjs
node test/browser/learning-smoke.cjs
```

Browser tests use synthetic signed launches, accounts, model responses, and outcome
services. They do not establish live Schoology permissions, name sharing, launch
behavior, or gradebook results. Keep those acceptance checks explicit.

Deploy only with the normal exact-main updater and its matching operational
backup. Tables are additive; retain the database, master key and previous images.
Disable signed launches and close the activity for a feature rollback; do not
delete learning tables or downgrade the core schema. Classroom controls and model
storage are outside this feature's deployment changes.

References: [Schoology course-level tools](https://uc.powerschool-docs.com/en/schoology/latest/course-materials-external-tools),
[LTI launch validation](https://developers.imsglobal.org/wiki/step-2-valid-lti-launch-request),
[LTI 1.1 implementation and outcomes](https://www.imsglobal.org/specs/ltiv1p1/implementation-guide),
[OAuth 1.0 signing](https://www.rfc-editor.org/rfc/rfc5849).
