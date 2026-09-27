export * from "@opendefence/core";
export * from "@opendefence/geo";
export * from "@opendefence/uncertainty";
export * from "@opendefence/terrain";
export * from "@opendefence/space";
export * from "@opendefence/eo";
export * from "@opendefence/environment";
export * from "@opendefence/sensors";
export * from "@opendefence/fusion";
export * from "@opendefence/comms";
export * from "@opendefence/pnt";
export * from "@opendefence/edge";
export * from "@opendefence/logistics";
export * from "@opendefence/fleet";
export * from "@opendefence/maintenance";
export * from "@opendefence/energy";
export * from "@opendefence/twin";
export * from "@opendefence/simulation";
export * from "@opendefence/security";
export * from "@opendefence/cyber";
export * from "@opendefence/interoperability";
export * from "@opendefence/ai";
export * from "@opendefence/spectrum";
export * from "@opendefence/audit";
export * from "@opendefence/telemetry";
export * from "@opendefence/validation";
export * from "@opendefence/data";
export * from "@opendefence/reporting";
export * from "@opendefence/routing";

import { HttpClient, MemoryCache, ProviderRegistry, type CacheAdapter, type HttpClientOptions } from "@opendefence/core";
import { TerrainEngine, type ElevationProvider } from "@opendefence/terrain";
import { SpaceModule, type OrbitPropagator, type SatelliteCatalogProvider } from "@opendefence/space";
import { EOModule, type EOProvider } from "@opendefence/eo";
import { EnvironmentModule, type EnvironmentProvider } from "@opendefence/environment";
import { SensorsModule } from "@opendefence/sensors";
import { FusionModule } from "@opendefence/fusion";
import { CommsModule } from "@opendefence/comms";
import { PNTModule } from "@opendefence/pnt";
import { EdgeModule } from "@opendefence/edge";
import { LogisticsModule } from "@opendefence/logistics";
import { FleetModule } from "@opendefence/fleet";
import { MaintenanceModule } from "@opendefence/maintenance";
import { EnergyModule } from "@opendefence/energy";
import { TwinModule } from "@opendefence/twin";
import { SimulationModule } from "@opendefence/simulation";
import { SecurityModule } from "@opendefence/security";
import { CyberModule } from "@opendefence/cyber";
import { InteroperabilityModule } from "@opendefence/interoperability";
import { AIModule } from "@opendefence/ai";
import { SpectrumModule } from "@opendefence/spectrum";
import { AuditModule } from "@opendefence/audit";
import { TelemetryModule } from "@opendefence/telemetry";
import { ValidationModule } from "@opendefence/validation";
import { DataModule } from "@opendefence/data";
import { ReportingModule } from "@opendefence/reporting";
import { RoutingModule } from "@opendefence/routing";

export interface OpenDefenceOptions {
  http?: HttpClientOptions;
  cache?: CacheAdapter | false;
  nodeId?: string;
  elevationProvider?: ElevationProvider;
  eoProviders?: EOProvider[];
  environmentProviders?: EnvironmentProvider[];
  satelliteProviders?: SatelliteCatalogProvider[];
  orbitPropagator?: OrbitPropagator;
  fusion?: { gateMahalanobis?:number; staleAfterMs?:number };
}
export class OpenDefence {
  readonly version="0.1.0";
  readonly http:HttpClient;
  readonly providers=new ProviderRegistry();
  readonly space:SpaceModule; readonly eo:EOModule; readonly environment:EnvironmentModule; readonly sensors=new SensorsModule(); readonly fusion:FusionModule;
  readonly comms=new CommsModule(); readonly pnt=new PNTModule(); readonly edge:EdgeModule; readonly logistics=new LogisticsModule(); readonly fleet=new FleetModule(); readonly maintenance=new MaintenanceModule(); readonly energy=new EnergyModule(); readonly twin=new TwinModule(); readonly sim=new SimulationModule(); readonly security=new SecurityModule(); readonly cyber=new CyberModule(); readonly interop=new InteroperabilityModule(); readonly ai=new AIModule(); readonly spectrum=new SpectrumModule(); readonly audit=new AuditModule(); readonly telemetry=new TelemetryModule(); readonly validation=new ValidationModule(); readonly data=new DataModule(); readonly reporting=new ReportingModule(); readonly routing=new RoutingModule();
  readonly terrain?:TerrainEngine;
  constructor(options:OpenDefenceOptions={}){
    const cache=options.cache===undefined?new MemoryCache():options.cache;
    this.http=new HttpClient({...options.http,cache}); const spaceOptions: {providers?: SatelliteCatalogProvider[]; propagator?: OrbitPropagator} = {}; if(options.satelliteProviders) spaceOptions.providers=options.satelliteProviders; if(options.orbitPropagator) spaceOptions.propagator=options.orbitPropagator; this.space=new SpaceModule(spaceOptions);this.eo=new EOModule(options.eoProviders);this.environment=new EnvironmentModule(options.environmentProviders);this.fusion=new FusionModule(options.fusion);this.edge=new EdgeModule(options.nodeId);if(options.elevationProvider)this.terrain=new TerrainEngine(options.elevationProvider);
  }
}
export const DefenceClient=OpenDefence;
