export type Vector = number[];
export type Matrix = number[][];
export interface GaussianEstimate { mean: Vector; covariance: Matrix; }

function assertSquare(m: Matrix): void {
  if (m.length === 0 || m.some(r => r.length !== m.length)) throw new Error("Matrix must be non-empty and square");
}
export function identity(n: number): Matrix { return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0)); }
export function transpose(m: Matrix): Matrix { return m[0]?.map((_, j) => m.map(row => row[j]!)) ?? []; }
export function matMul(a: Matrix, b: Matrix): Matrix {
  if ((a[0]?.length ?? 0) !== b.length) throw new Error("Matrix dimension mismatch");
  return a.map(row => (b[0] ?? []).map((_, j) => row.reduce((s, v, k) => s + v * b[k]![j]!, 0)));
}
export function matAdd(a: Matrix, b: Matrix): Matrix { return a.map((r, i) => r.map((v, j) => v + b[i]![j]!)); }
export function matSub(a: Matrix, b: Matrix): Matrix { return a.map((r, i) => r.map((v, j) => v - b[i]![j]!)); }
export function matVecMul(a: Matrix, v: Vector): Vector { return a.map(r => r.reduce((s, x, i) => s + x * v[i]!, 0)); }
export function vecSub(a: Vector, b: Vector): Vector { return a.map((x, i) => x - b[i]!); }
export function inverse(m: Matrix): Matrix {
  assertSquare(m);
  const n = m.length;
  const a = m.map((r, i) => [...r, ...identity(n)[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r;
    if (Math.abs(a[pivot]![col]!) < 1e-15) throw new Error("Matrix is singular");
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    const scale = a[col]![col]!;
    a[col] = a[col]!.map(x => x / scale);
    for (let r = 0; r < n; r++) if (r !== col) {
      const f = a[r]![col]!;
      a[r] = a[r]!.map((x, j) => x - f * a[col]![j]!);
    }
  }
  return a.map(r => r.slice(n));
}
export function covariancePropagate(covariance: Matrix, jacobian: Matrix, processNoise?: Matrix): Matrix {
  const p = matMul(matMul(jacobian, covariance), transpose(jacobian));
  return processNoise ? matAdd(p, processNoise) : p;
}
export function mahalanobisDistance(delta: Vector, covariance: Matrix): number {
  const inv = inverse(covariance);
  const v = matVecMul(inv, delta);
  return Math.sqrt(Math.max(0, delta.reduce((s, x, i) => s + x * v[i]!, 0)));
}
export function combineIndependent(estimates: GaussianEstimate[]): GaussianEstimate {
  if (estimates.length === 0) throw new Error("At least one estimate required");
  const n = estimates[0]!.mean.length;
  let information = Array.from({ length: n }, () => Array(n).fill(0) as number[]);
  let weighted = Array(n).fill(0) as number[];
  for (const e of estimates) {
    const inv = inverse(e.covariance);
    information = matAdd(information, inv);
    const w = matVecMul(inv, e.mean);
    weighted = weighted.map((x, i) => x + w[i]!);
  }
  const covariance = inverse(information);
  return { mean: matVecMul(covariance, weighted), covariance };
}
export function confidenceInterval(mean: number, stddev: number, z = 1.959963984540054): [number, number] { return [mean - z * stddev, mean + z * stddev]; }
export function rms(values: number[]): number { return values.length ? Math.sqrt(values.reduce((s, x) => s + x * x, 0) / values.length) : NaN; }

export function monteCarlo<T>(samples: number, sample: (index: number) => T): T[] {
  if (!Number.isInteger(samples) || samples < 1) throw new Error("samples must be a positive integer");
  return Array.from({ length: samples }, (_, i) => sample(i));
}
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const x = Math.min(1, Math.max(0, p)) * (sorted.length - 1);
  const lo = Math.floor(x), hi = Math.ceil(x), f = x - lo;
  return sorted[lo]! * (1 - f) + sorted[hi]! * f;
}
