# Windows daily-code sign-in pilot

RoomGoblin can create an optional, offline daily access code for a selected group
of Windows x64 computers. Students enter only the code at Windows sign-in to open
the existing standard local account. This is a shared access gate, not individual
identity verification or multifactor authentication.

This feature requires explicit local installation. A Hub update or normal Lab
Agent update never enables it. Windows console sign-in, unlock, recovery and
endpoint-protection acceptance must pass on a disposable VM before wider use.
Automated builds and algorithm tests do not establish that live acceptance.

## Operator workflow

Open **Lab Computers > Daily computer sign-in** as an administrator over HTTPS,
or through a localhost connection to the Hub. Create a group and choose its IANA
timezone. **Show today's code** reveals eight digits for the displayed calendar
date, then hides them after one minute. There is no yesterday/tomorrow grace day.

Download a separate encrypted enrollment for each selected Windows computer.
Enter its exact computer name (up to 15 characters), local account name and an
enrollment passphrase of at least 16 characters. The encrypted file expires for
new installations after 24 hours. Enrollment expiry does not expire an installed
computer's offline access. The Hub does not save the passphrase.

Download `RoomGoblinDailySignIn.zip` from the same trusted Hub release or the
`RoomGoblin-daily-signin-win-x64` artifact of the reviewed commit's Validate run.
The package contains only `RoomGoblinSignIn.exe`,
`RoomGoblinCredentialProvider.dll` and their size/SHA-256 manifest. Hashes detect
corruption, not publisher identity: obtain both files and manifest from the
trusted release. The initial pilot is not represented as Authenticode signed.
Use normal administrator-approved endpoint policy; never disable EDR, Defender,
application control or Windows protections to install it.

On a spare PC or VM:

The dedicated standard local account must already have **Password never expires**
enabled. Installation checks this before changing the account and does not modify
Windows password-expiry policy. The hidden Windows credential cannot complete an
interactive expired-password change. If device policy requires periodic Windows
password changes, this first pilot is not compatible with that policy.

1. Take a VM snapshot or tested system backup. Keep the separate local
   administrator account's password and recovery access available.
2. Sign the esports account out completely, including disconnected sessions.
   Sign into the separate local administrator desktop. The installer verifies
   that administrator's nonblank password.
3. Extract the package. Open an elevated PowerShell terminal there and run:
   `./RoomGoblinSignIn.exe install "C:\path\roomgoblin-daily-signin-enrollment.json"`.
4. Enter the enrollment passphrase privately. Type `ENABLE` to apply the reviewed
   local change. Installation refuses administrator targets, a nonblank target
   password, another computer's file, expired files, existing sign-in state,
   active esports sessions, and a different account's configured auto-logon.
5. Test from Windows **Sign-in options > RoomGoblin daily code** on the enrolled
   account. The normal Windows password option remains available, but students
   do not receive the underlying random password. Administrator sign-in remains
   independent of RoomGoblin, its service and the network.
6. Delete the encrypted enrollment file after successful testing. Keep its
   passphrase separate until then. Do not share enrollment files with students.

The first pilot intentionally supports the described blank-password standard
local account only. Domain/Entra accounts, existing password/Hello migrations,
ARM64, RDP, UAC credential prompts, and automatic deployment are outside this
pilot. Other local user accounts are not restricted by this feature. Remove or
secure any other student-accessible account through the normal device policy.

## Installed changes and recovery

The optional service is `RoomGoblinDailySignIn`, running as LocalSystem from
`C:\Program Files\RoomGoblin\SignIn`. It has no network listener and makes no
network requests. Identity and attempt state live in
`C:\ProgramData\RoomGoblin\DailySignIn`, protected with machine DPAPI and ACLs
limited to SYSTEM and local Administrators. The existing Lab Agent's service,
enrollment, data directory and four-file updater contract are unchanged.

Installation preserves the existing account SID/profile. It changes the blank
password to a unique random password using Windows' password-change API,
disables automatic sign-in, removes the saved auto-logon password, disables
Automatic Restart Sign-On, and registers the optional credential provider. It
does not install a provider filter or disable Microsoft's recovery providers.
An installation interruption leaves protected recovery material before the
Windows password mutation. Do not manually delete that material while the
account still depends on it.

To remove the gate, sign the esports account out, sign in as the separate
administrator, open elevated PowerShell, and run:

```powershell
& "C:\Program Files\RoomGoblin\SignIn\RoomGoblinSignIn.exe" recover
```

Enter and confirm a new manual Windows password of at least 16 characters.
Recovery changes the password using the prior credential, verifies it, removes
the provider registration, stops/deletes the service and removes protected state.
A journal preserves both sides of an interrupted password change for retry.
Automatic sign-in and Automatic Restart Sign-On remain disabled. After reboot,
the administrator can remove the sign-in program directory and empty policy
directory. Reverting the VM snapshot/system backup is the full pre-install
rollback. Do not roll out if this recovery procedure fails in the pilot.

There is no automatic sign-in component update in this version. Use the recovery
procedure, remove the old files after reboot, then explicitly install the reviewed
replacement. Updating the ordinary Lab Agent does not replace the credential DLL.

## Offline and security contract

The Hub stores one random 256-bit seed per group in encrypted SQLite secret
storage, separate from lab enrollment credentials. Enrollment uses AES-256-GCM,
PBKDF2-HMAC-SHA256 with 600,000 iterations, a 16-byte random salt, a 12-byte nonce
and authenticated format identifier. It contains the exact computer/account,
group ID, immutable timezone and seed.

For a calendar date `YYYY-MM-DD` in that configured timezone, both implementations
compute HMAC-SHA256 over UTF-8:

```text
roomgoblin-daily-signin-v1\n<group-id>\n<YYYY-MM-DD>
```

The first eight digest bytes, interpreted unsigned big-endian, modulo 100,000,000
produce the zero-padded eight-digit code. This is a reusable daily access code,
not RFC 6238 TOTP or replay-resistant MFA. Codes and seeds are never audited,
broadcast to receivers, put into URLs, or included in ordinary group lists.

The local service validates the account SID and rejects administrator targets on
each request. A SYSTEM-only local named pipe accepts only the system LogonUI
process. The provider verifies the server's SYSTEM identity and fixed installed
executable path before sending a code. IPC has fixed size and five-second
deadlines. Only successful local validation releases the account credential to
Windows Negotiate/LSA. The service saves the attempt state before releasing it.
Five failures start a one-minute cooldown, increasing to at most 15 minutes.
Cooldowns survive restart. Missing/corrupt identity or attempt state fails closed.

Both clocks must be correct. The configured timezone is independent of the
student's Windows display timezone. A rollback of more than five minutes from
the latest recorded attempt is rejected; this is not a tamper-proof clock.
Students must not have administrator, firmware or offline disk access. Local
administrators can recover protected material or change the installation; DPAPI
is not protection against a local administrator.

A shared group seed on one compromised computer exposes that group's future
codes. Separate groups limit that impact. There is no immediate offline
revocation, seed rotation, group editing, central used-code tracking or proof of
physical installation. To revoke an installed computer, use local administrator
recovery. To replace a compromised group, create a new group and reenroll every
member. Old group deletion must never be presented as remote revocation.

Changing the date/code does not end an already-open session. Schedule a separate
lock/logoff through the existing lab controls if required. Test existing game
launchers, saved credentials, sleep/resume, lock/unlock and Windows updates.

## Validation and physical acceptance

Run `node --test test/daily-signin.test.js` for real encrypted SQLite group storage,
atomic failure, dates/DST, authenticated enrollment, authorization, transport and
quotas. `python tools/test-daily-signin.py` executes the actual C# code against
Node-generated vectors and encrypted enrollment, including expiry, wrong-machine
rejection, restart cooldown, rollover and clock rollback. These tests never
install a service/provider or mutate Windows accounts.

`windows-agent/scripts/Build-Daily-SignIn.ps1` builds the .NET executable and
native C++ provider with MSVC; Docker builds the same provider with MinGW. Both
produce a separate sign-in package. Run the normal RoomGoblin Linux validations.

Before production acceptance, record actual results for: signed-in admin
recovery, correct/incorrect code, blank password rejection, password/PIN/Hello
alternate-path attempts, no-network cold boot, stopped/crashed service, persisted
cooldown, midnight/DST/clock rollback, sleep/resume and unlock, account deletion
and replacement, interrupted installation/recovery, EDR behavior, native C++
serialization and Windows update compatibility. Until these pass, use only the
disposable VM/spare-PC pilot and retain a draft PR.
