// ============================================================
// Refreshes builder/vendor/statforge: the copy of the StatForge engine
// (validator, formulas, sheet math) that the package builder runs.
//   node scripts/update-vendor.mjs [path to the statforge repository]
// Default path: ../statforge (both repositories side by side).
// Run it after every StatForge release, then commit builder/vendor.
// The builder never loads code from another site: this copy is the only engine it uses.
// ============================================================
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = resolve(process.argv[2] || join(ROOT, '..', 'statforge'));
const SRC = join(APP, 'site', 'js');
const OUT = join(ROOT, 'builder', 'vendor', 'statforge');
// What builder/js/engine.js imports; everything they import comes along.
const ENTRIES = ['engine/package.js', 'engine/formula.js', 'engine/calc.js', 'i18n.js'];

if (!existsSync(join(SRC, 'engine', 'package.js'))) {
  console.error(`StatForge not found at ${APP}. Pass the path: node scripts/update-vendor.mjs ../statforge`);
  process.exit(1);
}

const files = new Set();
function walk(rel) {
  if (files.has(rel)) return;
  files.add(rel);
  const text = readFileSync(join(SRC, rel), 'utf8');
  for (const m of text.matchAll(/^\s*import\s[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm)) {
    const next = relative(SRC, resolve(dirname(join(SRC, rel)), m[1])).split(sep).join('/');
    if (next.startsWith('..')) throw new Error(`${rel} imports ${m[1]}, outside site/js`);
    walk(next);
  }
}
ENTRIES.forEach(walk);

rmSync(join(OUT, 'js'), { recursive: true, force: true });
for (const rel of [...files].sort()) {
  const to = join(OUT, 'js', rel);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, readFileSync(join(SRC, rel)));
}
const version = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8')).version;
writeFileSync(join(OUT, 'COMMIT'), `StatForge v${version}\n`);
writeFileSync(join(OUT, 'LICENSE'), readFileSync(join(APP, 'LICENSE')));
console.log(`builder/vendor/statforge: StatForge v${version}, ${files.size} files`);
for (const rel of [...files].sort()) console.log(`  ${rel}`);
