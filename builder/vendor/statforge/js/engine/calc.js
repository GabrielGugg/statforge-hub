// ============================================================
// Computes a sheet from the assembled rules: values of attributes,
// skills, derived values, resources and counters, adding up the
// effects of everything that is active.
// ============================================================
import { evaluate, compile, FormulaError } from './formula.js';
import { t } from '../i18n.js';

const LIST_TYPES = ['advantage', 'disadvantage', 'immunity', 'resistance', 'vulnerability', 'note'];
const VALUE_SECTIONS = ['attributes', 'skills', 'derived', 'resources', 'counters'];

/** New, empty sheet for a system. */
export function emptySheet(rules, extra = {}) {
  const attributes = {};
  for (const a of Object.values(rules.attributes)) attributes[a.id] = a.default ?? a.min ?? 0;
  const counters = {};
  for (const c of Object.values(rules.counters)) counters[c.id] = 0;
  return {
    format: 1,
    name: '', level: 1, xp: 0,
    attributes, skills: {}, resources: {}, counters,
    items: [], notes: {}, fields: {},
    ...extra,
  };
}

/** Key used to reference an entity: "collection/id". */
export const key = (col, id) => `${col}/${id}`;

/** Is a sheet item active? (equippable ones only when equipped) */
export function itemActive(rules, item) {
  const col = rules.collections[item.collection];
  if (isBroken(rules, item)) return false;
  return !col?.equippable || !!item.equipped;
}

/** Collections with "wear": { "breaks": true } stop working at the maximum wear. */
export function isBroken(rules, item) {
  const w = rules.collections[item.collection]?.wear;
  return !!(w?.breaks && w.max && Number(item.wear || 0) >= w.max);
}

/** Wear that counts, after what the entity ignores ("wear_ignore": the first N levels). */
export function effectiveWear(rules, item) {
  const ent = rules.entities[item.collection]?.[item.ref];
  return Math.max(0, Number(item.wear || 0) - (Number(ent?.wear_ignore) || 0));
}

/**
 * Computes everything. Returns an object with:
 *   value(id), mod(n), active, lists (advantage, note...), errors
 */
