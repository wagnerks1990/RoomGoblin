# Finding metadata reconciliation

This supplement completes the metadata of condensed audit notes. Existing IDs are
preserved; cross-references do not create duplicate findings. Newly assigned IDs
identify previously unnumbered observations, not new defects found during this
documentation pass. Priority, complexity and compatibility risk below are
retrospective assessments of the recorded repair, not historical timestamps.

Each linked note supplies the implementation before and after repair, concrete
evidence, problem, recommendation and verification outcomes. The benefit below
summarizes that repair. Confidence applies to the reproduced behavior, not to
physical device acceptance. Delivery status comes from the [audit index](README.md)
and its receipts; historical pending text in a note is preserved as evidence.

Locations are exact changed source ranges at the immutable **repair revision**
shown, validated against that Git object. They locate the implementation to
review; they do not silently replace a note's original failure baseline or claim
line-by-line coverage of the enclosing file. Several findings repaired together
share file ranges. Tests have test-source locations. The destination-policy
CodeQL #411 false positive is explained in its note and is not a product defect.

Small, low-risk entries are the implemented quick wins. No open recommendation
is implied by this retrospective list; acceptance limits remain explicit in
[final integration](final-integration.md).

<a id="account-dialog-focus"></a>

## Account dialog initial focus

**Finding ID:** RG-AUTH-FOCUS-001. **Subsystem:** Navigation and account dialog.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Small.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Account dialog initial focus](account-dialog-focus.md).
**Expected benefit:** Keep keyboard focus on the operator's selected field.
**Repair revision:** `0f24c99394bb4bd9dbaed887e94cb3b6a81b0436`.

**Location:**

- [public/controller/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/0f24c99394bb4bd9dbaed887e94cb3b6a81b0436/public/controller/app.js#L2407): 2407.

<a id="android-activity-assignment"></a>

## Android activity display assignments

**Finding ID:** RG-LAB-038. **Subsystem:** Android managed displays.
**Category:** Correctness. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android activity display assignments](android-activity-assignment.md).
**Expected benefit:** Reject obsolete receiver assignments without replacing the current activity.
**Repair revision:** `8fcdc8b93d6e8e7d5534bf7ecafd89068e0345b6`.

**Location:**

- [agents/android-tv/app/src/main/java/org/roomgoblin/display/MainActivity.java](https://github.com/wagnerks1990/RoomGoblin/blob/8fcdc8b93d6e8e7d5534bf7ecafd89068e0345b6/agents/android-tv/app/src/main/java/org/roomgoblin/display/MainActivity.java#L24): 24, 63-64, 75-76, 78, 81-87, 89-93.

<a id="android-capability-ownership"></a>

## Android capability cache and card ownership

**Finding ID:** RG-LAB-036. **Subsystem:** Android managed displays.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Small.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android capability cache and card ownership](android-capability-ownership.md).
**Expected benefit:** Keep capability results attached to their selected device and dialog.
**Repair revision:** `2c682540334111d50b5958455d2927ec05d00b36`.

**Location:**

- [public/managed-displays/agent-capability-ui.js](https://github.com/wagnerks1990/RoomGoblin/blob/2c682540334111d50b5958455d2927ec05d00b36/public/managed-displays/agent-capability-ui.js#L7): 7-10, 12-26, 49-50.

<a id="android-capability-truth"></a>

## Native Android capability availability

**Finding ID:** RG-LAB-043. **Subsystem:** Android managed displays.
**Category:** Correctness. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Native Android capability availability](android-capability-truth.md).
**Expected benefit:** Report available capabilities from current native evidence.
**Repair revision:** `7ddeade28eb80d1c0e379b86e71821d4be2143f8`.

**Location:**

- [agents/android-tv/app/src/main/java/org/roomgoblin/display/AgentCapabilities.java](https://github.com/wagnerks1990/RoomGoblin/blob/7ddeade28eb80d1c0e379b86e71821d4be2143f8/agents/android-tv/app/src/main/java/org/roomgoblin/display/AgentCapabilities.java#L57): 57-58, 74-75, 77-81, 83.

<a id="android-command-ownership"></a>

## Android card command ownership

**Finding ID:** RG-LAB-029. **Subsystem:** Android managed displays.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android card command ownership](android-command-ownership.md).
**Expected benefit:** Bind command completion to its original device and retire obsolete UI ownership.
**Repair revision:** `039a1fc3506cb0f60f2b31e9a45369005cb88ebb`.

**Location:**

