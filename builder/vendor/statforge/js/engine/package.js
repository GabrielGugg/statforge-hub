// ============================================================
// Package validation and rule assembly for a sheet
// (system + extensions in list order, applying patches).
// ============================================================
import { parse, FormulaError } from './formula.js';
import { t } from '../i18n.js';

export const FORMAT = 1;
export const TYPES = ['system', 'extension', 'theme', 'table'];

// System sections that are lists of objects with an id. In the result
// they become id → object maps, and can be patch targets ("section/id").
export const SECTIONS = ['attributes', 'skills', 'derived', 'resources', 'counters'];
const OPS = ['add', 'replace', 'modify', 'remove', 'rename'];
const ID_OK = /^[a-z0-9][a-z0-9_.-]*$/i;
const LANG_OK = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;

/** Reads "id@>=1.2" into { id, min }. */
export function parseRequirement(txt) {
  const [id, cond] = String(txt).split('@');
  return { id: id.trim(), min: cond ? cond.replace(/^>=/, '').trim() : null };
}

/** Compares "1.2.3" versions. */
export function compareVersions(a, b) {
  const pa = String(a || '0').split('.').map(Number), pb = String(b || '0').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function checkFormula(txt, where, errors) {
  if (txt === undefined || txt === null || typeof txt === 'number' || typeof txt === 'boolean') return;
  try { parse(txt); } catch (e) {
    errors.push(t('val.badFormula', { where, formula: txt, error: e instanceof FormulaError ? e.message : e }));
  }
}

function checkEffects(effects, where, errors) {
  if (effects === undefined) return;
  if (!Array.isArray(effects)) { errors.push(t('val.effectsNotList', { where })); return; }
  effects.forEach((ef, i) => {
    const at = t('val.effectN', { where, n: i + 1 });
    if (!ef || !ef.type) errors.push(t('val.effectNoType', { where: at }));
    if (['add', 'set'].includes(ef?.type)) checkFormula(ef.value, at, errors);
    if (ef?.if) checkFormula(ef.if, at, errors);
  });
}

/**
 * Checks a package's structure. Returns { errors, warnings }.
 * Errors block installation; warnings are only shown.
 */
export function validatePackage(p) {
  const errors = [], warnings = [];
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { errors: [t('val.notObject')], warnings };
  if (p.format !== FORMAT) errors.push(t('val.format', { want: FORMAT, got: JSON.stringify(p.format) }));
  if (!p.id || !ID_OK.test(p.id)) errors.push(t('val.id'));
  if (!p.name) errors.push(t('val.name'));
  if (!TYPES.includes(p.type)) errors.push(t('val.type', { types: TYPES.join(', ') }));
  if (!p.version) warnings.push(t('val.noVersion'));
  if (p.language === undefined) warnings.push(t('val.noLanguage'));
  else if (typeof p.language !== 'string' || !LANG_OK.test(p.language)) errors.push(t('val.language'));

  if (p.type === 'system') {
    for (const s of SECTIONS) {
      if (p[s] === undefined) continue;
      if (!Array.isArray(p[s])) { errors.push(t('val.notList', { what: s })); continue; }
      const seen = new Set();
      p[s].forEach((o, i) => {
        if (!o?.id) errors.push(t('val.noId', { what: `${s}[${i}]` }));
        else if (seen.has(o.id)) errors.push(t('val.dupId', { what: s, id: o.id }));
        else seen.add(o.id);
        for (const k of ['formula', 'max', 'if', 'total']) checkFormula(o?.[k], `${s}/${o?.id}`, errors);
        checkEffects(o?.effects, `${s}/${o?.id}`, errors);
      });
    }
    if (p.collections && typeof p.collections !== 'object') errors.push(t('val.collectionsObject'));
    for (const [col, c] of Object.entries(p.collections || {})) {
      const want = Array.isArray(c?.custom) ? c.custom : c?.custom?.fields;
      for (const f of want || []) if (!c.fields?.[f]) warnings.push(t('val.customField', { col, field: f }));
    }
    for (const [col, list] of Object.entries(p.entities || {})) {
      if (!p.collections?.[col]) warnings.push(t('val.undeclaredCollection', { col }));
      if (!Array.isArray(list)) { errors.push(t('val.notList', { what: `entities.${col}` })); continue; }
      const seen = new Set();
      list.forEach((e, i) => {
        if (!e?.id) errors.push(t('val.noId', { what: `entities.${col}[${i}]` }));
        else if (seen.has(e.id)) errors.push(t('val.dupId', { what: `entities.${col}`, id: e.id }));
        else seen.add(e.id);
        checkEffects(e?.effects, `${col}/${e?.id}`, errors);
        checkFormula(e?.requires, `${col}/${e?.id}.requires`, errors);
      });
    }
    checkFormula(p.rolls?.modifier, 'rolls.modifier', errors);
    checkFormula(p.progression?.xp_per_level, 'progression.xp_per_level', errors);
    if (!p.layout?.tabs?.length) warnings.push(t('val.noLayout'));
    checkCreation(p.creation, errors);
    checkCreation(p.progression?.level_up, errors, 'progression.level_up');
    (p.auto_conditions || []).forEach((a, i) => { checkFormula(a?.when, `auto_conditions[${i}].when`, errors); if (!a?.ref?.includes('/')) errors.push(t('val.needs', { where: `auto_conditions[${i}]`, op: 'auto', field: 'ref' })); });
  }

  if (p.type === 'extension') {
    if (!p.system) errors.push(t('val.extNoSystem'));
    if (p.patches !== undefined && !Array.isArray(p.patches)) errors.push(t('val.notList', { what: 'patches' }));
    (p.patches || []).forEach((pt, i) => {
      const where = `patches[${i}]`;
      if (!OPS.includes(pt?.op)) { errors.push(t('val.op', { where, ops: OPS.join(', ') })); return; }
      if (pt.op === 'add') {
        if (!pt.collection) errors.push(t('val.needs', { where, op: 'add', field: 'collection' }));
        if (!pt.entity?.id) errors.push(t('val.addEntity', { where }));
        checkEffects(pt.entity?.effects, where, errors);
      } else if (!pt.target || (!['layout', 'creation'].includes(pt.target) && !pt.target.includes('/'))) {
        errors.push(t('val.target', { where }));
      }
      if (pt.op === 'replace' && !pt.entity) errors.push(t('val.needs', { where, op: 'replace', field: 'entity' }));
      if (pt.op === 'modify' && !pt.fields) errors.push(t('val.needs', { where, op: 'modify', field: 'fields' }));
      if (pt.op === 'rename' && !pt.name) errors.push(t('val.needs', { where, op: 'rename', field: 'name' }));
      checkEffects(pt.fields?.effects, where, errors);
    });
  }

  if (p.type === 'theme') {
    if (!p.colors || typeof p.colors !== 'object') errors.push(t('val.themeColors'));
  }

  if (p.type === 'table') {
    if (!p.system?.url && !p.system?.id) errors.push(t('val.tableSystem'));
    (p.packages || []).forEach((x, i) => { if (!x?.url && !x?.id) errors.push(t('val.tableRef', { where: `packages[${i}]` })); });
  }
  return { errors, warnings };
}

export const STEP_TYPES = ['pick', 'attributes', 'skills', 'items', 'info', 'notes', 'choice'];

function checkCreation(c, errors, name = 'creation') {
  if (c === undefined) return;
  if (!Array.isArray(c?.steps)) { errors.push(t('val.notList', { what: `${name}.steps` })); return; }
  c.steps.forEach((st, i) => {
    const where = `${name}.steps[${i}]`;
    if (!STEP_TYPES.includes(st?.type)) { errors.push(t('val.stepType', { where, types: STEP_TYPES.join(', ') })); return; }
    if (st.type === 'pick' && !st.collection) errors.push(t('val.needs', { where, op: 'pick', field: 'collection' }));
    if (st.type === 'items' && !st.from) errors.push(t('val.needs', { where, op: 'items', field: 'from' }));
    if (st.type === 'choice' && !st.options?.length) errors.push(t('val.needs', { where, op: 'choice', field: 'options' }));
    for (const k of ['if', 'min', 'max', 'points', 'choose', 'bonus', 'max_per_skill']) checkFormula(st[k], `${where}.${k}`, errors);
  });
}

const clone = o => (o === undefined ? o : JSON.parse(JSON.stringify(o)));

/**
 * Builds the rules for a sheet.
 * system: a "system" package; extensions: "extension" packages, already in order.
 * Returns { rules, log } — log holds warnings and conflicts for the UI.
 */
export function buildRules(system, extensions = []) {
  const log = [];
  const rules = {
    id: system.id, name: system.name, version: system.version, language: system.language,
    collections: clone(system.collections) || {},
    entities: {},
    progression: clone(system.progression) || {},
    layout: clone(system.layout) || null,
    creation: clone(system.creation) || null,
    auto_conditions: clone(system.auto_conditions) || [],
    rolls: clone(system.rolls) || {},
    origin: {}, // "section/id" → id of the last package that touched it
  };
  for (const s of SECTIONS) {
    rules[s] = {};
    for (const o of system[s] || []) { rules[s][o.id] = clone(o); rules.origin[`${s}/${o.id}`] = system.id; }
  }
  for (const [col, list] of Object.entries(system.entities || {})) {
    rules.entities[col] = {};
    for (const e of list) { rules.entities[col][e.id] = { ...clone(e), collection: col }; rules.origin[`${col}/${e.id}`] = system.id; }
  }

  const touched = {}; // target → [ids of extensions that touched it]
  const mapOf = sec => {
    if (SECTIONS.includes(sec)) return rules[sec];
    if (sec === 'collections') return rules.collections;
    return (rules.entities[sec] ||= {});
  };

  for (const ext of extensions) {
    for (const pt of ext.patches || []) {
      if (pt.op === 'add') {
        const target = `${pt.collection}/${pt.entity.id}`;
        const map = mapOf(pt.collection);
        if (map[pt.entity.id]) log.push({ level: 'warning', package: ext.id, msg: t('build.existed', { target }) });
        map[pt.entity.id] = { ...clone(pt.entity), ...(SECTIONS.includes(pt.collection) || pt.collection === 'collections' ? {} : { collection: pt.collection }) };
        (touched[target] ||= []).push(ext.id);
        rules.origin[target] = ext.id;
        continue;
      }
      if (pt.target === 'layout' || pt.target === 'creation') {
        const k = pt.target;
        if (pt.op === 'replace') rules[k] = clone(pt.entity);
        else if (pt.op === 'modify') rules[k] = { ...(rules[k] || {}), ...clone(pt.fields) };
        else if (pt.op === 'remove') rules[k] = null;
        (touched[k] ||= []).push(ext.id);
        continue;
      }
      const cut = pt.target.indexOf('/');
      const sec = pt.target.slice(0, cut), id = pt.target.slice(cut + 1);
      const map = mapOf(sec);
      const current = map[id];
      if (!current) {
        log.push({ level: 'warning', package: ext.id, msg: t('build.missing', { target: pt.target, op: pt.op }) });
        continue;
      }
      if (pt.op === 'remove') delete map[id];
      else if (pt.op === 'replace') map[id] = { ...clone(pt.entity), id, ...(current.collection ? { collection: current.collection } : {}) };
      else if (pt.op === 'modify') map[id] = { ...current, ...clone(pt.fields) };
      else if (pt.op === 'rename') map[id] = { ...current, name: pt.name };
      (touched[pt.target] ||= []).push(ext.id);
      rules.origin[pt.target] = ext.id;
    }
  }

  for (const [target, who] of Object.entries(touched)) {
    const unique = [...new Set(who)];
    if (unique.length > 1) {
      log.push({ level: 'conflict', target, msg: t('build.conflict', { target, who: unique.join(', '), winner: unique[unique.length - 1] }) });
    }
  }
  return { rules, log };
}

/**
 * Checks dependencies and conflicts of a set of active packages.
 * installed: id → package map. active: ids in order.
 */
export function checkSet(systemId, active, installed) {
  const warnings = [];
  const activeSet = new Set([systemId, ...active]);
  active.forEach((id, pos) => {
    const p = installed[id];
    if (!p) { warnings.push({ level: 'error', package: id, msg: t('set.notInstalled', { id }) }); return; }
    if (p.system && p.system !== systemId) warnings.push({ level: 'error', package: id, msg: t('set.wrongSystem', { for: p.system, system: systemId }) });
    for (const req of p.requires || []) {
      const r = parseRequirement(req);
      const target = installed[r.id];
      if (!activeSet.has(r.id) || !target) warnings.push({ level: 'error', package: id, msg: t('set.requires', { id: r.id }) });
      else if (r.min && compareVersions(target.version, r.min) < 0) warnings.push({ level: 'warning', package: id, msg: t('set.requiresVersion', { id: r.id, min: r.min, got: target.version }) });
    }
    for (const c of p.conflicts || []) {
      if (activeSet.has(parseRequirement(c).id)) warnings.push({ level: 'error', package: id, msg: t('set.conflicts', { id: c }) });
    }
    for (const d of p.load_after || []) {
      const i = active.indexOf(parseRequirement(d).id);
      if (i > pos) warnings.push({ level: 'warning', package: id, msg: t('set.loadAfter', { id: d }) });
    }
  });
  return warnings;
}

/** Suggests an order that respects "load_after" (keeps the current order when possible). */
export function suggestOrder(ids, installed) {
  const left = [...ids], out = [];
  let guard = ids.length * ids.length + 5;
  while (left.length && guard--) {
    const i = left.findIndex(id => (installed[id]?.load_after || [])
      .map(d => parseRequirement(d).id).every(d => !left.includes(d) || d === id));
    out.push(...left.splice(i < 0 ? 0 : i, 1));
  }
  return out.concat(left);
}
