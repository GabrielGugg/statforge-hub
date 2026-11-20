// Attribute generation for the creation wizard: point cost tables and rolled values.

/**
 * Points spent on one attribute with a cost table ({ "value": cost }).
 * Returns null when the value is not in the table (not allowed).
 */
export function costOf(table, value) {
  const c = table?.[String(value)];
  return typeof c === 'number' ? c : null;
}

/** The values a cost table allows, in order. */
export const costValues = table => Object.keys(table || {}).map(Number).filter(Number.isFinite).sort((a, b) => a - b);

/**
 * Points spent for a set of values.
 * Without a table, every point above the starting value costs 1 (and below gives 1 back).
 */
export function pointsSpent(values, starts, table) {
  let spent = 0;
  for (const [id, v] of Object.entries(values)) {
    const start = starts[id] ?? 0;
    if (!table) { spent += v - start; continue; }
    spent += (costOf(table, v) ?? 0) - (costOf(table, start) ?? 0);
  }
  return spent;
}

/** Parses "4d6kh3" (4d6, keep the highest 3), "3d6" or "2d6+6". */
export function parseDice(expr) {
  const m = String(expr || '').trim().match(/^(\d{1,2})d(\d{1,3})(?:k([hl])(\d{1,2}))?\s*(?:([+-])\s*(\d{1,3}))?$/i);
  if (!m) return null;
  const n = Number(m[1]), faces = Number(m[2]);
  const keep = m[3] ? Math.min(Number(m[4]), n) : n;
  if (!n || !faces || !keep) return null;
  return { n, faces, keep, high: (m[3] || 'h').toLowerCase() === 'h', bonus: m[5] ? Number(`${m[5]}${m[6]}`) : 0 };
}

/** Rolls the dice; returns { dice: [all], kept: [kept], total }. */
export function rollDice(expr, random = Math.random) {
  const d = parseDice(expr);
  if (!d) return null;
  const dice = Array.from({ length: d.n }, () => 1 + Math.floor(random() * d.faces));
  const sorted = [...dice].sort((a, b) => (d.high ? b - a : a - b)).slice(0, d.keep);
  return { dice, kept: sorted, total: sorted.reduce((a, b) => a + b, 0) + d.bonus };
}

/** Lowest and highest total the dice can give (for the manual entry of physical rolls). */
export function diceRange(expr) {
  const d = parseDice(expr);
  return d ? { min: d.keep + d.bonus, max: d.keep * d.faces + d.bonus } : { min: 1, max: 99 };
}

/**
 * Converts a rolled total with a table [{ max, value }, …] (first row whose max is ≥ the total).
 * Without a table, the total is the value.
 */
export function convertRoll(total, table) {
  if (!Array.isArray(table) || !table.length) return total;
  const row = table.find(r => total <= Number(r.max));
  return row ? Number(row.value) : Number(table[table.length - 1].value);
}

/**
 * Rolls a full set: `count` results, converted by `table`.
 * With `min_total`, while the converted values add up to less than it, the lowest result is rolled again.
 * Returns [{ dice, kept, total, value }].
 */
export function rollSet(cfg, random = Math.random) {
  const count = Number(cfg.count) || 6;
  const one = () => { const r = rollDice(cfg.dice, random); return { ...r, value: convertRoll(r.total, cfg.table) }; };
  const set = Array.from({ length: count }, one);
  const min = Number(cfg.min_total);
  for (let guard = 0; Number.isFinite(min) && set.reduce((s, r) => s + r.value, 0) < min && guard < 200; guard++) {
    const low = set.reduce((li, r, i) => (r.total < set[li].total ? i : li), 0);
    set[low] = one();
  }
  return set;
}

/** Sum of converted values (to show and check `min_total` for typed-in rolls). */
export const setTotal = set => set.reduce((s, r) => s + (Number(r?.value) || 0), 0);
