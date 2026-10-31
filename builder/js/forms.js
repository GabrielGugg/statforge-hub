// ============================================================
// Generic form widgets driven by a field spec.
// A spec is a list of { key, label, kind, help, ... } and edits an
// object in place. Keys the spec does not know are kept and shown
// in an "Other fields" JSON box, so nothing is ever lost.
//
// Kinds: text, textarea, number, bool, select, formula, dice, tags,
// ref, refs, list (array of objects), map (object of objects),
// object (nested spec), json, custom (render function).
// ============================================================
import { h } from './h.js';
import { t } from './i18n.js';

/** Context shared by every widget: { changed(), engine, ids(), refs(), preview() } */
export let ctx = { changed() {}, engine: null };
export function setContext(c) { ctx = c; }

const isEmpty = v => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Sets or deletes a key (empty values delete, so the export stays clean). */
export function put(obj, key, value, keepEmpty = false) {
  if (!keepEmpty && isEmpty(value)) delete obj[key];
  else obj[key] = value;
  ctx.changed();
}

const resolve = (x, obj) => (typeof x === 'function' ? x(obj) : x);

/** Renders the form of one object. */
export function objectForm(obj, spec, opts = {}) {
  const fields = resolve(spec, obj).filter(f => !f.if || f.if(obj));
  const known = new Set(fields.map(f => f.key));
  for (const k of opts.hiddenKeys || []) known.add(k);
  const wrap = h('div.form');
  const groups = new Map();
  for (const f of fields) {
    const el = fieldWidget(obj, f, () => { if (f.rerender) opts.rerender?.(); });
    if (!el) continue;
    if (f.group) {
      if (!groups.has(f.group)) { const g = h('div.fgroup', { 'data-cols': f.cols || 3 }); groups.set(f.group, g); wrap.appendChild(g); }
      groups.get(f.group).appendChild(el);
    } else wrap.appendChild(el);
  }
  if (opts.extra !== false) wrap.appendChild(extraKeys(obj, known, opts.rerender));
  return wrap;
}

/** "Other fields": everything the spec does not show, as editable JSON. */
function extraKeys(obj, known, rerender) {
  const rest = Object.fromEntries(Object.entries(obj).filter(([k]) => !known.has(k)));
  const n = Object.keys(rest).length;
  const area = h('textarea.code', { rows: Math.min(14, 3 + JSON.stringify(rest, null, 2).split('\n').length), spellcheck: 'false', value: JSON.stringify(rest, null, 2) });
  const msg = h('span.small');
  const apply = () => {
    let v;
    try { v = JSON.parse(area.value || '{}'); } catch (e) { msg.textContent = t('raw.bad', { error: e.message }); msg.className = 'small bad'; return; }
    if (!v || typeof v !== 'object' || Array.isArray(v)) { msg.textContent = t('raw.bad', { error: '{ … }' }); msg.className = 'small bad'; return; }
    for (const k of Object.keys(obj)) if (!known.has(k) && !(k in v)) delete obj[k];
    for (const [k, val] of Object.entries(v)) if (!known.has(k)) obj[k] = val;
    msg.textContent = t('raw.applied'); msg.className = 'small ok';
    ctx.changed();
    rerender?.();
  };
  return h('details.extra', n ? { open: false } : {},
    h('summary.small.muted', t('form.extra', { n })),
    h('p.small.muted', t('form.extra.help')),
    area,
    h('div.row', h('button.small', { type: 'button', onclick: apply }, t('raw.apply')), msg));
}

function label(f, ...children) {
  return h(`label.field${f.wide ? '.wide' : ''}`,
    h('span.label', f.label, f.required ? h('span.req', ' *') : null),
    ...children,
    f.help ? h('span.help', f.help) : null);
}