- [public/managed-displays/agent-capability-ui.js](https://github.com/wagnerks1990/RoomGoblin/blob/039a1fc3506cb0f60f2b31e9a45369005cb88ebb/public/managed-displays/agent-capability-ui.js#L15): 15.
- [public/managed-displays/agent-v2-ui.js](https://github.com/wagnerks1990/RoomGoblin/blob/039a1fc3506cb0f60f2b31e9a45369005cb88ebb/public/managed-displays/agent-v2-ui.js#L58): 58-59, 81-82, 107, 113, 117, 119, 124-125, 154.
- [public/managed-displays/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/039a1fc3506cb0f60f2b31e9a45369005cb88ebb/public/managed-displays/app.js#L7): 7, 17-36, 62, 201.
- [public/managed-displays/device-admin-ui.js](https://github.com/wagnerks1990/RoomGoblin/blob/039a1fc3506cb0f60f2b31e9a45369005cb88ebb/public/managed-displays/device-admin-ui.js#L20): 20, 29, 31, 40.

<a id="android-configuration-ownership"></a>

## Android configuration operation ownership

**Finding ID:** RG-LAB-034. **Subsystem:** Android managed displays.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android configuration operation ownership](android-configuration-ownership.md).
**Expected benefit:** Keep accepted configuration writes from overwriting newer device state.
**Repair revision:** `519ca6921e62f0cf8d1b55adbcb9d14da1c0a41d`.

**Location:**

- [maintenance-agent/android-tv-agent-artifact.js](https://github.com/wagnerks1990/RoomGoblin/blob/519ca6921e62f0cf8d1b55adbcb9d14da1c0a41d/maintenance-agent/android-tv-agent-artifact.js#L11): 11, 50, 53.
- [maintenance-agent/android-tv-agent-v2.js](https://github.com/wagnerks1990/RoomGoblin/blob/519ca6921e62f0cf8d1b55adbcb9d14da1c0a41d/maintenance-agent/android-tv-agent-v2.js#L10): 10, 39-41, 51.
- [maintenance-agent/android-tv-configuration-owner.js](https://github.com/wagnerks1990/RoomGoblin/blob/519ca6921e62f0cf8d1b55adbcb9d14da1c0a41d/maintenance-agent/android-tv-configuration-owner.js#L1): 1-21.
- [maintenance-agent/android-tv-extension.js](https://github.com/wagnerks1990/RoomGoblin/blob/519ca6921e62f0cf8d1b55adbcb9d14da1c0a41d/maintenance-agent/android-tv-extension.js#L11): 11, 172-173.
- [maintenance-agent/android-tv-persistent-adb.js](https://github.com/wagnerks1990/RoomGoblin/blob/519ca6921e62f0cf8d1b55adbcb9d14da1c0a41d/maintenance-agent/android-tv-persistent-adb.js#L9): 9, 47-48, 67, 78, 84.

<a id="android-editor-ownership"></a>

## Android editor submission and draft ownership

**Finding ID:** RG-LAB-025. **Subsystem:** Android managed displays.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android editor submission and draft ownership](android-editor-ownership.md).
**Expected benefit:** Protect editor drafts and selection while inventory updates.
**Repair revision:** `9de6079ea376cef71bd14ce7911c73bc1c0094f7`.

**Location:**

- [public/managed-displays/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/9de6079ea376cef71bd14ce7911c73bc1c0094f7/public/managed-displays/app.js#L4): 4-5, 36, 76-85, 108-121, 124-139, 141.
- [public/managed-displays/index.html](https://github.com/wagnerks1990/RoomGoblin/blob/9de6079ea376cef71bd14ce7911c73bc1c0094f7/public/managed-displays/index.html#L27): 27.
- [public/managed-displays/styles.css](https://github.com/wagnerks1990/RoomGoblin/blob/9de6079ea376cef71bd14ce7911c73bc1c0094f7/public/managed-displays/styles.css#L23): 23.

<a id="android-enrollment-ownership"></a>

## Android enrollment form and result ownership

**Finding ID:** RG-LAB-021. **Subsystem:** Android managed displays.
**Category:** Correctness. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android enrollment form and result ownership](android-enrollment-ownership.md).
**Expected benefit:** Keep enrollment results bound to the submitted device and current editor.
**Repair revision:** `312f753f67f8b2cb3b89ba3f7dd3f66da6af2e84`.

**Location:**

- [public/managed-displays/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/312f753f67f8b2cb3b89ba3f7dd3f66da6af2e84/public/managed-displays/app.js#L3): 3, 13, 74-75, 78-97, 100.

<a id="android-inventory-ownership"></a>

## Android inventory and status ownership

**Finding ID:** RG-LAB-028. **Subsystem:** Android managed displays.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android inventory and status ownership](android-inventory-ownership.md).
**Expected benefit:** Prevent stale inventory and probe responses from replacing current device state.
**Repair revision:** `f76670b12306166b7f21d6fdcc2e5c122419beaf`.

**Location:**

- [public/managed-displays/agent-probe-hotfix.js](https://github.com/wagnerks1990/RoomGoblin/blob/f76670b12306166b7f21d6fdcc2e5c122419beaf/public/managed-displays/agent-probe-hotfix.js#L9): 9, 14, 16-17.
- [public/managed-displays/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/f76670b12306166b7f21d6fdcc2e5c122419beaf/public/managed-displays/app.js#L4): 4, 47, 50, 52, 55, 59, 63, 67, 73-99, 101-113.

<a id="android-lifecycle-ownership"></a>

## Android enrollment lifecycle outcomes

**Finding ID:** RG-LAB-031. **Subsystem:** Android managed displays.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android enrollment lifecycle outcomes](android-lifecycle-ownership.md).
**Expected benefit:** Preserve operation identity across lifecycle progress and completion.
**Repair revision:** `92adafe1c610050f5ffd6465ed7f3a94136a30e7`.

**Location:**

- [public/managed-displays/agent-v2-ui.js](https://github.com/wagnerks1990/RoomGoblin/blob/92adafe1c610050f5ffd6465ed7f3a94136a30e7/public/managed-displays/agent-v2-ui.js#L26): 26, 78, 83, 118-119, 126.
- [public/managed-displays/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/92adafe1c610050f5ffd6465ed7f3a94136a30e7/public/managed-displays/app.js#L5): 5, 12-28, 43, 54-55, 153-159, 165, 194, 225-235.
- [public/managed-displays/device-admin-ui.js](https://github.com/wagnerks1990/RoomGoblin/blob/92adafe1c610050f5ffd6465ed7f3a94136a30e7/public/managed-displays/device-admin-ui.js#L6): 6-7, 32, 39.

<a id="android-management-ports"></a>

## Android management port admission

**Finding ID:** RG-LAB-039. **Subsystem:** Android managed displays.
**Category:** Correctness. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android management port admission](android-management-ports.md).
**Expected benefit:** Validate management ports consistently before native dispatch.
**Repair revision:** `bfa68575048c7c67db842654ad4c3e9970de74e9`.

**Location:**

- [maintenance-agent/android-tv-agent-v2.js](https://github.com/wagnerks1990/RoomGoblin/blob/bfa68575048c7c67db842654ad4c3e9970de74e9/maintenance-agent/android-tv-agent-v2.js#L9): 9, 34, 43, 47.
- [maintenance-agent/android-tv-lib.js](https://github.com/wagnerks1990/RoomGoblin/blob/bfa68575048c7c67db842654ad4c3e9970de74e9/maintenance-agent/android-tv-lib.js#L28): 28-32, 133.
- [maintenance-agent/android-tv-persistent-adb.js](https://github.com/wagnerks1990/RoomGoblin/blob/bfa68575048c7c67db842654ad4c3e9970de74e9/maintenance-agent/android-tv-persistent-adb.js#L8): 8, 48, 74.

<a id="android-pcm-ownership"></a>

## Android PCM worker ownership

**Finding ID:** RG-LAB-041. **Subsystem:** Android managed displays.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android PCM worker ownership](android-pcm-ownership.md).
**Expected benefit:** Retire obsolete PCM work without disrupting the current audio owner.
**Repair revision:** `7ddeade28eb80d1c0e379b86e71821d4be2143f8`.

**Location:**

- [agents/android-tv/app/src/main/java/org/roomgoblin/display/AndroidPcmSendspinPlayer.kt](https://github.com/wagnerks1990/RoomGoblin/blob/7ddeade28eb80d1c0e379b86e71821d4be2143f8/agents/android-tv/app/src/main/java/org/roomgoblin/display/AndroidPcmSendspinPlayer.kt#L81): 81-82, 88-89, 91-94, 101.

<a id="android-policy-admission"></a>

## Android policy dispatch admission

**Finding ID:** RG-LAB-033. **Subsystem:** Android managed displays.
**Category:** Security. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android policy dispatch admission](android-policy-admission.md).
**Expected benefit:** Validate policy operations before admitting a device mutation.
**Repair revision:** `e7c557a1fcde79d7108fa2d9e7024702b7296c27`.

**Location:**

- [maintenance-agent/android-tv-agent-artifact.js](https://github.com/wagnerks1990/RoomGoblin/blob/e7c557a1fcde79d7108fa2d9e7024702b7296c27/maintenance-agent/android-tv-agent-artifact.js#L52): 52.
- [maintenance-agent/android-tv-agent-v2.js](https://github.com/wagnerks1990/RoomGoblin/blob/e7c557a1fcde79d7108fa2d9e7024702b7296c27/maintenance-agent/android-tv-agent-v2.js#L46): 46, 78-79, 81.
- [maintenance-agent/android-tv-extension.js](https://github.com/wagnerks1990/RoomGoblin/blob/e7c557a1fcde79d7108fa2d9e7024702b7296c27/maintenance-agent/android-tv-extension.js#L25): 25, 97, 122-149, 163-164, 171, 173.
- [maintenance-agent/android-tv-lib.js](https://github.com/wagnerks1990/RoomGoblin/blob/e7c557a1fcde79d7108fa2d9e7024702b7296c27/maintenance-agent/android-tv-lib.js#L102): 102-113.
- [maintenance-agent/android-tv-persistent-adb.js](https://github.com/wagnerks1990/RoomGoblin/blob/e7c557a1fcde79d7108fa2d9e7024702b7296c27/maintenance-agent/android-tv-persistent-adb.js#L62): 62, 77.

<a id="android-preview-ownership"></a>

## Android screenshot preview lifetime

**Finding ID:** RG-LAB-027. **Subsystem:** Android managed displays.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android screenshot preview lifetime](android-preview-ownership.md).
**Expected benefit:** Prevent old screenshots and preview callbacks from replacing current previews.
**Repair revision:** `9de6079ea376cef71bd14ce7911c73bc1c0094f7`.

**Location:**

- [public/managed-displays/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/9de6079ea376cef71bd14ce7911c73bc1c0094f7/public/managed-displays/app.js#L4): 4-5, 36, 76-85, 108-121, 124-139, 141.
- [public/managed-displays/index.html](https://github.com/wagnerks1990/RoomGoblin/blob/9de6079ea376cef71bd14ce7911c73bc1c0094f7/public/managed-displays/index.html#L27): 27.
- [public/managed-displays/styles.css](https://github.com/wagnerks1990/RoomGoblin/blob/9de6079ea376cef71bd14ce7911c73bc1c0094f7/public/managed-displays/styles.css#L23): 23.

<a id="android-process-cleanup"></a>

## Android child process cleanup

**Finding ID:** RG-LAB-040. **Subsystem:** Android managed displays.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android child process cleanup](android-process-cleanup.md).
**Expected benefit:** Bound native process lifetime and release its streams and ownership.
**Repair revision:** `bfa68575048c7c67db842654ad4c3e9970de74e9`.

**Location:**

- [agents/android-tv/app/src/main/java/org/roomgoblin/display/RootTools.java](https://github.com/wagnerks1990/RoomGoblin/blob/bfa68575048c7c67db842654ad4c3e9970de74e9/agents/android-tv/app/src/main/java/org/roomgoblin/display/RootTools.java#L65): 65-80.

<a id="android-record-completion"></a>

## Android asynchronous record completion

**Finding ID:** RG-LAB-032. **Subsystem:** Android managed displays.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android asynchronous record completion](android-record-completion.md).
**Expected benefit:** Complete operations against the record that admitted them.
**Repair revision:** `e7c557a1fcde79d7108fa2d9e7024702b7296c27`.

**Location:**

- [maintenance-agent/android-tv-agent-artifact.js](https://github.com/wagnerks1990/RoomGoblin/blob/e7c557a1fcde79d7108fa2d9e7024702b7296c27/maintenance-agent/android-tv-agent-artifact.js#L52): 52.
- [maintenance-agent/android-tv-agent-v2.js](https://github.com/wagnerks1990/RoomGoblin/blob/e7c557a1fcde79d7108fa2d9e7024702b7296c27/maintenance-agent/android-tv-agent-v2.js#L46): 46, 78-79, 81.
- [maintenance-agent/android-tv-extension.js](https://github.com/wagnerks1990/RoomGoblin/blob/e7c557a1fcde79d7108fa2d9e7024702b7296c27/maintenance-agent/android-tv-extension.js#L25): 25, 97, 122-149, 163-164, 171, 173.
- [maintenance-agent/android-tv-lib.js](https://github.com/wagnerks1990/RoomGoblin/blob/e7c557a1fcde79d7108fa2d9e7024702b7296c27/maintenance-agent/android-tv-lib.js#L102): 102-113.
- [maintenance-agent/android-tv-persistent-adb.js](https://github.com/wagnerks1990/RoomGoblin/blob/e7c557a1fcde79d7108fa2d9e7024702b7296c27/maintenance-agent/android-tv-persistent-adb.js#L62): 62, 77.

<a id="android-sendspin-configuration"></a>

## Native Android Sendspin configuration

**Finding ID:** RG-LAB-042. **Subsystem:** Android managed displays.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Native Android Sendspin configuration](android-sendspin-configuration.md).
**Expected benefit:** Apply Sendspin configuration with explicit current-session ownership.
**Repair revision:** `7ddeade28eb80d1c0e379b86e71821d4be2143f8`.

**Location:**

- [agents/android-tv/app/src/main/java/org/roomgoblin/display/NativeSendspinManager.kt](https://github.com/wagnerks1990/RoomGoblin/blob/7ddeade28eb80d1c0e379b86e71821d4be2143f8/agents/android-tv/app/src/main/java/org/roomgoblin/display/NativeSendspinManager.kt#L29): 29, 52, 56-59, 70, 104, 109, 117-118, 122, 144, 150, 156-157.

<a id="android-shell-ownership"></a>

## Android shell and diagnostic output ownership

**Finding ID:** RG-LAB-030. **Subsystem:** Android managed displays.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android shell and diagnostic output ownership](android-shell-ownership.md).
**Expected benefit:** Keep shell feedback scoped to the initiating device and dialog.
**Repair revision:** `92adafe1c610050f5ffd6465ed7f3a94136a30e7`.

**Location:**

- [public/managed-displays/agent-v2-ui.js](https://github.com/wagnerks1990/RoomGoblin/blob/92adafe1c610050f5ffd6465ed7f3a94136a30e7/public/managed-displays/agent-v2-ui.js#L26): 26, 78, 83, 118-119, 126.
- [public/managed-displays/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/92adafe1c610050f5ffd6465ed7f3a94136a30e7/public/managed-displays/app.js#L5): 5, 12-28, 43, 54-55, 153-159, 165, 194, 225-235.
- [public/managed-displays/device-admin-ui.js](https://github.com/wagnerks1990/RoomGoblin/blob/92adafe1c610050f5ffd6465ed7f3a94136a30e7/public/managed-displays/device-admin-ui.js#L6): 6-7, 32, 39.

<a id="android-socket-lifecycle"></a>

## Android service socket ownership

**Finding ID:** RG-LAB-037. **Subsystem:** Android managed displays.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Android service socket ownership](android-socket-lifecycle.md).
**Expected benefit:** Retire obsolete socket callbacks and preserve service lifecycle ownership.
**Repair revision:** `8fcdc8b93d6e8e7d5534bf7ecafd89068e0345b6`.

**Location:**

- [agents/android-tv/app/src/main/java/org/roomgoblin/display/AgentService.java](https://github.com/wagnerks1990/RoomGoblin/blob/8fcdc8b93d6e8e7d5534bf7ecafd89068e0345b6/agents/android-tv/app/src/main/java/org/roomgoblin/display/AgentService.java#L31): 31, 40, 42, 63, 95, 97, 127-135, 138, 142.

<a id="announcement-probe-security"></a>

## Announcement probe destination review

**Finding ID:** GH-CODEQL-418, GH-CODEQL-419, GH-CODEQL-420. **Subsystem:** Announcement security regression coverage.
**Category:** Testing. **Priority:** P2. **Complexity:** Small.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Announcement probe destination review](announcement-probe-security.md).
**Expected benefit:** Assert the complete redacted structure instead of URL substring comparisons.
**Repair revision:** `ac1ae4002adf3995d079836a13245e3e8449b636`.

**Location:**

- [test/announcement-config-transaction.test.js](https://github.com/wagnerks1990/RoomGoblin/blob/ac1ae4002adf3995d079836a13245e3e8449b636/test/announcement-config-transaction.test.js#L1): 1-64.

<a id="audit-import-transaction"></a>

## Legacy audit import transaction

**Finding ID:** RG-DB-001. **Subsystem:** Database audit imports.
**Category:** Correctness. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Legacy audit import transaction](audit-import-transaction.md).
**Expected benefit:** Commit audit imports atomically with their database identity.
**Repair revision:** `8357bec099c0a9acf0241519d7b2028ce4eee126`.

**Location:**

- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/8357bec099c0a9acf0241519d7b2028ce4eee126/src/server.js#L5384): 5384, 6699-6705.
- [src/storage.js](https://github.com/wagnerks1990/RoomGoblin/blob/8357bec099c0a9acf0241519d7b2028ce4eee126/src/storage.js#L432): 432, 438, 451-467, 567.

<a id="backup-retention-authority"></a>

## Backup retention and rollback authority

**Finding ID:** RG-DOC-001, RG-RECOVERY-RETENTION-001, RG-RECOVERY-RETENTION-002. **Subsystem:** Backup and disaster recovery.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Backup retention and rollback authority](backup-retention-authority.md).
**Expected benefit:** Require rollback authority and preserve concurrent archive arrivals before cleanup.
**Repair revision:** `6a385d1d3dddd22000467555bd1cca93654b431d`.

RG-DOC-001 is Documentation/P3/Small/Low; the two retention findings are
Reliability/P1/Medium/Medium. The note separates authority failure from the
concurrent-arrival/phase race. Documentation source changes are recorded in
`docs/AI-CONTEXT.md` and `docs/PRODUCTION-UPDATES.md` at this same revision.

**Location:**

- [maintenance-agent/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/6a385d1d3dddd22000467555bd1cca93654b431d/maintenance-agent/server.js#L579): 579-600, 606-612.
- [docs/AI-CONTEXT.md](https://github.com/wagnerks1990/RoomGoblin/blob/6a385d1d3dddd22000467555bd1cca93654b431d/docs/AI-CONTEXT.md#L604): 604-609.
- [docs/PRODUCTION-UPDATES.md](https://github.com/wagnerks1990/RoomGoblin/blob/6a385d1d3dddd22000467555bd1cca93654b431d/docs/PRODUCTION-UPDATES.md#L204): 204-208, 212-215, 257-263.

<a id="browser-request-deadlines"></a>

## Operator request deadlines

**Finding ID:** RG-PERF-REQUEST-001. **Subsystem:** Shared frontend request lifecycle.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Operator request deadlines](browser-request-deadlines.md).
**Expected benefit:** Release browser request ownership after a bounded header-and-body deadline.
**Repair revision:** `b181521a78426a694d8fa2280476661ca5f4e7d3`.

**Location:**

- [public/controller/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/b181521a78426a694d8fa2280476661ca5f4e7d3/public/controller/app.js#L3): 3.
- [public/controller/index.html](https://github.com/wagnerks1990/RoomGoblin/blob/b181521a78426a694d8fa2280476661ca5f4e7d3/public/controller/index.html#L1459): 1459.
- [public/controller/veyon.html](https://github.com/wagnerks1990/RoomGoblin/blob/b181521a78426a694d8fa2280476661ca5f4e7d3/public/controller/veyon.html#L80): 80.
- [public/controller/veyon.js](https://github.com/wagnerks1990/RoomGoblin/blob/b181521a78426a694d8fa2280476661ca5f4e7d3/public/controller/veyon.js#L11): 11.
- [public/managed-displays/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/b181521a78426a694d8fa2280476661ca5f4e7d3/public/managed-displays/app.js#L8): 8.
- [public/managed-displays/index.html](https://github.com/wagnerks1990/RoomGoblin/blob/b181521a78426a694d8fa2280476661ca5f4e7d3/public/managed-displays/index.html#L21): 21.
- [public/managed-displays/ubuntu.js](https://github.com/wagnerks1990/RoomGoblin/blob/b181521a78426a694d8fa2280476661ca5f4e7d3/public/managed-displays/ubuntu.js#L21): 21-23.
- [public/shared/request.js](https://github.com/wagnerks1990/RoomGoblin/blob/b181521a78426a694d8fa2280476661ca5f4e7d3/public/shared/request.js#L1): 1-34.

<a id="diagnostic-evidence"></a>

## Diagnostic evidence and secret projection

**Finding ID:** RG-DIAG-EVIDENCE-001, RG-DIAG-EVIDENCE-002, RG-DIAG-EVIDENCE-003. **Subsystem:** Diagnostics and secret projection.
**Category:** Security. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Diagnostic evidence and secret projection](diagnostic-evidence.md).
**Expected benefit:** Redact diagnostic credentials and label observations by their actual evidence.
**Repair revision:** `ea924b8e634ebc12e33ffa7db08535fa0825fb2f`.

RG-DIAG-EVIDENCE-001 covers credential redaction (Security/P1); -002 covers
evidence labels and -003 obsolete observations (Correctness/P2). All three
share the stated complexity, compatibility risk and confidence.

**Location:**

- [public/controller/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/ea924b8e634ebc12e33ffa7db08535fa0825fb2f/public/controller/app.js#L2215): 2215-2224, 2247-2249, 2255.
- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/ea924b8e634ebc12e33ffa7db08535fa0825fb2f/src/server.js#L4606): 4606, 4609-4610, 4614, 4771, 4781, 4787, 4791-4792, 6500-6506, 6549-6551, 6562, 6570, 6750-6751.

<a id="display-enrollment-admission"></a>

## Display enrollment admission

**Finding ID:** RG-AUTH-ENROLL-001. **Subsystem:** Display enrollment authorization.
**Category:** Security. **Priority:** P1. **Complexity:** Small.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Display enrollment admission](display-enrollment-admission.md).
**Expected benefit:** Bound accepted administrator enrollment operations without charging rejected callers.
**Repair revision:** `3bdc179f711b7048a9202fa05dea4d970850756f`.

**Location:**

- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/3bdc179f711b7048a9202fa05dea4d970850756f/src/server.js#L736): 736, 1465, 1494, 1517, 1777, 2715, 4045-4052, 4123-4127, 4130, 4481, 4813, 5460-5480, 5516, 5586, 6328, 6335, 6351, 6476, 6491, 6691-6696, 6699-6700, 6776-6795, 7415, 8791, 8814.

<a id="display-identity-runtime"></a>

## Receiver identity admission and media access

**Finding ID:** RG-AUTH-IDENTITY-001. **Subsystem:** Receiver identity and authentication.
**Category:** Security. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Receiver identity admission and media access](display-identity-runtime.md).
**Expected benefit:** Preserve exact receiver identity across runtime dispatch and admission.
**Repair revision:** `3bdc179f711b7048a9202fa05dea4d970850756f`.

**Location:**

- [public/shared/common.js](https://github.com/wagnerks1990/RoomGoblin/blob/3bdc179f711b7048a9202fa05dea4d970850756f/public/shared/common.js#L20): 20.
- [src/automation-runtime.js](https://github.com/wagnerks1990/RoomGoblin/blob/3bdc179f711b7048a9202fa05dea4d970850756f/src/automation-runtime.js#L33): 33-39, 41, 43-49.
- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/3bdc179f711b7048a9202fa05dea4d970850756f/src/server.js#L736): 736, 1465, 1494, 1517, 1777, 2715, 4045-4052, 4123-4127, 4130, 4481, 4813, 5460-5480, 5516, 5586, 6328, 6335, 6351, 6476, 6491, 6691-6696, 6699-6700, 6776-6795, 7415, 8791, 8814.

<a id="esphome-admission-budgets"></a>

## ESPHome authorized admission budgets

**Finding ID:** RG-ESP-001. **Subsystem:** ESPHome.
**Category:** Security. **Priority:** P1. **Complexity:** Small.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [ESPHome authorized admission budgets](esphome-admission-budgets.md).
**Expected benefit:** Charge accepted ESPHome operations to shared appliance budgets.
**Repair revision:** `f74186637413d4c373bffdbf08ceef02c8166692`.

**Location:**

- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/f74186637413d4c373bffdbf08ceef02c8166692/src/server.js#L5600): 5600.

<a id="esphome-inventory-ownership"></a>

## ESPHome controller inventory and draft ownership

**Finding ID:** RG-ESP-002. **Subsystem:** ESPHome.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [ESPHome controller inventory and draft ownership](esphome-inventory-ownership.md).
**Expected benefit:** Keep ESPHome inventory and edits owned by the current request.
**Repair revision:** `f74186637413d4c373bffdbf08ceef02c8166692`.

**Location:**

- [public/controller/esphome.js](https://github.com/wagnerks1990/RoomGoblin/blob/f74186637413d4c373bffdbf08ceef02c8166692/public/controller/esphome.js#L8): 8, 22, 24, 31, 38, 43, 49-50, 52-53, 57, 59, 63-67, 105-106, 116, 123, 133-136, 140-141, 144-157, 159, 161.

<a id="esphome-worker-ownership"></a>

## ESPHome worker error containment and discovery completion

**Finding ID:** RG-ESP-003. **Subsystem:** ESPHome.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [ESPHome worker error containment and discovery completion](esphome-worker-ownership.md).
**Expected benefit:** Keep ESPHome worker results bound to their admitted operation.
**Repair revision:** `f74186637413d4c373bffdbf08ceef02c8166692`.

**Location:**

- [src/esphome.js](https://github.com/wagnerks1990/RoomGoblin/blob/f74186637413d4c373bffdbf08ceef02c8166692/src/esphome.js#L95): 95, 112-113, 138, 152-155, 255-260.

<a id="freeze-fixture-contention"></a>

## Export-freeze fixture setup contention

**Finding ID:** RG-TEST-FREEZE-001. **Subsystem:** Full Recovery test fixtures.
**Category:** Testing. **Priority:** P2. **Complexity:** Small.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Export-freeze fixture setup contention](freeze-fixture-contention.md).
**Expected benefit:** Allow bounded SQLite fixture contention without weakening freeze assertions.
**Repair revision:** `bfa68575048c7c67db842654ad4c3e9970de74e9`.

**Location:**

- [test/read-housekeeping-freeze.test.js](https://github.com/wagnerks1990/RoomGoblin/blob/bfa68575048c7c67db842654ad4c3e9970de74e9/test/read-housekeeping-freeze.test.js#L54): 54-55.

<a id="legacy-import-transaction"></a>

## Legacy configuration and secret import transactions

**Finding ID:** RG-DB-002. **Subsystem:** Database legacy imports.
**Category:** Correctness. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Legacy configuration and secret import transactions](legacy-import-transaction.md).
**Expected benefit:** Commit legacy imports atomically and preserve the canonical database identity.
**Repair revision:** `8357bec099c0a9acf0241519d7b2028ce4eee126`.

**Location:**

- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/8357bec099c0a9acf0241519d7b2028ce4eee126/src/server.js#L5384): 5384, 6699-6705.
- [src/storage.js](https://github.com/wagnerks1990/RoomGoblin/blob/8357bec099c0a9acf0241519d7b2028ce4eee126/src/storage.js#L432): 432, 438, 451-467, 567.

<a id="lighting-command-transport"></a>

## Lighting command transport ownership

**Finding ID:** RG-LIGHTS-003, RG-LIGHTS-004. **Subsystem:** Lighting and Govee.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Lighting command transport ownership](lighting-command-transport.md).
**Expected benefit:** Bound lighting command transport and preserve uncertain-write outcomes.
**Repair revision:** `33ee5d0352d59f55279fd2923059176bce255af1`.

**Location:**

- [public/controller/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/33ee5d0352d59f55279fd2923059176bce255af1/public/controller/app.js#L670): 670-687, 690-691, 694-695, 712, 720-722, 2183, 2186, 2190.
- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/33ee5d0352d59f55279fd2923059176bce255af1/src/server.js#L4355): 4355-4361, 4365-4366, 4369-4380, 4397, 4404-4405, 4407-4408, 4414, 4430-4432, 4435-4437, 4440-4442, 4445-4447, 4452-4453, 4536-4537, 4539, 4569, 4572-4576.

<a id="lighting-configuration-ordering"></a>

## Lighting configuration write ordering

**Finding ID:** RG-LIGHTS-005. **Subsystem:** Lighting and Govee.
**Category:** Correctness. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Lighting configuration write ordering](lighting-configuration-ordering.md).
**Expected benefit:** Prevent older configuration responses from replacing a newer accepted edit.
**Repair revision:** `5cf4c81830e97185f3e357d99d82f3251ee55024`.

**Location:**

- [public/controller/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/5cf4c81830e97185f3e357d99d82f3251ee55024/public/controller/app.js#L671): 671-678, 680-682, 684, 686, 709, 711-718, 721, 723, 725-727, 735, 761.

<a id="lighting-discovery-persistence"></a>

## Lighting discovery persistence

**Finding ID:** RG-LIGHTS-007. **Subsystem:** Lighting and Govee.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Lighting discovery persistence](lighting-discovery-persistence.md).
**Expected benefit:** Make discovered lighting state durable without hiding persistence failure.
**Repair revision:** `5ffba818197de5774b576a2a62dd85b35559dba1`.

**Location:**

- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/5ffba818197de5774b576a2a62dd85b35559dba1/src/server.js#L310): 310-312, 393, 397, 400-401, 404-409, 412-413, 418, 422-423, 425-429, 450, 477-478, 480, 504-507, 532-535, 539, 546-547, 551-552, 555-558, 3962-3963, 4479, 4545, 5636-5638, 5643-5644, 9306-9309.

<a id="lighting-dispatch-identity"></a>

## Lighting command target identity

**Finding ID:** RG-LIGHTS-008. **Subsystem:** Lighting and Govee.
**Category:** Correctness. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Lighting command target identity](lighting-dispatch-identity.md).
**Expected benefit:** Dispatch lighting operations against their captured target identity.
**Repair revision:** `af76c5a85ed7d9ef5bb26bdea6b631e6195ffee2`.

**Location:**

- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/af76c5a85ed7d9ef5bb26bdea6b631e6195ffee2/src/server.js#L4576): 4576-4577, 4594-4596, 4612, 4614, 4616-4624, 4628, 4631, 4639, 4644, 4651-4663, 4683, 5671.

<a id="lighting-inventory-ownership"></a>

## Lighting inventory and feedback ownership

**Finding ID:** RG-LIGHTS-001, RG-LIGHTS-002. **Subsystem:** Lighting and Govee.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Lighting inventory and feedback ownership](lighting-inventory-ownership.md).
**Expected benefit:** Keep lighting inventory updates from replacing current selection and operation state.
**Repair revision:** `33ee5d0352d59f55279fd2923059176bce255af1`.

**Location:**

- [public/controller/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/33ee5d0352d59f55279fd2923059176bce255af1/public/controller/app.js#L670): 670-687, 690-691, 694-695, 712, 720-722, 2183, 2186, 2190.
- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/33ee5d0352d59f55279fd2923059176bce255af1/src/server.js#L4355): 4355-4361, 4365-4366, 4369-4380, 4397, 4404-4405, 4407-4408, 4414, 4430-4432, 4435-4437, 4440-4442, 4445-4447, 4452-4453, 4536-4537, 4539, 4569, 4572-4576.

<a id="lighting-registry-persistence"></a>

## Lighting metadata and policy persistence

**Finding ID:** RG-LIGHTS-006. **Subsystem:** Lighting and Govee.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Lighting metadata and policy persistence](lighting-registry-persistence.md).
**Expected benefit:** Persist lighting registry changes before reporting them as saved.
**Repair revision:** `5ffba818197de5774b576a2a62dd85b35559dba1`.

**Location:**

- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/5ffba818197de5774b576a2a62dd85b35559dba1/src/server.js#L310): 310-312, 393, 397, 400-401, 404-409, 412-413, 418, 422-423, 425-429, 450, 477-478, 480, 504-507, 532-535, 539, 546-547, 551-552, 555-558, 3962-3963, 4479, 4545, 5636-5638, 5643-5644, 9306-9309.

<a id="media-library-controller"></a>

## Media-card dispatch and library refresh ownership

**Finding ID:** RG-MEDIA-008, RG-MEDIA-010. **Subsystem:** Media library and receiver playback.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Media-card dispatch and library refresh ownership](media-library-controller.md).
**Expected benefit:** Preserve media-library selection, feedback and current upload ownership.
**Repair revision:** `86ce127636b89e2a2077f225ec1cdff7e29a1ff6`.

**Location:**

- [public/controller/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/86ce127636b89e2a2077f225ec1cdff7e29a1ff6/public/controller/app.js#L567): 567-577, 579, 581-582, 594, 619, 1342-1343, 1345, 1348, 1479, 2118, 2120, 2125.
- [public/controller/display.html](https://github.com/wagnerks1990/RoomGoblin/blob/86ce127636b89e2a2077f225ec1cdff7e29a1ff6/public/controller/display.html#L899): 899, 906-915, 917-920, 933, 936.
- [public/shared/resumable-upload.js](https://github.com/wagnerks1990/RoomGoblin/blob/86ce127636b89e2a2077f225ec1cdff7e29a1ff6/public/shared/resumable-upload.js#L48): 48, 50, 52.
- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/86ce127636b89e2a2077f225ec1cdff7e29a1ff6/src/server.js#L8416): 8416-8436, 8482, 8484-8485, 8488-8489.

<a id="media-library-ownership"></a>

## Media conversion, deletion and upload cleanup ownership

**Finding ID:** RG-MEDIA-007. **Subsystem:** Media library and receiver playback.
**Category:** Correctness. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Media conversion, deletion and upload cleanup ownership](media-library-ownership.md).
**Expected benefit:** Preserve media records and library ownership across concurrent operations.
**Repair revision:** `43b4d83c394b997f8bb4c845ae0c43d2c4eb7901`.

**Location:**

- [src/resumable-upload.js](https://github.com/wagnerks1990/RoomGoblin/blob/43b4d83c394b997f8bb4c845ae0c43d2c4eb7901/src/resumable-upload.js#L77): 77, 109-133, 137-149, 152, 157-159, 163-164.
- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/43b4d83c394b997f8bb4c845ae0c43d2c4eb7901/src/server.js#L592): 592-602, 8306-8307, 8309, 8313-8316, 8318-8321, 8325, 8357-8363, 8369-8372, 8392, 8394-8395, 8397-8398, 8400-8412, 8414, 8421-8425, 8427, 8429-8453.

<a id="media-token-continuity"></a>

## Receiver video continuity across token renewal

**Finding ID:** RG-MEDIA-001. **Subsystem:** Media library and receiver playback.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Receiver video continuity across token renewal](media-token-continuity.md).
**Expected benefit:** Keep authorized receiver media sessions usable across token renewal.
**Repair revision:** `daa378f88f51278b695a7fd4673328d06caead69`.

**Location:**

- [public/display/index.html](https://github.com/wagnerks1990/RoomGoblin/blob/daa378f88f51278b695a7fd4673328d06caead69/public/display/index.html#L175): 175-176, 203-222, 234, 240-243, 249-252, 282-283, 294.
- [src/display-media.js](https://github.com/wagnerks1990/RoomGoblin/blob/daa378f88f51278b695a7fd4673328d06caead69/src/display-media.js#L1): 1-32.
- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/daa378f88f51278b695a7fd4673328d06caead69/src/server.js#L43): 43, 4127-4131, 4217, 6212.

<a id="presentation-rebuild-admission"></a>

## Presentation rebuild admission

**Finding ID:** RG-PRESENTATION-007. **Subsystem:** Presentation console.
**Category:** Security. **Priority:** P1. **Complexity:** Small.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Presentation rebuild admission](presentation-rebuild-admission.md).
**Expected benefit:** Apply shared administrator admission to presentation rebuild operations.
**Repair revision:** `fa5bb49036656c9d94e5b6685ef330593ca01865`.

**Location:**

- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/fa5bb49036656c9d94e5b6685ef330593ca01865/src/server.js#L8259): 8259.

<a id="presentation-session-ownership"></a>

## Presentation session and folder deletion ownership

**Finding ID:** RG-PRESENTATION-001, RG-PRESENTATION-002, RG-PRESENTATION-003, RG-PRESENTATION-004, RG-PRESENTATION-005, RG-PRESENTATION-006. **Subsystem:** Presentation console.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Presentation session and folder deletion ownership](presentation-session-ownership.md).
**Expected benefit:** Keep presentation preview and live session ownership independent and current.
**Repair revision:** `906e0ec1f2fb2ebc9f3c6444dd38823e27eb0b8a`.

**Location:**

- [public/controller/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/906e0ec1f2fb2ebc9f3c6444dd38823e27eb0b8a/public/controller/app.js#L361): 361-386, 388, 391-393, 399, 486-498, 507, 526, 532-540, 551-555, 564-565, 569, 571, 598.
- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/906e0ec1f2fb2ebc9f3c6444dd38823e27eb0b8a/src/server.js#L2494): 2494-2499, 2501-2507, 2510-2511, 2516, 2521, 2528-2529, 2532, 2564-2578, 2657, 8148-8153, 8190, 8195-8196, 8198-8202, 8208, 8275, 8284-8285, 8290, 8314, 8317.

<a id="preview-route-synchronization"></a>

## Automation preview route synchronization

**Finding ID:** RG-TEST-PREVIEW-001. **Subsystem:** Automation preview browser fixtures.
**Category:** Testing. **Priority:** P2. **Complexity:** Small.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Automation preview route synchronization](preview-route-synchronization.md).
**Expected benefit:** Wait for held preview routes before deliberately reversing their responses.
**Repair revision:** `336a71d6002239e77e5084a804d526e475ef9369`.

**Location:**

- [test/browser/test_workspaces.py](https://github.com/wagnerks1990/RoomGoblin/blob/336a71d6002239e77e5084a804d526e475ef9369/test/browser/test_workspaces.py#L1517): 1517, 1530-1533.

<a id="publication-candidate-retry"></a>

## Bounded publication retries

**Finding ID:** RG-CI-PUBLISH-001. **Subsystem:** CI and image publication.
**Category:** Reliability. **Priority:** P2. **Complexity:** Small.
**Compatibility risk:** Low. **Confidence:** Strong Evidence.
**Evidence, implementation, problem, recommendation and verification:** [Bounded publication retries](publication-candidate-retry.md).
**Expected benefit:** Retry bounded publication failures using the same scanned image identity.
**Repair revision:** `8d9e79fbf3a478e9846056377dd9b79ac933e102`.

**Location:**

- [.github/workflows/publish-main-images.yml](https://github.com/wagnerks1990/RoomGoblin/blob/8d9e79fbf3a478e9846056377dd9b79ac933e102/.github/workflows/publish-main-images.yml#L116): 116-118.
- [tools/publish-scanned-candidate.sh](https://github.com/wagnerks1990/RoomGoblin/blob/8d9e79fbf3a478e9846056377dd9b79ac933e102/tools/publish-scanned-candidate.sh#L1): 1-27.

<a id="settings-identity-transaction"></a>

## Administrative settings and credential transactions

**Finding ID:** RG-API-001. **Subsystem:** Settings database transactions.
**Category:** Correctness. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Administrative settings and credential transactions](settings-identity-transaction.md).
**Expected benefit:** Commit settings and dependent identity changes as one transaction.
**Repair revision:** `8357bec099c0a9acf0241519d7b2028ce4eee126`.

**Location:**

- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/8357bec099c0a9acf0241519d7b2028ce4eee126/src/server.js#L5384): 5384, 6699-6705.
- [src/storage.js](https://github.com/wagnerks1990/RoomGoblin/blob/8357bec099c0a9acf0241519d7b2028ce4eee126/src/storage.js#L432): 432, 438, 451-467, 567.

<a id="sports-import-ownership"></a>

## Sports import review ownership

**Finding ID:** RG-SPORTS-004. **Subsystem:** Sports workspace.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Sports import review ownership](sports-import-ownership.md).
**Expected benefit:** Retire obsolete import responses without replacing current sports drafts.
**Repair revision:** `bdf521c2a5739f8e8c9645fb3428ad46744f3714`.

**Location:**

- [public/controller/sports-workspace.js](https://github.com/wagnerks1990/RoomGoblin/blob/bdf521c2a5739f8e8c9645fb3428ad46744f3714/public/controller/sports-workspace.js#L6): 6, 12, 18, 20-32, 34-35, 43-52, 56, 73, 78, 98-100, 106, 114, 119-120.

<a id="sports-persistence-cache"></a>

## Sports durable saves and retired board reads

**Finding ID:** RG-SPORTS-005, RG-SPORTS-006. **Subsystem:** Sports workspace.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Sports durable saves and retired board reads](sports-persistence-cache.md).
**Expected benefit:** Preserve durable sports settings and invalidate only the correct cached state.
**Repair revision:** `bdf521c2a5739f8e8c9645fb3428ad46744f3714`.

**Location:**

- [public/controller/sports-workspace.js](https://github.com/wagnerks1990/RoomGoblin/blob/bdf521c2a5739f8e8c9645fb3428ad46744f3714/public/controller/sports-workspace.js#L6): 6, 12, 18, 20-32, 34-35, 43-52, 56, 73, 78, 98-100, 106, 114, 119-120.
- [public/shared/sports-board.js](https://github.com/wagnerks1990/RoomGoblin/blob/bdf521c2a5739f8e8c9645fb3428ad46744f3714/public/shared/sports-board.js#L5): 5, 8, 10, 13-15.
- [src/sports-service.js](https://github.com/wagnerks1990/RoomGoblin/blob/bdf521c2a5739f8e8c9645fb3428ad46744f3714/src/sports-service.js#L10): 10-18.

<a id="sports-refresh-ownership"></a>

## Sports source refresh and undo ownership

**Finding ID:** RG-SPORTS-003. **Subsystem:** Sports workspace.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Sports source refresh and undo ownership](sports-refresh-ownership.md).
**Expected benefit:** Keep sports refresh completion attached to its current source selection.
**Repair revision:** `bdf521c2a5739f8e8c9645fb3428ad46744f3714`.

**Location:**

- [public/controller/sports-workspace.js](https://github.com/wagnerks1990/RoomGoblin/blob/bdf521c2a5739f8e8c9645fb3428ad46744f3714/public/controller/sports-workspace.js#L6): 6, 12, 18, 20-32, 34-35, 43-52, 56, 73, 78, 98-100, 106, 114, 119-120.

<a id="sports-source-identity"></a>

## Sports source status identity

**Finding ID:** RG-SPORTS-001. **Subsystem:** Sports workspace.
**Category:** Correctness. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Sports source status identity](sports-source-identity.md).
**Expected benefit:** Resolve sports data against the selected source identity.
**Repair revision:** `f588de3b138429127dfaed2beb1bc558db1b9b47`.

**Location:**

- [src/sports-routes.js](https://github.com/wagnerks1990/RoomGoblin/blob/f588de3b138429127dfaed2beb1bc558db1b9b47/src/sports-routes.js#L10): 10-11.
- [src/sports-service.js](https://github.com/wagnerks1990/RoomGoblin/blob/f588de3b138429127dfaed2beb1bc558db1b9b47/src/sports-service.js#L7): 7-9, 18, 20, 64, 67.

<a id="sports-workspace-ownership"></a>

## Sports workspace save and scene ownership

**Finding ID:** RG-SPORTS-002. **Subsystem:** Sports workspace.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Sports workspace save and scene ownership](sports-workspace-ownership.md).
**Expected benefit:** Protect sports workspace drafts and selection from obsolete callbacks.
**Repair revision:** `f588de3b138429127dfaed2beb1bc558db1b9b47`.

**Location:**

- [public/controller/sports-workspace.js](https://github.com/wagnerks1990/RoomGoblin/blob/f588de3b138429127dfaed2beb1bc558db1b9b47/public/controller/sports-workspace.js#L6): 6, 18, 20-31, 34, 49-59.

<a id="ubuntu-configuration-ownership"></a>

## Ubuntu screen configuration owns only its configuration fields

**Finding ID:** RG-LAB-018. **Subsystem:** Ubuntu managed displays.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Ubuntu screen configuration owns only its configuration fields](ubuntu-configuration-ownership.md).
**Expected benefit:** Keep accepted Ubuntu configuration writes bound to the current record.
**Repair revision:** `fb1d1e6bbeafd6d7a0f583aed9ed153b89a513f8`.

**Location:**

- [src/ubuntu-displays.js](https://github.com/wagnerks1990/RoomGoblin/blob/fb1d1e6bbeafd6d7a0f583aed9ed153b89a513f8/src/ubuntu-displays.js#L259): 259.

<a id="ubuntu-repair-admission"></a>

## Ubuntu repair admission and announcement priority

**Finding ID:** RG-LAB-024. **Subsystem:** Ubuntu managed displays.
**Category:** Security. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Ubuntu repair admission and announcement priority](ubuntu-repair-admission.md).
**Expected benefit:** Validate Ubuntu repair admission before dispatching native work.
**Repair revision:** `865631ddb27a3ad67f7560797fbce4739a882077`.

**Location:**

- [src/ubuntu-displays.js](https://github.com/wagnerks1990/RoomGoblin/blob/865631ddb27a3ad67f7560797fbce4739a882077/src/ubuntu-displays.js#L112): 112-117, 191, 198, 208, 219-221, 223, 231-233, 237, 250-251, 260, 265, 269, 276, 278-279, 283, 291.

<a id="ubuntu-repair-record-ownership"></a>

## Ubuntu repair completion and current records

**Finding ID:** RG-LAB-022. **Subsystem:** Ubuntu managed displays.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Ubuntu repair completion and current records](ubuntu-repair-record-ownership.md).
**Expected benefit:** Keep repair completion attached to its originating computer record.
**Repair revision:** `865631ddb27a3ad67f7560797fbce4739a882077`.

**Location:**

- [src/ubuntu-displays.js](https://github.com/wagnerks1990/RoomGoblin/blob/865631ddb27a3ad67f7560797fbce4739a882077/src/ubuntu-displays.js#L112): 112-117, 191, 198, 208, 219-221, 223, 231-233, 237, 250-251, 260, 265, 269, 276, 278-279, 283, 291.

<a id="ubuntu-screen-mapping-ownership"></a>

## Confirmed Ubuntu screen mappings and uncertain targets

**Finding ID:** RG-LAB-026. **Subsystem:** Ubuntu managed displays.
**Category:** Correctness. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Confirmed Ubuntu screen mappings and uncertain targets](ubuntu-screen-mapping-ownership.md).
**Expected benefit:** Preserve unique physical-output mappings through repair and health updates.
**Repair revision:** `865631ddb27a3ad67f7560797fbce4739a882077`.

**Location:**

- [src/ubuntu-display-health.js](https://github.com/wagnerks1990/RoomGoblin/blob/865631ddb27a3ad67f7560797fbce4739a882077/src/ubuntu-display-health.js#L19): 19.
- [src/ubuntu-displays.js](https://github.com/wagnerks1990/RoomGoblin/blob/865631ddb27a3ad67f7560797fbce4739a882077/src/ubuntu-displays.js#L112): 112-117, 191, 198, 208, 219-221, 223, 231-233, 237, 250-251, 260, 265, 269, 276, 278-279, 283, 291.

<a id="ubuntu-ui-ownership"></a>

## Ubuntu inventory, commands and dialog ownership

**Finding ID:** RG-LAB-019. **Subsystem:** Ubuntu managed displays.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Ubuntu inventory, commands and dialog ownership](ubuntu-ui-ownership.md).
**Expected benefit:** Keep Ubuntu edits and inventory feedback owned by the current selection.
**Repair revision:** `fb1d1e6bbeafd6d7a0f583aed9ed153b89a513f8`.

**Location:**

- [public/managed-displays/index.html](https://github.com/wagnerks1990/RoomGoblin/blob/fb1d1e6bbeafd6d7a0f583aed9ed153b89a513f8/public/managed-displays/index.html#L20): 20.
- [public/managed-displays/ubuntu.js](https://github.com/wagnerks1990/RoomGoblin/blob/fb1d1e6bbeafd6d7a0f583aed9ed153b89a513f8/public/managed-displays/ubuntu.js#L12): 12-14, 16-23, 25, 56-66, 91-95, 97, 110, 156-157, 170-171, 175-177, 179, 182-184, 186-192, 204-205, 207-208, 210-211, 213-216, 219-220, 222-226.

<a id="ubuntu-wizard-ownership"></a>

## Ubuntu wizard input and request ownership

**Finding ID:** RG-LAB-023. **Subsystem:** Ubuntu managed displays.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Ubuntu wizard input and request ownership](ubuntu-wizard-ownership.md).
**Expected benefit:** Retire obsolete wizard probes and fingerprints while preserving the current draft.
**Repair revision:** `865631ddb27a3ad67f7560797fbce4739a882077`.

**Location:**

- [public/managed-displays/ubuntu.js](https://github.com/wagnerks1990/RoomGoblin/blob/865631ddb27a3ad67f7560797fbce4739a882077/public/managed-displays/ubuntu.js#L7): 7, 102, 120-125, 127-132, 134-136, 140, 148, 150-159, 161-162.

<a id="ubuntu-wizard-route-fixture"></a>

## Ubuntu wizard browser-route readiness

**Finding ID:** RG-TEST-UBUNTU-ROUTES-001. **Subsystem:** Ubuntu managed displays.
**Category:** Testing. **Priority:** P2. **Complexity:** Small.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Ubuntu wizard browser-route readiness](ubuntu-wizard-route-fixture.md).
**Expected benefit:** Wait for actual wizard route callbacks before accessing held responses.
**Repair revision:** `039a1fc3506cb0f60f2b31e9a45369005cb88ebb`.

**Location:**

- [test/browser/test_workspaces.py](https://github.com/wagnerks1990/RoomGoblin/blob/039a1fc3506cb0f60f2b31e9a45369005cb88ebb/test/browser/test_workspaces.py#L298): 298-414, 790, 793, 797, 801.

<a id="upload-cancellation-outcome"></a>

## Completed upload cancellation feedback

**Finding ID:** RG-MEDIA-009. **Subsystem:** Resumable media uploads.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Completed upload cancellation feedback](upload-cancellation-outcome.md).
**Expected benefit:** Report upload cancellation according to the committed server outcome.
**Repair revision:** `86ce127636b89e2a2077f225ec1cdff7e29a1ff6`.

**Location:**

- [public/controller/app.js](https://github.com/wagnerks1990/RoomGoblin/blob/86ce127636b89e2a2077f225ec1cdff7e29a1ff6/public/controller/app.js#L567): 567-577, 579, 581-582, 594, 619, 1342-1343, 1345, 1348, 1479, 2118, 2120, 2125.
- [public/controller/display.html](https://github.com/wagnerks1990/RoomGoblin/blob/86ce127636b89e2a2077f225ec1cdff7e29a1ff6/public/controller/display.html#L899): 899, 906-915, 917-920, 933, 936.
- [public/shared/resumable-upload.js](https://github.com/wagnerks1990/RoomGoblin/blob/86ce127636b89e2a2077f225ec1cdff7e29a1ff6/public/shared/resumable-upload.js#L48): 48, 50, 52.
- [src/resumable-upload.js](https://github.com/wagnerks1990/RoomGoblin/blob/86ce127636b89e2a2077f225ec1cdff7e29a1ff6/src/resumable-upload.js#L166): 166.
- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/86ce127636b89e2a2077f225ec1cdff7e29a1ff6/src/server.js#L8416): 8416-8436, 8482, 8484-8485, 8488-8489.

<a id="upload-completion-receipts"></a>

## Resumable upload completion receipts

**Finding ID:** RG-MEDIA-006. **Subsystem:** Resumable media uploads.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Resumable upload completion receipts](upload-completion-receipts.md).
**Expected benefit:** Preserve completion receipts so uncertain upload retries remain idempotent.
**Repair revision:** `43b4d83c394b997f8bb4c845ae0c43d2c4eb7901`.

**Location:**

- [src/resumable-upload.js](https://github.com/wagnerks1990/RoomGoblin/blob/43b4d83c394b997f8bb4c845ae0c43d2c4eb7901/src/resumable-upload.js#L77): 77, 109-133, 137-149, 152, 157-159, 163-164.
- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/43b4d83c394b997f8bb4c845ae0c43d2c4eb7901/src/server.js#L592): 592-602, 8306-8307, 8309, 8313-8316, 8318-8321, 8325, 8357-8363, 8369-8372, 8392, 8394-8395, 8397-8398, 8400-8412, 8414, 8421-8425, 8427, 8429-8453.

<a id="veyon-dialog-ownership"></a>

## Veyon information-dialog ownership

**Finding ID:** RG-LAB-002. **Subsystem:** Veyon lab management.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Veyon information-dialog ownership](veyon-dialog-ownership.md).
**Expected benefit:** Keep Veyon dialog results, passwords and focus within the current session.
**Repair revision:** `1a005b25624575632df6017d4018e77a014449d9`.

**Location:**

- [public/controller/veyon.js](https://github.com/wagnerks1990/RoomGoblin/blob/1a005b25624575632df6017d4018e77a014449d9/public/controller/veyon.js#L8): 8, 76-81, 83-84, 87, 91-92, 96, 220, 222-228, 238-240, 245, 248, 251, 259, 262, 264-272, 331.

<a id="veyon-inventory-ownership"></a>

## Veyon inventory and metadata ownership

**Finding ID:** RG-LAB-001. **Subsystem:** Veyon lab management.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Veyon inventory and metadata ownership](veyon-inventory-ownership.md).
**Expected benefit:** Preserve inventory ownership and command targets across Veyon refreshes.
**Repair revision:** `1a005b25624575632df6017d4018e77a014449d9`.

**Location:**

- [public/controller/veyon.js](https://github.com/wagnerks1990/RoomGoblin/blob/1a005b25624575632df6017d4018e77a014449d9/public/controller/veyon.js#L8): 8, 76-81, 83-84, 87, 91-92, 96, 220, 222-228, 238-240, 245, 248, 251, 259, 262, 264-272, 331.

<a id="weather-forecast-identity"></a>

## Weather forecast identity

**Finding ID:** RG-WEATHER-001. **Subsystem:** Weather workspace.
**Category:** Correctness. **Priority:** P2. **Complexity:** Small.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Weather forecast identity](weather-forecast-identity.md).
**Expected benefit:** Render forecast results only for the current location identity.
**Repair revision:** `f588de3b138429127dfaed2beb1bc558db1b9b47`.

**Location:**

- [public/controller/weather-workspace.js](https://github.com/wagnerks1990/RoomGoblin/blob/f588de3b138429127dfaed2beb1bc558db1b9b47/public/controller/weather-workspace.js#L6): 6, 25, 32-46, 50-56, 67, 70, 73.

<a id="weather-location-search"></a>

## Weather location search ownership

**Finding ID:** RG-WEATHER-004. **Subsystem:** Weather workspace.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Small.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Weather location search ownership](weather-location-search.md).
**Expected benefit:** Keep location search feedback attached to the current query.
**Repair revision:** `770d7a720f825de067ddfd5b81edf77847a09c24`.

**Location:**

- [public/controller/weather-workspace.js](https://github.com/wagnerks1990/RoomGoblin/blob/770d7a720f825de067ddfd5b81edf77847a09c24/public/controller/weather-workspace.js#L25): 25, 27-28, 33-46, 64, 81-82, 85, 89.

<a id="weather-request-admission"></a>

## Weather request allowance admission

**Finding ID:** RG-WEATHER-005. **Subsystem:** Weather workspace.
**Category:** Security. **Priority:** P1. **Complexity:** Small.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Weather request allowance admission](weather-request-admission.md).
**Expected benefit:** Apply shared admission budgets to accepted weather requests.
**Repair revision:** `770d7a720f825de067ddfd5b81edf77847a09c24`.

**Location:**

- [src/server.js](https://github.com/wagnerks1990/RoomGoblin/blob/770d7a720f825de067ddfd5b81edf77847a09c24/src/server.js#L5832): 5832-5833.

<a id="weather-save-ownership"></a>

## Weather settings save ownership

**Finding ID:** RG-WEATHER-002. **Subsystem:** Weather workspace.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Weather settings save ownership](weather-save-ownership.md).
**Expected benefit:** Prevent obsolete saves from replacing newer weather edits.
**Repair revision:** `f588de3b138429127dfaed2beb1bc558db1b9b47`.

**Location:**

- [public/controller/weather-workspace.js](https://github.com/wagnerks1990/RoomGoblin/blob/f588de3b138429127dfaed2beb1bc558db1b9b47/public/controller/weather-workspace.js#L6): 6, 25, 32-46, 50-56, 67, 70, 73.

<a id="weather-scene-ownership"></a>

## Weather scene operation ownership

**Finding ID:** RG-WEATHER-006. **Subsystem:** Weather workspace.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Weather scene operation ownership](weather-scene-ownership.md).
**Expected benefit:** Keep weather scene responses bound to their current selection.
**Repair revision:** `770d7a720f825de067ddfd5b81edf77847a09c24`.

**Location:**

- [public/controller/weather-workspace.js](https://github.com/wagnerks1990/RoomGoblin/blob/770d7a720f825de067ddfd5b81edf77847a09c24/public/controller/weather-workspace.js#L25): 25, 27-28, 33-46, 64, 81-82, 85, 89.

<a id="weather-theme-contrast"></a>

## Weather workspace theme contrast

**Finding ID:** RG-WEATHER-003. **Subsystem:** Weather workspace.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Small.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Weather workspace theme contrast](weather-theme-contrast.md).
**Expected benefit:** Maintain readable weather controls in the supported themes.
**Repair revision:** `f588de3b138429127dfaed2beb1bc558db1b9b47`.

**Location:**

- [public/controller/weather-workspace.css](https://github.com/wagnerks1990/RoomGoblin/blob/f588de3b138429127dfaed2beb1bc558db1b9b47/public/controller/weather-workspace.css#L1): 1-2, 6, 8, 10-11, 14-16.

<a id="windows-alert-ownership"></a>

## Windows alert ownership and hidden captures

**Finding ID:** RG-LAB-005, RG-LAB-006. **Subsystem:** Windows lab agents.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Windows alert ownership and hidden captures](windows-alert-ownership.md).
**Expected benefit:** Keep alert completion and cleanup bound to the initiating lab dialog.
**Repair revision:** `5e1af236aa28a2250d1f210d9ec8ac41422267ce`.

**Location:**

- [public/controller/lab.html](https://github.com/wagnerks1990/RoomGoblin/blob/5e1af236aa28a2250d1f210d9ec8ac41422267ce/public/controller/lab.html#L79): 79, 85, 235, 290-308, 315, 323, 326, 330, 333, 341-348, 360-362, 370-371, 374, 376, 379, 382-383, 386-387, 406, 422, 425-439, 441-442, 445, 452-456, 459-463, 472, 490, 493-499, 501-514, 518, 578, 580, 582, 588, 597, 602, 604-606, 609-612, 632, 634, 638, 640, 643, 649, 656-657, 660, 668, 671-673, 675, 690-691, 693-694, 701, 707, 711-715.

<a id="windows-command-cancellation"></a>

## Native Windows command cancellation

**Finding ID:** RG-LAB-007. **Subsystem:** Windows lab agents.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Native Windows command cancellation](windows-command-cancellation.md).
**Expected benefit:** Terminate native command work when its owner cancels.
**Repair revision:** `0f24c99394bb4bd9dbaed887e94cb3b6a81b0436`.

**Location:**

- [windows-agent/RoomGoblin.Agent.Service/AgentWorker.Transport.cs](https://github.com/wagnerks1990/RoomGoblin/blob/0f24c99394bb4bd9dbaed887e94cb3b6a81b0436/windows-agent/RoomGoblin.Agent.Service/AgentWorker.Transport.cs#L54): 54, 102.

<a id="windows-connection-deadline"></a>

## Native Windows connection deadline

**Finding ID:** RG-LAB-011. **Subsystem:** Windows lab agents.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Native Windows connection deadline](windows-connection-deadline.md).
**Expected benefit:** Bound connection work and retire obsolete transport ownership.
**Repair revision:** `d3a393778059d233b1b311dcf8dc2c3018db6490`.

**Location:**

- [windows-agent/RoomGoblin.Agent.Service/AgentWorker.Connection.cs](https://github.com/wagnerks1990/RoomGoblin/blob/d3a393778059d233b1b311dcf8dc2c3018db6490/windows-agent/RoomGoblin.Agent.Service/AgentWorker.Connection.cs#L176): 176, 188-190, 196.

<a id="windows-enrollment-identity"></a>

## Native Windows enrollment identity preservation

**Finding ID:** RG-LAB-017. **Subsystem:** Windows lab agents.
**Category:** Security. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Native Windows enrollment identity preservation](windows-enrollment-identity.md).
**Expected benefit:** Preserve enrollment identity through Windows bootstrap.
**Repair revision:** `7acaa7a1c725a53494ef5409a1d47d8792d9ad24`.

**Location:**

- [windows-agent/RoomGoblin.Agent.Bootstrap/Program.cs](https://github.com/wagnerks1990/RoomGoblin/blob/7acaa7a1c725a53494ef5409a1d47d8792d9ad24/windows-agent/RoomGoblin.Agent.Bootstrap/Program.cs#L74): 74-76, 497.

<a id="windows-enrollment-origin"></a>

## Native Windows enrollment origin validation

**Finding ID:** RG-LAB-035. **Subsystem:** Windows lab agents.
**Category:** Security. **Priority:** P1. **Complexity:** Small.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Native Windows enrollment origin validation](windows-enrollment-origin.md).
**Expected benefit:** Validate the enrollment origin before accepting bootstrap configuration.
**Repair revision:** `519ca6921e62f0cf8d1b55adbcb9d14da1c0a41d`.

**Location:**

- [windows-agent/RoomGoblin.Agent.Bootstrap/Program.cs](https://github.com/wagnerks1990/RoomGoblin/blob/519ca6921e62f0cf8d1b55adbcb9d14da1c0a41d/windows-agent/RoomGoblin.Agent.Bootstrap/Program.cs#L442): 442, 445.

<a id="windows-enrollment-ownership"></a>

## Windows enrollment request ownership

**Finding ID:** RG-LAB-008. **Subsystem:** Windows lab agents.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Windows enrollment request ownership](windows-enrollment-ownership.md).
**Expected benefit:** Keep Windows enrollment replies attached to the active enrollment session.
**Repair revision:** `0f24c99394bb4bd9dbaed887e94cb3b6a81b0436`.

**Location:**

- [public/controller/lab-enrollment.js](https://github.com/wagnerks1990/RoomGoblin/blob/0f24c99394bb4bd9dbaed887e94cb3b6a81b0436/public/controller/lab-enrollment.js#L4): 4-10, 62-65, 70, 72, 82-84, 86-87.

<a id="windows-inventory-ownership"></a>

## Windows lab inventory ownership and focus

**Finding ID:** RG-LAB-003. **Subsystem:** Windows lab agents.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Windows lab inventory ownership and focus](windows-inventory-ownership.md).
**Expected benefit:** Keep lab inventory and selection stable across polling.
**Repair revision:** `5e1af236aa28a2250d1f210d9ec8ac41422267ce`.

**Location:**

- [public/controller/lab.html](https://github.com/wagnerks1990/RoomGoblin/blob/5e1af236aa28a2250d1f210d9ec8ac41422267ce/public/controller/lab.html#L79): 79, 85, 235, 290-308, 315, 323, 326, 330, 333, 341-348, 360-362, 370-371, 374, 376, 379, 382-383, 386-387, 406, 422, 425-439, 441-442, 445, 452-456, 459-463, 472, 490, 493-499, 501-514, 518, 578, 580, 582, 588, 597, 602, 604-606, 609-612, 632, 634, 638, 640, 643, 649, 656-657, 660, 668, 671-673, 675, 690-691, 693-694, 701, 707, 711-715.

<a id="windows-legacy-task-state"></a>

## Native Windows legacy-task admission

**Finding ID:** RG-LAB-015, RG-LAB-016. **Subsystem:** Windows lab agents.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Native Windows legacy-task admission](windows-legacy-task-state.md).
**Expected benefit:** Preserve legacy task state during native bootstrap reconciliation.
**Repair revision:** `ea648350e200e8f6130ae533d0fb7600790b0d82`.

**Location:**

- [windows-agent/RoomGoblin.Agent.Bootstrap/Program.cs](https://github.com/wagnerks1990/RoomGoblin/blob/ea648350e200e8f6130ae533d0fb7600790b0d82/windows-agent/RoomGoblin.Agent.Bootstrap/Program.cs#L105): 105-107, 117, 532-541, 543-566.

<a id="windows-monitoring-ownership"></a>

## Windows monitoring request ownership

**Finding ID:** RG-LAB-004. **Subsystem:** Windows lab agents.
**Category:** UI/UX. **Priority:** P2. **Complexity:** Medium.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Windows monitoring request ownership](windows-monitoring-ownership.md).
**Expected benefit:** Prevent obsolete monitoring callbacks from replacing current lab state.
**Repair revision:** `5e1af236aa28a2250d1f210d9ec8ac41422267ce`.

**Location:**

- [public/controller/lab.html](https://github.com/wagnerks1990/RoomGoblin/blob/5e1af236aa28a2250d1f210d9ec8ac41422267ce/public/controller/lab.html#L79): 79, 85, 235, 290-308, 315, 323, 326, 330, 333, 341-348, 360-362, 370-371, 374, 376, 379, 382-383, 386-387, 406, 422, 425-439, 441-442, 445, 452-456, 459-463, 472, 490, 493-499, 501-514, 518, 578, 580, 582, 588, 597, 602, 604-606, 609-612, 632, 634, 638, 640, 643, 649, 656-657, 660, 668, 671-673, 675, 690-691, 693-694, 701, 707, 711-715.

<a id="windows-native-lifecycle"></a>

## Native Windows lifecycle process ownership

**Finding ID:** RG-LAB-012, RG-LAB-013, RG-LAB-014. **Subsystem:** Windows lab agents.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Native Windows lifecycle process ownership](windows-native-lifecycle.md).
**Expected benefit:** Preserve native installation and update lifecycle ownership and rollback.
**Repair revision:** `395cb88f4a135ea6b990458d8c53e520d282e5a3`.

**Location:**

- [windows-agent/RoomGoblin.Agent.Bootstrap/Program.cs](https://github.com/wagnerks1990/RoomGoblin/blob/395cb88f4a135ea6b990458d8c53e520d282e5a3/windows-agent/RoomGoblin.Agent.Bootstrap/Program.cs#L99): 99-101, 104-119, 187, 574, 576-577, 579-580, 582-590, 592, 599-600, 602-603, 612, 615-626, 631-632, 635, 640-653.
- [windows-agent/RoomGoblin.Agent.Updater/Program.cs](https://github.com/wagnerks1990/RoomGoblin/blob/395cb88f4a135ea6b990458d8c53e520d282e5a3/windows-agent/RoomGoblin.Agent.Updater/Program.cs#L2): 2, 174, 176-177, 179-180, 182-190, 192, 199-200, 202-203, 212, 215-226, 231-232, 235, 240-253.

<a id="windows-native-resource-bounds"></a>

## Native Windows command and transfer bounds

**Finding ID:** RG-LAB-009, RG-LAB-010. **Subsystem:** Windows lab agents.
**Category:** Reliability. **Priority:** P1. **Complexity:** Medium.
**Compatibility risk:** Medium. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Native Windows command and transfer bounds](windows-native-resource-bounds.md).
**Expected benefit:** Bound native command and download resources before accepting completion.
**Repair revision:** `d3a393778059d233b1b311dcf8dc2c3018db6490`.

**Location:**

- [windows-agent/RoomGoblin.Agent.Service/AgentWorker.Transport.cs](https://github.com/wagnerks1990/RoomGoblin/blob/d3a393778059d233b1b311dcf8dc2c3018db6490/windows-agent/RoomGoblin.Agent.Service/AgentWorker.Transport.cs#L77): 77, 79-80, 84, 124-137.
- [windows-agent/RoomGoblin.Agent.Service/NativeUpdateClient.cs](https://github.com/wagnerks1990/RoomGoblin/blob/d3a393778059d233b1b311dcf8dc2c3018db6490/windows-agent/RoomGoblin.Agent.Service/NativeUpdateClient.cs#L127): 127-129, 131-139, 141-158, 160-164.

<a id="workspace-route-fixtures"></a>

## Workspace held-response fixture readiness

**Finding ID:** RG-TEST-HELD-ROUTES-001. **Subsystem:** Browser regression fixtures.
**Category:** Testing. **Priority:** P2. **Complexity:** Small.
**Compatibility risk:** Low. **Confidence:** Confirmed.
**Evidence, implementation, problem, recommendation and verification:** [Workspace held-response fixture readiness](workspace-route-fixtures.md).
**Expected benefit:** Wait for captured held routes while retaining every browser assertion.
**Repair revision:** `e7c557a1fcde79d7108fa2d9e7024702b7296c27`.

**Location:**

- [test/browser/test_workspaces.py](https://github.com/wagnerks1990/RoomGoblin/blob/e7c557a1fcde79d7108fa2d9e7024702b7296c27/test/browser/test_workspaces.py#L158): 158, 192, 250, 619, 644, 647, 676, 680, 711, 714, 739, 743, 752, 790, 856, 913, 943, 946, 1019, 1134, 2828, 2839, 2872, 2875, 2895, 2900, 2914, 2928, 2944, 2946, 2989, 2992, 3013, 3195, 3217, 3243, 3246, 3272, 3297, 3300, 3511, 3539, 3542, 3595, 3691.
