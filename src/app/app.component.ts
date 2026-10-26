import { CommonModule } from '@angular/common';
import { Component, computed, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { INITIAL_ACTIVITY, INITIAL_DRIVERS, INITIAL_ORDERS } from './mock-data';
import { ActivityEvent, Driver, Order, OrderStatus } from './models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnDestroy {
  readonly orders = signal<Order[]>(structuredClone(INITIAL_ORDERS));
  readonly drivers = signal<Driver[]>(structuredClone(INITIAL_DRIVERS));
  readonly activities = signal<ActivityEvent[]>(structuredClone(INITIAL_ACTIVITY));
  readonly currentTab = signal('Overview');
  readonly filter = signal<'ALL' | OrderStatus>('ALL');
  readonly query = signal('');
  readonly selectedOrderId = signal<string | null>('FL-20481');
  readonly isSimulating = signal(false);
  readonly showNewOrder = signal(false);
  readonly toast = signal('');
  readonly newCustomer = signal('');
  readonly newDestination = signal('');
  readonly newPriority = signal<'NORMAL' | 'HIGH'>('NORMAL');
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private orderCounter = 20487;
  private tickCount = 0;

  readonly summary = computed(() => {
    const orders = this.orders();
    const drivers = this.drivers();
    return {
      activeDeliveries: orders.filter(o => o.status === 'IN_TRANSIT').length,
      deliveredToday: orders.filter(o => o.status === 'DELIVERED').length,
      delayedOrders: orders.filter(o => o.status === 'DELAYED').length,
      availableDrivers: drivers.filter(d => d.status === 'AVAILABLE').length,
      onTimeRate: orders.length ? Math.round(orders.filter(o => o.status !== 'DELAYED').length / orders.length * 100) : 100
    };
  });
  readonly visibleOrders = computed(() => this.orders().filter(o => {
    const byStatus = this.filter() === 'ALL' || o.status === this.filter();
    const q = this.query().toLowerCase().trim();
    return byStatus && (!q || [o.id, o.customer, o.destination].some(value => value.toLowerCase().includes(q)));
  }));
  readonly selectedOrder = computed(() => this.orders().find(o => o.id === this.selectedOrderId()) ?? null);
  readonly inTransit = computed(() => this.orders().filter(o => o.status === 'IN_TRANSIT'));
  readonly routePoints = [
    {x: 105,y: 175},{x: 175,y: 285},{x: 283,y: 240},{x: 377,y: 145},{x: 490,y: 206},{x: 625,y: 120}
  ];

  setTab(tab: string): void {
    if (tab === 'Settings') { this.notify('Settings are coming in a future release.'); return; }
    this.currentTab.set(tab);
    if (tab === 'Deliveries') this.filter.set('ALL');
  }
  setFilter(filter: 'ALL' | OrderStatus): void { this.filter.set(filter); }
  selectOrder(id: string): void { this.selectedOrderId.set(id); }
  toggleSimulation(): void {
    if (this.isSimulating()) { this.stopSimulation(); this.notify('Simulation paused'); return; }
    this.isSimulating.set(true);
    this.notify('Live simulation running');
    this.tickTimer = setInterval(() => this.tick(), 2200);
  }
  stopSimulation(): void {
    this.isSimulating.set(false);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }
  private tick(): void {
    this.tickCount++;
    this.orders.update(orders => orders.map(o => {
      if (o.status !== 'IN_TRANSIT') return o;
      const eta = Math.max(0, o.etaMinutes - 3);
      if (eta === 0) {
        this.addActivity('order_delivered', `${o.id} successfully delivered`);
        return {...o, etaMinutes: 0, status: 'DELIVERED'};
      }
      return {...o, etaMinutes: eta};
    }));
    this.drivers.update(ds => ds.map((d, i) => {
      if (d.status !== 'BUSY') return d;
      return {...d, lat: d.lat + Math.sin(this.tickCount + i) * 0.0011, lng: d.lng + Math.cos(this.tickCount + i) * 0.0018};
    }));
    if (this.tickCount % 3 === 0) this.assignNextPending();
  }
  assignNextPending(): void {
    const pending = this.orders().find(o => o.status === 'PENDING');
    const driver = this.drivers().find(d => d.status === 'AVAILABLE');
    if (!pending || !driver) { this.notify('No pending order or available driver'); return; }
    this.orders.update(orders => orders.map(o => o.id === pending.id ? {...o, status:'IN_TRANSIT',driverId:driver.id} : o));
    this.drivers.update(drivers => drivers.map(d => d.id === driver.id ? {...d,status:'BUSY',load:1} : d));
    this.addActivity('driver_assigned', `${driver.name} assigned to ${pending.id}`);
    this.notify(`${pending.id} assigned to ${driver.name}`);
  }
  createOrder(): void {
    if (!this.newCustomer().trim() || !this.newDestination().trim()) { this.notify('Enter customer and destination'); return; }
    const order: Order = {
      id: `FL-${++this.orderCounter}`,customer:this.newCustomer().trim(),destination:this.newDestination().trim(),
      priority:this.newPriority(), status:'PENDING',etaMinutes:25 + Math.floor(Math.random()*30),driverId:null,createdAt:new Date().toISOString()
    };
    this.orders.update(orders => [order, ...orders]);
    this.addActivity('order_created', `New order ${order.id} received`);
    this.selectedOrderId.set(order.id);
    this.newCustomer.set(''); this.newDestination.set(''); this.newPriority.set('NORMAL'); this.showNewOrder.set(false);
    this.notify(`${order.id} created successfully`);
  }
  private addActivity(type: ActivityEvent['type'], message: string): void {
    this.activities.update(list => [{id:`EV-${Date.now()}-${Math.random()}`,type,message,timestamp:new Date().toISOString()},...list].slice(0,8));
  }
  private notify(message: string): void {
    this.toast.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 3200);
  }
  statusLabel(status: OrderStatus): string {
    return ({PENDING:'Pending',IN_TRANSIT:'In transit',DELIVERED:'Delivered',DELAYED:'Delayed'} as const)[status];
  }
  getDriverName(id: string | null): string {
    return this.drivers().find(d => d.id === id)?.name ?? 'Unassigned';
  }
  trackById(_index: number, item: {id: string}): string { return item.id; }
  ngOnDestroy(): void { this.stopSimulation(); if (this.toastTimer) clearTimeout(this.toastTimer); }
}
