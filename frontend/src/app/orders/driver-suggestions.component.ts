import { MarkdownComponent } from '../shared/markdown.component';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { OrderApiService } from './order-api.service';
import { DriverSuggestion } from './order-api.models';

@Component({
  selector: 'app-driver-suggestions',
  standalone: true, imports: [MarkdownComponent],
  template: `
    <section aria-label="Driver suggestions" [attr.aria-busy]="loading()">
      <div class="heading"><h5>Driver suggestions</h5>
        <button type="button" (click)="load()" [disabled]="disabled || loading()">{{loading() ? 'Finding…' : loaded() ? 'Refresh' : 'Find drivers'}}</button>
      </div>
      <p class="hint">Prioritizes lighter workloads, fewer assignments today, then longest waiting. Routes and travel times are not considered.</p>
      @if(error()){<p role="alert">{{error()}}</p>}
      @if(loading()){<p role="status">Checking available drivers…</p>}
      @if(explanation(); as detail){<div aria-live="polite"><strong>{{detail.source === 'AI' ? 'AI explanation' : 'Capacity-based guidance'}}:</strong><app-markdown [text]="detail.text"/></div>}
      @if(loaded() && !loading() && !error()){
        @for(driver of suggestions(); track driver.driverId; let first = $first){
          <article>
            <div class="heading"><strong>{{driver.name}}</strong>@if(first){<span class="tag">Top match</span>}</div>
            <small>{{driver.employeeCode}}</small>
            <p>{{driver.reason}}</p>
            <button type="button" [disabled]="disabled" (click)="choose.emit(driver.driverId)">Choose {{driver.name}}</button>
          </article>
        } @empty {<p role="status">No eligible drivers have capacity right now. Refresh after availability changes.</p>}
        @if(suggestions().length){
          <button type="button" (click)="explain()" [disabled]="disabled || explaining()">{{explaining() ? 'Explaining…' : 'Explain with AI'}}</button>
          <p class="hint">Choose a driver, then confirm with Assign driver. Availability is checked again when assigning.</p>
        }
      }
    </section>
  `,
  styles: [`
    :host { display:block; }
    section { border:1px solid var(--warm-border); border-radius:6px; padding:12px; background:var(--warm); }
    .heading { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
    h5 { margin:0; font-size:12px; } p { font-size:12px; margin:8px 0; overflow-wrap:anywhere; }
    .hint, small { color:var(--muted); font-size:11px; }
    article { border-top:1px solid var(--warm-border); padding:12px 0; }
    strong { overflow-wrap:anywhere; } .tag { font-size:10px; color:var(--accent-text); }
    button { min-height:36px; padding:6px 10px; border:1px solid var(--border-strong); border-radius:4px; background:var(--panel); color:var(--text); font:inherit; font-size:11px; }
    button:disabled { opacity:.55; cursor:not-allowed; }
  `]
})
export class DriverSuggestionsComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) orderId!: number;
  @Input() disabled = false;
  @Output() choose = new EventEmitter<number>();
  private readonly api = inject(OrderApiService);
  private request?: Subscription;
  private explanationRequest?: Subscription;
  readonly explaining = signal(false);
  readonly explanation = signal<{ source: 'AI' | 'RULES'; text: string } | null>(null);
  readonly suggestions = signal<DriverSuggestion[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');

  ngOnChanges(): void {
    this.request?.unsubscribe();
    this.clearExplanation();
    this.suggestions.set([]); this.loading.set(false); this.loaded.set(false); this.error.set('');
  }
  load(): void {
    if (this.disabled || this.loading()) return;
    this.request?.unsubscribe();
    this.clearExplanation();
    this.loading.set(true); this.error.set(''); this.suggestions.set([]);
    this.request = this.api.getDriverSuggestions(this.orderId).subscribe({
      next: suggestions => { this.suggestions.set(suggestions); this.loaded.set(true); this.loading.set(false); },
      error: error => {
        this.loading.set(false);
        this.error.set(error.status === 409 ? 'This order changed. Refresh its details before requesting suggestions.'
          : error.status === 404 ? 'Suggestions are unavailable. Refresh the order and check that the backend is updated.'
          : 'Could not load suggestions. Try again or choose a driver manually.');
      }
    });
  }
  explain(): void {
    if (this.disabled || this.loading() || this.explaining() || !this.suggestions().length) return;
    this.explaining.set(true); this.explanation.set(null);
    this.explanationRequest = this.api.explainDriverSuggestions(this.orderId).subscribe({
      next: result => { this.suggestions.set(result.suggestions); this.explanation.set(result.explanation); this.explaining.set(false); },
      error: () => {
        this.explaining.set(false);
        this.explanation.set({ source: 'RULES', text: 'Could not explain these suggestions. Refresh to check current availability, or choose a driver manually.' });
      }
    });
  }
  private clearExplanation(): void {
    this.explanationRequest?.unsubscribe(); this.explaining.set(false); this.explanation.set(null);
  }
  ngOnDestroy(): void { this.request?.unsubscribe(); this.clearExplanation(); }
}
