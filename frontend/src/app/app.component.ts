import { OrderViewsComponent } from './orders/order-views.component';
import { DriverSuggestionsComponent } from './orders/driver-suggestions.component';
import { GermanyMapComponent } from './germany/germany-map.component';
import { LogisticsAiComponent } from './ai/logistics-ai.component';
import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription } from 'rxjs';
import { DriverApiService } from './drivers/driver-api.service';
import { Driver, VehicleType } from './drivers/driver-api.models';
import { ThemeService } from './shared/theme.service';
import { OrderApiService } from './orders/order-api.service';
import { OrderStatus } from './models';
import { OrdersStore } from './orders/orders.store';
import { orderErrorMessage } from './orders/order-errors';
import { DialogDirective } from './shared/dialog.directive';
import { IconComponent } from './shared/icon.component';
import { OrderActivityComponent } from './orders/order-activity.component';
import { HttpErrorResponse } from '@angular/common/http';
import { BulkAssignmentItem, BulkAssignmentResult, BulkAssignmentService } from './orders/bulk-assignment.service';
import { ScheduleFilter, ScheduledOrder, matchesSchedule, overdue, dueToday, localDateTime, windowError } from './orders/order-schedule';

type OrderFilter = 'ALL' | OrderStatus;
type SortKey = 'id' | 'trackingNumber' | 'destination' | 'status';
type FormField = 'customerName' | 'pickupAddress' | 'deliveryAddress';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogDirective, IconComponent, OrderActivityComponent, OrderViewsComponent, DriverSuggestionsComponent, GermanyMapComponent, LogisticsAiComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnDestroy {
  readonly theme = inject(ThemeService);
  private readonly store = inject(OrdersStore);
  private readonly destroyRef = inject(DestroyRef);
  readonly orders = this.store.orders.asReadonly();
  readonly loading = this.store.loading.asReadonly();
  readonly loadError = this.store.error.asReadonly();
  readonly selectedOrder = this.store.selected.asReadonly();
  readonly selectedOrderId = this.store.selectedId.asReadonly();
  readonly detailLoading = this.store.detailLoading.asReadonly();
  readonly detailError = this.store.detailError.asReadonly();
  private readonly driverApi = inject(DriverApiService);
  private readonly orderApi = inject(OrderApiService);
  private readonly bulkApi = inject(BulkAssignmentService);
  readonly checkedOrderIds = signal<ReadonlySet<number>>(new Set());
  readonly showBulkAssignment = signal(false);
  readonly bulkAssigning = signal(false);
  readonly bulkItems = signal<BulkAssignmentItem[]>([]);
  readonly bulkResults = signal<BulkAssignmentResult[]>([]);
  readonly bulkError = signal('');
  readonly bulkFinished = signal(false);
  bulkDriverId: number | null = null;
  private bulkRequest?: Subscription;
  private driverRequest?: Subscription;
  readonly drivers = signal<Driver[]>([]);
  readonly driversLoading = signal(false);
  readonly driversError = signal('');
  readonly showNewDriver = signal(false);
  readonly driverSaving = signal(false);
  readonly driverCreateError = signal('');
  driverName = '';
  employeeCode = '';
  driverCapacity = 8;
  readonly editingDriverId = signal<number | null>(null);
  mobileNumber = '';
  driverEmail = '';
  vehicleType: VehicleType | '' = '';
  vehicleRegistration = '';
  driverNotes = '';
  readonly vehicleTypes: { value: VehicleType; label: string }[] = [
    { value: 'BICYCLE', label: 'Bicycle' }, { value: 'MOTORCYCLE', label: 'Motorcycle' },
    { value: 'CAR', label: 'Car' }, { value: 'VAN', label: 'Van' }, { value: 'TRUCK', label: 'Truck' }, { value: 'OTHER', label: 'Other' }
  ];
  readonly assigning = signal(false);
  readonly assignError = signal('');
  readonly statusChanging = signal(false);
  readonly statusError = signal('');
  assignmentDriverId: number | null = null;
  private driverDetailRequest?: Subscription;
  readonly selectedDriverId = signal<number | null>(null);
  readonly selectedDriver = signal<Driver | null>(null);
  readonly driverDetailLoading = signal(false);
  readonly driverDetailError = signal('');
  readonly driverQuery = signal('');
  readonly driverFilter = signal<'ALL' | Driver['status']>('ALL');
  readonly unassignedOnly = signal(false);
  readonly visibleDrivers = computed(() => {
    const query = this.driverQuery().trim().toLowerCase();
    return this.drivers().filter(driver =>
      (this.driverFilter() === 'ALL' || driver.status === this.driverFilter()) &&
      (!query || [driver.name, driver.employeeCode, driver.mobileNumber ?? '', driver.email ?? '', driver.vehicleRegistration ?? '', String(driver.id)].some(value => value.toLowerCase().includes(query))));
  });
  readonly driverOrders = computed(() => this.orders().filter(order => order.driverId === this.selectedDriverId()));
  readonly orderView = signal<'table' | 'cards' | 'board'>('table');
  readonly driverView = signal<'table' | 'cards'>('table');
  readonly compactRows = signal(false);
  readonly driverNames = computed(() => new Map(this.drivers().map(driver => [driver.id, driver.name])));
  readonly currentTab = signal('Overview');
  readonly pageTitle = computed(() => (({ Overview: 'Dispatch', Deliveries: 'Orders', Fleet: 'Drivers', Map: 'Germany map', AI: 'AI tools' } as Record<string, string>)[this.currentTab()] ?? 'Dispatch'));
  readonly pageDescription = computed(() => (({ Overview: 'Your queue, priorities and available capacity.', Deliveries: 'Search, assign and manage your deliveries.', Fleet: 'Find available capacity and keep your team moving.', Map: 'Confirm locations and manage driver service areas across Germany.', AI: 'Review guidance and drafts based on your saved operations data.' } as Record<string, string>)[this.currentTab()] ?? ''));
  readonly scheduleFilter = signal<ScheduleFilter>('ALL');
  readonly scheduleFilters: { key: ScheduleFilter; label: string }[] = [{ key: 'ALL', label: 'Any date' }, { key: 'TODAY', label: 'Due today' }, { key: 'OVERDUE', label: 'Overdue' }, { key: 'UNSCHEDULED', label: 'Unscheduled' }];
  readonly clockNow = signal(Date.now());
  readonly activeFilterCount = computed(() => Number(!!this.query().trim()) + Number(this.filter() !== 'ALL') + Number(this.unassignedOnly()) + Number(this.scheduleFilter() !== 'ALL'));
  readonly dueTodayCount = computed(() => this.orders().filter(order => dueToday(order, this.clockNow())).length);
  reviewToday(): void { this.clearFilters(); this.setScheduleFilter('TODAY'); }
  reviewDelayed(): void { this.clearFilters(); this.setFilter('DELAYED'); }
  readonly localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  private clockTimer?: ReturnType<typeof setInterval>;
  readonly editingOrderId = signal<number | null>(null);
  readonly editingTracking = signal('');
  deliveryWindowStart = '';
  deliveryWindowEnd = '';
  readonly scheduleError = signal('');
  readonly cancelOrderTarget = signal<{ id: number; trackingNumber: string } | null>(null);
  readonly cancelling = signal(false);
  readonly cancelError = signal('');
  readonly filter = signal<OrderFilter>('ALL');
  readonly query = signal('');
  readonly sortKey = signal<SortKey>('id');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');
  readonly submitted = signal(false);
  readonly fieldErrors = signal<Partial<Record<FormField, string>>>({});
  readonly orderFields: readonly FormField[] = ['customerName', 'pickupAddress', 'deliveryAddress'];
  readonly showNewOrder = signal(false);
  readonly saving = signal(false);
  readonly createError = signal('');
  readonly toast = signal('');
  readonly newCustomer = signal('');
  readonly newPickupAddress = signal('');
  readonly newDestination = signal('');
  readonly filters: ReadonlyArray<{ key: OrderFilter; label: string }> = [
    { key: 'ALL', label: 'All' }, { key: 'PENDING', label: 'Pending' },
    { key: 'IN_TRANSIT', label: 'On the road' }, { key: 'DELAYED', label: 'Delayed' },
    { key: 'DELIVERED', label: 'Delivered' }, { key: 'CANCELLED', label: 'Cancelled' }
  ];
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly summary = computed(() => ({
    delayedOrders: this.orders().filter(order => order.status === 'DELAYED').length,
    availableDrivers: this.drivers().filter(driver => driver.status !== 'OFFLINE' && driver.availableSpaces > 0).length,
    unassigned: this.orders().filter(order => order.status === 'PENDING' && order.driverId === null).length,
    assigned: this.orders().filter(order => order.driverId !== null).length,
    spaces: this.drivers().filter(driver => driver.status !== 'OFFLINE').reduce((total, driver) => total + driver.availableSpaces, 0)
  }));
  readonly visibleOrders = computed(() => this.orders().filter(order => {
    const q = this.query().toLowerCase().trim();
    return matchesSchedule(order, this.scheduleFilter(), this.clockNow()) && (!this.unassignedOnly() || (order.status === 'PENDING' && order.driverId === null)) &&
      (this.filter() === 'ALL' || order.status === this.filter()) &&
      (!q || [String(order.id), order.trackingNumber, order.customer, order.destination, order.pickupAddress]
        .some(value => value.toLowerCase().includes(q)));
  }).sort((a, b) => {
    const key = this.sortKey();
    const comparison = key === 'id' ? a.id - b.id : String(a[key]).localeCompare(String(b[key]), 'en', { numeric: true, sensitivity: 'base' });
    return this.sortDirection() === 'asc' ? comparison : -comparison;
  }));
  readonly availableDrivers = computed(() => this.drivers().filter(driver => driver.status !== 'OFFLINE' && driver.availableSpaces > 0));
  readonly eligibleOrders = computed(() => this.orders().filter(order => order.status === 'PENDING' && order.driverId === null));
  readonly checkedOrders = computed(() => this.eligibleOrders().filter(order => this.checkedOrderIds().has(order.id)));
  readonly visibleEligibleOrders = computed(() => this.visibleOrders().filter(order => order.status === 'PENDING' && order.driverId === null));
  readonly allVisibleChecked = computed(() => this.visibleEligibleOrders().length > 0 && this.visibleEligibleOrders().every(order => this.checkedOrderIds().has(order.id)));
  readonly someVisibleChecked = computed(() => this.visibleEligibleOrders().some(order => this.checkedOrderIds().has(order.id)) && !this.allVisibleChecked());
  readonly hiddenCheckedCount = computed(() => this.checkedOrders().filter(order => !this.visibleOrders().some(visible => visible.id === order.id)).length);
  readonly bulkDrivers = computed(() => this.availableDrivers().filter(driver => driver.availableSpaces >= this.bulkItems().length));
  readonly bulkSuccessCount = computed(() => this.bulkResults().filter(result => result.outcome === 'assigned').length);
  readonly operationalAlerts = computed(() => {
    const alerts: { key: 'unassigned' | 'delayed' | 'capacity' | 'overdue'; title: string; detail: string; action: string }[] = [];
    if (!this.loading() && !this.loadError()) {
      const late = this.orders().filter(order => overdue(order, this.clockNow())).length;
      if (late) alerts.push({ key: 'overdue', title: `${late} overdue deliveries`, detail: 'The delivery window has ended and these orders are still unfinished.', action: 'Review overdue' });
      if (this.summary().delayedOrders) alerts.push({ key: 'delayed', title: `${this.summary().delayedOrders} delayed deliveries`, detail: 'Review delivery progress and resolve exceptions.', action: 'Review delayed' });
      if (this.summary().unassigned) alerts.push({ key: 'unassigned', title: `${this.summary().unassigned} orders awaiting assignment`, detail: 'Select pending orders and assign them together.', action: 'Assign orders' });
    }
    if (!this.driversLoading() && !this.driversError()) {
      if (this.summary().spaces === 0) alerts.push({ key: 'capacity', title: 'No available driver capacity', detail: this.drivers().length ? 'All drivers are full or offline. Review your roster.' : 'Add your first driver to begin assigning deliveries.', action: 'Review drivers' });
      else if (!this.loading() && !this.loadError() && this.summary().unassigned > this.summary().spaces) alerts.push({ key: 'capacity', title: `${this.summary().unassigned - this.summary().spaces} orders exceed available capacity`, detail: `${this.summary().spaces} spaces available for ${this.summary().unassigned} pending unassigned orders.`, action: 'Review capacity' });
    }
    return alerts;
  });

  openOperationalAlert(key: 'unassigned' | 'delayed' | 'capacity' | 'overdue'): void {
    if (key === 'capacity') { this.driverQuery.set(''); this.driverFilter.set('ALL'); this.setTab('Fleet'); return; }
    this.setTab('Deliveries'); this.query.set('');
    if (key === 'overdue') { this.setScheduleFilter('OVERDUE'); return; }
    if (key === 'unassigned') this.showUnassigned(); else this.setFilter('DELAYED');
  }

  toggleOrderSelection(id: number): void {
    if (this.bulkAssigning() || this.loading() || this.loadError() || !this.eligibleOrders().some(order => order.id === id)) return;
    this.checkedOrderIds.update(ids => { const next = new Set(ids); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  toggleVisibleSelection(): void {
    if (this.bulkAssigning() || this.loading() || this.loadError()) return;
    const remove = this.allVisibleChecked();
    this.checkedOrderIds.update(ids => { const next = new Set(ids); for (const order of this.visibleEligibleOrders()) remove ? next.delete(order.id) : next.add(order.id); return next; });
  }

  clearOrderSelection(): void { if (!this.bulkAssigning()) this.checkedOrderIds.set(new Set()); }

  openBulkAssignment(): void {
    if (this.saving() || this.cancelling() || !this.checkedOrders().length || this.loading() || this.loadError() || this.assigning() || this.statusChanging() || this.bulkAssigning()) return;
    this.bulkItems.set(this.checkedOrders().map(({ id, trackingNumber }) => ({ id, trackingNumber })));
    this.bulkResults.set([]); this.bulkError.set(''); this.bulkFinished.set(false); this.bulkDriverId = null;
    this.showBulkAssignment.set(true); this.reloadDrivers();
  }

  closeBulkAssignment(): void { if (!this.bulkAssigning()) this.showBulkAssignment.set(false); }

  assignSelectedOrders(): void {
    if (this.saving() || this.cancelling() || this.bulkAssigning() || this.bulkFinished() || this.assigning() || this.statusChanging()) return;
    const items = this.bulkItems();
    const driverId = this.bulkDriverId;
    if (this.loading() || this.loadError() || this.driversLoading() || this.driversError()) { this.bulkError.set('Wait for orders and driver availability to load successfully.'); return; }
    if (!items.length || items.some(item => !this.eligibleOrders().some(order => order.id === item.id))) { this.bulkError.set('Some selected orders are no longer eligible. Close this dialog and review your selection.'); return; }
    if (driverId === null || !this.bulkDrivers().some(driver => driver.id === driverId)) { this.bulkError.set('Choose an online driver with enough free spaces for the entire selection.'); return; }
    this.bulkError.set(''); this.bulkAssigning.set(true);
    this.bulkRequest = this.bulkApi.assign(items, driverId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => this.bulkResults.update(results => [...results, result]),
      complete: () => {
        this.bulkAssigning.set(false); this.bulkFinished.set(true);
        // Reconcile against server truth before allowing a new batch, including uncertain outcomes.
        this.checkedOrderIds.set(new Set()); this.refreshWorkspace();
        this.notify(`${this.bulkSuccessCount()} of ${items.length} assignments confirmed. Review the batch results.`);
      }
    });
  }

  constructor() {
    this.store.load(); this.reloadDrivers();
    if (typeof window !== 'undefined') this.clockTimer = setInterval(() => this.clockNow.set(Date.now()), 30000);
  }
  isOverdue(order: ScheduledOrder): boolean { return overdue(order, this.clockNow()); }
  isDueToday(order: ScheduledOrder): boolean { return dueToday(order, this.clockNow()); }
  setScheduleFilter(filter: ScheduleFilter): void { this.scheduleFilter.set(filter); this.clockNow.set(Date.now()); }

  editOrder(): void {
    const order = this.selectedOrder();
    if (!order || order.status !== 'PENDING' || this.saving() || this.assigning() || this.statusChanging() || this.bulkAssigning() || this.cancelling()) return;
    this.editingOrderId.set(order.id); this.editingTracking.set(order.trackingNumber);
    this.newCustomer.set(order.customer); this.newPickupAddress.set(order.pickupAddress); this.newDestination.set(order.destination);
    this.deliveryWindowStart = localDateTime(order.deliveryWindowStart); this.deliveryWindowEnd = localDateTime(order.deliveryWindowEnd);
    this.createError.set(''); this.scheduleError.set(''); this.fieldErrors.set({}); this.submitted.set(false); this.showNewOrder.set(true);
  }
  requestCancellation(): void {
    const order = this.selectedOrder();
    if (!order || order.status === 'DELIVERED' || order.status === 'CANCELLED' || this.statusChanging() || this.assigning() || this.bulkAssigning() || this.saving()) return;
    this.cancelError.set(''); this.cancelOrderTarget.set({ id: order.id, trackingNumber: order.trackingNumber });
  }
  closeCancellation(): void { if (!this.cancelling()) this.cancelOrderTarget.set(null); }
  confirmCancellation(): void {
    const target = this.cancelOrderTarget();
    if (!target || this.cancelling() || this.assigning() || this.statusChanging() || this.bulkAssigning() || this.saving()) return;
    this.cancelling.set(true); this.cancelError.set('');
    this.orderApi.updateStatus(target.id, { status: 'CANCELLED' }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.cancelling.set(false))).subscribe({
      next: () => { this.cancelOrderTarget.set(null); this.refreshWorkspace(); this.notify(`${target.trackingNumber} cancelled`); },
      error: error => { this.cancelError.set(orderErrorMessage(error)); this.refreshWorkspace(); }
    });
  }

  updateOrderStatus(status: OrderStatus): void {
    const order = this.selectedOrder();
    if (!order || this.statusChanging() || this.assigning() || this.bulkAssigning() || this.cancelling() || this.saving()) return;
    this.statusChanging.set(true); this.statusError.set('');
    this.orderApi.updateStatus(order.id, { status }).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.statusChanging.set(false))
    ).subscribe({
      next: () => {
        this.store.load(); this.reloadDrivers();
        if (this.selectedOrderId() === order.id) this.store.select(order.id);
        if (this.selectedDriverId() !== null) this.selectDriver(this.selectedDriverId()!);
        this.notify(`${order.trackingNumber}: ${this.statusLabel(status)}`);
      },
      error: error => {
        if (this.selectedOrderId() === order.id) this.statusError.set(orderErrorMessage(error));
        else this.notify(`${order.trackingNumber}: ${orderErrorMessage(error)}`);
        if (error instanceof HttpErrorResponse && (error.status === 404 || error.status === 409)) {
          this.store.load(); this.reloadDrivers();
          if (this.selectedOrderId() === order.id) this.store.select(order.id);
        }
      }
    });
  }

  refreshWorkspace(): void {
    this.store.load(); this.reloadDrivers();
    if (this.currentTab() === 'Fleet' && this.selectedDriverId() !== null) this.selectDriver(this.selectedDriverId()!);
    else if (this.selectedOrderId() !== null) this.store.select(this.selectedOrderId()!);
  }

  selectDriver(id: number): void {
    this.driverDetailRequest?.unsubscribe();
    this.selectedDriverId.set(id); this.selectedDriver.set(null);
    this.driverDetailError.set(''); this.driverDetailLoading.set(true);
    this.driverDetailRequest = this.driverApi.getDriverById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: driver => {
        this.selectedDriver.set(driver); this.driverDetailLoading.set(false);
        this.drivers.update(drivers => drivers.map(item => item.id === driver.id ? driver : item));
      },
      error: error => { this.driverDetailError.set(orderErrorMessage(error)); this.driverDetailLoading.set(false); }
    });
  }

  closeDriverDetails(): void {
    this.driverDetailRequest?.unsubscribe(); this.selectedDriverId.set(null); this.selectedDriver.set(null);
    this.driverDetailLoading.set(false); this.driverDetailError.set('');
  }

  openNewDriver(): void {
    this.editingDriverId.set(null); this.driverName = ''; this.employeeCode = ''; this.driverCapacity = 8;
    this.mobileNumber = ''; this.driverEmail = ''; this.vehicleType = ''; this.vehicleRegistration = ''; this.driverNotes = '';
    this.driverCreateError.set(''); this.showNewDriver.set(true);
  }
  editDriverProfile(): void {
    const driver = this.selectedDriver();
    if (!driver || this.driverSaving()) return;
    this.editingDriverId.set(driver.id); this.driverName = driver.name; this.employeeCode = driver.employeeCode;
    this.mobileNumber = driver.mobileNumber ?? ''; this.driverEmail = driver.email ?? '';
    this.vehicleType = driver.vehicleType ?? ''; this.vehicleRegistration = driver.vehicleRegistration ?? ''; this.driverNotes = driver.notes ?? '';
    this.driverCreateError.set(''); this.showNewDriver.set(true);
  }
  vehicleLabel(type: VehicleType | null): string { return this.vehicleTypes.find(item => item.value === type)?.label ?? 'Not specified'; }
  showUnassigned(): void { this.query.set(''); this.filter.set('ALL'); this.scheduleFilter.set('ALL'); this.unassignedOnly.set(true); }
  viewDriver(id: number): void { this.setTab('Fleet'); this.selectDriver(id); }
  viewDriverOrder(id: number): void { this.setTab('Deliveries'); this.selectOrder(id); }
  driverStatusLabel(status: Driver['status']): string {
    return { AVAILABLE: 'Available', ON_DELIVERY: 'On delivery', OFFLINE: 'Offline' }[status];
  }

  reloadDrivers(): void {
    this.driverRequest?.unsubscribe();
    this.driversLoading.set(true); this.driversError.set('');
    this.driverRequest = this.driverApi.getDrivers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: drivers => { this.drivers.set(drivers); this.driversLoading.set(false); },
      error: error => { this.drivers.set([]); this.driversLoading.set(false); this.driversError.set(orderErrorMessage(error)); }
    });
  }

  driverLabel(id: number | null): string {
    if (id === null) return 'Unassigned';
    return this.drivers().find(driver => driver.id === id)?.name ?? `Driver #${id}`;
  }

  closeNewDriver(): void { if (!this.driverSaving()) this.showNewDriver.set(false); }

  createDriver(): void {
    if (this.driverSaving()) return;
    const editingId = this.editingDriverId();
    const profile = { name: this.driverName.trim(), mobileNumber: this.mobileNumber.trim().replace(/[\s().-]/g, '') || null,
      email: this.driverEmail.trim() || null, vehicleType: this.vehicleType || null, vehicleRegistration: this.vehicleRegistration.trim() || null, notes: this.driverNotes.trim() || null };
    const request = { ...profile, employeeCode: this.employeeCode.trim(), capacity: this.driverCapacity };
    if (!request.name || request.name.length > 150 || (editingId === null && (!request.employeeCode || request.employeeCode.length > 50 ||
        !Number.isInteger(request.capacity) || request.capacity < 1 || request.capacity > 2147483647))) {
      this.driverCreateError.set('Enter a name (up to 150 characters), employee code (up to 50), and a positive whole-number capacity.'); return;
    }
    if ((editingId === null && !profile.mobileNumber) || (profile.mobileNumber && !/^\+?[0-9]{7,15}$/.test(profile.mobileNumber))) {
      this.driverCreateError.set('Enter a mobile number with 7–15 digits, optionally starting with + and a country code.'); return;
    }
    if ((profile.email && (!/^[^\s@]+@[^\s@]+$/.test(profile.email) || profile.email.length > 254)) ||
        (profile.vehicleType && !this.vehicleTypes.some(type => type.value === profile.vehicleType)) ||
        (profile.vehicleRegistration?.length ?? 0) > 32 || (profile.notes?.length ?? 0) > 1000) {
      this.driverCreateError.set('Check the email, vehicle type, registration (up to 32 characters), and notes (up to 1,000 characters).'); return;
    }
    this.driverSaving.set(true); this.driverCreateError.set('');
    const operation = editingId === null ? this.driverApi.createDriver(request) : this.driverApi.updateProfile(editingId, profile);
    operation.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.driverSaving.set(false))).subscribe({
      next: driver => {
        this.driverRequest?.unsubscribe();
        this.drivers.update(drivers => [...drivers.filter(item => item.id !== driver.id), driver]);
        this.driverQuery.set(''); this.driverFilter.set('ALL');
        if (this.currentTab() === 'Fleet') {
          this.driverDetailRequest?.unsubscribe();
          this.selectedDriverId.set(driver.id); this.selectedDriver.set(driver);
          this.driverDetailLoading.set(false); this.driverDetailError.set('');
        }
        this.reloadDrivers(); this.showNewDriver.set(false);
        this.driverName = ''; this.employeeCode = ''; this.driverCapacity = 8;
        this.notify(`Driver ${driver.name} ${editingId === null ? 'added' : 'updated'}`);
      },
      error: error => this.driverCreateError.set(orderErrorMessage(error))
    });
  }

  assignDriver(): void {
    const order = this.selectedOrder();
    const driverId = this.assignmentDriverId;
    if (this.cancelling() || this.saving() || this.bulkAssigning() || this.assigning() || this.statusChanging() || !order || order.driverId !== null || order.status !== 'PENDING' || driverId === null) return;
    this.assigning.set(true); this.assignError.set('');
    this.orderApi.assignDriver(order.id, { driverId }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.assigning.set(false))).subscribe({
      next: () => {
        this.store.load(); this.reloadDrivers();
        if (this.selectedOrderId() === order.id) this.store.select(order.id);
        this.assignmentDriverId = null; this.notify('Driver assigned');
      },
      error: error => {
        this.assignError.set(orderErrorMessage(error));
        if (error instanceof HttpErrorResponse && (error.status === 404 || error.status === 409)) {
          this.store.load(); this.reloadDrivers();
          if (this.selectedOrderId() === order.id) this.store.select(order.id);
          this.assignmentDriverId = null;
        }
      }
    });
  }

  reloadOrders(): void { this.store.load(); }
  setTab(tab: string): void {
    this.scheduleFilter.set('ALL');
    this.currentTab.set(tab);
    if (tab === 'Fleet') {
      this.reloadDrivers();
      if (this.selectedDriverId() !== null) this.selectDriver(this.selectedDriverId()!);
    }
    if (tab === 'Deliveries' || tab === 'Overview') { this.filter.set('ALL'); this.unassignedOnly.set(false); }
  }
  setFilter(filter: OrderFilter): void { this.filter.set(filter); this.unassignedOnly.set(false); }
  selectStage(status: OrderStatus): void { this.query.set(''); this.filter.set(status); }
  selectOrder(id: number): void { this.statusError.set(''); this.assignError.set(''); this.assignmentDriverId = null; this.store.select(id); }
  closeDetails(): void { this.store.closeDetails(); this.statusError.set(''); this.assignError.set(''); this.assignmentDriverId = null; }
  retryDetails(): void {
    const id = this.selectedOrderId();
    if (id !== null) this.store.select(id);
  }
  openNewOrder(): void {
    if (this.editingOrderId() !== null) { this.newCustomer.set(''); this.newPickupAddress.set(''); this.newDestination.set(''); this.deliveryWindowStart = ''; this.deliveryWindowEnd = ''; }
    this.editingOrderId.set(null); this.editingTracking.set(''); this.scheduleError.set('');
    this.closeDetails(); this.createError.set(''); this.fieldErrors.set({}); this.submitted.set(false); this.showNewOrder.set(true);
  }
  closeNewOrder(): void { if (!this.saving()) this.showNewOrder.set(false); }

  createOrder(): void {
    if (this.saving() || this.cancelling() || this.assigning() || this.statusChanging() || this.bulkAssigning()) return;
    const editingId = this.editingOrderId();
    this.submitted.set(true);
    const request = {
      customerName: this.newCustomer().trim(),
      pickupAddress: this.newPickupAddress().trim(), deliveryAddress: this.newDestination().trim()
    };
    if (Object.values(request).some(value => !value)) {
      this.createError.set('Enter a customer, pickup address and delivery address.');
      return;
    }
    const errors: Partial<Record<FormField, string>> = {};
    for (const field of Object.keys(request) as FormField[]) {
      const limit = field === 'customerName' ? 150 : 255;
      if (request[field].length > limit) errors[field] = 'This value is too long.';
    }
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length) return;
    const scheduleError = windowError(this.deliveryWindowStart, this.deliveryWindowEnd);
    this.scheduleError.set(scheduleError);
    if (scheduleError) return;
    const payload = { ...request, ...((this.deliveryWindowStart || editingId !== null) ? {
      deliveryWindowStart: this.deliveryWindowStart ? new Date(this.deliveryWindowStart).toISOString() : null,
      deliveryWindowEnd: this.deliveryWindowEnd ? new Date(this.deliveryWindowEnd).toISOString() : null
    } : {}) };
    this.saving.set(true);
    this.createError.set('');
    (editingId === null ? this.store.create(payload) : this.store.update(editingId, payload)).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: order => {
        this.filter.set('ALL'); this.query.set(''); this.sortKey.set('id'); this.sortDirection.set('desc');
        this.unassignedOnly.set(false);
        this.scheduleFilter.set('ALL'); this.deliveryWindowStart = ''; this.deliveryWindowEnd = '';
        this.currentTab.set('Deliveries');
        this.newCustomer.set('');
        this.newPickupAddress.set(''); this.newDestination.set('');
        this.showNewOrder.set(false);
        this.notify(`Delivery ${order.trackingNumber} ${editingId === null ? 'created' : 'updated'}`);
      },
      error: (error: unknown) => {
        this.createError.set(orderErrorMessage(error));
        if (error instanceof HttpErrorResponse) {
          const body: unknown = error.error;
          if (typeof body === 'object' && body !== null && 'fieldErrors' in body && typeof body.fieldErrors === 'object' && body.fieldErrors !== null) {
            const fields = body.fieldErrors;
            const messages: Partial<Record<FormField, string>> = {};
            for (const key of this.orderFields) {
              if (key in fields) {
                const message: unknown = Reflect.get(fields, key);
                if (typeof message === 'string') messages[key] = message;
              }
            }
            this.fieldErrors.set(messages);
          }
          if (error.status === 409 && editingId === null) this.createError.set('The generated tracking number could not be saved. Please try creating the delivery again.');
          if (editingId !== null && (error.status === 404 || error.status === 409)) this.refreshWorkspace();
        }
      }
    });
  }

  sortBy(key: SortKey): void {
    this.sortDirection.set(this.sortKey() === key && this.sortDirection() === 'asc' ? 'desc' : 'asc');
    this.sortKey.set(key);
  }
  sortAria(key: SortKey): 'none' | 'ascending' | 'descending' {
    return this.sortKey() !== key ? 'none' : this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }
  filterCount(key: OrderFilter): number { return key === 'ALL' ? this.orders().length : this.orders().filter(order => order.status === key).length; }
  clearFilters(): void { this.query.set(''); this.filter.set('ALL'); this.unassignedOnly.set(false); this.scheduleFilter.set('ALL'); }
  editField(field: FormField, value: string): void {
    const targets = { customerName: this.newCustomer, pickupAddress: this.newPickupAddress, deliveryAddress: this.newDestination };
    targets[field].set(value);
    this.fieldErrors.update(errors => ({ ...errors, [field]: undefined }));
    this.createError.set('');
  }
  fieldError(field: FormField, touched: boolean): string {
    const serverError = this.fieldErrors()[field];
    if (serverError) return serverError;
    if (!touched && !this.submitted()) return '';
    const values = { customerName: this.newCustomer(), pickupAddress: this.newPickupAddress(), deliveryAddress: this.newDestination() };
    return values[field].trim() ? '' : 'This field is required.';
  }
  private notify(message: string): void {
    this.toast.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 4000);
  }
  copyTracking(trackingNumber: string): void {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(trackingNumber).then(() => {
        this.notify(`Tracking ${trackingNumber} copied`);
      }).catch(() => {
        this.notify(`Tracking: ${trackingNumber}`);
      });
    } else {
      this.notify(`Tracking: ${trackingNumber}`);
    }
  }
  statusLabel(status: OrderStatus | 'ALL'): string {
    if (status === 'ALL') return 'All';
    return ({ PENDING: 'Pending', IN_TRANSIT: 'In transit', DELIVERED: 'Delivered', DELAYED: 'Delayed', CANCELLED: 'Cancelled' } as const)[status];
  }
  ngOnDestroy(): void { this.bulkRequest?.unsubscribe(); if (this.clockTimer) clearInterval(this.clockTimer); if (this.toastTimer) clearTimeout(this.toastTimer); }
}
