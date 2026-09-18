# RoomGoblin Controller

## Host-network deployment contract

The Linux Hub and maintenance containers, plus reviewed managed add-on templates, now use host networking. Maintenance is loopback-only; custom ports are actual listeners. Preserve explicit bind addresses, persistent mounts and secrets, and never silently recreate adopted containers. See [Host networking and migration](HOST-NETWORKING.md) for preflight, port inventory, compatibility, acceptance tests and rollback. Do not reintroduce Docker service DNS or port-publishing assumptions.

Normal configuration is structured and validated; advanced raw configuration remains available only where an integration has settings not yet represented by a form.

## Design rules
- Classroom operations stay separate from infrastructure administration.
- Stable display IDs are preserved across renames.
- Display and lighting target domains remain separate.
- Normal users do not need to edit JSON, YAML, or environment files.
- Advanced infrastructure actions remain in System Management.


## Authentication roles (alpha.14)
- Read Only (`viewer`): authenticated status/read access.
- Operator / Teacher (`operator`): read access plus normal classroom control actions.
- Administrator (`admin`): full configuration, users, secrets, database, maintenance and recovery.

Administrator troubleshooting endpoint: `GET /api/v1/admin/health`.

## Integration connection settings

Administrators configure MQTT/Govee, Pluto AV matrix, and Veyon classroom-computer connections under **Settings → Integrations & Hardware**. Saving validates URL schemes and numeric bounds, stores non-secret values in SQLite, encrypts MQTT passwords and Veyon private keys, and applies the settings without an application restart. Secret fields are write-only: the controller reports whether a value exists but never receives it back.

Environment values remain first-start and migration fallbacks. Once the form is saved, its database record is authoritative. Host/container boundary settings and bootstrap credentials remain outside this screen because they are required before the application can safely open its database and serve the controller.

## Classroom display access

Enabled configured displays connect through their stable `/display/<id>` URLs without credentials by default. Under **Settings → Classroom Display Access**, administrators may optionally create expiring one-use enrollment links, inspect coverage, revoke credentials, and enable **Require individual display credentials** after every receiver is enrolled. Raw credentials are never listed.

Turning the requirement off immediately restores stable URL access. The legacy shared display token is only a fallback when credential authentication is enabled.

## Cross-domain scheduled actions (alpha.17)

Each scheduled action owns a target domain. Display actions select display clients, TV power selects TV targets, and Govee actions select lighting groups/devices. Actions do not implicitly clear display content; a clear is performed only by an explicit display action.

Additional actions may reuse the main event targets only when both actions use a compatible target domain. Cross-domain actions require explicit targets in the editor. For compatibility, a legacy or empty cross-domain step uses the domain's **All** target at execution time and is written with that default the next time the automation is saved.

An automated TV-power step with **All TVs**, **All HDMI TVs**, or **All HDBT TVs** uses the matching Pluto broadcast CEC command, the same command used by the Room controls. A selected set of TVs continues to use individual output commands.

An explicit target selected on an additional action overrides the linked class's display defaults. Class defaults are used only when that cross-domain display action has no explicit target of its own.

## Scheduled automation workspace

Scheduled automations are selected from time-ordered dropdowns rather than expanded cards. Class-linked automations sort by earliest resolved occurrence. The action editor shows only controls relevant to the selected action and uploaded media type.

Execution is pass-based: Run once participates only on pass 1, Loop X times participates through X passes, and Loop continually participates every pass until the occurrence ends or is superseded/cancelled.
