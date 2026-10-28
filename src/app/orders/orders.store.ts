import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { map, Observable, Subscription, tap } from 'rxjs';
import { OrderApiService } from './order-api.service';
import { CreateOrderRequest, OrderView, toOrderView } from './order-api.models';
import { orderErrorMessage } from './order-errors';

@Injectable({ providedIn: 'root' })
export class OrdersStore {
  private readonly api = inject(OrderApiService);
  private listRequest?: Subscription;
  private detailRequest?: Subscription;
  readonly orders = signal<OrderView[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly selectedId = signal<number | null>(null);
  readonly selected = signal<OrderView | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.listRequest?.unsubscribe();
      this.detailRequest?.unsubscribe();
    });
  }

  load(): void {
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.listRequest = this.api.getOrders().pipe(map(orders => orders.map(toOrderView))).subscribe({
      next: orders => { this.orders.set(orders); this.loading.set(false); },
      error: (error: unknown) => {
        this.orders.set([]);
        this.error.set(orderErrorMessage(error));
        this.loading.set(false);
      }
    });
  }

  select(id: number): void {
    this.detailRequest?.unsubscribe();
    this.selectedId.set(id);
    this.selected.set(null);
    this.detailError.set('');
    this.detailLoading.set(true);
    this.detailRequest = this.api.getOrderById(id).pipe(map(toOrderView)).subscribe({
      next: order => {
        this.selected.set(order);
        this.orders.update(orders => orders.map(existing => existing.id === order.id ? order : existing));
        this.detailLoading.set(false);
      },
      error: (error: unknown) => {
        this.detailError.set(orderErrorMessage(error));
        this.detailLoading.set(false);
      }
    });
  }

  closeDetails(): void {
    this.detailRequest?.unsubscribe();
    this.selectedId.set(null);
    this.selected.set(null);
    this.detailLoading.set(false);
    this.detailError.set('');
  }

  update(id: number, request: CreateOrderRequest): Observable<OrderView> {
    return this.api.updateOrder(id, request).pipe(map(toOrderView), tap(order => this.acceptSaved(order)));
  }

  private acceptSaved(order: OrderView): void {
    this.listRequest?.unsubscribe(); this.closeDetails(); this.loading.set(false); this.error.set('');
    this.orders.update(orders => [order, ...orders.filter(existing => existing.id !== order.id)]);
    this.selectedId.set(order.id); this.selected.set(order);
  }

  create(request: CreateOrderRequest): Observable<OrderView> {
    return this.api.createOrder(request).pipe(map(toOrderView), tap(order => {
      // Prevent an older in-flight list or detail response from replacing the new order.
      this.listRequest?.unsubscribe();
      this.closeDetails();
      this.loading.set(false);
      this.error.set('');
      this.orders.update(orders => [order, ...orders.filter(existing => existing.id !== order.id)]);
      this.selectedId.set(order.id);
      this.selected.set(order);
    }));
  }
}
