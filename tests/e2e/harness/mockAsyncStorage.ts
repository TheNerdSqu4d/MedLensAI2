export interface MockStorageSnapshot {
  [key: string]: string;
}

export class MockAsyncStorage {
  private static store: Map<string, string> = new Map();
  private static writeFailCount: number = 0;
  private static readFailCount: number = 0;

  static async getItem(key: string): Promise<string | null> {
    if (this.readFailCount > 0) {
      this.readFailCount--;
      throw new Error('Simulated AsyncStorage Read Failure');
    }
    return this.store.get(key) ?? null;
  }

  static async setItem(key: string, value: string): Promise<void> {
    if (this.writeFailCount > 0) {
      this.writeFailCount--;
      throw new Error('Simulated AsyncStorage Write Failure');
    }
    this.store.set(key, String(value));
  }

  static async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  static async clear(): Promise<void> {
    this.store.clear();
  }

  static async getAllKeys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  static async multiGet(keys: string[]): Promise<[string, string | null][]> {
    return keys.map((k) => [k, this.store.get(k) ?? null]);
  }

  static async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    for (const [k, v] of keyValuePairs) {
      this.store.set(k, String(v));
    }
  }

  // Synchronous inspection & seed helpers
  static dump(): MockStorageSnapshot {
    return Object.fromEntries(this.store.entries());
  }

  static seed(data: MockStorageSnapshot): void {
    this.store.clear();
    for (const [k, v] of Object.entries(data)) {
      this.store.set(k, String(v));
    }
  }

  static simulateCorruption(key: string): void {
    this.store.set(key, '<<<CORRUPTED_JSON_DATA>>>');
  }

  static setSimulatedFailures(reads: number = 0, writes: number = 0): void {
    this.readFailCount = reads;
    this.writeFailCount = writes;
  }

  static async flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

export default MockAsyncStorage;
