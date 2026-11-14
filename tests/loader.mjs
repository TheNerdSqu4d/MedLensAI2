import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  // Mock native modules for node test runner
  if (specifier === 'expo-secure-store') {
    const mockCandidate = path.resolve(process.cwd(), 'tests/mockSecureStore.cjs');
    if (fs.existsSync(mockCandidate)) {
      return nextResolve(pathToFileURL(mockCandidate).href, context);
    }
  }

  // Handle @/ alias
  if (specifier.startsWith('@/')) {
    const relative = specifier.slice(2);
    const basePath = path.resolve(process.cwd(), relative);
    for (const ext of ['', '.ts', '.tsx', '.js', '/index.ts', '/index.js']) {
      const candidate = basePath + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }

  // If specifier is relative and has no extension
  if (specifier.startsWith('.') && context.parentURL) {
    const parentPath = fileURLToPath(context.parentURL);
    const dir = path.dirname(parentPath);
    const target = path.resolve(dir, specifier);
    for (const ext of ['', '.ts', '.tsx', '.js', '/index.ts', '/index.js']) {
      const candidate = target + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }

  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      for (const ext of ['.js', '/index.js']) {
        try {
          return await nextResolve(specifier + ext, context);
        } catch {}
      }
    }
    throw err;
  }
}
