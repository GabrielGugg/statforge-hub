// ============================================================
// Visual editors for each section of a package.
// Each editor receives (state, api) and returns an element.
// api: { changed(), rerender() }
// ============================================================
import { h, mount } from './h.js';
import { t } from './i18n.js';
import { objectForm, listEditor, mapEditor, masterDetail, setContext, put } from './forms.js';
import { setKey, formulaId, slug, THEME_VARS, parseTable, importRows, tableOf, toCsv } from './model.js';
import { getLang } from './i18n.js';
import {
  L, SPECS, collectionSpec, entitySpec, layoutSpec, creationSpec, dependenciesSpec, tableSpec, PATCH_OPS,
  setPackageGetter, setCustomRenderer, setWidthRenderer, setDecreaseRenderer, valueIds, entityRefs, collectionOptions, fieldOptions,
} from './schema.js';

/** Makes sure a top-level key exists and returns it. */
function ensure(pkg, key, empty) {
  if (pkg[key] === undefined || pkg[key] === null) setKey(pkg, key, structuredClone(empty));
  return pkg[key];
}

// ---------- shared context for the widgets ----------
let previewCache = null;
export function initContext(state, changed) {
  ctxChanged = () => { previewCache = null; changed(); };
  // In an extension, lists of ids come from the base system (when loaded).
  setPackageGetter(() => (state.pkg?.type === 'extension' && state.base ? state.base : state.pkg || {}));
  setContext({
    changed: () => { previewCache = null; changed(); },
    get engine() { return state.engine; },
    ids: () => {
      const p = state.pkg?.type === 'extension' && state.base ? state.base : state.pkg || {};
      return [...valueIds(), ...Object.keys(p.collections || {}).map(c => ({ value: c, label: L('coleção', 'collection') }))];
    },
    refs: () => [...entityRefs(), ...Object.values(state.pkg?.type === 'extension' && state.base ? state.base.entities || {} : state.pkg?.entities || {})
      .flatMap(l => (Array.isArray(l) ? l : []).map(e => ({ value: e.id, label: e.name || '' })))],
    preview: (src, vars) => preview(state, src, vars),
  });
}

/** Value of a formula on a test sheet (level 1, default attributes, no items). */
function preview(state, src, vars = []) {
  const eng = state.engine;
  const sys = state.pkg?.type === 'system' ? state.pkg : state.pkg?.type === 'extension' ? state.base : null;
  if (!eng || !sys) return undefined;
  try {
    if (!previewCache) {
      const exts = state.pkg.type === 'extension' ? [state.pkg] : [];
      const { rules } = eng.buildRules(sys, exts);
      previewCache = eng.compute(rules, eng.emptySheet(rules));
    }
    const sample = { value: 5, points: 0, n: 1, qty: 1, wear: 0 };
    const v = previewCache.formula(src, Object.fromEntries((vars || []).map(k => [k, sample[k] ?? 0])));
    return typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v);
  } catch (e) {
    return `⚠ ${e.message}`;
  }
}

// ---------- custom widgets used by the specs ----------
setWidthRenderer(o => h('label.field', h('span.label', L('Largura (colunas de 12)', 'Width (of 12 columns)')),
  h('select', { onchange: e => put(o, 'w', e.target.value === '' ? undefined : Number(e.target.value)) },
    h('option', { value: '' }, L('Padrão (6)', 'Default (6)')),
    [3, 4, 6, 8, 12].map(n => h('option', { value: n, selected: o.w === n }, String(n))))));

setDecreaseRenderer(o => h('label.check', h('input', { type: 'checkbox', checked: o.decrease !== false,
  onchange: e => put(o, 'decrease', e.target.checked ? undefined : false, true) }),
h('span', h('strong', L('Baixar um atributo devolve pontos', 'Lowering an attribute gives points back')))));

