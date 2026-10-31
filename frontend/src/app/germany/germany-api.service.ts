import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface GermanyConfig { countryCode: 'DE'; states: Record<string, string>; tileUrl: string; attribution: string; }
export interface OrderMap {
  version?: number | null; orderId: number; countryCode: 'DE'; pickupState: string; deliveryState: string;
  pickupLat: number | null; pickupLng: number | null; deliveryLat: number | null; deliveryLng: number | null;
  stale: boolean; pickupAddress: string; deliveryAddress: string;
}
export interface LocationCandidate { label: string; lat: number; lng: number; state: string; }
export interface LocationMatch { status: 'FOUND' | 'NO_MATCH' | 'UNAVAILABLE' | 'SAVED'; candidates: LocationCandidate[]; }
export interface AddressLookup { pickupAddress: string; deliveryAddress: string; pickup: LocationMatch; delivery: LocationMatch; }
@Injectable({ providedIn: 'root' })
export class GermanyApiService {
  private readonly http = inject(HttpClient);
  config() { return this.http.get<GermanyConfig>('/api/v1/germany/config'); }
  map(id: number) { return this.http.get<OrderMap>(`/api/v1/germany/orders/${id}`); }
  lookup(id: number) { return this.http.get<AddressLookup>(`/api/v1/germany/orders/${id}/lookup`); }
  saveMap(id: number, value: OrderMap, germanyConfirmed: boolean) { return this.http.put<OrderMap>(`/api/v1/germany/orders/${id}`, { ...value, germanyConfirmed }); }
  coverage(id: number) { return this.http.get<string[]>(`/api/v1/germany/drivers/${id}`); }
  saveCoverage(id: number, states: string[]) { return this.http.put<string[]>(`/api/v1/germany/drivers/${id}`, states); }
}
