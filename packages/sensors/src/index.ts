import { ValidationError, dataQuality, nowProvenance, type DataQuality, type Provenance } from "@opendefence/core";
import type { GeoPoint } from "@opendefence/geo";

export interface UncertaintyDescriptor { covariance?: number[][]; stddev?: number | number[]; units?: string; }
export interface Observation<T = unknown> {
  id: string;
  sensorId: string;
  observedAt: Date;
  receivedAt: Date;
  location?: GeoPoint;
  value: T;
  uncertainty?: UncertaintyDescriptor;
  quality: DataQuality;
  provenance: Provenance;
}
export interface SensorDefinition {
  id: string;
  name?: string;
  type: string;
  location?: GeoPoint;
  units?: string;
  metadata?: Record<string, unknown>;
}
export interface SensorHealth { sensorId: string; observations: number; lastObservedAt?: Date; ageMs?: number; stale: boolean; }

export class SensorRegistry {
  private readonly sensors = new Map<string, SensorDefinition>();
  register(sensor: SensorDefinition): this {
    if (!sensor.id) throw new ValidationError("Sensor id is required");
    this.sensors.set(sensor.id, structuredClone(sensor)); return this;
  }
  get(id: string): SensorDefinition | undefined { const s = this.sensors.get(id); return s ? structuredClone(s) : undefined; }
  list(): SensorDefinition[] { return [...this.sensors.values()].map(s => structuredClone(s)); }
}

export class ObservationStore {
  private readonly bySensor = new Map<string, Observation[]>();
  constructor(readonly maxPerSensor = 10_000) {}
  ingest<T>(observation: Observation<T>): void {
    const list = this.bySensor.get(observation.sensorId) ?? [];
    list.push(observation as Observation);
    list.sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
    if (list.length > this.maxPerSensor) list.splice(0, list.length - this.maxPerSensor);
    this.bySensor.set(observation.sensorId, list);
  }
  latest<T = unknown>(sensorId: string): Observation<T> | undefined { return this.bySensor.get(sensorId)?.at(-1) as Observation<T> | undefined; }
  history<T = unknown>(sensorId: string, from?: Date, to?: Date): Observation<T>[] {
    return (this.bySensor.get(sensorId) ?? []).filter(o => (!from || o.observedAt >= from) && (!to || o.observedAt <= to)) as Observation<T>[];
  }
  health(sensorId: string, staleAfterMs = 5 * 60_000, now = new Date()): SensorHealth {
    const list = this.bySensor.get(sensorId) ?? [], last = list.at(-1);
    const ageMs = last ? Math.max(0, now.getTime() - last.observedAt.getTime()) : undefined;
    return { sensorId, observations: list.length, ...(last ? { lastObservedAt: last.observedAt } : {}), ...(ageMs === undefined ? {} : { ageMs }), stale: ageMs === undefined || ageMs > staleAfterMs };
  }
}

export class SensorsModule {
  readonly registry = new SensorRegistry();
  readonly store = new ObservationStore();
  normalize<T>(input: { id?: string; sensorId: string; observedAt?: Date; receivedAt?: Date; location?: GeoPoint; value: T; uncertainty?: UncertaintyDescriptor; quality?: Partial<DataQuality>; provider?: string; sourceId?: string }): Observation<T> {
    const receivedAt = input.receivedAt ?? new Date();
    const observedAt = input.observedAt ?? receivedAt;
    const provenance = nowProvenance(input.provider ?? "sensor", input.sourceId ?? input.id);
    provenance.receivedAt = receivedAt; provenance.observedAt = observedAt;
    return {
      id: input.id ?? `${input.sensorId}:${observedAt.toISOString()}:${Math.random().toString(36).slice(2, 8)}`,
      sensorId: input.sensorId, observedAt, receivedAt,
      ...(input.location ? { location: input.location } : {}),
      value: input.value,
      ...(input.uncertainty ? { uncertainty: input.uncertainty } : {}),
      quality: dataQuality(input.quality), provenance,
    };
  }
  ingest<T>(observation: Observation<T>): Observation<T> { this.store.ingest(observation); return observation; }
}
