# Architecture notes

OpenDefence uses a layered architecture:

1. Provider adapters fetch or receive external data.
2. Normalizers map external schemas into stable SDK models.
3. Provenance, timestamp, uncertainty and quality metadata remain attached.
4. Engineering packages operate on normalized models.
5. Edge event logs preserve state while disconnected.
6. Digital twins materialize application-facing state from events.
7. Simulation reuses the same models for deterministic testing.

## Package dependency direction

Core packages never depend on the high-level SDK facade. Domain packages depend only on the lowest-level packages they need. `@opendefence/sdk` is the only package that intentionally depends on nearly every capability.

## Safety boundary

Public packages are limited to systems engineering, data interoperability, situational awareness, resilience, defensive cyber posture and generic estimation. Weapon-control, electronic-attack and offensive-cyber capabilities are out of scope.

## Fidelity boundary

First-order models are explicit. Higher-fidelity models should be added behind stable adapter interfaces and validated independently.
