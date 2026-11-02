# Android service socket ownership

[Finding classification and immutable source locations](finding-metadata.md#android-socket-lifecycle).

RG-LAB-037 reproduces service destruction leaving accepted clients open. The
existing executor interrupts workers and discards queued tasks, but neither action
closes their sockets. The initial real-socket fixture fails shutdown while queue
overflow rejection and normal handler completion pass.

The service now tracks accepted sockets before queueing them. Registration checks
service and listener ownership under the listener lock. Worker completion,
admission rejection and setup failure close and release only their socket.
Destruction closes admission, then active and queued clients, then the executor.
A retiring listener closes its own server socket without clearing a newer one.
Ordinary listener replacement preserves already-accepted client work.

The JVM fixture compiles actual service fields, listener and destruction methods
with Android callbacks substituted and a blocking socket handler. Four loopback
cases pass: complete shutdown, saturation rejection, normal completion and
listener replacement. Seven existing Android hardening cases pass; their static
rejection assertion now checks the shared close path. The JVM check is added to
the existing Validate Android job without renaming any required workflow.

Supported Linux qualification passes 2,399 tests with zero failures and two
root-only skips, all 23 Host Recovery cases, all four JVM cases and the required
syntax/controller/shell checks. Browser sources remain unchanged from the
126-case-per-engine qualification. These checks do not install an APK or exercise
Android framework lifecycle, physical devices or root commands. Existing request
parser limits, idle timeout, worker/queue bounds and token authorization remain.