export function fieldWidget(obj, f, after = () => {}) {
  const val = obj[f.key];
  const set = (v, keep) => { put(obj, f.key, v, keep ?? f.keepEmpty); after(v); f.onchange?.(obj, v); };

  switch (f.kind) {
    case 'text': case 'dice': case undefined:
      return label(f, h('input', { type: 'text', value: val ?? '', placeholder: f.placeholder, list: f.datalist, spellcheck: f.kind === 'dice' ? 'false' : undefined,
        oninput: e => set(e.target.value) }));
    case 'textarea':
      return label({ ...f, wide: true }, h('textarea', { rows: f.rows || 3, value: val ?? '', placeholder: f.placeholder, oninput: e => set(e.target.value) }));
    case 'number':
      return label(f, h('input', { type: 'number', step: 'any', value: val ?? '', placeholder: f.placeholder,
        oninput: e => set(e.target.value === '' ? undefined : Number(e.target.value)) }));
    case 'numformula':
      // A number or a formula: numbers are stored as numbers, anything else as text.
      return formulaField(obj, f, v => set(v === '' ? undefined : (/^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v)));
    case 'formula':
      return formulaField(obj, f, v => set(v));
    case 'bool':
      return h('label.check', h('input', { type: 'checkbox', checked: !!val, onchange: e => set(e.target.checked || undefined) }),
        h('span', h('strong', f.label), f.help ? h('span.help', ' ', f.help) : null));
    case 'select': {
      const options = resolve(f.options, obj) || [];
      const has = options.some(o => (o.value ?? o) === val);
      return label(f, h('select', { onchange: e => set(e.target.value === '' ? undefined : e.target.value) },
        f.noEmpty ? null : h('option', { value: '' }, f.emptyLabel || '—'),
        !has && val !== undefined ? h('option', { value: val, selected: true }, `${val} (?)`) : null,
        options.map(o => h('option', { value: o.value ?? o, selected: (o.value ?? o) === val }, o.label ?? o))));
    }
    case 'tags': {
      // Text list, comma separated.
      const text = Array.isArray(val) ? val.join(', ') : (val ?? '');
      return label(f, h('input', { type: 'text', value: text, placeholder: f.placeholder || 'a, b, c', list: f.datalist,
        oninput: e => set(e.target.value.split(',').map(s => s.trim()).filter(Boolean)) }));
    }
    case 'ref':
      return label(f, refPicker(val, resolve(f.options, obj) || [], v => set(v), f));
    case 'refs':
      return label(f, refsPicker(Array.isArray(val) ? val : (val === undefined ? [] : [val]), resolve(f.options, obj) || [], v => set(v), f));
    case 'object': {
      const box = h('fieldset.sub', h('legend', f.label));
      const draw = () => {
        box.replaceChildren(h('legend', f.label));
        if (f.help) box.appendChild(h('p.help', f.help));
        const cur = obj[f.key];
        if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
          box.appendChild(objectForm(cur, f.spec, { rerender: draw }));
          if (!f.required) box.appendChild(h('button.small.ghost.danger', { type: 'button', onclick: () => { delete obj[f.key]; ctx.changed(); draw(); } }, t('form.removeGroup')));
        } else {
          if (cur !== undefined) box.appendChild(h('p.small.muted', `${t('form.currentValue')}: ${JSON.stringify(cur)}`));
          box.appendChild(h('button.small', { type: 'button', onclick: () => { obj[f.key] = structuredClone(f.empty ?? {}); ctx.changed(); draw(); } }, f.addLabel || t('form.addGroup')));
        }
      };
      draw();
      return box;
    }
    case 'list':
      return h('div.field.wide', h('span.label', f.label), f.help ? h('span.help', f.help) : null, listEditor(obj, f));
    case 'map':
      return h('div.field.wide', h('span.label', f.label), f.help ? h('span.help', f.help) : null, mapEditor(obj, f));
    case 'json': {
      const area = h('textarea.code', { rows: f.rows || 6, spellcheck: 'false', value: val === undefined ? '' : JSON.stringify(val, null, 2) });
      const msg = h('span.small');
      area.addEventListener('change', () => {
        if (!area.value.trim()) { set(undefined); msg.textContent = ''; return; }
        try { set(JSON.parse(area.value)); msg.textContent = ''; } catch (e) { msg.textContent = t('raw.bad', { error: e.message }); msg.className = 'small bad'; }
      });
      return label({ ...f, wide: true }, area, msg);
    }
    case 'custom':
      return f.render(obj, f);
    default:
      return null;
  }
}

