import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
export interface AiTool { id: string; title: string; description: string; requiresOrder: boolean; requiresText: boolean; }
export interface AiResult { toolId: string; title: string; source: 'AI' | 'LOCAL'; content: string; facts: string; generatedAt: string; }
@Injectable({ providedIn: 'root' })
export class LogisticsAiApi {
  private readonly http = inject(HttpClient);
  tools() { return this.http.get<AiTool[]>('/api/v1/ai/tools'); }
  run(toolId: string, orderId: number | null, text: string, language: 'DE' | 'EN') { return this.http.post<AiResult>('/api/v1/ai/run', { toolId, orderId, text, language }); }
}
