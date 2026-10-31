import { Component, inject, Input, OnChanges, OnDestroy, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { OrderApiService } from './order-api.service';
import { OrderActivity } from './order-api.models';
import { orderErrorMessage } from './order-errors';

@Component({
  selector: 'app-order-activity', standalone: true, imports: [DatePipe],
  template: `
    <section aria-label="Order activity">
      <div class="heading"><h4>Activity history</h4><button type="button" (click)="load()" [disabled]="loading()">Refresh</button></div>
      @if (loading()) { <p role="status">Loading activity…</p> }
      @else if (error()) { <p class="error" role="alert">{{error()}}</p><button type="button" (click)="load()">Retry activity</button> }
      @else { <ol>@for (event of events(); track event.id) {
        <li><span class="event-dot" aria-hidden="true"></span><div><strong>{{event.message}}</strong><time [attr.datetime]="event.timestamp">{{event.timestamp | date:'d MMM y, HH:mm:ss'}}</time></div></li>
      } @empty { <p>No recorded activity for this order yet.</p> }</ol> }
    </section>`,
  styles: `
    :host{display:block;border-top:1px solid var(--border);padding-top:20px}
    .heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}
    h4{margin:0;color:var(--text);font-size:12px;font-weight:650}
    button{border:0;background:none;color:var(--accent-text);font-size:11px;padding:0;cursor:pointer}button:disabled{opacity:.5}
    p{color:var(--muted);font-size:12px;line-height:1.7;margin:0}.error{color:var(--error-text);margin-bottom:10px}
    ol{list-style:none;padding:0;margin:0}li{display:flex;gap:10px;position:relative;padding-bottom:18px}
    li:not(:last-child)::before{content:'';position:absolute;left:3px;top:9px;bottom:0;width:1px;background:var(--border)}
    li:last-child{padding-bottom:0}.event-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);flex:none;margin-top:5px}
    strong{display:block;font-size:11px;font-weight:500;color:var(--secondary-text);line-height:1.6;overflow-wrap:anywhere}
    time{display:block;font-size:10px;color:var(--muted);margin-top:4px}
  `
})
export class OrderActivityComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) orderId!: number;
  @Input() refreshKey: unknown;
  private readonly api = inject(OrderApiService);
  private request?: Subscription;
  readonly events = signal<OrderActivity[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  ngOnChanges(): void { this.load(); }
  load(): void {
    this.request?.unsubscribe(); this.events.set([]); this.loading.set(true); this.error.set('');
    this.request = this.api.getActivity(this.orderId).subscribe({
      next: events => { this.events.set(events); this.loading.set(false); },
      error: error => { this.error.set(orderErrorMessage(error)); this.loading.set(false); }
    });
  }
  ngOnDestroy(): void { this.request?.unsubscribe(); }
}
