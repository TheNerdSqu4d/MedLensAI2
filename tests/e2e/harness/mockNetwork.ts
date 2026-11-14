import { MOCK_ANALYSIS_PRESET_1, MOCK_ANALYSIS_PRESET_2 } from '@/mocks/mockData';
import type { PrescriptionAnalysisResult } from '@/types/medlens';

export type NetworkMode =
  | 'SUCCESS_PRESET_1'
  | 'SUCCESS_PRESET_2'
  | 'NETWORK_OFFLINE'
  | 'SERVER_500_ERROR'
  | 'TIMEOUT'
  | 'CUSTOM_PAYLOAD'
  | 'PASS_THROUGH';

export interface InterceptedRequest {
  url: string;
  method: string;
  headers?: any;
  body?: any;
  timestamp: number;
}

export class MockNetworkController {
  private static mode: NetworkMode = 'SUCCESS_PRESET_1';
  private static customPayload: any = null;
  private static requestHistory: InterceptedRequest[] = [];
  private static originalFetch: typeof globalThis.fetch | null = null;
  private static installed: boolean = false;

  static setMode(mode: NetworkMode, customPayload?: any): void {
    this.mode = mode;
    if (customPayload !== undefined) {
      this.customPayload = customPayload;
    }
  }

  static getMode(): NetworkMode {
    return this.mode;
  }

  static getHistory(): InterceptedRequest[] {
    return [...this.requestHistory];
  }

  static clearHistory(): void {
    this.requestHistory = [];
  }

  static install(): void {
    if (this.installed) return;
    this.originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as any).url || '';
      const method = init?.method || (input instanceof Request ? input.method : 'GET');
      
      let bodyData: any = null;
      if (init?.body) {
        try {
          bodyData = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
        } catch {
          bodyData = init.body;
        }
      }

      this.requestHistory.push({
        url: urlStr,
        method,
        headers: init?.headers,
        body: bodyData,
        timestamp: Date.now(),
      });

      // Intercept Supabase Edge Function calls to chat-ai
      if (urlStr.includes('/functions/v1/chat-ai') || urlStr.includes('chat-ai')) {
        if (this.mode === 'NETWORK_OFFLINE') {
          throw new TypeError('Network request failed: device offline');
        }

        if (this.mode === 'SERVER_500_ERROR') {
          return new Response(
            JSON.stringify({ error: 'Internal Server Error: AI Gateway unavailable' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        if (this.mode === 'TIMEOUT') {
          await new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Gateway timeout after 5000ms')), 20)
          );
        }

        if (this.mode === 'CUSTOM_PAYLOAD') {
          return new Response(JSON.stringify(this.customPayload || {}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (this.mode === 'SUCCESS_PRESET_2') {
          return new Response(JSON.stringify(MOCK_ANALYSIS_PRESET_2), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Default: SUCCESS_PRESET_1
        return new Response(JSON.stringify(MOCK_ANALYSIS_PRESET_1), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // If pass-through and originalFetch exists
      if (this.originalFetch) {
        return this.originalFetch(input, init);
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as any;

    this.installed = true;
  }

  static uninstall(): void {
    if (!this.installed) return;
    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
    }
    this.installed = false;
  }
}
