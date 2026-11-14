declare const require: any;
const fs = require('fs');
const path = require('path');
import * as ts from 'typescript';

export interface UIValidationResult {
  filePath: string;
  forbiddenHtmlTags: Array<{ tag: string; line: number }>;
  hasLightGroupedBackground: boolean;
  importedUiComponents: string[];
}

export const FORBIDDEN_HTML_TAGS = new Set([
  'div',
  'span',
  'p',
  'img',
  'button',
  'a',
  'input',
  'form',
  'section',
  'article',
  'header',
  'footer',
  'ul',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'table',
  'tr',
  'td',
]);

/**
 * Scan a single TSX file for UI HIG constraints and zero raw HTML tags
 */
export function scanFileUIConstraints(filePath: string): UIValidationResult {
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const forbiddenHtmlTags: Array<{ tag: string; line: number }> = [];
  const importedUiComponents: string[] = [];
  const hasLightGroupedBackground =
    content.includes('#F2F2F7') ||
    content.includes('#f2f2f7') ||
    content.includes('bg-[#F2F2F7]') ||
    content.includes('bg-[#f2f2f7]');

  function visit(node: ts.Node) {
    // 1. Check for raw HTML tags in JSX elements (in JSX, raw HTML tags are lowercase)
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      const isLowerCaseTag = tagName[0] === tagName[0].toLowerCase();
      if (isLowerCaseTag && FORBIDDEN_HTML_TAGS.has(tagName.toLowerCase())) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        forbiddenHtmlTags.push({ tag: tagName, line: line + 1 });
      }
    }

    // 2. Track imports from @/components/ui
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
      if (moduleSpecifier.startsWith('@/components/ui') || moduleSpecifier.startsWith('../components/ui') || moduleSpecifier.startsWith('../../components/ui')) {
        const importClause = node.importClause;
        if (importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
          for (const specifier of importClause.namedBindings.elements) {
            importedUiComponents.push(specifier.name.getText(sourceFile));
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    filePath,
    forbiddenHtmlTags,
    hasLightGroupedBackground,
    importedUiComponents,
  };
}

/**
 * Recursively scan all UI source files in the project
 */
export function scanAllProjectUIFiles(rootDir: string = process.cwd()): UIValidationResult[] {
  const results: UIValidationResult[] = [];
  const targetDirs = [path.join(rootDir, 'app'), path.join(rootDir, 'components')];

  function collectTsxFiles(dir: string, fileList: string[] = []): string[] {
    if (!fs.existsSync(dir)) return fileList;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.agents') {
          collectTsxFiles(fullPath, fileList);
        }
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        // Exclude web shell app/+html.tsx
        if (entry.name !== '+html.tsx') {
          fileList.push(fullPath);
        }
      }
    }
    return fileList;
  }

  const allFiles = targetDirs.flatMap((dir) => collectTsxFiles(dir));
  for (const file of allFiles) {
    results.push(scanFileUIConstraints(file));
  }

  return results;
}
