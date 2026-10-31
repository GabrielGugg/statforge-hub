// ============================================================
// Package model for the builder. Pure functions, no DOM, so the
// same code runs in the browser and in the Node tests.
// The package object itself is the source of truth: editors change
// parts of it and never drop keys they do not know about.
// ============================================================

export const TYPES = ['system', 'extension', 'theme', 'table'];

/** Order of the top-level keys when a new key is added (existing order is kept). */
const KEY_ORDER = [
  'format', 'id', 'name', 'version', 'author', 'license', 'language', 'type', 'description',
  'system', 'requires', 'conflicts', 'load_after',
  'rolls', 'progression', 'attributes', 'skills', 'derived', 'resources', 'counters',
  'collections', 'entities', 'layout', 'creation', 'auto_conditions',
  'patches', 'font', 'scheme', 'colors', 'packages', 'theme',
];

/**
 * Sections shown in the side menu for each package type.
 * key: the one top-level key the section edits; keys: several of them.
 * empty: value used when a single-key section does not exist yet.
 * The "meta" section is the package details (name, id, version...).
 */
export const SECTIONS = {
  system: [
    { id: 'meta', key: null },
    { id: 'rolls', key: 'rolls', empty: {} },
    { id: 'progression', key: 'progression', empty: {} },
    { id: 'attributes', key: 'attributes', empty: [] },
    { id: 'skills', key: 'skills', empty: [] },
    { id: 'derived', key: 'derived', empty: [] },
    { id: 'resources', key: 'resources', empty: [] },
    { id: 'counters', key: 'counters', empty: [] },
    { id: 'collections', key: 'collections', empty: {} },
    { id: 'entities', key: 'entities', empty: {} },
    { id: 'auto_conditions', key: 'auto_conditions', empty: [] },
    { id: 'layout', key: 'layout', empty: { tabs: [] } },
    { id: 'creation', key: 'creation', empty: { steps: [] } },
  ],
  extension: [
    { id: 'meta', key: null },
    { id: 'dependencies', keys: ['system', 'requires', 'conflicts', 'load_after'] },
    { id: 'patches', key: 'patches', empty: [] },
  ],
  theme: [
    { id: 'meta', key: null },
    { id: 'colors', keys: ['font', 'scheme', 'colors'] },
  ],
  table: [
    { id: 'meta', key: null },
    { id: 'links', keys: ['system', 'packages', 'theme'] },
  ],
};

/** Theme variables the app reads. */
export const THEME_VARS = ['--bg', '--surface', '--surface-2', '--text', '--text-muted', '--border',
  '--accent', '--accent-text', '--danger', '--warning', '--ok'];

/** Turns a name into a valid id: "Minha Ficha 2.0" → "minha-ficha-2.0". */
export function slug(name) {
  return String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9_.]+/g, '-').replace(/^[-_.]+|-+$/g, '')
    .slice(0, 64);
}

/** Id usable inside formulas (no hyphens): "Carga máxima" → "carga_maxima". */
export function formulaId(name) {
  return slug(name).replace(/[-.]+/g, '_');
}

/** A new, valid package of the given type. */
export function newPackage(type, { name = '', author = '', language = 'pt-BR' } = {}) {
  const base = { format: 1, id: slug(name), name, version: '1.0.0', author, license: 'CC-BY-4.0', language, type, description: '' };
  if (type === 'system') {
    return { ...base, rolls: { default: '1d20' }, attributes: [], skills: [], derived: [], resources: [], counters: [],
      collections: {}, entities: {}, layout: { tabs: [] } };
  }
  if (type === 'extension') return { ...base, system: '', requires: [], patches: [] };
  if (type === 'theme') {
    return { ...base, colors: { '--bg': '#101010', '--surface': '#1a1a1a', '--surface-2': '#242424', '--text': '#eeeeee',
      '--text-muted': '#9a9a9a', '--border': '#333333', '--accent': '#ffcc00', '--accent-text': '#101010',
      '--danger': '#ff6b6b', '--warning': '#f0b445', '--ok': '#5dd28e' } };
  }
  if (type === 'table') return { ...base, system: { url: '' }, packages: [], theme: { url: '' } };
  throw new Error(`unknown type ${type}`);
}

