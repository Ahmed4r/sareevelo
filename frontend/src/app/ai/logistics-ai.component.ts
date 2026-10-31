import { MarkdownComponent } from '../shared/markdown.component';
import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { OrderView } from '../orders/order-api.models';
import { orderErrorMessage } from '../orders/order-errors';
import { AiResult, AiTool, LogisticsAiApi } from './logistics-ai.service';

@Component({
  selector: 'app-logistics-ai', standalone: true, imports: [FormsModule, DatePipe, MarkdownComponent],
  template: `
    <section class="ai-workspace" aria-label="Logistics AI tools">
      <div class="intro"><div><h2>Dispatch assistant</h2><p>Ten focused tools for your Germany operation. Review the output before acting.</p></div><span class="provider">Powered by Groq</span></div>
      @if(catalogLoading()){<p role="status">Loading tools…</p>}
      @if(catalogError()){<p class="error" role="alert">{{catalogError()}}</p><button type="button" (click)="loadTools()">Retry tools</button>}
      <div class="tools-grid">@for(tool of tools(); track tool.id){<button class="tool" type="button" [class.active]="selected()?.id === tool.id" [attr.aria-pressed]="selected()?.id === tool.id" (click)="selectTool(tool)"><strong>{{tool.title}}</strong><span>{{tool.description}}</span></button>}</div>
      @if(selected(); as tool){
        <section class="tool-runner" [attr.aria-label]="tool.title">
          <div class="runner-heading"><div><h3>{{tool.title}}</h3><p>{{tool.description}}</p></div><label>Output language<select [(ngModel)]="language" (ngModelChange)="clearResult()" [disabled]="busy()"><option value="DE">Deutsch</option><option value="EN">English</option></select></label></div>
          @if(tool.requiresOrder){<label>Order<select [(ngModel)]="orderId" (ngModelChange)="clearResult()" [disabled]="busy()"><option [ngValue]="null">Choose an order</option>@for(order of orders; track order.id){<option [ngValue]="order.id">{{order.trackingNumber}} · {{order.status}}</option>}</select></label>}
          @if(tool.requiresText){<label>Message to translate<textarea rows="5" maxlength="3000" [(ngModel)]="inputText" (ngModelChange)="clearResult()" [disabled]="busy()" placeholder="Enter German or English dispatch text"></textarea></label><p class="hint">This text is sent to Groq when you run the tool. Remove private details that are not needed. {{inputText.length}} / 3000 characters.</p>}
          <div class="run-actions"><button type="button" class="primary" (click)="run()" [disabled]="busy() || (tool.requiresOrder && orderId === null) || (tool.requiresText && !inputText.trim())">{{busy() ? 'Preparing…' : 'Run ' + tool.title.toLowerCase()}}</button>@if(busy()){<button type="button" (click)="cancel()">Cancel</button>}</div>
          @if(error()){<p class="error" role="alert">{{error()}}</p>}
          @if(result(); as output){
            <div class="output" aria-live="polite"><div class="output-heading"><strong>{{output.source === 'AI' ? 'AI draft' : 'Local guidance · AI unavailable'}}</strong><time>{{output.generatedAt | date:'d MMM, HH:mm'}}</time></div>
              <div class="output-modes" role="group" aria-label="Answer display"><button type="button" [attr.aria-pressed]="!editing" (click)="editing = false">Preview</button><button type="button" [attr.aria-pressed]="editing" (click)="editing = true">Edit Markdown</button></div>
              @if(editing){<label class="output-label">Edit answer<textarea rows="12" [(ngModel)]="draft" (ngModelChange)="copied.set(false)"></textarea></label>}
              @else {<app-markdown [text]="draft"/>}
              <div class="run-actions"><button type="button" (click)="copy()">{{copied() ? 'Copied' : 'Copy Markdown'}}</button><span class="hint">No messages sent or records changed.</span></div>
              <details><summary>Facts used</summary><pre>{{output.facts}}</pre></details>
            </div>
          }
        </section>
      }
    </section>
  `,
  styleUrl: './logistics-ai.component.css'
})
export class LogisticsAiComponent implements OnInit, OnDestroy {
  @Input() orders: OrderView[] = [];
  private readonly api = inject(LogisticsAiApi);
  private catalogRequest?: Subscription;
  private request?: Subscription;
  readonly tools = signal<AiTool[]>([]); readonly selected = signal<AiTool | null>(null);
  readonly catalogLoading = signal(false); readonly catalogError = signal(''); readonly busy = signal(false); readonly error = signal('');
  readonly result = signal<AiResult | null>(null); readonly copied = signal(false);
  orderId: number | null = null; inputText = ''; language: 'DE' | 'EN' = 'EN'; draft = ''; editing = false;
  ngOnInit(): void { this.loadTools(); }
  loadTools(): void {
    this.catalogRequest?.unsubscribe(); this.catalogLoading.set(true); this.catalogError.set('');
    this.catalogRequest = this.api.tools().subscribe({ next: tools => { this.tools.set(tools); this.catalogLoading.set(false); this.selected.set(tools[0] ?? null); }, error: error => { this.catalogLoading.set(false); this.catalogError.set(orderErrorMessage(error)); } });
  }
  selectTool(tool: AiTool): void { this.cancel(); this.selected.set(tool); this.clearResult(); }
  clearResult(): void { this.editing = false; this.result.set(null); this.error.set(''); this.draft = ''; this.copied.set(false); }
  run(): void {
    const tool = this.selected(); if (!tool || this.busy() || (tool.requiresOrder && this.orderId === null) || (tool.requiresText && !this.inputText.trim())) return;
    this.clearResult(); this.busy.set(true);
    this.request = this.api.run(tool.id, tool.requiresOrder ? this.orderId : null, tool.requiresText ? this.inputText : '', this.language).subscribe({
      next: result => { this.result.set(result); this.draft = result.content; this.busy.set(false); },
      error: error => { this.error.set(orderErrorMessage(error)); this.busy.set(false); }
    });
  }
  cancel(): void { this.request?.unsubscribe(); this.busy.set(false); }
  async copy(): Promise<void> { try { await navigator.clipboard.writeText(this.draft); this.copied.set(true); } catch { this.error.set('Copy was unavailable. Select and copy the draft text manually.'); } }
  ngOnDestroy(): void { this.cancel(); this.catalogRequest?.unsubscribe(); }
}