// custom: true | ["field", ...] | { fields: [...], magazine: "collection" }
setCustomRenderer((col, holder) => {
  const draw = () => {
    const c = col.custom;
    const mode = c === undefined || c === false ? 'none' : c === true ? 'all' : 'some';
    const fields = Array.isArray(c) ? c : Array.isArray(c?.fields) ? c.fields : [];
    const magazine = c && typeof c === 'object' && !Array.isArray(c) ? c.magazine : undefined;
    const write = (m, fl, mg) => {
      if (m === 'none') delete col.custom;
      else if (m === 'all' && !mg) col.custom = true;
      else if (mg) col.custom = { fields: m === 'all' ? Object.keys(col.fields || {}) : fl, magazine: mg };
      else col.custom = fl;
      put(col, 'custom', col.custom); draw();
    };
    mount(holder,
      h('span.label', L('Itens personalizados', 'Custom items')),
      h('span.help', L('Deixa o jogador criar os próprios itens desta coleção ("Criar item personalizado").', 'Lets players create their own items in this collection.')),
      h('select', { onchange: e => write(e.target.value, fields, magazine) },
        [['none', L('Não permitir', 'Not allowed')], ['all', L('Permitir, com todos os campos', 'Allow, every field')], ['some', L('Permitir, só os campos marcados', 'Allow, chosen fields')]]
          .map(([v, lb]) => h('option', { value: v, selected: v === mode }, lb))),
      mode === 'some' ? h('div.chips', Object.entries(col.fields || {}).map(([k, f]) => h('label.chip',
        h('input', { type: 'checkbox', checked: fields.includes(k), onchange: e => write('some', e.target.checked ? [...fields, k] : fields.filter(x => x !== k), magazine) }),
        ` ${f?.label || k}`))) : null,
      mode !== 'none' ? h('label.field', h('span.label', L('Pede capacidade de pente, com munição da coleção', 'Asks for magazine capacity, ammo from collection')),
        h('select', { onchange: e => write(mode, fields, e.target.value || undefined) }, h('option', { value: '' }, '—'),
          collectionOptions().map(o => h('option', { value: o.value, selected: o.value === magazine }, o.label)))) : null,
    );
  };
  draw();
  return document.createTextNode('');
});

// ---------- editors ----------
function intro(text) { return h('p.muted.intro', text); }

function valueSection(sec, newItem, introText) {
  return state => {
    const pkg = state.pkg;
    return h('div', intro(introText()), masterDetail({
      items: () => (Array.isArray(pkg[sec]) ? pkg[sec] : []),
      ensure: () => ensure(pkg, sec, []),
      spec: SPECS[sec],
      label: o => o.name || o.id,
      sub: o => o.id,
      idOf: o => o.id,
      newItem,
      onDuplicate: (c, arr) => { c.id = uniqueId(arr, c.id); },
    }));
  };
}

function uniqueId(arr, base) {
  const ids = new Set(arr.map(o => o?.id));
  let i = 2, id = `${base}_${i}`;
  while (ids.has(id)) id = `${base}_${++i}`;
  return id;
}

