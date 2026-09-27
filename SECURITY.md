# Security policy

OpenDefence treats external data, provider payloads, credentials and edge synchronization inputs as untrusted by default.

## Reporting

Report security issues privately to the project maintainers. Do not publish credentials, exploitable production configurations or sensitive customer data in a public issue.

## Design rules

- Keep API keys and private credentials out of browser bundles and source control.
- Validate provider responses before they enter trusted application state.
- Preserve provider IDs, timestamps and transformation provenance.
- Prefer least-privilege credentials and explicit policy decisions.
- Separate operator-specific command transports from the public SDK.
- Record security-relevant actions in an auditable log.
- Pin production versions and review dependency changes.
- Treat cached/offline data as potentially stale and carry freshness metadata.

## Scope boundary

The public project is for systems engineering, resilience, situational awareness, defensive cyber posture and interoperability. Weapon-control, electronic-attack and offensive-cyber functionality is outside the public-core scope.
