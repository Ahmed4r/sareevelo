import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { INITIAL_ACTIVITY, INITIAL_DRIVERS } from './mock-data';
import { OrderStatus } from './models';
import { OrdersStore } from './orders/orders.store';
import { orderErrorMessage } from './orders/order-errors';

type OrderFilter = 'ALL' | OrderStatus;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnDestroy {
  private readonly store = inject(OrdersStore);
  private readonly destroyRef = inject(DestroyRef);
  readonly orders = this.store.orders.asReadonly();
  readonly loading = this.store.loading.asReadonly();
  readonly loadError = this.store.error.asReadonly();
  readonly selectedOrder = this.store.selected.asReadonly();
  readonly selectedOrderId = this.store.selectedId.asReadonly();
  readonly detailLoading = this.store.detailLoading.asReadonly();
  readonly detailError = this.store.detailError.asReadonly();
  // These fixtures are display-only and never participate in real order mutations.
  readonly drivers = signal(structuredClone(INITIAL_DRIVERS)).asReadonly();
  readonly activities = signal(structuredClone(INITIAL_ACTIVITY)).asReadonly();
  readonly currentTab = signal('Overview');
  readonly filter = signal<OrderFilter>('ALL');
  readonly query = signal('');
  readonly showNewOrder = signal(false);
  readonly saving = signal(false);
  readonly createError = signal('');
  readonly toast = signal('');
  readonly newTrackingNumber = signal('');
  readonly newCustomer = signal('');
  readonly newPickupAddress = signal('');
  readonly newDestination = signal('');
  readonly filters: ReadonlyArray<{ key: OrderFilter; label: string }> = [
    { key: 'ALL', label: 'All' }, { key: 'PENDING', label: 'Pending' },
    { key: 'IN_TRANSIT', label: 'On the road' }, { key: 'DELAYED', label: 'Delayed' },
    { key: 'DELIVERED', label: 'Delivered' }
  ];
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly summary = computed(() => ({
    delayedOrders: this.orders().filter(order => order.status === 'DELAYED').length,
    availableDrivers: this.drivers().filter(driver => driver.status === 'AVAILABLE').length
  }));
  readonly visibleOrders = computed(() => this.orders().filter(order => {
    const q = this.query().toLowerCase().trim();
    return (this.filter() === 'ALL' || order.status === this.filter()) &&
      (!q || [String(order.id), order.trackingNumber, order.customer, order.destination, order.pickupAddress]
        .some(value => value.toLowerCase().includes(q)));
  }));
  readonly attentionOrders = computed(() => this.orders()
    .filter(order => order.status === 'DELAYED' || order.status === 'PENDING')
    .sort((a, b) => Number(b.status === 'DELAYED') - Number(a.status === 'DELAYED')));
  readonly availableDrivers = computed(() => this.drivers().filter(driver => driver.status === 'AVAILABLE'));
  readonly shipmentStages = computed(() => [
    { status: 'PENDING' as OrderStatus, label: 'Pending dispatch', orders: this.orders().filter(order => order.status === 'PENDING') },
    { status: 'IN_TRANSIT' as OrderStatus, label: 'On the road', orders: this.orders().filter(order => order.status === 'IN_TRANSIT') },
    { status: 'DELIVERED' as OrderStatus, label: 'Delivered', orders: this.orders().filter(order => order.status === 'DELIVERED') }
  ]);

  constructor() { this.store.load(); }

  reloadOrders(): void { this.store.load(); }
  setTab(tab: string): void {
    this.currentTab.set(tab);
    if (tab === 'Deliveries') this.filter.set('ALL');
  }
  setFilter(filter: OrderFilter): void { this.filter.set(filter); }
  selectStage(status: OrderStatus): void { this.query.set(''); this.filter.set(status); }
  selectOrder(id: number): void { this.store.select(id); }
  closeDetails(): void { this.store.closeDetails(); }
  retryDetails(): void {
    const id = this.selectedOrderId();
    if (id !== null) this.store.select(id);
  }
  openNewOrder(): void { this.createError.set(''); this.showNewOrder.set(true); }
  closeNewOrder(): void { if (!this.saving()) this.showNewOrder.set(false); }

  createOrder(): void {
    if (this.saving()) return;
    const request = {
      trackingNumber: this.newTrackingNumber().trim(), customerName: this.newCustomer().trim(),
      pickupAddress: this.newPickupAddress().trim(), deliveryAddress: this.newDestination().trim()
    };
    if (Object.values(request).some(value => !value)) {
      this.createError.set('Enter a tracking number, customer, pickup address and delivery address.');
      return;
    }
    this.saving.set(true);
    this.createError.set('');
    this.store.create(request).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: order => {
        this.filter.set('ALL'); this.query.set('');
        this.currentTab.set('Deliveries');
        this.newTrackingNumber.set(''); this.newCustomer.set('');
        this.newPickupAddress.set(''); this.newDestination.set('');
        this.showNewOrder.set(false);
        this.notify(`Delivery ${order.trackingNumber} created`);
      },
      error: (error: unknown) => this.createError.set(orderErrorMessage(error))
    });
  }

  private notify(message: string): void {
    this.toast.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 4000);
  }
  statusLabel(status: OrderStatus): string {
    return ({ PENDING: 'Pending', IN_TRANSIT: 'In transit', DELIVERED: 'Delivered', DELAYED: 'Delayed' } as const)[status];
  }
  ngOnDestroy(): void { if (this.toastTimer) clearTimeout(this.toastTimer); }
}
