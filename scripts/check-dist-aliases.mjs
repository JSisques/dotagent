// Post-build guard: fails when `dist` is missing/empty or still contains alias specifiers.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const ALIAS_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]@(?:test)?\//;

function listJs(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listJs(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : [],
  );
}

function main() {
  let isDir = false;
  try {
    isDir = statSync(dist).isDirectory();
  } catch {
    // handled below
  }
  const files = isDir ? listJs(dist) : [];
  if (files.length === 0) {
    console.error('check-dist-aliases: dist is missing or contains no .js files');
    return 1;
  }

  const offenders = [];
  for (const file of files) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (ALIAS_SPECIFIER.test(line)) {
          offenders.push(`${relative(root, file)}:${i + 1}: ${line.trim()}`);
        }
      });
  }
  if (offenders.length > 0) {
    console.error('check-dist-aliases: unresolved alias specifiers in dist:');
    for (const o of offenders) console.error(`  ${o}`);
    return 1;
  }
  console.log(`check-dist-aliases: ${files.length} files clean`);
  return 0;
}

process.exit(main());
