# Automatic SCORM grade recovery

Create current [direct API packages](DIRECT-ASSIGNMENT-API.md) in `/learn`.
The old hosted discussion, companion and launcher apps are removed. Old launcher
exports return 410; they do not redirect or create credentials.

Writing and grading jobs commit before inference. Feedback can finish after the
student or teacher closes their browser. Teacher rubrics, publication settings,
access checks, bounded model output and private participant scope remain
mandatory. Teachers can correct grades; AI never overwrites a teacher review.

The LMS-hosted package restores its private capability from SCORM suspend state.
It retrieves the saved review and applies the score through the native LMS API
when open or reopened. Iframe and native LMS popup launches are supported; the
latter finds the LMS API in its opener and creates no companion window. Native
exit is marked suspended before committing private resume data.

Unchanged receipts do not repeat grade commits. Failed native commits retry while
the attempt is open. Preview/review modes do not create a participant or write a
grade. Changing the LMS learner clears private writing and stops stale delivery.

Server grading needs no open browser. A browser-native SCORM API cannot be written
after its window closes. This does not add Schoology REST gradebook access.
Reported names or IDs cannot recover a lost private capability.

Signed identity protocols and date-based receipts remain backend security
contracts, without the retired web apps. An authorized fresh start removes old
records and enrollment keys; see [Learning fresh start](LEARNING-FRESH-START.md).
