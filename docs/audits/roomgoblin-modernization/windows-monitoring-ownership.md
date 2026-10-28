# Windows monitoring request ownership

Baseline: qualified Windows inventory repair `a225c26`.

RG-LAB-004 reproduced five actual-source failures: old browser history or its
error replacing another view, saved screenshots crossing computer identity,
late save completion labeling a different computer as saved, and an old image
remaining visible under a new computer while its capture was pending.

History/profile and screenshot-history reads now retain their computer, dialog
generation and request generation. Close/Escape clears sensitive content and
invalidates pending results; a queued native close event cannot clear a reopened
dialog. Screen changes clear the previous frame. Capture errors are contained,
delivery must identify the requested computer, and feedback distinguishes an
accepted request from confirmed image/save completion. Existing command routing,
permissions, retention and single-flight ordinary refresh remain unchanged.

All 20 new Node regressions and 39 focused cases pass. Three Chromium cases pass
for history ownership across Escape, clearing images during computer changes,
and undelivered captures without false saved feedback. Full Linux qualification
passes 2,122 tests, zero failures and two root-only skips (2,124 total), plus all
23 Host Recovery tests and syntax/controller checks. All 89 workspace and nine
Veyon command-page cases pass in both Chromium and Firefox.
The first Chromium run checked cleanup before the queued native close event;
the test now waits for the required cleanup. The first Firefox run exposed
collapsed-select inner-text differences; it now checks the same option content
through textContent. Neither adjustment removes an assertion.
Transports are fixtures; no student history, actual
capture, classroom command or live agent was used. Hidden-frame capture lifecycle,
other monitoring controls and managed-device review remain separate open work.
