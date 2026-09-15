# Room topology (retired)

The room topology feature was removed at the operator's request because the
Displays & AV configuration was unreliable. Use the **TV Routing Matrix**, its
TV/source drawers, the Settings display editor and the original receiver Setup.

The previous editor, target-picker overrides, ordering observer and server-side
projection wrappers are removed. The normal receiver/group and Pluto label stores
are authoritative again. Already-saved values and all stable identities remain.
The historical `room.topology` preference is retained untouched for recovery; it
must not override current configuration. Old topology-only saves return HTTP 409
and require reloading the controller.

See [TV Routing Matrix](TV-Routing-Matrix) for controls, data preservation,
upgrade, rollback and verification. This page remains at its old path so existing
links do not suggest that the retired editor is still an operator workflow.
