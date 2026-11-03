# IT I operating-system discussion

The existing written discussion workspace now supports the additional fixed case
`it1-u03-c01-os-selection-v1`: **OS Selection: Requirements Before Price**.
It retains shared initial posts, peer and teacher replies, asynchronous AI
assessment, private grading feedback, teacher corrections, and signed Schoology
grade return. It does not use arcade movement or multiple-choice gameplay.

The case uses the original IT I Class 01 prompt: a Windows-only application,
domain join, 16 GB RAM, and a colleague selecting editions by appearance. The
original 20-point allocation remains reasoning **0/4/8**, vocabulary **0/2/4**,
limitation **0/1/3**, and peer or independent-case improvement **0/2/5**. An initial
post can earn 15 points; the written response supplies the remaining five.
Sentence counts guide writing and are not scored mechanically.

The teacher chooses **Discussion case** when adding an activity. Each stored
template ID selects its prompt, alternate case, score tiers, AI schema, and
feedback. Existing IPv4 activities retain their identifiers, posts, and 6/6/5/3
rubric. Do not change an existing activity's template or overwrite prior grades.
Create a separate OS activity in each assigned class and use its signed Schoology
tool. The class's existing provider configuration can be retained; the new
activity needs its own resource-link binding. Follow
[signed Schoology delivery](LEARNING-SCHOOLOGY-LTI.md).

Models classify evidence and cite sentence IDs; application code assigns points
and selects public responses. Unknown templates, malformed references, and
ambiguous evidence fail closed for teacher review. Peer writing cannot supply
credit for the student's initial post. AI feedback is disclosed in the student
directions. Assessments remain correctable by the teacher.

Before opening the activity, run the synthetic calibration fixtures against the
configured model and compare each criterion, then verify the actual Schoology
gradebook with an authorized learner. Fixtures and local HTTP/browser checks do
not establish live provider acceptance. Keep the discussion game unpublished
after the replacement is ready; retain existing student work and grades.

This discussion uses the authenticated public student service. It does not need
the private classroom-presence window, which is a separate requirement for room
leaderboards and physical effects. No network or presence rules change here.

Reference facts were checked against Microsoft documentation:

- [Upgrade Windows Home to Windows Pro](https://support.microsoft.com/en-gb/windows/deployment/install-upgrade/upgrade-windows-home-to-windows-pro)
- [Join a computer to a domain](https://learn.microsoft.com/windows-server/identity/ad-ds/manage/join-computer-to-domain)
- [Windows 11 requirements](https://learn.microsoft.com/en-gb/windows/whats-new/windows-11-requirements)

No release or production configuration is implied by this source change. Rollback:
close new OS activities before restoring prior application code, retain all
activity/post/review tables, and use the native exact-commit updater with its
backup. Do not reset or downgrade the database.
