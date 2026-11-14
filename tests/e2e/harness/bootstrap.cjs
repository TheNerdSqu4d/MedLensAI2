const path = require('path');
const fs = require('fs');
const Module = require('module');
const ts = require('typescript');

const rootDir = path.resolve(__dirname, '../../..');

// 1. TypeScript in-memory transpiler for .ts and .tsx files
function compileTypeScript(mod, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
    fileName: filename,
  });
  mod._compile(outputText, filename);
}

require.extensions['.ts'] = compileTypeScript;
require.extensions['.tsx'] = compileTypeScript;

// 2. Custom module resolution hook
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  // Shims for native Expo and React Native libraries
  if (request === '@react-native-async-storage/async-storage') {
    return path.join(__dirname, 'mockAsyncStorage.ts');
  }

  if (request === 'expo-haptics') {
    return path.join(__dirname, 'mockHaptics.ts');
  }

  if (request === 'expo-image-picker') {
    return path.join(__dirname, 'mockImagePicker.ts');
  }

  if (request === 'expo-image-manipulator') {
    return path.join(__dirname, 'mockImageManipulator.ts');
  }

  if (request === 'expo-notifications') {
    return path.join(__dirname, 'mockNotifications.ts');
  }

  if (request === 'expo-secure-store') {
    return path.join(rootDir, 'tests/mockSecureStore.cjs');
  }

  if (request === 'react-native') {
    return path.join(rootDir, 'tests/mockReactNative.cjs');
  }

  // Handle @/ path alias
  if (request.startsWith('@/')) {
    const rel = request.slice(2);
    const candidateBase = path.join(rootDir, rel);
    for (const ext of ['', '.ts', '.tsx', '.js', '/index.ts', '/index.js']) {
      const full = candidateBase + ext;
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        return full;
      }
    }
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

// 3. Polyfill window & localStorage for Zustand createJSONStorage
const { MockAsyncStorage } = require('./mockAsyncStorage.ts');
globalThis.window = globalThis.window || {};
globalThis.window.localStorage = {
  getItem: (k) => MockAsyncStorage.dump()[k] || null,
  setItem: (k, v) => MockAsyncStorage.setItem(k, v),
  removeItem: (k) => MockAsyncStorage.removeItem(k),
  clear: () => MockAsyncStorage.clear(),
};

// 4. Install network mock controller
const { MockNetworkController } = require('./mockNetwork.ts');
MockNetworkController.install();

module.exports = {
  rootDir,
};
