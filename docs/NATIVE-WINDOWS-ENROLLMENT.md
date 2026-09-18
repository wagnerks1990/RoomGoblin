# Native Windows Enrollment

RoomGoblin's administrator enrollment workflow recommends the native Windows service for new computers while retaining the legacy PowerShell scheduled-task installer as an explicit compatibility fallback.

## Administrator workflow

In the controller's Windows Lab Agent enrollment panel:

1. enter the stable computer ID;
2. choose the short one-time enrollment lifetime;
3. select **Create One-Time Installer**;
4. download **RoomGoblinNativeAgent.zip** in the target Windows browser;
5. download the matching one-time enrollment JSON;
6. extract the ZIP, place the JSON in the extracted directory, and run the native bootstrap elevated with `--enrollment-file`.

Example:

```powershell
.\RoomGoblinAgentBootstrap.exe install --enrollment-file .\roomgoblin-enrollment-LAB-PC-01.json
```

The recommended path no longer requires PowerShell to download and immediately execute unsigned binaries. The automated PowerShell native installer remains available only as an explicit fallback for environments whose endpoint-protection policy permits that process chain.

The raw one-time enrollment token is displayed only in the generated command. It expires according to the configured enrollment policy and is exchanged for the computer's permanent RoomGoblin credential during the first successful native connection.

## HTTPS primary with LAN fallback

When managed Cloudflare HTTPS is recorded, newly issued enrollment artifacts prefer that public HTTPS RoomGoblin origin. Both the native service and legacy PowerShell agent convert HTTPS to WSS for the long-lived control channel and preserve the current/requested LAN origin as `fallbackHubUrl`.

After an authenticated handshake, an updated agent may accept a server-advertised preferred Hub origin only when it is HTTPS. Before promoting it, the agent preserves its current origin as fallback. Reconnect and native self-update both try the preferred origin first and the fallback second.

HTTP primary or fallback origins require explicit insecure-LAN acknowledgement during bootstrap. Existing agents therefore retain a local path when Cloudflare or the Internet is unavailable.

Cloudflare Access on the main RoomGoblin hostname can require interactive browser authentication. Do not assume unattended agents can satisfy that challenge; use an Access-compatible machine policy before combining those features.

## Native package and enrollment file

The appliance publishes `/lab-agent/native/RoomGoblinNativeAgent.zip` containing the exact four native executables plus `manifest.json`. The browser-generated enrollment JSON uses the schema `roomgoblin-native-enrollment-v1` and contains the Hub origin, stable agent ID, one-time enrollment token, HTTP acknowledgement when applicable, and optional publisher thumbprint.

When `--enrollment-file` is used, the bootstrap:

1. requires `manifest.json` beside the bootstrap;
2. requires exactly the four allowlisted native executable entries;
3. computes SHA-256 for each executable and compares it with the package manifest before installation;
4. reads the enrollment JSON and immediately deletes the plaintext enrollment file;
5. validates the schema, Hub URL, agent ID, enrollment-token bounds, HTTP policy, and optional publisher thumbprint;
6. DPAPI-protects the enrollment token before writing the compatibility configuration;
7. installs the service only after all package and enrollment checks pass.

The older automated PowerShell native path still downloads `manifest.json`, limits downloads to the exact four filenames, verifies SHA-256 for each executable, and then invokes the bootstrap. It remains a fallback rather than the recommended workflow.

## Bootstrap security

The bootstrap performs a second boundary at the endpoint:

- fresh enrollment requires `--hub-url`, `--agent-id`, and `--enrollment-token` together;
- HTTPS is the default; HTTP requires explicit `--allow-http` acknowledgement;
- the agent ID is bounded and restricted to a stable safe identifier;
- the one-time token is protected with Windows LocalMachine DPAPI before `lab-agent.json` is written;
- the compatibility data directory and configuration ACLs are restricted to `SYSTEM` and local `Administrators`;
- the service is installed as `LocalSystem` with automatic startup and SCM recovery;
- native health must become fresh before installation is accepted;
- a newly created fresh-enrollment config is removed if native health acceptance fails.

The permanent credential returned by the Hub remains DPAPI-protected by the native service. RoomGoblin does not add a workstation-side inbound listener or arbitrary shell execution.

## Legacy compatibility

The enrollment API continues to return its historical `installCommand` and `installerUrl`. Existing tooling and regression tests therefore remain compatible. The controller places the legacy scheduled-task command inside a clearly labeled fallback disclosure instead of removing it during the native rollout.

Do not remove the legacy installer until reboot persistence, native self-update, uninstall/legacy restore, and representative fleet rollout are accepted.

## Validation

Repository validation must cover all of these surfaces:

- native .NET build on Windows;
- source regressions for DPAPI, ACLs, HTTP opt-in, health rollback, and allowed native files;
- controller regression proving the native command is preferred;
- manifest SHA-256 verification in the generated command;
- continued visibility of the legacy fallback;
- Docker packaging of the exact four native binaries plus manifest.

The production appliance has already been validated serving the native package and migrating an existing enrolled endpoint. Fresh first-time enrollment still requires live endpoint acceptance for each materially changed release build.