export const EDITORS = {
  rolls: state => h('div', intro(L('Como os modificadores e as rolagens funcionam no seu sistema.', 'How modifiers and rolls work in your system.')),
    objectForm(ensure(state.pkg, 'rolls', {}), SPECS.rolls)),

  progression: state => h('div', intro(L('XP, nível máximo e o que acontece ao subir de nível.', 'XP, max level and what happens on level up.')),
    objectForm(ensure(state.pkg, 'progression', {}), SPECS.progression)),

  attributes: valueSection('attributes', () => ({ id: '', name: '', min: 1, max: 10, default: 5 }),
    () => L('Os atributos principais (FOR, PER, RES…). O id é o que aparece nas fórmulas.', 'The main attributes (STR, DEX…). The id is what formulas use.')),
  skills: valueSection('skills', () => ({ id: '', name: '' }),
    () => L('Cada perícia usa um atributo. O total padrão é pontos + mod(atributo).', 'Each skill uses an attribute. Default total is points + mod(attribute).')),
  derived: valueSection('derived', () => ({ id: '', name: '', formula: '0' }),
    () => L('Números calculados por fórmula: defesa, carga máxima, iniciativa…', 'Numbers computed by formula: defense, max load, initiative…')),
  resources: valueSection('resources', () => ({ id: '', name: '', max: '10' }),
    () => L('Valores que sobem e descem durante o jogo: PV, PE, PA…', 'Values that go up and down in play: HP, stamina…')),
  counters: valueSection('counters', () => ({ id: '', name: '', max: 5 }),
    () => L('Vão de 0 ao máximo e aplicam efeitos enquanto acima de 0: fome, sede, exaustão…', 'Go from 0 to max and apply effects while above 0: hunger, exhaustion…')),

  auto_conditions: state => h('div', intro(L('Condições que o app sugere sozinho quando a regra vale (ex.: Sobrecarregado quando a carga passa do máximo).', 'Conditions the app offers by itself when a rule holds.')),
    listEditor(state.pkg, { key: 'auto_conditions', spec: SPECS.auto_conditions, summary: a => `${a.ref || '?'}  ⇐  ${a.when || '?'}`, newItem: () => ({ ref: '', when: '' }) })),

  collections: (state, api) => {
    const pkg = state.pkg;
    ensure(pkg, 'collections', {});
    return h('div', intro(L('Tipos de coisa que a ficha pode ter: armas, armaduras, talentos, condições… Os itens de cada uma ficam em "Itens das coleções".', 'Kinds of things a sheet can have. Their items live in "Collection items".')),
      mapEditor(pkg, {
        key: 'collections', keyPlaceholder: L('id da coleção (ex.: armas)', 'collection id (e.g. weapons)'), makeKey: formulaId,
        specFor: k => collectionSpec(k), addLabel: L('coleção', 'collection'),
        newItem: k => ({ name: k, fields: {} }),
        summary: c => `${c?.name || ''} · ${(pkg.entities?.[Object.keys(pkg.collections).find(k => pkg.collections[k] === c)] || []).length} ${L('itens', 'items')}`,
        onadd: k => { ensure(pkg, 'entities', {}); if (!pkg.entities[k]) pkg.entities[k] = []; },
        onrename: (a, b) => {
          if (pkg.entities?.[a]) {
            const entries = Object.entries(pkg.entities).map(([k, v]) => [k === a ? b : k, v]);
            for (const k of Object.keys(pkg.entities)) delete pkg.entities[k];
            for (const [k, v] of entries) pkg.entities[k] = v;
          }
        },
        confirmRemove: k => L(`Remover a coleção "${k}" e todos os ${(pkg.entities?.[k] || []).length} itens dela?`, `Remove collection "${k}" and its ${(pkg.entities?.[k] || []).length} items?`),
        onremove: k => { if (pkg.entities) delete pkg.entities[k]; },
      }));
    void api;
  },

  entities: (state, api) => {
    const pkg = state.pkg;
    const cols = Object.keys(pkg.collections || {});
    if (!cols.length) return h('p.muted', L('Crie uma coleção primeiro (menu Coleções).', 'Create a collection first (Collections menu).'));
    if (!cols.includes(state.entityCol)) state.entityCol = cols[0];
    const col = state.entityCol;
    return h('div',
      h('label.field', h('span.label', L('Coleção', 'Collection')),
        h('select', { onchange: e => { state.entityCol = e.target.value; api.rerender(); } },
          cols.map(c => h('option', { value: c, selected: c === col }, `${pkg.collections[c]?.name || c} (${(pkg.entities?.[c] || []).length})`)))),
      masterDetail({
        items: () => (Array.isArray(pkg.entities?.[col]) ? pkg.entities[col] : []),
        ensure: () => { ensure(pkg, 'entities', {}); return (pkg.entities[col] ||= []); },
        spec: entitySpec(col),
        label: e => e.name || e.id,
        sub: e => e.id,
        idOf: e => e.id,
        newItem: () => ({ id: '', name: '' }),
        onDuplicate: (c, arr) => { c.id = uniqueId(arr, c.id); },
        addLabel: L('item', 'item'),
      }),
      h('p.small.muted', L('Dica: o id é gerado do nome se você deixar vazio e sair do campo Nome.', 'Tip: leave the id empty and it is made from the name.')),
      spreadsheetBox(state, api, col));
  },

  layout: state => h('div', intro(L('As abas da ficha e os blocos de cada uma, numa grade de 12 colunas. Dê um id a cada bloco.', 'Sheet tabs and their blocks, on a 12-column grid. Give each block an id.')),
    objectForm(ensure(state.pkg, 'layout', { tabs: [] }), layoutSpec())),

  creation: state => h('div', intro(L('O assistente de "Nova ficha", passo a passo. O último passo é sempre a revisão.', 'The step-by-step "New sheet" assistant. The last screen is always a review.')),
    objectForm(ensure(state.pkg, 'creation', { steps: [] }), creationSpec())),

  dependencies: (state, api) => (autoBase(state, api), h('div', intro(L('Qual sistema esta extensão muda e de quais pacotes ela depende.', 'Which system this extension changes and what it depends on.')),
    objectForm(state.pkg, dependenciesSpec(), { extra: false }),
    state.base ? h('p.small.ok', '✓ ', L('Sistema base carregado: ', 'Base system loaded: '), state.base.name, ` (v${state.base.version})`) : null)),

  patches: (state, api) => patchesEditor(state, api),
  colors: (state, api) => themeEditor(state, api),
  links: state => tableEditor(state),
};

