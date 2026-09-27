# Provider guide

Provider adapters should do as little policy as possible. Their job is to authenticate, request, validate and normalize external data while retaining raw metadata needed for traceability.

## Recommended pattern

```ts
export interface ExampleProvider {
  readonly id: string;
  query(input: ExampleQuery): Promise<NormalizedResult[]>;
}
```

Use `HttpClient` for rate limiting, retries, timeout, caching, deduplication and telemetry. Respect the upstream provider's update cadence and usage policy rather than polling merely because the SDK can retry.

Normalize dates into `Date`, coordinates into explicit coordinate models, numeric units into documented SI units where possible, and always attach provenance.

Do not silently convert an approximate model into an apparently precise result. Add a fidelity note or adapter boundary instead.
