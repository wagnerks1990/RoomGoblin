# Android enrollment form and result ownership

[Finding classification and immutable source locations](finding-metadata.md#android-enrollment-ownership).

RG-LAB-021 reproduces an accepted Android enrollment followed by a null
currentTarget/reset error. In the real-browser fixture exactly one request was
accepted, the pairing field stayed populated and the device editor never opened.
The first probe used an unavailable ADB fixture and could not submit; after making
that synthetic bridge available, the application failure reproduced. The initial
eight-case source fixture fails all eight assertions against old source.

The handler captures its form before awaiting the server. One pending enrollment
survives redraws and rejects duplicate or unavailable-bridge admission. The
submitted pairing code is cleared immediately and its local payload field is
cleared when the request settles. A newer code or enrollment draft stays intact.
Only an unchanged draft and editor context can open the accepted device editor.
A missing device identity reports an unconfirmed reply without retrying; inventory
follow-up failure preserves the accepted outcome and asks for a refresh.

All ten source cases and three browser cases pass. Browser coverage includes
mobile form/editor layout, pending refresh, duplicate submission, newer drafts,
concurrent editing, rejected/incomplete replies and no automatic replay. The
original browser reproduction now shows a cleared pairing field and an open new
device editor with no page errors. Combined qualification passes 2,220 supported
Linux tests with two root-only skips, all 23 Host Recovery cases, and all 106
workspace cases in each of Chromium and Firefox. No real Android device was
paired, probed or controlled. Existing ADB identity, APK signer, receiver and
maintenance boundaries remain unchanged. Required checks, exact publication and
backed-up appliance verification precede delivery.

Android inventory/status ownership, editor completion and preview lifetime remain
under review. Ubuntu wizard probe/input ownership also remains open in Group 10.

Initial combined qualification found one stale source assertion (the accepted
response was renamed from `j` to `result`); it now follows the new identifier,
with the ten behavioral cases independently checking enrollment ownership.
That run recorded 2,219 passes, one failure and two skips. Chromium passed all
106 workspace cases. Firefox recorded 105 passes and one timeout in the existing
Windows enrollment authorization case before any enrollment request was sent.
An isolated run passed, but repetition reproduced the failure. Pointer/focus and
resize tracing showed the lazy Veyon iframe above enrollment replacing its
820px fallback height with 814px while the test clicked; the click reached the
frame. The enrollment fixture now waits for the complete iframe's actual natural
height. All 20 repeated authorization cases then passed. Fresh Linux and browser
qualification passed with the totals above; the initial failures remain recorded.