// ---------- formulas: autocomplete, syntax check and test value ----------
const FUNCS = ['mod(', 'floor(', 'ceil(', 'round(', 'abs(', 'min(', 'max(', 'if(', 'has(\'', 'owns(\'', 'qty(\'', 'count(\'', 'sum(\'', 'tag(\'', 'current(\'', 'maxof(\''];
const WORDS = ['and', 'or', 'not', 'level', 'xp', 'true', 'false'];

function formulaField(obj, f, set) {
  const val = obj[f.key];
  const input = h('input.formula', { type: 'text', value: val ?? '', placeholder: f.placeholder || t('form.formulaHelp'), spellcheck: 'false', autocomplete: 'off' });
  const status = h('span.fstatus.small');
  const menu = h('ul.ac', { hidden: true });
  let items = [], sel = 0;

  const check = () => {
    const src = input.value.trim();
    status.className = 'fstatus small';
    if (!src || /^-?\d+(\.\d+)?$/.test(src) || !ctx.engine) { status.textContent = ''; return; }
    try { ctx.engine.parseFormula(src); } catch (e) { status.textContent = `✗ ${e.message}`; status.classList.add('bad'); return; }
    // Names that are not ids of this package are almost always typos.
    try {
      const known = new Set([...(ctx.ids?.() || []).map(x => x.value), ...(f.vars || []), 'level', 'xp', 'true', 'false']);
      const unknown = ctx.engine.identifiers(src).filter(n => !known.has(n));
      if (unknown.length && ctx.ids) { status.textContent = `⚠ ${t('form.unknownId', { ids: unknown.join(', ') })}`; status.classList.add('warn'); return; }
    } catch { /* ignore */ }
    const v = ctx.preview?.(src, f.vars);
    status.textContent = v === undefined ? '✓' : `✓ ${t('form.testValue')}: ${v}`;
    status.classList.add('ok');
  };

  const word = () => {
    const upto = input.value.slice(0, input.selectionStart);
    const m = /([\p{L}_][\p{L}\p{N}_]*)$/u.exec(upto) || /'([^']*)$/.exec(upto);
    return m ? { text: m[1], start: input.selectionStart - m[1].length, quoted: m[0].startsWith("'") } : null;
  };
  const close = () => { menu.hidden = true; items = []; };
  const pick = it => {
    const w = word();
    if (!w) return close();
    const before = input.value.slice(0, w.start), after = input.value.slice(input.selectionStart);
    const ins = w.quoted ? `${it.value}'` : it.value;
    input.value = before + ins + after;
    const pos = before.length + ins.length;
    input.setSelectionRange(pos, pos);
    input.focus();
    close();
    set(input.value); check();
  };
  const open = () => {
    const w = word();
    if (!w || (!w.quoted && w.text.length < 1)) return close();
    const q = w.text.toLowerCase();
    const pool = w.quoted
      ? (ctx.refs?.() || []).map(r => ({ value: r.value, label: r.label }))
      : [...(ctx.ids?.() || []), ...(f.vars || []).map(v => ({ value: v, label: t('form.var') })),
        ...FUNCS.map(x => ({ value: x, label: t('form.func') })), ...WORDS.map(x => ({ value: x, label: '' }))];
    items = pool.filter(p => p.value.toLowerCase().includes(q) && p.value !== w.text)
      .sort((a, b) => a.value.toLowerCase().indexOf(q) - b.value.toLowerCase().indexOf(q)).slice(0, 12);
    if (!items.length) return close();
    sel = 0;
    menu.replaceChildren(...items.map((it, i) => h(`li${i === sel ? '.sel' : ''}`, { onmousedown: e => { e.preventDefault(); pick(it); } },
      h('code', it.value), it.label ? h('span.muted.small', ` ${it.label}`) : null)));
    menu.hidden = false;
  };
  input.addEventListener('input', () => { set(input.value); check(); open(); });
  input.addEventListener('keydown', e => {
    if (menu.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      [...menu.children].forEach((li, i) => li.classList.toggle('sel', i === sel));
    } else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(items[sel]); } else if (e.key === 'Escape') close();
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
  setTimeout(check, 0);
  return label(f, h('div.acwrap', input, menu), status);
}

