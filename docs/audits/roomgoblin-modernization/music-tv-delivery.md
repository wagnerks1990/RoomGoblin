# TV audio recovery and search delivery

PR [#303](https://github.com/wagnerks1990/RoomGoblin/pull/303) merged as
`2b0c79aa5c3fe7abfdbe593358413bf48c8945eb` after all 14 PR checks and resolved reviews.
All five main workflows, including exact Hub and maintenance image publication,
passed. The normal updater completed on 2026-10-28T03:49:03.512734+00:00.

The selective plan recreated only the Hub. Clean main and the healthy Hub image
match the merged commit; the existing healthy maintenance container was retained.
Control/media/Host Agent health, readiness, canonical SQLite, eight secret
decryptions, DB/ADB modes, authorization and served assets passed. The final
selective plan requires no further changes and no update request remains.

Backup `auto-operational-2026-10-28T03-48-49-972Z.zip` is 128788095 bytes, mode 0600.
SHA-256: `31b7719244b1104ada1f412361bb2d1cd35140157eff8f6ad23495be1827f06e`.
Checksum, ZIP CRC, operational scope, canonical-only database membership and
extracted SQLite integrity passed. Rollback to `4f9e3da9b204ce111b2c017d7f96c449d8faffe7`
is available with the prior images; rollback was not exercised.

No physical classroom commands, receiver reloads or production fault injection
were performed. This verifies appliance delivery, not physical audio acceptance.
The wider modernization remains active.
