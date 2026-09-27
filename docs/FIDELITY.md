# Fidelity and validation

OpenDefence deliberately distinguishes deterministic arithmetic from first-order engineering approximations and provider data.

A production integration should maintain a verification matrix containing:

- function or model
- requirements reference
- unit convention
- source/reference implementation
- accepted error tolerance
- test vectors
- supported input envelope
- known singularities
- provider/version assumptions
- certification status, if any

The included two-body orbit propagator, spherical/geodesic helpers, free-space RF model and simple estimation filters are architecture tools. High-fidelity operational work should substitute independently validated domain implementations behind the provided interfaces.
