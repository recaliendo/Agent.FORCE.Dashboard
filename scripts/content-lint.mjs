import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const phrase = (...parts) => new RegExp(parts.join('[ ._-]*'), 'i');
const word = (left, right) => new RegExp(`${left}${right}`, 'i');

export const forbiddenUiTerms = [
  phrase('job', 'search'),
  phrase('job', 'application'),
  phrase('application', 'queue'),
  word('res', 'ume'),
  phrase('cover', 'letter'),
  phrase('compensation', 'guardrails'),
  word('candi', 'date'),
  word('recruit', 'er'),
  word('hir', 'ing'),
  phrase('career', 'automation'),
  phrase('Job', 'SEARCH', 'AGENT')
];

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return '';
}

export function isRepositoryUrlLiteral(node) {
  const urlProperty = node.parent;
  if (!ts.isPropertyAssignment(urlProperty) || propertyName(urlProperty.name) !== 'url') return false;
  const repositoryObject = urlProperty.parent;
  const repositoryProperty = repositoryObject.parent;
  return ts.isObjectLiteralExpression(repositoryObject)
    && ts.isPropertyAssignment(repositoryProperty)
    && propertyName(repositoryProperty.name) === 'repository';
}

function lineNumber(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

export function findViolations(source, fileName = 'inline.tsx') {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const violations = [];

  function checkText(text, node) {
    if (isRepositoryUrlLiteral(node)) return;
    for (const pattern of forbiddenUiTerms) {
      if (pattern.test(text)) {
        violations.push({ fileName, line: lineNumber(sourceFile, node), pattern: pattern.source, text: text.trim() });
      }
    }
  }

  function visit(node) {
    if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) checkText(node.text, node);
    if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) checkText(node.text, node);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

async function sourceFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(fullPath));
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

export async function lintApplication(root = process.cwd()) {
  const roots = ['src', 'electron'];
  const files = (await Promise.all(roots.map((folder) => sourceFiles(path.join(root, folder))))).flat();
  const violations = [];
  for (const file of files) {
    violations.push(...findViolations(await readFile(file, 'utf8'), path.relative(root, file)));
  }
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  for (const pattern of forbiddenUiTerms) {
    if (pattern.test(html)) violations.push({ fileName: 'index.html', line: 1, pattern: pattern.source, text: 'HTML content' });
  }
  return violations;
}

const isDirectRun = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  const violations = await lintApplication();
  if (violations.length) {
    for (const violation of violations) {
      console.error(`${violation.fileName}:${violation.line} forbidden /${violation.pattern}/ in ${JSON.stringify(violation.text)}`);
    }
    process.exitCode = 1;
  } else {
    console.log('Content lint passed: no restricted UI vocabulary found.');
  }
}