// ---------- references ----------
function refPicker(val, options, set, f) {
  const listId = `dl-${Math.random().toString(36).slice(2)}`;
  return h('div.row',
    h('input', { type: 'text', value: val ?? '', list: listId, placeholder: f.placeholder || t('form.searchRef'), spellcheck: 'false',
      oninput: e => set(e.target.value) }),
    h('datalist', { id: listId }, options.slice(0, 3000).map(o => h('option', { value: o.value ?? o }, o.label ?? ''))));
}

function refsPicker(vals, options, set, f) {
  const box = h('div.refs');
  const labelOf = v => (options.find(o => (o.value ?? o) === v)?.label) || '';
  const draw = () => {
    const listId = `dl-${Math.random().toString(36).slice(2)}`;
    const input = h('input', { type: 'text', list: listId, placeholder: f.placeholder || t('form.addRef'), spellcheck: 'false' });
    const add = () => { const v = input.value.trim(); if (v && !vals.includes(v)) { vals = [...vals, v]; set(vals); draw(); } };
    input.addEventListener('change', add);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    box.replaceChildren(
      h('div.chips', vals.map((v, i) => h('span.chip', h('code', v), labelOf(v) ? h('span.muted.small', ` ${labelOf(v)}`) : null,
        h('button.x', { type: 'button', title: t('form.remove'), onclick: () => { vals = vals.filter((_, j) => j !== i); set(vals); draw(); } }, '×')))),
      h('div.row', input, h('datalist', { id: listId }, options.slice(0, 3000).map(o => h('option', { value: o.value ?? o }, o.label ?? ''))),
        h('button.small', { type: 'button', onclick: add }, '+')));
  };
  draw();
  return box;
}

// ---------- lists of objects (effects, steps, blocks...) ----------
/**
 * f.spec(item) → fields; f.newItem() → object; f.summary(item) → text;
 * f.types: [{ value, label, make() }] offers one "add" button per type.
 */
