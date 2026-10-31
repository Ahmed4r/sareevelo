import { ThemeService } from '../shared/theme.service';
import { IconComponent } from '../shared/icon.component';
import { AfterViewInit, Component, ElementRef, Input, NgZone, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import type * as Leaflet from 'leaflet';
import { GermanyApiService, OrderMap, AddressLookup, LocationCandidate } from './germany-api.service';
import { OrderView } from '../orders/order-api.models';
import { Driver } from '../drivers/driver-api.models';
import { orderErrorMessage } from '../orders/order-errors';

@Component({
  selector: 'app-germany-map', standalone: true, imports: [FormsModule, IconComponent],
  templateUrl: './germany-map.component.html',
  styleUrl: './germany-map.component.css'
})
export class GermanyMapComponent implements AfterViewInit, OnDestroy {
  @Input() orders: OrderView[] = [];
  @Input() drivers: Driver[] = [];
  @ViewChild('mapHost', { static: true }) host!: ElementRef<HTMLDivElement>;
  private readonly api = inject(GermanyApiService);
  private readonly theme = inject(ThemeService);
  readonly mapStyle = signal<'auto' | 'light' | 'dark' | 'original'>(this.readMapStyle());
  readonly resolvedMapStyle = computed(() => this.mapStyle() === 'auto' ? this.theme.current() : this.mapStyle());
  private readMapStyle(): 'auto' | 'light' | 'dark' | 'original' {
    try { const value = globalThis.localStorage?.getItem('sareevelo-map-style'); if (value === 'light' || value === 'dark' || value === 'original') return value; } catch { /* Optional preference. */ }
    return 'auto';
  }
  setMapStyle(value: string): void {
    if (value !== 'auto' && value !== 'light' && value !== 'dark' && value !== 'original') return;
    this.mapStyle.set(value);
    try { globalThis.localStorage?.setItem('sareevelo-map-style', value); } catch { /* Style works without storage. */ }
  }
  private readonly zone = inject(NgZone);
  private map?: Leaflet.Map;
  private leaflet?: typeof Leaflet;
  private markers?: Leaflet.LayerGroup;
  private tiles?: Leaflet.TileLayer;
  private resizeObserver?: ResizeObserver;
  mode: 'locations' | 'coverage' = 'locations'; orderSearch = '';
  private readonly subscriptions = new Subscription();
  private orderRequest?: Subscription;
  private lookupRequest?: Subscription;
  readonly locating = signal(false);
  readonly lookupResult = signal<AddressLookup | null>(null);
  readonly lookupError = signal('');
  private coverageRequest?: Subscription;
  private destroyed = false;
  private initializingMap = false;
  private configRequest?: Subscription;
  readonly mapFailed = signal(false);
  readonly states = signal<{ code: string; name: string }[]>([]);
  readonly loading = signal(false); readonly saving = signal(false); readonly error = signal(''); readonly message = signal(''); readonly tileError = signal(false);
  readonly coverageLoading = signal(false); readonly coverageSaving = signal(false); readonly coverageLoaded = signal(false); readonly coverageError = signal('');
  orderId: number | null = null; driverId: number | null = null; model: OrderMap | null = null;
  confirmed = false; city = ''; pinMode: 'pickup' | 'delivery' = 'pickup'; selectedStates: string[] = [];
  readonly stateCode = (state: { code: string }) => state.code;
  readonly cities = [
    { name: 'Berlin', lat: 52.52, lng: 13.405 }, { name: 'Hamburg', lat: 53.551, lng: 9.994 }, { name: 'München', lat: 48.137, lng: 11.576 },
    { name: 'Köln', lat: 50.938, lng: 6.96 }, { name: 'Frankfurt am Main', lat: 50.11, lng: 8.682 }, { name: 'Stuttgart', lat: 48.776, lng: 9.183 },
    { name: 'Düsseldorf', lat: 51.228, lng: 6.774 }, { name: 'Leipzig', lat: 51.34, lng: 12.373 }, { name: 'Dresden', lat: 51.051, lng: 13.738 },
    { name: 'Hannover', lat: 52.375, lng: 9.732 }, { name: 'Bremen', lat: 53.079, lng: 8.802 }, { name: 'Nürnberg', lat: 49.452, lng: 11.077 },
    { name: 'Passau', lat: 48.5667, lng: 13.4319 }
  ];
  ngAfterViewInit(): void { this.loadConfig(); }
  loadConfig(): void {
    if (this.initializingMap) return;
    this.configRequest?.unsubscribe(); this.mapFailed.set(false); this.error.set('');
    this.configRequest = this.api.config().subscribe({ next: config => {
      this.states.set(Object.entries(config.states).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name, 'de')));
      if (!this.map) this.zone.runOutsideAngular(() => { void this.initializeMap(config.tileUrl, config.attribution); });
    }, error: error => { this.mapFailed.set(true); this.error.set(orderErrorMessage(error)); } });
  }
  private async initializeMap(tileUrl: string, attribution: string) {
    if (this.initializingMap || this.map || this.destroyed) return;
    this.initializingMap = true;
    try {
      const module = await import('leaflet');
      // Production bundles wrap Leaflet's CommonJS API in a default export.
      const L = (module as typeof Leaflet & { default?: typeof Leaflet }).default ?? module;
      if (this.destroyed) return; this.leaflet = L;
      this.map = L.map(this.host.nativeElement, { scrollWheelZoom: true, touchZoom: true }).fitBounds([[47.2, 5.8], [55.1, 15.1]]);
      this.markers = L.layerGroup().addTo(this.map);
      const safeCredit = attribution.replace(/[<>&"']/g, '');
      this.tiles = L.tileLayer(tileUrl, { maxZoom: 19, attribution: safeCredit + ' · <a href="https://www.openstreetmap.org/copyright">OSM licence</a>' })
        .on('tileerror', () => this.zone.run(() => this.tileError.set(true))).addTo(this.map);
      this.map.on('click', (event: Leaflet.LeafletMouseEvent) => this.zone.run(() => {
        if (!this.model || !this.editable() || this.mode !== 'locations') return;
        const lat = Number(event.latlng.lat.toFixed(6)), lng = Number(event.latlng.lng.toFixed(6));
        if (lat < 47.2 || lat > 55.1 || lng < 5.8 || lng > 15.1) { this.error.set('Choose a location within the Germany map area.'); return; }
        if (this.pinMode === 'pickup') { this.model.pickupLat = lat; this.model.pickupLng = lng; }
        else { this.model.deliveryLat = lat; this.model.deliveryLng = lng; }
        this.coordinatesChanged();
        if (this.pinMode === 'pickup' && this.model.deliveryLat === null) this.pinMode = 'delivery';
      }));
      this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize({ pan: false }));
      this.resizeObserver.observe(this.host.nativeElement);
      this.drawPins(true);
    } catch { this.map?.remove(); this.map = undefined; this.zone.run(() => { this.mapFailed.set(true); this.error.set('The map could not start. Retry, or enter coordinates manually.'); }); }
    finally { this.initializingMap = false; }
  }
  setMode(mode: 'locations' | 'coverage'): void { this.mode = mode; this.drawPins(); }
  filteredOrders(): OrderView[] { const query = this.orderSearch.trim().toLowerCase(); return this.orders.filter(order => order.id === this.orderId || !query || [order.trackingNumber, order.pickupAddress, order.destination].some(value => value?.toLowerCase().includes(query))); }
  validPins(): boolean { const m = this.model; return !!m && [m.pickupLat, m.deliveryLat].every(v => v !== null && Number.isFinite(v) && v >= 47.2 && v <= 55.1) && [m.pickupLng, m.deliveryLng].every(v => v !== null && Number.isFinite(v) && v >= 5.8 && v <= 15.1) && !!m.pickupState && !!m.deliveryState; }
  focusPin(kind: 'pickup' | 'delivery'): void { this.pinMode = kind; const m = this.model; if (!m) return; const lat = kind === 'pickup' ? m.pickupLat : m.deliveryLat; const lng = kind === 'pickup' ? m.pickupLng : m.deliveryLng; if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) && lat >= 47.2 && lat <= 55.1 && lng >= 5.8 && lng <= 15.1) this.map?.setView([lat,lng], 14); }
  fitLocations(): void { if (this.model && (this.model.pickupLat !== null || this.model.deliveryLat !== null)) this.drawPins(true); else this.map?.fitBounds([[47.2,5.8],[55.1,15.1]]); }
  retryTiles(): void { this.tileError.set(false); this.tiles?.redraw(); }
  editable(): boolean { return !!this.model && !this.loading() && !this.saving() && this.orders.find(item => item.id === this.orderId)?.status === 'PENDING'; }
  loadOrder(id: number | null): void {
    if (this.saving()) return;
    this.cancelLookup(); this.lookupResult.set(null); this.lookupError.set(''); this.orderRequest?.unsubscribe(); this.orderId = id; this.pinMode = 'pickup'; this.model = null; this.confirmed = false; this.error.set(''); this.message.set(''); this.drawPins();
    if (id === null) { this.loading.set(false); return; }
    this.loading.set(true);
    this.orderRequest = this.api.map(id).subscribe({ next: value => { this.model = value; this.loading.set(false); this.drawPins(true); if (value.pickupLat === null || value.pickupLng === null || value.deliveryLat === null || value.deliveryLng === null) this.locate(); }, error: error => { this.loading.set(false); this.error.set(orderErrorMessage(error)); } });
  }
  cancelLookup(): void { this.lookupRequest?.unsubscribe(); this.locating.set(false); }
  locate(): void {
    if (!this.model || this.orderId === null || this.locating() || this.saving()) return;
    const id = this.orderId; const snapshot = this.model;
    this.lookupError.set(''); this.locating.set(true);
    this.lookupRequest = this.api.lookup(id).subscribe({ next: result => {
      this.locating.set(false);
      if (this.orderId !== id || this.model !== snapshot) return;
      if (snapshot.pickupAddress !== result.pickupAddress || snapshot.deliveryAddress !== result.deliveryAddress) { this.lookupError.set('Addresses changed. Select the order again to reload.'); return; }
      this.lookupResult.set(result);
      if ((snapshot.pickupLat === null || snapshot.pickupLng === null) && result.pickup.candidates.length) this.applyCandidate('pickup', result.pickup.candidates[0]);
      if ((snapshot.deliveryLat === null || snapshot.deliveryLng === null) && result.delivery.candidates.length) this.applyCandidate('delivery', result.delivery.candidates[0]);
      this.drawPins(true);
    }, error: error => { this.locating.set(false); this.lookupError.set(orderErrorMessage(error)); } });
  }
  applyCandidate(kind: 'pickup' | 'delivery', candidate: LocationCandidate): void {
    if (!this.model || this.saving() || !candidate || !Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng) || candidate.lat < 47.2 || candidate.lat > 55.1 || candidate.lng < 5.8 || candidate.lng > 15.1) return;
    this.cancelLookup();
    if (kind === 'pickup') { this.model.pickupLat = candidate.lat; this.model.pickupLng = candidate.lng; this.model.pickupState = candidate.state; }
    else { this.model.deliveryLat = candidate.lat; this.model.deliveryLng = candidate.lng; this.model.deliveryState = candidate.state; }
    this.confirmed = false; this.message.set(''); this.drawPins(true);
  }
  changed(): void { this.cancelLookup(); this.confirmed = false; this.message.set(''); }
  coordinatesChanged(): void { this.changed(); this.drawPins(); }
  goToCity(name: string): void { this.city = name; const city = this.cities.find(item => item.name === name); if (city) this.map?.setView([city.lat, city.lng], 12); else this.map?.fitBounds([[47.2, 5.8], [55.1, 15.1]]); }
  private drawPins(fit = false): void {
    this.markers?.clearLayers(); if (!this.leaflet || !this.map || !this.markers || !this.model) return;
    const bounds: Leaflet.LatLngTuple[] = [];
    for (const [lat, lng, label] of [[this.model.pickupLat, this.model.pickupLng, 'Pickup'], [this.model.deliveryLat, this.model.deliveryLng, 'Delivery']] as const) {
      if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
      bounds.push([lat, lng]);
      const kind = label === 'Pickup' ? 'pickup' : 'delivery';
      const marker = this.leaflet.marker([lat, lng], { draggable: this.editable() && this.mode === 'locations', title: label,
        icon: this.leaflet.divIcon({ className: 'dispatch-map-marker ' + kind, html: label === 'Pickup' ? 'A' : 'B', iconSize: [34, 42], iconAnchor: [17, 42] }) }).addTo(this.markers);
      marker.on('dragend', () => this.zone.run(() => {
        const point = marker.getLatLng(); if (!this.model || !this.editable()) return;
        if (point.lat < 47.2 || point.lat > 55.1 || point.lng < 5.8 || point.lng > 15.1) { this.error.set('Keep both pins within Germany.'); this.drawPins(); return; }
        if (kind === 'pickup') { this.model.pickupLat = Number(point.lat.toFixed(6)); this.model.pickupLng = Number(point.lng.toFixed(6)); }
        else { this.model.deliveryLat = Number(point.lat.toFixed(6)); this.model.deliveryLng = Number(point.lng.toFixed(6)); }
        this.changed();
      }));
    }
    if (fit && bounds.length) this.map.fitBounds(bounds, { padding: [35, 35], maxZoom: 14 });
  }
  save(): void {
    if (!this.editable() || !this.confirmed || !this.validPins() || this.orderId === null || !this.model) return;
    this.saving.set(true); this.error.set(''); this.drawPins();
    this.subscriptions.add(this.api.saveMap(this.orderId, this.model, this.confirmed).subscribe({ next: value => { this.model = value; this.saving.set(false); this.drawPins(); this.message.set('Germany locations saved. Refresh driver suggestions to check coverage.'); }, error: error => { this.saving.set(false); this.drawPins(); this.error.set(orderErrorMessage(error)); } }));
  }
  loadCoverage(id: number | null): void {
    if (this.coverageSaving()) return;
    this.coverageRequest?.unsubscribe(); this.driverId = id; this.selectedStates = []; this.coverageLoaded.set(false); this.coverageError.set(''); this.message.set('');
    if (id === null) { this.coverageLoading.set(false); return; }
    this.coverageLoading.set(true);
    this.coverageRequest = this.api.coverage(id).subscribe({ next: states => { this.selectedStates = states; this.coverageLoading.set(false); this.coverageLoaded.set(true); }, error: error => { this.coverageLoading.set(false); this.coverageError.set(orderErrorMessage(error)); } });
  }
  toggleState(code: string): void { this.selectedStates = this.selectedStates.includes(code) ? this.selectedStates.filter(item => item !== code) : [...this.selectedStates, code]; }
  saveCoverage(): void {
    if (this.driverId === null || !this.coverageLoaded() || this.coverageSaving()) return;
    this.coverageSaving.set(true); this.coverageError.set('');
    this.subscriptions.add(this.api.saveCoverage(this.driverId, this.selectedStates).subscribe({ next: states => { this.selectedStates = states; this.coverageSaving.set(false); this.message.set('Driver service areas saved. Existing assignments were not changed.'); }, error: error => { this.coverageSaving.set(false); this.coverageError.set(orderErrorMessage(error)); } }));
  }
  ngOnDestroy(): void { this.cancelLookup(); this.configRequest?.unsubscribe(); this.destroyed = true; this.orderRequest?.unsubscribe(); this.coverageRequest?.unsubscribe(); this.subscriptions.unsubscribe(); this.resizeObserver?.disconnect(); this.map?.remove(); }
}