/** Detects the indentation of a JSON text, to export it the same way. */
export function detectIndent(text) {
  const m = /^\{\r?\n([ \t]+)"/.exec(String(text));
  if (!m) return 2;
  return m[1][0] === '\t' ? '\t' : m[1].length;
}

/** Reads a JSON text. Returns { pkg, indent, trailingNewline } or throws with a readable message. */
export function parseImport(text) {
  const src = String(text).replace(/^﻿/, '');
  const pkg = JSON.parse(src);
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) throw new Error('not-object');
  return { pkg, indent: detectIndent(src), trailingNewline: /\n$/.test(src) };
}

/** The final .json text. */
export function exportText(pkg, { indent = 2, trailingNewline = true } = {}) {
  return JSON.stringify(clean(pkg), null, indent) + (trailingNewline ? '\n' : '');
}

/**
 * Removes what the builder may leave behind without meaning it:
 * an empty description or license. Everything else is kept as is,
 * so an imported package comes out the same as it went in.
 */
export function clean(pkg) {
  const out = { ...pkg };
  for (const k of ['description', 'license']) if (out[k] === '') delete out[k];
  return out;
}

/** Sets a top-level key, keeping the order of the existing keys and placing new ones sensibly. */
export function setKey(pkg, key, value) {
  if (key in pkg) { pkg[key] = value; return pkg; }
  const entries = Object.entries(pkg);
  const want = KEY_ORDER.indexOf(key);
  let at = entries.length;
  if (want >= 0) {
    const i = entries.findIndex(([k]) => { const o = KEY_ORDER.indexOf(k); return o < 0 || o > want; });
    if (i >= 0) at = i;
  }
  entries.splice(at, 0, [key, value]);
  for (const k of Object.keys(pkg)) delete pkg[k];
  for (const [k, v] of entries) pkg[k] = v;
  return pkg;
}

/** Deletes a top-level key. */
export function deleteKey(pkg, key) { delete pkg[key]; return pkg; }

/** Extra rules the StatForge Hub adds on top of the app's validator (see scripts/hub.mjs). */
export function hubChecks(pkg) {
  const errors = [], warnings = [];
  if (!pkg.author) errors.push('hub.author');
  if (!pkg.version) errors.push('hub.version');
  if (!pkg.language) errors.push('hub.language');
  if (!pkg.license) warnings.push('hub.license');
  return { errors, warnings };
}

/** Deep equality of two JSON values (key order ignored). */
export function sameJson(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => sameJson(x, b[i]));
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && sameJson(a[k], b[k]));
}

