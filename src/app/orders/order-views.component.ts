import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { OrderView } from './order-api.models';
import { OrderStatus } from '../models';
import { IconComponent } from '../shared/icon.component';
import { overdue } from './order-schedule';

@Component({
  selector: 'app-order-views', standalone: true, imports: [CommonModule, IconComponent],
  template: `
    <div class="collections" [class.board]="mode === 'board'">
      @for(group of groups; track group.key) {
        <section class="collection" [attr.aria-label]="group.label">
          @if(mode === 'board'){<header><span class="lane-dot" [attr.data-status]="group.key"></span><h3>{{group.label}}</h3><span>{{group.orders.length}}</span></header>}
          <div class="cards">
            @for(order of group.orders; track order.id){
              <article class="delivery-card" [class.active]="selectedId === order.id" [class.late]="isLate(order)">
                <div class="card-top"><span class="state">{{labels[order.status]}}</span><input type="checkbox" [attr.aria-label]="'Select order ' + order.trackingNumber" [checked]="checked.has(order.id) && eligible(order)" [disabled]="busy || !eligible(order)" (change)="toggle.emit(order.id)"></div>
                <button class="order-title" (click)="open.emit(order.id)">{{order.trackingNumber}}<app-icon name="arrow"/></button>
                <p class="customer">{{order.customer}}</p>
                <div class="route"><app-icon name="pin"/><div><small>Delivery address</small><p>{{order.destination}}</p></div></div>
                <footer><span>{{order.deliveryWindowEnd ? (order.deliveryWindowEnd | date:'d MMM, HH:mm') : 'Unscheduled'}}@if(isLate(order)){<strong>Overdue</strong>}</span><span>{{order.driverId === null ? 'Unassigned' : driverName(order.driverId)}}</span></footer>
              </article>
            } @empty {<p class="lane-empty">No matching orders</p>}
          </div>
        </section>
      }
    </div>`,
  styles: `
    :host{display:block;min-width:0}.collections{padding:20px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:14px}.collection{min-width:0}.board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px 12px;background:var(--canvas)}.board .cards{display:flex;flex-direction:column}.collection header{display:flex;align-items:center;gap:8px;margin:0 0 14px}.collection h3{font-size:12px;margin:0;flex:1}.collection header>span:last-child{font:11px var(--font-mono);color:var(--muted)}.lane-dot{width:7px;height:7px;border-radius:50%;background:var(--muted)}.lane-dot[data-status=PENDING]{background:var(--accent)}.lane-dot[data-status=DELAYED]{background:var(--error-text)}.lane-dot[data-status=DELIVERED]{background:var(--success-text)}.delivery-card{min-width:0;border:1px solid var(--border);background:var(--panel);padding:16px;border-radius:8px}.delivery-card.active{outline:2px solid var(--accent-text);outline-offset:-2px}.delivery-card.late{border-top:3px solid var(--error-text)}.card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}.state{font-size:10px;color:var(--secondary-text)}input{width:18px;height:18px;accent-color:var(--accent-hover)}.order-title{display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:0;background:none;color:var(--text);font:600 12px var(--font-mono);padding:0;min-height:44px;width:100%;overflow-wrap:anywhere;cursor:pointer}.customer{font-size:12px;color:var(--muted);margin:4px 0 18px;overflow-wrap:anywhere}.route{display:flex;gap:10px;padding:14px 0;border-top:1px solid var(--border)}.route app-icon{color:var(--accent-text)}small{font-size:10px;color:var(--muted)}.route p{font-size:12px;line-height:1.6;margin:5px 0;overflow-wrap:anywhere}footer{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;border-top:1px solid var(--border);padding-top:12px;font-size:10px;color:var(--muted);overflow-wrap:anywhere}footer strong{display:block;color:var(--error-text);margin-top:5px}.lane-empty{font-size:12px;color:var(--muted);padding:22px 10px;border:1px dashed var(--border);border-radius:8px}button:focus-visible,input:focus-visible{outline:2px solid var(--accent-text);outline-offset:3px}@media(max-width:1350px){.board{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){.board{grid-template-columns:minmax(0,1fr)}.collections{padding:14px}.delivery-card{padding:16px}}
  `
})
export class OrderViewsComponent {
  @Input() orders: readonly OrderView[] = [];
  @Input() mode: 'cards' | 'board' = 'cards';
  @Input() selectedId: number | null = null;
  @Input() checked: ReadonlySet<number> = new Set();
  @Input() busy = false;
  @Input() now = Date.now();
  @Input() driverNames: ReadonlyMap<number, string> = new Map();
  @Output() open = new EventEmitter<number>();
  @Output() toggle = new EventEmitter<number>();
  readonly labels: Record<OrderStatus, string> = { PENDING: 'Pending', IN_TRANSIT: 'On the road', DELAYED: 'Delayed', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' };
  get groups() {
    return this.mode === 'cards' ? [{ key: 'all', label: 'Orders', orders: this.orders }] :
      (Object.keys(this.labels) as OrderStatus[]).map(key => ({ key, label: this.labels[key], orders: this.orders.filter(order => order.status === key) }));
  }
  eligible(order: OrderView): boolean { return order.status === 'PENDING' && order.driverId === null; }
  isLate(order: OrderView): boolean { return overdue(order, this.now); }
  driverName(id: number): string { return this.driverNames.get(id) ?? 'Driver #' + id; }
}
