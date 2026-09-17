# Community chat and pilot files in the browser

The Veyon page adds **Two-way chat** and **Browse pilot files**, each for one
selected computer. Both require the matching RoomGoblin native pilot on the
appliance and community plugins on the endpoint. Stock Veyon 4.11.2 alone does
not implement these routes. A Hub update does not install native components.
Use disposable matching Linux desktop VMs and sample data; Windows packaging
and physical endpoint acceptance remain outstanding.

Chat displays student replies as plain text. A teacher send is marked unverified;
a successful HTTP response does not prove the student saw it. Each conversation
retains at most 100 messages of 2000 characters in memory. Closing or hiding the
workspace attempts to stop it; endpoint conversations expire after 15 minutes
if the browser disappears. Reopen to continue. Nothing is archived by the Hub.
Native debug logging can include message contents and should remain disabled.

The file browser lists the student's existing `RoomGoblin-Pilot` folder, opens
subdirectories and downloads complete files up to 8 MiB. It cannot upload, delete,
or browse outside that folder. Listing is capped at 1000 entries. Transfers use
128 KiB chunks, a 60-second native deadline, and exact byte-count verification;
a Save link appears only after the entire file arrives. This is the community
file browser, not Veyon's separate distribution/collection workflow. The native
folder policy is not a race-resistant sandbox against a hostile local user.

Both tools require `lab.control` and `lab.sensitive.read`. The Hub binds opaque
browser sessions to their user, saved computer identity and exact authenticated
native connection. Eight sessions at most; no automatic reconnect, command retry,
or persistence across restarts. A connection change requires reopening. The
file plugin retains its existing first-teacher connection restriction: a new
native connection can require restarting the disposable endpoint service.

## API and implementation

`POST /api/v1/veyon/computers/:id/browser/:action` uses normal session/CSRF checks,
no-store responses and a shared 600/minute budget including polling/chunks.
Actions are `open`, `close`, `state`, `send`, `roots`, `list`, `download`, `chunk`.
Payloads are validated and reconstructed; arbitrary native protocol forwarding
is not exposed. Each session permits only one in-flight request. Asynchronous
work remains counted for Full Recovery Export even if the HTTP client closes.
The browser polls while visible, serializes requests, clears sent text and
renders replies with textContent. Endpoint/private authentication UIDs never
enter browser responses. A lost response is an uncertain outcome, not a retry.

The pinned source preparer adds a fixed authenticated WebAPI route and a typed
plugin interface. It retains upstream checkConnection/lookupConnection and
worker-thread dispatch. GPL native adapter source remains separate from the MIT
Hub. File listing replies now echo request IDs to reject stale responses.

## Acceptance

Automated tests cover ownership, identity changes, revoked authorization,
expiry, resource release, argument limits, response projection and browser chat
rendering. Native compilation and browser CI must pass before merge. Automated
fixtures do not prove real endpoint operation. Test a matching teacher/student
pair: student replies, close/expiry, wrong caller, refused access, missing plugin,
empty/multichunk files, checksum equality, out-of-folder rejection, disconnect,
and interrupted/oversized downloads. Revert the disposable VM snapshot to remove
the pilot; preserve production packages, keys and authentication rules.

The AI detection service, full remote mouse/keyboard control, clipboard reading,
monitor selection and native distribution/collection adapters are not implemented
by this change. They must not be described as enabled.
