import { MockAsyncStorage } from './mockAsyncStorage';
import type { useMedStore as useMedStoreType } from '@/store/useMedStore';
import type { MedState } from '@/types/medlens';

export class StoreTestHarness {
  /**
   * Reset store to clean baseline demo data and clear storage
   */
  static async resetAll(): Promise<void> {
    await MockAsyncStorage.clear();
    const { useMedStore } = await import('@/store/useMedStore');
    useMedStore.getState().resetToDemo();
    await MockAsyncStorage.flush();
  }

  /**
   * Get current state of useMedStore
   */
  static async getState(): Promise<MedState> {
    const { useMedStore } = await import('@/store/useMedStore');
    return useMedStore.getState();
  }

  /**
   * Wait for any debounced Zustand persistence to commit to AsyncStorage
   */
  static async flushStorage(): Promise<void> {
    await MockAsyncStorage.flush();
  }

  /**
   * Simulate a 100% process termination (Kill App) and restart:
   * 1. Flush pending writes to AsyncStorage
   * 2. Evict store modules from require.cache
   * 3. Re-import store fresh and wait for rehydration
   */
  static async killAndRestartApp(): Promise<typeof useMedStoreType> {
    await MockAsyncStorage.flush();

    // Evict store and dependents from cache
    const nodeRequire = require as any;
    if (nodeRequire && nodeRequire.cache) {
      for (const key of Object.keys(nodeRequire.cache)) {
        if (key.includes('store') || key.includes('useMedStore')) {
          delete nodeRequire.cache[key];
        }
      }
    }

    // Dynamic re-import simulating cold app startup
    const freshModule = await import('@/store/useMedStore');
    
    // Give Zustand persist rehydration a moment to read from MockAsyncStorage
    await new Promise((resolve) => setTimeout(resolve, 50));

    return freshModule.useMedStore;
  }
}
