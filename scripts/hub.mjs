// ============================================================
// StatForge Hub tools.
//   node scripts/hub.mjs check [--base <git ref>]   validates every package
//   node scripts/hub.mjs index                      writes index.json
// The validator comes from the StatForge app itself, so the hub always
// checks packages with the same rules the app uses. Point STATFORGE_DIR
// at a copy of https://github.com/GabrielGugg/statforge (default: .statforge).
// ============================================================
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;
const PACKAGES = join(ROOT, 'packages');
const MAX_BYTES = 5 * 1024 * 1024;
const [cmd, ...args] = process.argv.slice(2);

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const posix = p => relative(ROOT, p).split(sep).join('/');
const files = () => (existsSync(PACKAGES) ? walk(PACKAGES).filter(f => f.endsWith('.json')).sort() : []);
const compareVersions = (a, b) => {
  const pa = String(a || '0').split(/[.-]/).map(Number), pb = String(b || '0').split(/[.-]/).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
};

async function check() {
  const dir = process.env.STATFORGE_DIR || join(ROOT, '.statforge');
  const { validatePackage } = await import(pathToFileURL(join(dir, 'site/js/engine/package.js')).href);
  const at = args.indexOf('--base');
  const base = at >= 0 ? args[at + 1] : null;
  const ids = new Map();
  let failed = false;
  const fail = (file, msg) => { console.log(`✗ ${file}: ${msg}`); failed = true; };

  for (const f of files()) {
    const rel = posix(f);
    if (statSync(f).size > MAX_BYTES) { fail(rel, `larger than ${MAX_BYTES / 1024 / 1024} MB`); continue; }
    let p;
    try { p = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { fail(rel, `invalid JSON (${e.message})`); continue; }
    const { errors, warnings } = validatePackage(p);
    for (const e of errors) fail(rel, e);
    for (const w of warnings) console.log(`  warning ${rel}: ${w}`);
    if (!p.author) fail(rel, '"author" is required in the hub');
    if (!p.version) fail(rel, '"version" is required in the hub');
    if (!p.language) fail(rel, '"language" is required in the hub');
    if (!p.license) console.log(`  warning ${rel}: no "license" (players will not know how they may reuse it)`);
    if (p.id && ids.has(p.id)) fail(rel, `id "${p.id}" is already used by ${ids.get(p.id)}`);
    else if (p.id) ids.set(p.id, rel);

    // A changed package must raise its version, or players would never get the update.
    if (base) {
      let old = null;
      try { old = JSON.parse(execFileSync('git', ['show', `${base}:${rel}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch { /* new file */ }
      if (old && JSON.stringify(old) !== JSON.stringify(p)) {
        if (old.id !== p.id) fail(rel, `the id changed from "${old.id}" to "${p.id}"; sheets refer to packages by id, so publish a new file instead`);
        if (compareVersions(p.version, old.version) <= 0) fail(rel, `changed but "version" was not raised (was ${old.version})`);
      }
    }
    if (!errors.length) console.log(`✓ ${rel} — ${p.name} (${p.type}, ${p.language || '?'}, v${p.version || '?'})`);
  }
  if (!files().length) console.log('No packages yet.');
  process.exit(failed ? 1 : 0);
}

/** A table's relative system link points at another hub file: report that package's id. */
function systemIdFromUrl(tableFile, url) {
  if (!url || /^[a-z]+:/i.test(url)) return url;
  try { return JSON.parse(readFileSync(join(tableFile, '..', url), 'utf8')).id; } catch { return url; }
}

function index() {
  const packages = [];
  for (const f of files()) {
    let p;
    try { p = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
    if (!p?.id || !p.type) continue;
    const entry = {
      id: p.id, name: p.name, version: p.version, type: p.type, language: p.language, author: p.author,
      license: p.license, description: p.description, url: posix(f), bytes: statSync(f).size,
    };
    if (p.type === 'extension') entry.system = p.system;
    if (p.type === 'table') entry.system = p.system?.id || systemIdFromUrl(f, p.system?.url);
    if (p.type === 'system') entry.entities = Object.values(p.entities || {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);
    packages.push(Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined && v !== '')));
  }
  packages.sort((a, b) => a.type.localeCompare(b.type) || String(a.name).localeCompare(String(b.name)));
  const out = { format: 1, name: 'StatForge Hub', owner: 'GabrielGugg', count: packages.length, packages };
  writeFileSync(join(ROOT, 'index.json'), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`index.json: ${packages.length} packages`);
}

if (cmd === 'check') await check();
else if (cmd === 'index') index();
else { console.log('Usage: node scripts/hub.mjs check [--base <git ref>] | index'); process.exit(1); }
