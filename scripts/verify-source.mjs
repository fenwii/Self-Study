import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const files = [];
const missingImports = [];
let syntaxErrors = 0;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(ts|tsx)$/u.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(file);
  }
}

function checkRelativeImports(file) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true);
  for (const statement of sourceFile.statements) {
    if ((!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith('.')) continue;
    const base = path.resolve(path.dirname(file), specifier);
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.d.ts`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
    if (!candidates.some(fs.existsSync)) missingImports.push(`${path.relative(root, file)} -> ${specifier}`);
  }
}

walk(path.join(root, 'src'));
walk(path.join(root, 'tests'));
for (const name of ['forge.config.ts', 'vite.main.config.ts', 'vite.preload.config.ts', 'vite.renderer.config.ts']) files.push(path.join(root, name));

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    fileName: file,
    reportDiagnostics: true
  });
  for (const diagnostic of result.diagnostics ?? []) {
    syntaxErrors += 1;
    console.error(`${path.relative(root, file)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }
  checkRelativeImports(file);
}

if (missingImports.length) {
  console.error('Missing relative imports:\n' + missingImports.join('\n'));
}

console.log(`Verified ${files.length} TypeScript files.`);
console.log(`Syntax errors: ${syntaxErrors}; missing relative imports: ${missingImports.length}.`);
process.exit(syntaxErrors || missingImports.length ? 1 : 0);