/** Short statistics shown on the home screen and in the header. */
export function stats(pkg) {
  const count = k => (Array.isArray(pkg[k]) ? pkg[k].length : 0);
  if (pkg.type === 'system') {
    const ents = Object.values(pkg.entities || {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);
    return { attributes: count('attributes'), skills: count('skills'), collections: Object.keys(pkg.collections || {}).length,
      entities: ents, tabs: pkg.layout?.tabs?.length || 0, steps: pkg.creation?.steps?.length || 0 };
  }
  if (pkg.type === 'extension') return { patches: count('patches') };
  if (pkg.type === 'table') return { packages: count('packages') };
  return {};
}

// ============================================================
// Spreadsheets: paste from Excel / Google Sheets, or a .csv file.
// ============================================================

/** Splits a table text into rows of cells. Tab, semicolon or comma, with "quoted" cells. */
export function parseTable(text) {
  const src = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const first = src.split('\n')[0] || '';
  const count = ch => first.split(ch).length - 1;
  const sep = count('\t') ? '\t' : count(';') > count(',') ? ';' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Columns every entity understands, with names people tend to write in the header. */
const COMMON_COLUMNS = {
  id: ['id'],
  name: ['name', 'nome'],
  description: ['description', 'descricao', 'desc'],
  tags: ['tags', 'tag'],
  requires: ['requires', 'requisito', 'requisitos', 'requirement'],
  repeat: ['repeat', 'repetir', 'vezes'],
  abbr: ['abbr', 'abreviacao', 'sigla'],
};

/** Which entity key each header names (null = not recognized). */
export function mapColumns(headers, collection = {}) {
  const fields = collection.fields || {};
  return headers.map(hd => {
    const n = norm(hd);
    if (!n) return null;
    for (const [key, names] of Object.entries(COMMON_COLUMNS)) if (names.includes(n)) return key;
    for (const [key, f] of Object.entries(fields)) if (norm(key) === n || norm(f?.label) === n) return key;
    return null;
  });
}

function convert(value, type) {
  const v = String(value).trim();
  if (v === '') return undefined;
  if (type === 'number') { const x = Number(v.replace(/\s/g, '').replace(',', '.')); return Number.isFinite(x) ? x : v; }
  if (type === 'boolean') return /^(1|x|sim|s|yes|y|true|verdadeiro)$/i.test(v);
  if (type === 'list' || type === 'tags') return v.split(/\s*[,;]\s*/).filter(Boolean);
  return v;
}

/**
 * Turns table rows (first row = header) into entities of a collection and merges them
 * into the existing list: same id updates the given columns, new ids are added.
 * Returns { list, added, updated, ignored (unknown headers), skipped (rows without name or id) }.
 */
export function importRows(rows, collection = {}, existing = []) {
  const [header = [], ...body] = rows;
  const keys = mapColumns(header, collection);
  const ignored = header.filter((_, i) => !keys[i] && String(header[i]).trim());
  const list = existing.map(e => ({ ...e }));
  const byId = new Map(list.map((e, i) => [e.id, i]));
  let added = 0, updated = 0, skipped = 0;
  for (const r of body) {
    const ent = {};
    keys.forEach((k, i) => {
      if (!k) return;
      const type = k === 'tags' ? 'tags' : k === 'repeat' ? 'number' : collection.fields?.[k]?.type;
      const v = convert(r[i] ?? '', type);
      if (v !== undefined) ent[k] = v;
    });
    if (!ent.id && ent.name) ent.id = formulaId(ent.name);
    if (!ent.id) { skipped++; continue; }
    if (byId.has(ent.id)) { Object.assign(list[byId.get(ent.id)], ent); updated++; } else {
      const { id, name, ...rest } = ent;
      list.push({ id, name: name ?? id, ...rest });
      byId.set(id, list.length - 1); added++;
    }
  }
  return { list, added, updated, ignored, skipped };
}

/** A collection as a table (header + one row per entity), for editing in a spreadsheet. */
const PT_HEADERS = { name: 'Nome', description: 'Descrição', tags: 'Tags', requires: 'Requisito' };
export function tableOf(collection = {}, list = [], lang = 'en') {
  const fieldKeys = Object.keys(collection.fields || {});
  const keys = ['id', 'name', ...fieldKeys, 'description', 'tags', 'requires'];
  const header = keys.map(k => collection.fields?.[k]?.label || (lang === 'pt-BR' ? PT_HEADERS[k] : null) || k);
  const cell = v => (v === undefined || v === null ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'sim' : '') : String(v));
  return [header, ...list.map(e => keys.map(k => cell(e[k])))];
}

/** Rows to CSV text, quoted when needed. Excel in Portuguese expects ";" as separator. */
export function toCsv(rows, sep = ',') {
  const q = s => (/[",\n;\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return rows.map(r => r.map(c => q(String(c))).join(sep)).join('\n') + '\n';
}
