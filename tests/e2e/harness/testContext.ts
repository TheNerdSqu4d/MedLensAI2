export interface TestDefinition {
  id: string;
  tier: number;
  category: string;
  title: string;
  fn: () => Promise<void> | void;
}

export const testRegistry: TestDefinition[] = [];

export function defineTest(
  id: string,
  tier: number,
  category: string,
  title: string,
  fn: () => Promise<void> | void
) {
  testRegistry.push({ id, tier, category, title, fn });
}

export function assert(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

assert.equal = function (actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(
      `${message ? message + ' — ' : ''}Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`
    );
  }
};

assert.notEqual = function (actual: any, expected: any, message?: string) {
  if (actual === expected) {
    throw new Error(
      `${message ? message + ' — ' : ''}Expected value to NOT equal ${JSON.stringify(expected)}`
    );
  }
};

assert.ok = function (value: any, message?: string) {
  if (!value) {
    throw new Error(message || 'Expected truthy value, but received falsy');
  }
};

assert.includes = function (actual: any, expectedItem: any, message?: string) {
  if (typeof actual === 'string') {
    if (!actual.includes(expectedItem)) {
      throw new Error(
        `${message ? message + ' — ' : ''}Expected string to include "${expectedItem}", received: "${actual}"`
      );
    }
  } else if (Array.isArray(actual)) {
    if (!actual.includes(expectedItem)) {
      throw new Error(
        `${message ? message + ' — ' : ''}Expected array to include ${JSON.stringify(expectedItem)}`
      );
    }
  } else {
    throw new Error(`${message ? message + ' — ' : ''}Target is neither a string nor an array: ${actual}`);
  }
};

assert.deepEqual = function (actual: any, expected: any, message?: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      `${message ? message + ' — ' : ''}Deep equality failed:\nExpected: ${expectedStr}\nActual:   ${actualStr}`
    );
  }
};

assert.throws = async function (fn: () => Promise<any> | any, expectedMessageSubstr?: string) {
  let threw = false;
  try {
    await fn();
  } catch (err: any) {
    threw = true;
    if (expectedMessageSubstr && !String(err?.message || err).includes(expectedMessageSubstr)) {
      throw new Error(
        `Expected error containing "${expectedMessageSubstr}", but caught: "${err?.message || err}"`
      );
    }
  }
  if (!threw) {
    throw new Error('Expected function to throw an error, but it returned without throwing');
  }
};
