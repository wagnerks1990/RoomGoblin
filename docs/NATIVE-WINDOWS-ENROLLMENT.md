# Native Windows Enrollment

RoomGoblin's administrator enrollment workflow recommends the native Windows service for new computers while retaining the legacy PowerShell scheduled-task installer as an explicit compatibility fallback.

## Endpoint protection / EDR behavior

RoomGoblin's native package is currently unsigned unless the deployment pipeline is supplied with an approved code-signing identity. Some endpoint-protection products can classify the combination of an interactive PowerShell downloader, newly downloaded unsigned executables, Windows-service creation, one-shot interactive-session helpers, and self-extracted native SQLite support as suspicious behavior.

A production acceptance run on 2026-09-17 showed SentinelOne quarantining the RoomGoblin native executables after a successful first-time enrollment. The endpoint had already exchanged the one-time token for a DPAPI-protected permanent credential and produced fresh native health before quarantine. Treat this as an endpoint-protection deployment concern, not as evidence that broad antivirus exclusions are appropriate.

Operational rules:

- do not disable or stop endpoint protection to install RoomGoblin;
- do not create blanket exclusions for PowerShell, TEMP, Program Files, or the RoomGoblin data directory;
- prefer a publisher-based allow policy after the binaries are Authenticode signed;
- until signing is available, use an administrator-approved exact-file/hash exception for the immutable release artifacts only;
- verify hashes against the Hub's same-origin `/lab-agent/native/manifest.json` before restoring or allowing a quarantined binary;
- after an EDR block, do not issue another enrollment token if `credentialProtected` is already populated; restore/allow the verified release and use bootstrap `repair` with the existing configuration;
- keep the legacy scheduled-task fallback until the native package is accepted by the organization's endpoint-protection policy.

The controller should avoid presenting PowerShell download-and-execute behavior as the long-term deployment model. A browser/package-based enrollment path and signed publisher trust are preferred because they reduce heuristic risk and produce a clearer audit trail.

## Administrator workflow

In the controller's Windows Lab Agent enrollment panel:

1. enter the stable computer ID;
2. choose the short one-time enrollment lifetime;
3. select **Create One-Time Installer**;
4. copy the **Recommended: native Windows service installer** command;
5. run it once from an elevated Windows PowerShell window on the target computer.

The raw one-time enrollment token is displayed only in the generated command. It expires according to the configured enrollment policy and is exchanged for the computer's permanent RoomGoblin credential during the first successful native connection.

## What the generated command does

The controller derives the Hub origin from the server-issued installer URL rather than inventing another endpoint. The command then:

1. creates a unique temporary staging directory;
2. downloads `/lab-agent/native/manifest.json` from the same Hub origin;
3. requires the manifest to contain the exact four expected native files;
4. downloads `RoomGoblinAgent.exe`, `RoomGoblinSessionAgent.exe`, `RoomGoblinAgentUpdater.exe`, and `RoomGoblinAgentBootstrap.exe`;
5. computes SHA-256 for every downloaded file and compares it with the manifest before execution;
6. invokes `RoomGoblinAgentBootstrap.exe install` with the Hub URL, stable agent ID, and one-time enrollment token;
7. supplies `--allow-http` only when the current RoomGoblin deployment itself uses HTTP;
8. removes the temporary package after a successful bootstrap run.

The generated installer does not use `Invoke-Expression`, pipe downloaded script text into PowerShell, or accept arbitrary filenames from the manifest.

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
