import { ValidationError, type Provenance } from "@opendefence/core";
import type { GeoPoint } from "@opendefence/geo";

export interface EnvironmentSnapshot {
  location: GeoPoint;
  observedAt: Date;
  temperatureC?: number;
  pressurePa?: number;
  humidityPct?: number;
  windSpeedMps?: number;
  windDirectionDeg?: number;
  precipitationMmH?: number;
  visibilityM?: number;
  cloudCoverPct?: number;
  solarIrradianceWm2?: number;
  provenance: Provenance;
}
export interface EnvironmentProvider { readonly id: string; snapshot(location: GeoPoint, at?: Date): Promise<EnvironmentSnapshot>; }
export class EnvironmentModule {
  private readonly providers = new Map<string, EnvironmentProvider>();
  constructor(providers: EnvironmentProvider[] = []) { providers.forEach(p => this.providers.set(p.id, p)); }
  register(provider: EnvironmentProvider): this { this.providers.set(provider.id, provider); return this; }
  async snapshot(location: GeoPoint, providerId?: string, at?: Date): Promise<EnvironmentSnapshot> {
    const p = providerId ? this.providers.get(providerId) : this.providers.values().next().value as EnvironmentProvider | undefined;
    if (!p) throw new ValidationError("No environment provider configured");
    return p.snapshot(location, at);
  }
  async ensemble(location: GeoPoint, at?: Date): Promise<EnvironmentSnapshot[]> {
    return Promise.all([...this.providers.values()].map(p => p.snapshot(location, at)));
  }
}
