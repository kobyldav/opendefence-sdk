# Contributing

## Before adding capability

A new API should answer four questions:

1. Does it belong in an existing generic engine rather than as another alias?
2. What fidelity tier does it provide?
3. What provenance/uncertainty information must survive the transformation?
4. Can it remain dependency-light and portable across edge runtimes?

## Development

```bash
npm install
npm run check
```

Add tests for every deterministic calculation and provider-normalization path. Live network tests should be optional and must respect provider usage policies.

## Package boundaries

Low-level packages must not import `@opendefence/sdk`. Dependencies should point downward toward small primitives. Provider-specific behavior belongs behind interfaces.

## Public-core boundary

Do not submit weapon targeting, fire-control, engagement optimization, jamming/electronic attack, offensive cyber exploitation or direct operator-specific satellite command implementations to the public core.