export function compute(rules, sheet) {
  const errors = [];
  const warn = msg => { if (!errors.includes(msg)) errors.push(msg); };

  // 1) Active sources: sheet items + what they grant + counters > 0.
  const sources = [];
  const seen = new Set();
  function addEntity(col, id, item, from) {
    const k = key(col, id);
    if (seen.has(k) && !item) return;
    const ent = rules.entities[col]?.[id];
    if (!ent) { if (item) warn(t('calc.goneItem', { name: item.name || k })); return; }
    seen.add(k);
    sources.push({ k, col, ent, item, from, effects: ent.effects || [], vars: { qty: item?.qty ?? 1, wear: item ? effectiveWear(rules, item) : 0 } });
    for (const ef of ent.effects || []) {
      if (ef.type === 'grant' && ef.ref) {
        const [c, i] = ef.ref.split('/');
        addEntity(c, i, null, ent.name);
      }
    }
  }
  for (const item of sheet.items || []) {
    if (itemActive(rules, item)) addEntity(item.collection, item.ref, item, null);
  }
  for (const s of ['attributes', 'skills', 'derived', 'resources']) {
    for (const o of Object.values(rules[s])) {
      if (o.effects?.length) sources.push({ k: `${s}/${o.id}`, col: s, ent: o, effects: o.effects, vars: {} });
    }
  }
  for (const c of Object.values(rules.counters)) {
    const n = Number(sheet.counters?.[c.id] || 0);
    if (n > 0 && c.effects?.length) sources.push({ k: `counters/${c.id}`, col: 'counters', ent: c, effects: c.effects, vars: { n } });
  }

  // 2) Blocks: a source can cancel the effects of a collection or tag.
  const blocks = sources.flatMap(f => f.effects.filter(e => e.type === 'block'));
  const blocked = f => f.item !== undefined && blocks.some(b =>
    (b.collection && b.collection === f.col) || (b.tag && (f.ent.tags || []).includes(b.tag)));
  const active = sources.filter(f => !blocked(f));

  // 3) Effects by target.
  const byTarget = {};
  const lists = Object.fromEntries(LIST_TYPES.map(x => [x, []]));
  for (const f of active) {
    for (const ef of f.effects) {
      if (ef.type === 'add' || ef.type === 'set') (byTarget[ef.target] ||= []).push({ ef, f });
      else if (LIST_TYPES.includes(ef.type)) lists[ef.type].push({ ef, f });
    }
  }

  // 4) Values, memoized, with cycle detection.
  const memo = new Map();
  const computing = new Set();
  const sectionOf = id => VALUE_SECTIONS.find(s => Object.hasOwn(rules[s], id) && rules[s][id]);
  const modFormula = rules.rolls?.modifier || 'value';
  const items = sheet.items || [];
  const matches = (i, ref) => i.ref === ref || key(i.collection, i.ref) === ref;

  const functions = {
    mod: v => num(run(modFormula, { value: num(v) })),
    has: ref => (String(ref).includes('/') ? active.some(f => f.k === ref) : active.some(f => f.ent.id === ref)),
    owns: ref => items.some(i => matches(i, ref)),
    qty: ref => items.filter(i => matches(i, ref)).reduce((s, i) => s + num(i.qty ?? 1), 0),
    count: col => items.filter(i => i.collection === col).length,
    sum: (col, field, onlyActive) => items
      .filter(i => i.collection === col && (!onlyActive || itemActive(rules, i)))
      .reduce((s, i) => s + num(rules.entities[col]?.[i.ref]?.[field]) * num(i.qty ?? 1), 0),
    tag: x => active.some(f => (f.ent.tags || []).includes(x)),
    current: id => num(sheet.resources?.[id] ?? value(id)),
    maxof: (col, field, onlyActive) => items
      .filter(i => i.collection === col && (!onlyActive || itemActive(rules, i)))
      .reduce((m, i) => Math.max(m, num(rules.entities[col]?.[i.ref]?.[field])), 0),
  };

  function variable(name) {
    if (name === 'level') return num(sheet.level);
    if (name === 'xp') return num(sheet.xp);
    if (sectionOf(name)) return value(name);
    if (Object.hasOwn(sheet.fields || {}, name)) return sheet.fields[name];
    throw new FormulaError(t('formula.unknownValue', { name }));
  }

  function run(f, vars = {}) {
    if (f === undefined || f === null || f === '') return 0;
    if (typeof f === 'number' || typeof f === 'boolean') return f;
    return evaluate(compile(f), { vars, variable, functions });
  }

  function applyEffects(id, base) {
    let sets = null, add = 0;
    for (const { ef, f } of byTarget[id] || []) {
      try {
        if (ef.if && !run(ef.if, f.vars)) continue;
        const v = num(run(ef.value, f.vars));
        if (ef.type === 'set') sets = sets === null ? v : Math.max(sets, v);
        else add += v;
      } catch (e) { warn(t('calc.effectError', { source: f.ent.name || f.k, target: id, error: e.message })); }
    }
    // "set" replaces the base value (highest wins); "add" goes on top.
    return (sets !== null ? sets : base) + add;
  }

  function value(id) {
    if (memo.has(id)) return memo.get(id);
    if (computing.has(id)) throw new FormulaError(t('calc.cycle', { id }));
    computing.add(id);
    let v = 0;
    try {
      const sec = sectionOf(id);
      const def = rules[sec]?.[id];
      if (sec === 'attributes') v = applyEffects(id, num(sheet.attributes?.[id] ?? def.default ?? def.min ?? 0));
      else if (sec === 'skills') {
        const points = num(sheet.skills?.[id]);
        const base = def.total
          ? run(def.total, { points })
          : points + (def.attribute && rules.attributes[def.attribute] ? functions.mod(value(def.attribute)) : 0);
        v = applyEffects(id, num(base));
      } else if (sec === 'derived') v = applyEffects(id, num(run(def.formula))) + (def.editable_bonus ? num(sheet.bonus?.[id]) : 0);
      else if (sec === 'resources') v = applyEffects(id, num(run(def.max)));
      else if (sec === 'counters') v = num(sheet.counters?.[id]);
    } catch (e) {
      warn(`"${id}": ${e.message}`);
      v = 0;
    } finally {
      computing.delete(id);
    }
    memo.set(id, v);
    return v;
  }

  /** Evaluates any formula in the sheet's context (used by the roller and the UI). */
  function formula(f, vars) {
    try { return run(f, vars); } catch (e) { warn(e.message); return 0; }
  }

  // List effects (immunity, advantage...) also honor "if".
  for (const type of LIST_TYPES) {
    lists[type] = lists[type].filter(({ ef, f }) => {
      if (!ef.if) return true;
      try { return !!run(ef.if, f.vars); } catch (e) { warn(t('calc.effectError', { source: f.ent.name || f.k, target: type, error: e.message })); return true; }
    });
  }

  // Immunities with "ref" (an entity "collection/id" or a counter id) or "tag"
  // keep those conditions out of the sheet's add lists.
  const immuneRefs = new Set(), immuneTags = new Set();
  for (const { ef } of lists.immunity) {
    for (const r of [].concat(ef.ref ?? [])) immuneRefs.add(String(r));
    for (const x of [].concat(ef.tag ?? [])) immuneTags.add(String(x));
  }
  function immune(col, id) {
    if (col === 'counters') return immuneRefs.has(id) || immuneRefs.has(key('counters', id));
    const ent = rules.entities[col]?.[id];
    return immuneRefs.has(key(col, id)) || (ent?.tags || []).some(x => immuneTags.has(x));
  }

  /**
   * How a value was reached, for the debug mode: the base formula, the same formula with
   * the values it read, and each effect on top. { formula, filled, base, parts, bonus, total }
   */
  function explain(id) {
    const sec = sectionOf(id);
    const def = rules[sec]?.[id];
    if (!def) return null;
    let formula = null, vars = {}, base;
    if (sec === 'attributes') base = num(sheet.attributes?.[id] ?? def.default ?? def.min ?? 0);
    else if (sec === 'skills') {
      vars = { points: num(sheet.skills?.[id]) };
      formula = def.total || (def.attribute && rules.attributes[def.attribute] ? `points + mod(${def.attribute})` : 'points');
    } else if (sec === 'derived') formula = def.formula;
    else if (sec === 'resources') formula = def.max;
    else return null;
    if (formula !== null) base = num(safe(formula, vars));
    const parts = (byTarget[id] || []).map(({ ef, f }) => {
      let on = true, v = 0;
      try { on = !ef.if || !!run(ef.if, f.vars); v = num(run(ef.value, f.vars)); } catch { on = false; }
      return { source: f.ent.name || f.k, type: ef.type, formula: String(ef.value), filled: fill(ef.value, f.vars), if: ef.if, on, value: v };
    });
    return { formula: formula === null ? null : String(formula ?? 0), filled: formula === null ? null : fill(formula, vars), base, parts,
      bonus: sec === 'derived' && def.editable_bonus ? num(sheet.bonus?.[id]) : 0, total: value(id) };
  }
  function safe(f, vars) { try { return run(f, vars); } catch { return 0; } }
  // The formula with each value it names replaced by its number (quoted text is left alone).
  function fill(f, vars = {}) {
    if (typeof f !== 'string') return String(f ?? 0);
    return f.replace(/('[^']*'|"[^"]*")|(?<![\p{L}\p{N}_])([\p{L}_][\p{L}\p{N}_]*)(?![\p{L}\p{N}_]|\s*\()/gu, (all, quoted, name) => {
      if (quoted) return all;
      if (name in vars) return fmtNum(vars[name]);
      try { return fmtNum(variable(name)); } catch { return all; }
    });
  }

  /** Is a derived value visible? ("if" field) */
  function visible(def) {
    if (!def.if) return true;
    try { return !!run(def.if); } catch { return true; }
  }

  return {
    value, formula, visible, immune, explain, errors, lists, sources, active,
    mod: v => functions.mod(v),
    blocked: sources.filter(blocked),
  };
}

const fmtNum = v => (typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v));

function num(v) {
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Rolls an expression like "2d6 + mod(STR) + 1".
 * Dice are replaced by their results before the formula is evaluated.
 */
export function roll(expr, calc, random = Math.random) {
  const details = [];
  const text = String(expr).replace(/(\d*)d(\d+)/gi, (_, q, f) => {
    const n = Math.min(Number(q || 1), 100), faces = Number(f);
    const r = Array.from({ length: n }, () => 1 + Math.floor(random() * faces));
    details.push(`${n}d${faces}: [${r.join(', ')}]`);
    return `(${r.reduce((a, b) => a + b, 0)})`;
  });
  const total = calc ? calc.formula(text) : evaluate(text);
  return { total: num(total), details };
}
