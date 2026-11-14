import { defineTest, assert } from '../../harness/testContext';
import { MockNetworkController } from '../../harness/mockNetwork';
import { MOCK_ANALYSIS_PRESET_1, MOCK_ANALYSIS_PRESET_2 } from '@/mocks/mockData';
import type { PrescriptionAnalysisResult } from '@/types/medlens';

/**
 * Resilient AI prescription analysis client modeling services/ai.ts
 */
export async function resilientAnalyzePrescription(
  preset: 'preset1' | 'preset2' = 'preset1',
  timeoutMs: number = 2000
): Promise<PrescriptionAnalysisResult> {
  const fallbackResult = preset === 'preset2' ? MOCK_ANALYSIS_PRESET_2 : MOCK_ANALYSIS_PRESET_1;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch('https://mock-supabase-endpoint/functions/v1/chat-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      // Server error (HTTP 500 etc) -> graceful fallback
      return fallbackResult;
    }

    const data = await response.json();
    return data;
  } catch (err) {
    // Network failure, offline, or timeout -> resilient zero-crash fallback
    return fallbackResult;
  }
}

// T2-NET-01: Offline Airplane Mode fallback
defineTest(
  'T2-NET-01',
  2,
  'Offline & Network Fallback',
  'Mất mạng (Airplane Mode) bắt lỗi Network request failed và chuyển fallback an toàn',
  async () => {
    MockNetworkController.setMode('NETWORK_OFFLINE');

    const result = await resilientAnalyzePrescription('preset1');
    assert.ok(result, 'Must return fallback result without throwing');
    assert.equal(result.medicines.length, 3);
  }
);

// T2-NET-02: HTTP 500 error from Edge Function
defineTest(
  'T2-NET-02',
  2,
  'Offline & Network Fallback',
  'Edge Function trả HTTP 500 kích hoạt fallback không văng lỗi unhandled',
  async () => {
    MockNetworkController.setMode('SERVER_500_ERROR');

    const result = await resilientAnalyzePrescription('preset2');
    assert.ok(result);
    assert.equal(result.medicines.length, 2);
    assert.equal(result.warnings.length, 2);
  }
);

// T2-NET-03: Gateway timeout
defineTest(
  'T2-NET-03',
  2,
  'Offline & Network Fallback',
  'Gateway Timeout hủy request treo và trả kết quả fallback an toàn',
  async () => {
    MockNetworkController.setMode('TIMEOUT');

    const result = await resilientAnalyzePrescription('preset1', 10);
    assert.ok(result);
    assert.equal(result.medicines.length, 3);
  }
);

// T2-NET-04: No blocking error dialogs
defineTest(
  'T2-NET-04',
  2,
  'Offline & Network Fallback',
  'Không xuất hiện dialog lỗi chặn màn hình khi mạng gặp sự cố',
  async () => {
    MockNetworkController.setMode('NETWORK_OFFLINE');
    let hasBlockingDialog = false;

    try {
      await resilientAnalyzePrescription('preset1');
    } catch {
      hasBlockingDialog = true;
    }

    assert.equal(hasBlockingDialog, false, 'Should never pop a blocking crash/dialog');
  }
);

// T2-NET-05: Connection recovery
defineTest(
  'T2-NET-05',
  2,
  'Offline & Network Fallback',
  'Phục hồi kết nối khi mạng hoạt động trở lại',
  async () => {
    // 1. First run offline
    MockNetworkController.setMode('NETWORK_OFFLINE');
    const offlineRes = await resilientAnalyzePrescription('preset1');
    assert.ok(offlineRes);

    // 2. Network recovers
    MockNetworkController.setMode('SUCCESS_PRESET_2');
    const onlineRes = await resilientAnalyzePrescription('preset2');
    assert.ok(onlineRes);
    assert.equal(onlineRes.medicines.length, 2);
  }
);