export function listEditor(obj, f) {
  const box = h('div.list');
  const open = new Set();
  const draw = () => {
    const arr = Array.isArray(obj[f.key]) ? obj[f.key] : [];
    box.replaceChildren(
      ...arr.map((item, i) => {
        const card = h('details.item', open.has(i) ? { open: true } : {});
        card.addEventListener('toggle', () => { if (card.open) open.add(i); else open.delete(i); });
        const summary = h('summary', h('span.sum', (f.summary?.(item, i)) || `#${i + 1}`),
          h('span.tools',
            h('button.icon', { type: 'button', title: t('form.up'), disabled: i === 0, onclick: e => { e.preventDefault(); move(i, -1); } }, '↑'),
            h('button.icon', { type: 'button', title: t('form.down'), disabled: i === arr.length - 1, onclick: e => { e.preventDefault(); move(i, 1); } }, '↓'),
            h('button.icon', { type: 'button', title: t('form.duplicate'), onclick: e => { e.preventDefault(); arr.splice(i + 1, 0, structuredClone(item)); ctx.changed(); draw(); } }, '⧉'),
            h('button.icon.danger', { type: 'button', title: t('form.remove'), onclick: e => { e.preventDefault(); arr.splice(i, 1); if (!arr.length && !f.keepEmpty) delete obj[f.key]; ctx.changed(); open.clear(); draw(); } }, '×')));
        card.appendChild(summary);
        if (item && typeof item === 'object') {
          const body = h('div.itembody');
          const redraw = () => { body.replaceChildren(objectForm(item, f.spec, { rerender: redraw })); summary.firstChild.textContent = (f.summary?.(item, i)) || `#${i + 1}`; };
          card.addEventListener('toggle', () => { if (card.open && !body.childElementCount) redraw(); });
          if (open.has(i)) redraw();
          card.appendChild(body);
        } else {
          card.appendChild(h('p.small.muted', JSON.stringify(item)));
        }
        return card;
      }),
      h('div.row.adds', (f.types || [{ label: f.addLabel || t('form.add'), make: f.newItem || (() => ({})) }]).map(tp =>
        h('button.small', { type: 'button', onclick: () => {
          if (!Array.isArray(obj[f.key])) obj[f.key] = [];
          obj[f.key].push(tp.make()); open.add(obj[f.key].length - 1); ctx.changed(); draw();
        } }, `+ ${tp.label}`))),
    );
  };
  const move = (i, d) => {
    const arr = obj[f.key]; const [x] = arr.splice(i, 1); arr.splice(i + d, 0, x);
    const wasOpen = open.has(i); open.delete(i); if (wasOpen) open.add(i + d);
    ctx.changed(); draw();
  };
  draw();
  return box;
}

// ---------- maps: { id: {...} } (collections, collection fields) ----------
export function mapEditor(obj, f) {
  const box = h('div.list');
  const open = new Set();
  const draw = () => {
    const map = obj[f.key] && typeof obj[f.key] === 'object' ? obj[f.key] : {};
    const newKey = h('input', { type: 'text', placeholder: f.keyPlaceholder || 'id', spellcheck: 'false' });
    box.replaceChildren(
      ...Object.entries(map).map(([k, item]) => {
        const card = h('details.item', open.has(k) ? { open: true } : {});
        card.addEventListener('toggle', () => { if (card.open) open.add(k); else open.delete(k); });
        const summary = h('summary', h('span.sum', h('code', k), ' ', f.summary?.(item, k) || ''),
          h('span.tools',
            h('button.icon', { type: 'button', title: t('form.rename'), onclick: e => { e.preventDefault(); rename(k); } }, '✎'),
            h('button.icon.danger', { type: 'button', title: t('form.remove'), onclick: e => {
              e.preventDefault(); if (f.confirmRemove && !confirm(f.confirmRemove(k))) return;
              delete map[k]; f.onremove?.(k); ctx.changed(); draw(); } }, '×')));
        const body = h('div.itembody');
        const redraw = () => body.replaceChildren(objectForm(item, f.specFor ? f.specFor(k) : f.spec, { rerender: redraw }));
        card.addEventListener('toggle', () => { if (card.open && !body.childElementCount) redraw(); });
        if (open.has(k)) redraw();
        card.append(summary, body);
        return card;
      }),
      h('div.row.adds', newKey, h('button.small', { type: 'button', onclick: () => {
        const k = (f.makeKey || (x => x))(newKey.value.trim());
        if (!k) return;
        if (map[k]) { alert(t('form.keyExists', { key: k })); return; }
        if (!obj[f.key]) obj[f.key] = {};
        obj[f.key][k] = f.newItem ? f.newItem(k) : {};
        f.onadd?.(k); open.add(k); ctx.changed(); draw();
      } }, `+ ${f.addLabel || t('form.add')}`)),
    );
  };
  const rename = k => {
    const nk = (f.makeKey || (x => x))((prompt(t('form.renamePrompt'), k) || '').trim());
    if (!nk || nk === k) return;
    const map = obj[f.key];
    if (map[nk]) { alert(t('form.keyExists', { key: nk })); return; }
    const entries = Object.entries(map).map(([key, v]) => [key === k ? nk : key, v]);
    for (const key of Object.keys(map)) delete map[key];
    for (const [key, v] of entries) map[key] = v;
    f.onrename?.(k, nk);
    if (open.delete(k)) open.add(nk);
    ctx.changed(); draw();
  };
  draw();
  return box;
}

