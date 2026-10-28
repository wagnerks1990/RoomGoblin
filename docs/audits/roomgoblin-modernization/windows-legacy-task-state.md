# Native Windows legacy-task admission

RG-LAB-015 reproduces a failed native installation re-enabling and starting an
already-disabled legacy task. RG-LAB-016 reproduces successful native installation
after Task Scheduler rejected disabling the legacy runtime. The enabled-task
rollback control passes against the same original Install body.

Migration now reads the registered enabled property, preserves disabled state on
rollback and requires successful disable before touching the native service.
Read-only Task Scheduler COM lookup replaces a localized CLI existence check
that treated every nonzero status as absence. Only ERROR_FILE_NOT_FOUND from the
task lookup means missing; connection, folder, access and property errors remain
failures. RCWs are released in reverse acquisition order. The admission wait is
30 seconds; Windows COM does not expose cancellation here, and a late background
read cannot mutate state or outlive the bootstrap process.

The first 20 isolated cases passed. Adding a real Windows read-only absent-task
probe exposed .NET's FileNotFoundException mapping of the missing-task HRESULT.
The repair handles that mapping only at task lookup; mapped connection/property
errors remain fatal. The expanded 24-case suite also covers original task state,
the real deadline, COM release, rejected disables and untouched native-service
ownership. All 24 cases pass locally on .NET 10, along with all 36 lifecycle
cases. The locked bootstrap project builds with zero warnings/errors. Final
Linux qualification passes 2,169 tests with zero failures and two root-only
skips, all 23 Host Recovery cases and syntax/controller/shell checks. Browser
sources remain at qualified `32416c9` (270 Chromium and 106 workspace/Veyon
Firefox cases). Required .NET 8 Windows CI, checked merge, exact publication and backed-up delivery remain
pending. No workstation task or service was created, controlled or enrolled.
Explicit uninstall's documented legacy restoration behavior is preserved.
Real absent-task lookup is read-only; migration acceptance remains separate.
Fresh-enrollment arguments overwriting an existing configuration have a separate
local reproduction and remain queued for the next identity-preservation repair.

References: Microsoft's [registered Enabled property](https://learn.microsoft.com/en-us/windows/win32/api/taskschd/nf-taskschd-iregisteredtask-get_enabled)
and [task lookup error contract](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-tsch/528539ab-2678-4184-9573-cd624916ef9a),
plus [.NET HRESULT exception mapping](https://learn.microsoft.com/en-us/dotnet/standard/native-interop/how-to-map-hresults-and-exceptions).
