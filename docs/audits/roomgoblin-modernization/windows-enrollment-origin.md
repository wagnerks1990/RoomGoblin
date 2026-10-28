# Native Windows enrollment origin validation

[Finding classification and immutable source locations](finding-metadata.md#windows-enrollment-origin).

RG-LAB-035 reproduces three primary-URL failures: username/password, username-only
and percent-encoded user information reached configuration and ACL preparation.
The fallback writer already rejected embedded credentials. The new cases execute
the actual configuration writer; all fifteen unchanged controls pass on old code.

The primary writer now rejects nonempty URI user information before filesystem or
ACL changes, matching the fallback boundary. Valid HTTPS origins and explicit
HTTP primary/fallback acknowledgements retain their existing behavior. Primary
HTTP permission does not authorize an HTTP fallback. No enrolled configuration,
credential, compatibility path or native service is migrated.

All 18 native enrollment cases pass locally on .NET 10 with zero warnings/errors.
Temporary-file fixtures substitute DPAPI and ACL execution; they do not claim
effective workstation ACL or installation acceptance. Supported Linux qualification
passes 2,386 tests with zero failures and two root-only skips, all 23 Host Recovery
cases and syntax/controller/shell checks. Required .NET 8 CI remains a delivery
gate. Public sources are unchanged from the 125-case Chromium/Firefox qualification.
