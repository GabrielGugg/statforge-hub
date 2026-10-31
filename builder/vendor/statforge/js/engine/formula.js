// ============================================================
// Formula mini-language used by packages.
// No eval: tokenize, build a tree, evaluate it with a context.
//   Numbers, 'strings', identifiers, calls f(a, b)
//   + - * / %   < <= > >= == !=   and or not (also && || !)
// ============================================================
import { t } from '../i18n.js';

export class FormulaError extends Error {}

const WORDS = { and: '&&', or: '||', not: '!' };

function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const n = Number(src.slice(i, j));
      if (Number.isNaN(n)) throw new FormulaError(t('formula.badNumber', { text: src.slice(i, j) }));
      toks.push({ t: 'num', v: n }); i = j; continue;
    }
    if (c === "'" || c === '"') {
      const j = src.indexOf(c, i + 1);
      if (j < 0) throw new FormulaError(t('formula.unclosedString'));
      toks.push({ t: 'str', v: src.slice(i + 1, j) }); i = j + 1; continue;
    }
    if (/[\p{L}_]/u.test(c)) {
      let j = i;
      while (j < src.length && /[\p{L}\p{N}_]/u.test(src[j])) j++;
      const w = src.slice(i, j);
      if (WORDS[w]) toks.push({ t: 'op', v: WORDS[w] });
      else toks.push({ t: 'id', v: w });
      i = j; continue;
    }
    const two = src.slice(i, i + 2);
    if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) { toks.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/%<>!(),'.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    throw new FormulaError(t('formula.badChar', { char: c }));
  }
  return toks;
}

// Binary operator precedence (higher binds tighter).
const BIN = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };

export function parse(src) {
  const toks = tokenize(String(src));
  let p = 0;
  const peek = () => toks[p];
  const expect = v => {
    const tk = toks[p++];
    if (!tk || tk.v !== v) throw new FormulaError(t('formula.expected', { text: v }));
  };

  function primary() {
    const tk = toks[p++];
    if (!tk) throw new FormulaError(t('formula.incomplete'));
    if (tk.t === 'num' || tk.t === 'str') return { k: 'lit', v: tk.v };
    if (tk.t === 'op' && tk.v === '(') { const e = expr(0); expect(')'); return e; }
    if (tk.t === 'op' && (tk.v === '-' || tk.v === '!')) return { k: 'un', op: tk.v, a: expr(7) };
    if (tk.t === 'op' && tk.v === '+') return expr(7);
    if (tk.t === 'id') {
      if (tk.v === 'true') return { k: 'lit', v: true };
      if (tk.v === 'false') return { k: 'lit', v: false };
      if (peek() && peek().v === '(') {
        p++;
        const args = [];
        if (!(peek() && peek().v === ')')) {
          do { args.push(expr(0)); } while (peek() && peek().v === ',' && ++p);
        }
        expect(')');
        return { k: 'call', f: tk.v, args };
      }
      return { k: 'var', n: tk.v };
    }
    throw new FormulaError(t('formula.unexpected', { text: tk.v }));
  }

  function expr(min) {
    let left = primary();
    for (;;) {
      const tk = peek();
      if (!tk || tk.t !== 'op' || !(tk.v in BIN) || BIN[tk.v] <= min) break;
      p++;
      left = { k: 'bin', op: tk.v, a: left, b: expr(BIN[tk.v]) };
    }
    return left;
  }

  const tree = expr(0);
  if (p < toks.length) throw new FormulaError(t('formula.leftover', { text: toks[p].v }));
  return tree;
}

const num = v => (typeof v === 'boolean' ? (v ? 1 : 0) : Number(v) || 0);

// Always-available functions. Sheet-dependent ones come in ctx.functions.
const FUNCTIONS = {
  min: (...a) => Math.min(...a.map(num)),
  max: (...a) => Math.max(...a.map(num)),
  floor: a => Math.floor(num(a)),
  ceil: a => Math.ceil(num(a)),
  round: a => Math.round(num(a)),
  abs: a => Math.abs(num(a)),
  if: (c, a, b) => (c ? a : b),
};

/**
 * Evaluates a formula tree (or text).
 * ctx.variable(name) returns the value of an identifier;
 * ctx.functions adds extra functions (mod, has, qty, sum...).
 */
export function evaluate(f, ctx = {}) {
  const tree = typeof f === 'string' ? parse(f) : f;
  const ext = ctx.functions || {};
  const vars = ctx.vars || {};
  function ev(n) {
    switch (n.k) {
      case 'lit': return n.v;
      case 'var':
        if (n.n in vars) return vars[n.n];
        if (ctx.variable) return ctx.variable(n.n);
        throw new FormulaError(t('formula.unknownValue', { name: n.n }));
      case 'un': return n.op === '-' ? -num(ev(n.a)) : !ev(n.a);
      case 'bin': {
        if (n.op === '&&') return ev(n.a) && ev(n.b);
        if (n.op === '||') return ev(n.a) || ev(n.b);
        const a = ev(n.a), b = ev(n.b);
        switch (n.op) {
          case '+': return num(a) + num(b);
          case '-': return num(a) - num(b);
          case '*': return num(a) * num(b);
          case '/': return num(b) === 0 ? 0 : num(a) / num(b);
          case '%': return num(b) === 0 ? 0 : num(a) % num(b);
          case '<': return num(a) < num(b);
          case '<=': return num(a) <= num(b);
          case '>': return num(a) > num(b);
          case '>=': return num(a) >= num(b);
          case '==': return a == b; // eslint-disable-line eqeqeq
          case '!=': return a != b; // eslint-disable-line eqeqeq
        }
        break;
      }
      case 'call': {
        const fn = ext[n.f] || FUNCTIONS[n.f];
        if (!fn) throw new FormulaError(t('formula.unknownFunction', { name: n.f }));
        if (n.f === 'if') return ev(n.args[0]) ? ev(n.args[1]) : ev(n.args[2]);
        return fn(...n.args.map(ev));
      }
    }
    throw new FormulaError(t('formula.invalid'));
  }
  return ev(tree);
}

/** Lists the identifiers used in a formula (for package validation). */
export function identifiers(f) {
  const out = new Set();
  (function walk(n) {
    if (!n) return;
    if (n.k === 'var') out.add(n.n);
    if (n.a) walk(n.a);
    if (n.b) walk(n.b);
    if (n.args) n.args.forEach(walk);
  })(typeof f === 'string' ? parse(f) : f);
  return [...out];
}

// Tree cache by text, since the same formulas run on every redraw.
const cache = new Map();
export function compile(src) {
  const k = String(src);
  if (!cache.has(k)) cache.set(k, parse(k));
  return cache.get(k);
}