// ---------- master/detail for big lists (entities, attributes...) ----------
/**
 * Big list with search and pages on the left, the selected item's form on the right.
 * o: { items: () => array, spec, label(item), sub(item), newItem(), idOf(item), pageSize }
 */
export function masterDetail(o) {
  const box = h('div.md');
  let query = '', page = 0, selected = o.initial ?? null;
  const pageSize = o.pageSize || 40;
  const listEl = h('div.mdlist'), detail = h('div.mddetail');
  const search = h('input', { type: 'search', placeholder: t('form.search'), oninput: e => { query = e.target.value.toLowerCase(); page = 0; drawList(); } });

  const matches = it => !query || [o.label(it), o.idOf?.(it), o.sub?.(it)].some(s => String(s ?? '').toLowerCase().includes(query));
  function drawList() {
    const arr = o.items();
    const idx = arr.map((it, i) => [it, i]).filter(([it]) => matches(it));
    const pages = Math.max(1, Math.ceil(idx.length / pageSize));
    page = Math.min(page, pages - 1);
    listEl.replaceChildren(
      h('div.row', search, h('button.primary.small', { type: 'button', onclick: add }, `+ ${o.addLabel || t('form.add')}`)),
      h('p.small.muted', t('form.count', { n: idx.length, total: arr.length })),
      h('ul.mditems', idx.slice(page * pageSize, (page + 1) * pageSize).map(([it, i]) =>
        h('li', h(`button${i === selected ? '.active' : ''}`, { type: 'button', onclick: () => { selected = i; drawList(); drawDetail(); } },
          h('span', o.label(it) || '—'), h('span.muted.small', o.sub?.(it) ?? o.idOf?.(it) ?? ''))))),
      pages > 1 ? h('div.row.pager',
        h('button.small', { type: 'button', disabled: page === 0, onclick: () => { page--; drawList(); } }, '‹'),
        h('span.small', `${page + 1} / ${pages}`),
        h('button.small', { type: 'button', disabled: page >= pages - 1, onclick: () => { page++; drawList(); } }, '›')) : '',
    );
  }
  function drawDetail() {
    const arr = o.items();
    const it = arr[selected];
    if (!it) { detail.replaceChildren(h('p.muted', o.emptyText || t('form.pick'))); return; }
    const redraw = () => { detail.replaceChildren(
      h('div.row.mdhead', h('h2', o.label(it) || '—'), h('div.spacer'),
        h('button.small', { type: 'button', onclick: () => { const c = structuredClone(it); o.onDuplicate?.(c, arr); arr.splice(selected + 1, 0, c); selected++; ctx.changed(); drawList(); drawDetail(); } }, t('form.duplicate')),
        h('button.small.danger', { type: 'button', onclick: () => { if (!confirm(t('form.removeAsk', { name: o.label(it) || '?' }))) return; arr.splice(selected, 1); selected = null; ctx.changed(); drawList(); drawDetail(); } }, t('form.remove'))),
      objectForm(it, o.spec, { rerender: () => { redraw(); drawList(); } })); };
    redraw();
  }
  // Name changes refresh the list label without losing focus.
  let typing = null;
  detail.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(drawList, 300); });
  function add() {
    const arr = o.ensure ? o.ensure() : o.items();
    arr.push(o.newItem());
    selected = arr.length - 1; query = ''; search.value = '';
    page = Math.floor(selected / pageSize);
    ctx.changed(); drawList(); drawDetail();
  }
  drawList(); drawDetail();
  box.append(listEl, detail);
  return box;
}