// Fill an empty id from the name when leaving the name field.
document.addEventListener('focusout', e => {
  const input = e.target;
  if (!(input instanceof HTMLInputElement)) return;
  const form = input.closest('.form');
  if (!form) return;
  const label = input.closest('label.field')?.querySelector('.label')?.textContent || '';
  if (!/^(Nome|Name)/.test(label)) return;
  const idInput = [...form.querySelectorAll(':scope > .fgroup label.field, :scope > label.field')]
    .find(l => l.querySelector('.label')?.textContent.trim().replace(' *', '') === 'id')?.querySelector('input');
  if (idInput && !idInput.value && input.value) { idInput.value = formulaId(input.value); idInput.dispatchEvent(new Event('input', { bubbles: true })); }
});

// ---------- spreadsheet import / export of a collection ----------
function spreadsheetBox(state, api, col) {
  const pkg = state.pkg;
  const collection = pkg.collections?.[col] || {};
  const area = h('textarea.code', { rows: 6, spellcheck: 'false', placeholder: L('Cole aqui as linhas da planilha, com a linha de títulos no topo', 'Paste the spreadsheet rows here, with the header row first') });
  const msg = h('p.small');
  const file = h('input', { type: 'file', accept: '.csv,.tsv,.txt', hidden: true, onchange: async e => { const f = e.target.files[0]; if (f) area.value = await f.text(); e.target.value = ''; } });
  const download = () => {
    const pt = getLang() === 'pt-BR';
    const text = (pt ? '\uFEFF' : '') + toCsv(tableOf(collection, pkg.entities?.[col] || [], getLang()), pt ? ';' : ',');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    const a = h('a', { href: url, download: `${col}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const run = () => {
    const rows = parseTable(area.value);
    if (rows.length < 2) { msg.textContent = L('Preciso da linha de títulos e de pelo menos uma linha de item.', 'I need the header row and at least one item row.'); msg.className = 'small bad'; return; }
    const r = importRows(rows, collection, pkg.entities?.[col] || []);
    ensure(pkg, 'entities', {});
    if (!Array.isArray(pkg.entities[col])) pkg.entities[col] = [];
    pkg.entities[col].splice(0, pkg.entities[col].length, ...r.list);
    ctxChanged();
    api.rerender();
    // the section was redrawn: report in a toast-like line at the top
    setTimeout(() => {
      const note = document.querySelector('#section .import-result');
      if (note) {
        note.textContent = L(`${r.added} novo(s), ${r.updated} atualizado(s)`, `${r.added} added, ${r.updated} updated`)
          + (r.skipped ? L(`, ${r.skipped} linha(s) sem nome ignorada(s)`, `, ${r.skipped} row(s) without a name skipped`) : '')
          + (r.ignored.length ? L(`. Colunas não reconhecidas: ${r.ignored.join(', ')}`, `. Unknown columns: ${r.ignored.join(', ')}`) : '.');
        note.className = 'small ok import-result';
      }
    }, 0);
  };
  return h('details.sheet', { open: !!state.sheetOpen, ontoggle: e => { state.sheetOpen = e.target.open; } },
    h('summary', L('Planilha: importar ou editar vários itens de uma vez', 'Spreadsheet: import or edit many items at once')),
    h('p.small.muted', L(
      'Baixe a planilha desta coleção, edite no Excel ou Google Planilhas e cole as linhas de volta aqui (ou abra o .csv). '
      + 'Os títulos das colunas podem ser o id ou o rótulo dos campos, além de Nome, Descrição, Tags e Requisito. '
      + 'Linhas com um id que já existe atualizam só as colunas preenchidas; as outras viram itens novos.',
      'Download this collection as a spreadsheet, edit it, and paste the rows back (or open the .csv). '
      + 'Column titles may be field ids or labels, plus Name, Description, Tags and Requires. '
      + 'Rows whose id exists update only the filled columns; the rest become new items.')),
    h('div.row', h('button.small', { type: 'button', onclick: download }, L('Baixar planilha (.csv)', 'Download spreadsheet (.csv)')),
      file, h('button.small', { type: 'button', onclick: () => file.click() }, L('Abrir .csv', 'Open .csv'))),
    area,
    h('div.row', h('button.primary.small', { type: 'button', onclick: run }, L('Importar linhas', 'Import rows'))),
    h('p.small.import-result'), msg);
}

let ctxChanged = () => {};

// ---------- extension patches ----------
function sectionSpec(target, base) {
  const [sec, id] = String(target || '').split('/');
  if (!id) return null;
  if (SPECS[sec] && ['attributes', 'skills', 'derived', 'resources', 'counters'].includes(sec)) return SPECS[sec];
  if (sec === 'collections') return collectionSpec(id);
  if (base?.collections?.[sec] || !base) return entitySpec(sec);
  return null;
}

function targetOptions(base) {
  if (!base) return [];
  const out = [{ value: 'layout', label: L('Layout inteiro', 'Whole layout') }, { value: 'creation', label: L('Criação inteira', 'Whole creation') }];
  for (const s of ['attributes', 'skills', 'derived', 'resources', 'counters']) for (const o of base[s] || []) out.push({ value: `${s}/${o.id}`, label: o.name || '' });
  for (const c of Object.keys(base.collections || {})) out.push({ value: `collections/${c}`, label: base.collections[c]?.name || '' });
  out.push(...entityRefs());
  return out;
}

function patchSpec(state) {
  return pt => {
    const base = state.base;
    const f = [{ key: 'op', label: L('Operação', 'Operation'), kind: 'select', options: PATCH_OPS, noEmpty: true, rerender: true, group: 'top' }];
    if (pt.op === 'add') {
      f.push({ key: 'collection', label: L('Coleção (ou attributes, skills…)', 'Collection (or attributes, skills…)'), kind: 'ref', group: 'top', rerender: true,
        options: () => [...collectionOptions(), ...['attributes', 'skills', 'derived', 'resources', 'counters'].map(s => ({ value: s }))] });
      const spec = SPECS[pt.collection] && ['attributes', 'skills', 'derived', 'resources', 'counters'].includes(pt.collection) ? SPECS[pt.collection] : entitySpec(pt.collection);
      f.push({ key: 'entity', label: L('Novo item', 'New item'), kind: 'object', required: true, empty: { id: '', name: '' }, spec });
      return f;
    }
    f.push({ key: 'target', label: L('Alvo', 'Target'), kind: 'ref', options: () => targetOptions(base), group: 'top', rerender: true,
      help: base ? L('Escolha da lista do sistema base.', 'Pick from the base system list.') : L('coleção/id. Carregue o sistema base para escolher de uma lista.', 'collection/id. Load the base system to pick from a list.') });
    const spec = sectionSpec(pt.target, base);
    const raw = !spec || pt.target === 'layout' || pt.target === 'creation';
    if (pt.op === 'modify') {
      f.push(raw ? { key: 'fields', label: L('Campos alterados (JSON)', 'Changed fields (JSON)'), kind: 'json', rows: 8 }
        : { key: 'fields', label: L('Só os campos que mudam', 'Only the fields that change'), kind: 'object', required: true, empty: {}, spec: () => spec({}).filter(x => x.key !== 'id'),
          help: L('Deixe vazio o que não muda. Se mexer em Efeitos, a lista inteira é substituída.', 'Leave unchanged fields empty. Touching Effects replaces the whole list.') });
      if (base && !raw) f.push({ key: '_copy', kind: 'custom', render: o => h('button.small', { type: 'button', onclick: () => {
        const cur = findTarget(base, o.target);
        if (cur) { const c = structuredClone(cur); delete c.id; o.fields = c; put(o, 'fields', o.fields); state.rerender(); }
      } }, L('Copiar os valores atuais do alvo', 'Copy the target\'s current values')) });
    }
    if (pt.op === 'rename') f.push({ key: 'name', label: L('Novo nome', 'New name'), kind: 'text', required: true });
    if (pt.op === 'replace') f.push(raw ? { key: 'entity', label: L('Novo conteúdo (JSON)', 'New content (JSON)'), kind: 'json', rows: 8 }
      : { key: 'entity', label: L('Novo conteúdo', 'New content'), kind: 'object', required: true, empty: { name: '' }, spec: () => spec({}).filter(x => x.key !== 'id') });
    return f;
  };
}

function findTarget(base, target) {
  const [sec, id] = String(target || '').split('/');
  if (['attributes', 'skills', 'derived', 'resources', 'counters'].includes(sec)) return (base[sec] || []).find(o => o.id === id);
  if (sec === 'collections') return base.collections?.[id];
  return (base.entities?.[sec] || []).find(e => e.id === id);
}

function patchesEditor(state, api) {
  const pkg = state.pkg;
  autoBase(state, api);
  const status = h('p.small');
  const file = h('input', { type: 'file', accept: '.json', hidden: true, onchange: async e => {
    const f = e.target.files[0]; if (!f) return;
    try { setBase(state, JSON.parse(await f.text())); api.rerender(); } catch (err) { status.textContent = err.message; status.className = 'small bad'; }
  } });
  const hubSelect = h('select', h('option', { value: '' }, L('Escolher do StatForge Hub…', 'Pick from the StatForge Hub…')));
  fetch('../index.json').then(r => r.json()).then(idx => {
    for (const p of idx.packages || []) if (p.type === 'system') hubSelect.appendChild(h('option', { value: p.url, selected: p.id === pkg.system }, `${p.name} (${p.id})`));
  }).catch(() => {});
  hubSelect.addEventListener('change', async () => {
    if (!hubSelect.value) return;
    try { const r = await fetch(`../${hubSelect.value}`); setBase(state, await r.json()); api.rerender(); } catch (err) { status.textContent = err.message; status.className = 'small bad'; }
  });
  const base = state.base;
  return h('div',
    intro(L('Cada mudança altera, renomeia, substitui, remove ou adiciona algo no sistema base.', 'Each change modifies, renames, replaces, removes or adds something in the base system.')),
    h('section.card.base',
      base ? h('p', '✓ ', L('Sistema base carregado: ', 'Base system loaded: '), h('strong', base.name), ` (${base.id} v${base.version})`)
        : h('p', L('Carregue o sistema base para escolher alvos de uma lista e editar com formulários.', 'Load the base system to pick targets from a list and edit with forms.')),
      h('div.row', hubSelect, file, h('button.small', { type: 'button', onclick: () => file.click() }, L('Abrir .json do sistema', 'Open system .json'))),
      status),
    listEditor(pkg, { key: 'patches', keepEmpty: true, spec: patchSpec(state),
      summary: p => `${PATCH_OPS().find(o => o.value === p.op)?.label || p.op}: ${p.target || (p.collection ? `${p.collection}/${p.entity?.id || '?'}` : '?')}${p.name ? ` → ${p.name}` : ''}`,
      types: PATCH_OPS().map(o => ({ label: o.label, make: () => (o.value === 'add' ? { op: 'add', collection: '', entity: { id: '', name: '' } } : { op: o.value, target: '' }) })) }));
}

const BASE_KEY = 'statforge-builder:base';

function setBase(state, sys) {
  if (sys?.type !== 'system') throw new Error(L('Este arquivo não é um sistema.', 'This file is not a system.'));
  state.base = sys;
  previewCache = null;
  if (!state.pkg.system) { setKey(state.pkg, 'system', sys.id); ctxChanged(); }
  // Remembered for the next visit (may fail: big file, private mode).
  try { localStorage.setItem(BASE_KEY, JSON.stringify(sys)); } catch { /* the hub copy is fetched again next time */ }
}

/** Finds the extension's base system by itself: the remembered copy, or the hub package with that id. */
let autoTried = null;
async function autoBase(state, api) {
  const want = state.pkg?.system;
  if (!want || state.base || autoTried === `${want}`) return;
  autoTried = `${want}`;
  try {
    const saved = JSON.parse(localStorage.getItem(BASE_KEY) || 'null');
    if (saved?.id === want) { state.base = saved; previewCache = null; api.rerender(); return; }
  } catch { /* no saved copy */ }
  try {
    const idx = await (await fetch('../index.json')).json();
    const hit = (idx.packages || []).find(p => p.id === want && p.type === 'system');
    if (!hit) return;
    const sys = await (await fetch(`../${hit.url}`)).json();
    if (state.pkg?.system === want && !state.base) { setBase(state, sys); api.rerender(); }
  } catch { /* offline: the person can still open the file */ }
}

// ---------- theme ----------
const VAR_LABEL = () => ({
  '--bg': L('Fundo', 'Background'), '--surface': L('Cartões', 'Cards'), '--surface-2': L('Cartões (destaque)', 'Cards (alt)'),
  '--text': L('Texto', 'Text'), '--text-muted': L('Texto secundário', 'Muted text'), '--border': L('Bordas', 'Borders'),
  '--accent': L('Destaque', 'Accent'), '--accent-text': L('Texto sobre destaque', 'Text on accent'),
  '--danger': L('Perigo', 'Danger'), '--warning': L('Aviso', 'Warning'), '--ok': L('Ok', 'Ok'),
});

function colorRows(colors, onChange) {
  const lab = VAR_LABEL();
  return h('div.colors', THEME_VARS.map(v => {
    const text = h('input', { type: 'text', value: colors[v] ?? '', spellcheck: 'false', placeholder: '#000000' });
    const pick = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(colors[v] || '') ? colors[v] : '#000000' });
    pick.addEventListener('input', () => { text.value = pick.value; colors[v] = pick.value; onChange(); });
    text.addEventListener('input', () => { if (text.value) colors[v] = text.value; else delete colors[v]; if (/^#[0-9a-f]{6}$/i.test(text.value)) pick.value = text.value; onChange(); });
    return h('label.color', h('span', lab[v], h('code.small.muted', ` ${v}`)), h('div.row', pick, text));
  }));
}

function themePreview(colors, font) {
  const css = Object.entries(colors || {}).map(([k, v]) => `${k}:${v}`).join(';');
  return h('div.tpreview', { style: `${css};${font ? `--font:${font}` : ''}` },
    h('div.tp-card', h('strong', L('Ficha de exemplo', 'Sample sheet')), h('p.tp-muted', L('Texto secundário', 'Muted text')),
      h('div.row', h('span.tp-btn', L('Botão', 'Button')), h('span.tp-ok', 'OK'), h('span.tp-warn', '!'), h('span.tp-bad', '✗')),
      h('div.tp-bar', h('div'))));
}

function themeEditor(state, api) {
  const pkg = state.pkg;
  const colors = ensure(pkg, 'colors', {});
  const dual = !!(colors.light || colors.dark);
  const box = h('div');
  const prev = h('div.tprevs');
  const drawPreview = () => prev.replaceChildren(...(dual ? [colors.light, colors.dark] : [colors]).filter(Boolean).map(c => themePreview(c, pkg.font)));
  const changed = () => { put(pkg, 'colors', pkg.colors, true); drawPreview(); };
  box.append(
    intro(L('As cores e a fonte do app. A prévia mostra como fica.', 'App colors and font. The preview shows the result.')),
    objectForm(pkg, [
      { key: 'font', label: L('Fonte', 'Font'), kind: 'text', placeholder: 'Georgia, serif', help: L('Uma lista de fontes CSS. Vazio: a do app.', 'A CSS font list. Empty: the app\'s.') },
      ...(dual ? [] : [{ key: 'scheme', label: L('Esquema', 'Scheme'), kind: 'select', emptyLabel: L('Escuro (padrão)', 'Dark (default)'), options: () => [{ value: 'light', label: L('Claro', 'Light') }] }]),
    ], { extra: false }),
    h('label.check', h('input', { type: 'checkbox', checked: dual, onchange: e => {
      if (e.target.checked) { const c = { ...colors }; for (const k of Object.keys(colors)) delete colors[k]; colors.light = c; colors.dark = structuredClone(c); delete pkg.scheme; }
      else { const c = colors.dark || colors.light || {}; for (const k of Object.keys(colors)) delete colors[k]; Object.assign(colors, c); }
      changed(); api.rerender();
    } }), h('span', h('strong', L('Versões clara e escura (o app troca com o aparelho)', 'Light and dark versions (the app follows the device)')))),
    h('div.themegrid',
      h('div', dual
        ? [h('h3', L('Clara', 'Light')), colorRows(colors.light ||= {}, changed), h('h3', L('Escura', 'Dark')), colorRows(colors.dark ||= {}, changed)]
        : colorRows(colors, changed)),
      prev),
  );
  drawPreview();
  return box;
}

// ---------- table ----------
function tableEditor(state) {
  const pkg = state.pkg;
  const out = h('code.small');
  const link = h('input', { type: 'url', placeholder: 'https://raw.githubusercontent.com/…/mesa.json' });
  const app = h('input', { type: 'url', value: 'https://gabrielgugg.github.io/statforge', placeholder: 'https://…' });
  const update = () => { out.textContent = link.value ? `${app.value.replace(/\/$/, '')}/site/?table=${encodeURIComponent(link.value)}` : ''; };
  link.addEventListener('input', update); app.addEventListener('input', update);
  return h('div',
    intro(L('Uma mesa junta sistema, extensões e tema num link só. Links relativos são resolvidos a partir do link da mesa.', 'A table bundles system, extensions and theme in one link.')),
    objectForm(pkg, tableSpec(), { extra: false }),
    h('section.card',
      h('h3', L('Link pronto para os jogadores', 'Ready link for players')),
      h('label.field', h('span.label', L('Onde a mesa vai ficar hospedada', 'Where the table will be hosted')), link),
      h('label.field', h('span.label', L('Endereço do app StatForge', 'StatForge app address')), app),
      out));
}

export { slug, valueIds, fieldOptions };
