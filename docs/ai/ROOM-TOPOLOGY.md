# Matrix workflow after topology removal

Read `docs/TV-ROUTING-MATRIX.md` before changing Displays & AV or receiver setup.
The operator explicitly retired room topology. Do not reintroduce its editor,
API monkey patches, target overrides, ordering observer or persisted preference
projection as a cleanup or recovery measure.

`devices`/`displayGroups` and the existing Pluto labels are authoritative. Preserve
stable receiver IDs/URLs, enrollment credentials, AV output mappings, source
endpoint IDs, disabled state and unrelated fields. The old `room.topology`
preference is archived data only; neither ordinary reads nor saves may mutate it.
Reject old topology-bearing display saves with HTTP 409 even when they also
contain a devices map, so cached editors cannot overwrite current configuration.

Keep the TV Routing Matrix first and use its original TV/source drawers. Setup
uses receiver count/IDs; Settings owns receiver mappings/groups. A matrix port
without a receiver can be renamed without creating a receiver. Surface save
errors and partial success; never claim both writes succeeded after one failed.
Build changed matrix markup once; retain unchanged controls during polling and
preserve open drawer drafts. Avoid page-wide mutation observers and rebuilding
hidden editors. The existing automation target expansion helpers remain for
compatibility; runtime code does not read archived topology. Do not revert
scheduler or priority fixes as part of this UI removal.

Retain Morning Announcements priority, scheduler reconciliation, Background Music,
native Sendspin, managed-device state and ADB trust. Use the validation checklist
in `docs/ai/ROOM-TOPOLOGY-VALIDATION.md`; distinguish browser fixtures from physical
hardware acceptance.

## Receiver editor recovery

The receiver editor lives in the collapsed `receiverSettings` form under Displays
& AV, linked from Settings and the TV drawer. Keep its `RECEIVERCFG` draft separate
from poll-refreshed `S.avConfig`. Preserve drafts when editing/removing groups.
Do not infer receiver IDs from output numbers or choose the first of several
receivers sharing an output. Receiver tools require a unique saved assignment;
physical matrix routing and power remain independent. Cleanup of empty repeated
`display-` groups is explicit and limited to the draft until saved; never rewrite
schedule references or delete nonempty/custom groups automatically. Follow
`docs/TV-ROUTING-MATRIX.md` for recovery and validation details.
