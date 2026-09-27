import { HttpClient, ValidationError, type Provenance } from "@opendefence/core";
import type { BoundingBox, GeoJsonGeometry } from "@opendefence/geo";

export interface ObservationAsset { href: string; type?: string; roles?: string[]; title?: string; }
export interface SpectralBand { name: string; commonName?: string; centerWavelengthUm?: number; }
export interface ObservationProduct {
  id: string;
  collection?: string;
  geometry?: GeoJsonGeometry | Record<string, unknown> | null;
  bbox?: number[];
  acquiredAt?: Date;
  platform?: string;
  instruments: string[];
  cloudCover?: number;
  assets: Record<string, ObservationAsset>;
  properties: Record<string, unknown>;
  provenance: Provenance;
}
export interface EOQuery {
  bbox?: BoundingBox | [number, number, number, number];
  from?: Date | string;
  to?: Date | string;
  collections?: string[];
  ids?: string[];
  limit?: number;
  cloudCoverMax?: number;
  query?: Record<string, unknown>;
}
export interface EOProvider { readonly id: string; search(query: EOQuery): Promise<ObservationProduct[]>; collections?(): Promise<unknown[]>; }

type StacItem = {
  id: string;
  collection?: string;
  geometry?: Record<string, unknown> | null;
  bbox?: number[];
  properties?: Record<string, unknown>;
  assets?: Record<string, { href: string; type?: string; roles?: string[]; title?: string }>;
};
type StacFeatureCollection = { features: StacItem[]; links?: Array<{ rel: string; href: string; method?: string; body?: unknown }> };

function interval(from?: Date | string, to?: Date | string): string | undefined {
  if (!from && !to) return undefined;
  const f = from ? new Date(from).toISOString() : "..";
  const t = to ? new Date(to).toISOString() : "..";
  return `${f}/${t}`;
}
function bboxArray(b?: BoundingBox | [number, number, number, number]): number[] | undefined {
  if (!b) return undefined;
  return Array.isArray(b) ? [...b] : [b.west, b.south, b.east, b.north];
}
function normalize(item: StacItem, provider: string): ObservationProduct {
  const p = item.properties ?? {};
  const datetime = p["datetime"] ?? p["start_datetime"];
  const instruments = Array.isArray(p["instruments"]) ? p["instruments"].map(String) : [];
  const cloud = Number(p["eo:cloud_cover"]);
  const assets: Record<string, ObservationAsset> = {};
  for (const [key, value] of Object.entries(item.assets ?? {})) {
    assets[key] = { href: value.href, ...(value.type ? { type: value.type } : {}), ...(value.roles ? { roles: [...value.roles] } : {}), ...(value.title ? { title: value.title } : {}) };
  }
  return {
    id: item.id,
    ...(item.collection ? { collection: item.collection } : {}),
    ...(item.geometry !== undefined ? { geometry: item.geometry } : {}),
    ...(item.bbox ? { bbox: item.bbox } : {}),
    ...(datetime ? { acquiredAt: new Date(String(datetime)) } : {}),
    ...(p["platform"] ? { platform: String(p["platform"]) } : {}),
    instruments,
    ...(Number.isFinite(cloud) ? { cloudCover: cloud } : {}),
    assets,
    properties: p,
    provenance: { provider, sourceId: item.id, ...(datetime ? { observedAt: new Date(String(datetime)) } : {}), receivedAt: new Date() },
  };
}

export class StacProvider implements EOProvider {
  readonly id: string;
  constructor(readonly baseUrl: string, private readonly http = new HttpClient({ cacheTtlMs: 5 * 60_000 }), id = "stac") {
    this.id = id;
  }
  async search(query: EOQuery): Promise<ObservationProduct[]> {
    const url = new URL("search", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    const body: Record<string, unknown> = {};
    const b = bboxArray(query.bbox); if (b) body["bbox"] = b;
    const dt = interval(query.from, query.to); if (dt) body["datetime"] = dt;
    if (query.collections?.length) body["collections"] = query.collections;
    if (query.ids?.length) body["ids"] = query.ids;
    body["limit"] = query.limit ?? 100;
    if (query.query) body["query"] = query.query;
    if (query.cloudCoverMax !== undefined) {
      body["query"] = { ...(query.query ?? {}), "eo:cloud_cover": { lte: query.cloudCoverMax } };
    }
    const page = await this.http.json<StacFeatureCollection>(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), dedupe: false });
    return page.features.map(item => normalize(item, this.id));
  }
  async collections(): Promise<unknown[]> {
    const url = new URL("collections", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    const data = await this.http.json<{ collections?: unknown[] }>(url);
    return data.collections ?? [];
  }
}

export class EOModule {
  private readonly providers = new Map<string, EOProvider>();
  constructor(providers: EOProvider[] = []) { for (const p of providers) this.providers.set(p.id, p); }
  register(provider: EOProvider): this { this.providers.set(provider.id, provider); return this; }
  provider(id: string): EOProvider {
    const p = this.providers.get(id); if (!p) throw new ValidationError(`EO provider not found: ${id}`); return p;
  }
  async search(query: EOQuery, providerId?: string): Promise<ObservationProduct[]> {
    const providers = providerId ? [this.provider(providerId)] : [...this.providers.values()];
    if (providers.length === 0) throw new ValidationError("No EO providers configured");
    const results = await Promise.all(providers.map(p => p.search(query)));
    return results.flat().sort((a, b) => (b.acquiredAt?.getTime() ?? 0) - (a.acquiredAt?.getTime() ?? 0));
  }
  temporalSeries(products: ObservationProduct[]): ObservationProduct[] {
    return [...products].sort((a, b) => (a.acquiredAt?.getTime() ?? 0) - (b.acquiredAt?.getTime() ?? 0));
  }
  coverage(products: ObservationProduct[]): { products: number; providers: string[]; earliest?: Date; latest?: Date } {
    const dates = products.flatMap(p => p.acquiredAt ? [p.acquiredAt] : []);
    return { products: products.length, providers: [...new Set(products.map(p => p.provenance.provider))].sort(), ...(dates.length ? { earliest: new Date(Math.min(...dates.map(d => d.getTime()))), latest: new Date(Math.max(...dates.map(d => d.getTime()))) } : {}) };
  }
}
