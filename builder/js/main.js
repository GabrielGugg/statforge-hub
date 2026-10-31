// ============================================================
// StatForge package builder: screens, state and draft saving.
// ============================================================
import { h, mount, toast } from './h.js';
import { t, setLang, getLang, otherLang, browserLang } from './i18n.js';
import { TYPES, SECTIONS, newPackage, parseImport, exportText, hubChecks, setKey, deleteKey, slug, stats } from './model.js';
import { loadEngine } from './engine.js';
import { EDITORS as SECTION_EDITORS, initContext } from './editors.js';

const DRAFT_KEY = 'statforge-builder:draft';
const LANG_KEY = 'statforge-builder:lang';

const state = {
  pkg: null,          // the package being edited
  indent: 2,          // indentation of the exported file (kept from an imported one)
  trailingNewline: true,
  section: 'meta',
  engine: null,
  check: { errors: [], warnings: [] },
};

const app = document.getElementById('app');
initContext(state, () => changed());

// ---------- storage (every access may throw: private mode, blocked storage) ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* nothing to do */ } },
};

function readDraft() {
  try { const d = JSON.parse(store.get(DRAFT_KEY) || 'null'); return d?.pkg ? d : null; } catch { return null; }
}

let saveTimer = null;
let warnedUnsaved = false;
function changed() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const ok = store.set(DRAFT_KEY, JSON.stringify({ pkg: state.pkg, indent: state.indent, trailingNewline: state.trailingNewline, section: state.section }));
    const badge = document.getElementById('save-state');
    if (badge) badge.textContent = ok ? t('draft.saved') : '';
    if (!ok && !warnedUnsaved) { warnedUnsaved = true; toast(t('draft.unsaved'), 'warning'); }
  }, 400);
  runCheck();
}

// ---------- validation ----------
let checkTimer = null;
function runCheck() {
  clearTimeout(checkTimer);
  checkTimer = setTimeout(() => {
    if (!state.pkg || !state.engine) return;
    const engine = state.engine;
    let res;
    try { res = engine.validatePackage(state.pkg); } catch (e) { res = { errors: [String(e.message || e)], warnings: [] }; }
    const hub = hubChecks(state.pkg);
    state.check = {
      errors: [...res.errors, ...hub.errors.map(k => t(k))],
      warnings: [...res.warnings, ...hub.warnings.map(k => t(k))],
    };
    renderCheck();
  }, 250);
}

function renderCheck() {
  const box = document.getElementById('check');
  if (!box) return;
  const { errors, warnings } = state.check;
  const engineNote = state.engine
    ? t('check.engine', { source: t(state.engine.remote ? 'check.engine.remote' : 'check.engine.local') })
    : t('check.loading');
  mount(box,
    h('h2', t('nav.check')),
    !state.engine ? null : !errors.length && !warnings.length ? h('p.ok', t('check.ok')) : null,
    errors.length ? [h('p.bad', t('check.errors', { n: errors.length })), h('ul.msgs.bad', errors.map(e => h('li', e)))] : null,
    warnings.length ? [h('p.warn', t('check.warnings', { n: warnings.length })), h('ul.msgs.warn', warnings.map(w => h('li', w)))] : null,
    h('p.muted.small', engineNote),
  );
  const badge = document.getElementById('check-badge');
  if (badge) {
    badge.textContent = errors.length ? `✗ ${errors.length}` : warnings.length ? `! ${warnings.length}` : '✓';
    badge.className = `badge ${errors.length ? 'bad' : warnings.length ? 'warn' : 'ok'}`;
  }
}

// ---------- opening packages ----------
function openPackage(pkg, { indent = 2, trailingNewline = true, section = 'meta' } = {}) {
  state.pkg = pkg;
  state.base = null;
  state.entityCol = null;
  state.indent = indent;
  state.trailingNewline = trailingNewline;
  state.section = (SECTIONS[pkg.type] || []).some(s => s.id === section) ? section : 'meta';
  changed();
  renderEditor();
}

function importText(text) {
  try {
    const { pkg, indent, trailingNewline } = parseImport(text);
    if (!TYPES.includes(pkg.type)) toast(t('import.bad', { error: `type "${pkg.type}"` }), 'bad');
    openPackage(pkg, { indent, trailingNewline });
    toast(t('import.done', { name: pkg.name || pkg.id || '?' }), 'ok');
  } catch (e) {
    toast(e.message === 'not-object' ? t('import.notObject') : t('import.bad', { error: e.message }), 'bad');
  }
}

/** GitHub page links become raw links, like the app does. */
function rawUrl(url) {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(url.trim());
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}` : url.trim();
}

async function importUrl(url) {
  try {
    const res = await fetch(rawUrl(url));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    importText(await res.text());
  } catch (e) { toast(t('import.url', { error: e.message }), 'bad'); }
}

// ---------- export ----------
function fileName() { return `${state.pkg.id || slug(state.pkg.name) || 'pacote'}.json`; }

function exportFile() {
  const n = state.check.errors.length;
  if (n && !confirm(t('export.withErrors', { n }))) return;
  const text = exportText(state.pkg, { indent: state.indent, trailingNewline: state.trailingNewline });
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: fileName() });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(t('export.done', { file: fileName() }), 'ok');
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(exportText(state.pkg, { indent: state.indent, trailingNewline: state.trailingNewline }));
    toast(t('export.copied'), 'ok');
  } catch (e) { toast(String(e.message || e), 'bad'); }
}

// ---------- header ----------
function header(inEditor) {
  return h('header.top',
    h('div.brand', h('strong', t('app.title'))),
    inEditor ? h('span#save-state.muted.small') : null,
    h('div.spacer'),
    inEditor ? h('button.ghost', { onclick: () => { if (confirm(t('leave.ask'))) renderHome(); } }, t('nav.home')) : null,
    inEditor ? h('button.ghost', { onclick: copyJson }, t('export.copy')) : null,
    inEditor ? h('button.primary', { onclick: exportFile }, t('nav.export')) : null,
    h('button.ghost', { onclick: () => { setLang(otherLang()); store.set(LANG_KEY, getLang()); state.engine?.setLanguage(getLang()); runCheck(); inEditor ? renderEditor() : renderHome(); }, title: 'Idioma / Language' }, t('app.lang')),
  );
}

// ---------- home ----------
function renderHome() {
  state.pkg = null;
  const draft = readDraft();
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true,
    onchange: async e => { const f = e.target.files[0]; if (f) importText(await f.text()); e.target.value = ''; } });
  const urlInput = h('input', { type: 'url', placeholder: t('home.urlPlaceholder') });
  const paste = h('textarea', { rows: 4, placeholder: t('home.pastePlaceholder') });

  mount(app,
    header(false),
    h('main.home',
      h('p.lead', t('app.tagline')),
      draft ? h('section.card.draft',
        h('p', t('home.draftOf', { name: draft.pkg.name || draft.pkg.id || '?', type: t(`type.${draft.pkg.type}`) })),
        h('div.row',
          h('button.primary', { onclick: () => openPackage(draft.pkg, draft) }, t('home.draft')),
          h('button.ghost.danger', { onclick: () => { if (confirm(t('home.discardAsk'))) { store.del(DRAFT_KEY); renderHome(); } } }, t('home.discard')),
        )) : null,
      h('h2', t('home.new')),
      h('div.types', TYPES.map(type => h('button.type-card', {
        onclick: () => {
          if (draft && !confirm(t('home.discardAsk'))) return;
          openPackage(newPackage(type, { language: getLang() }));
        },
      }, h('strong', t(`type.${type}`)), h('span', t(`type.${type}.desc`))))),
      h('h2', t('home.open')),
      h('section.card.open',
        h('div.row', fileInput, h('button', { onclick: () => fileInput.click() }, t('home.openFile'))),
        h('label', t('home.openUrl'), h('div.row', urlInput, h('button', { onclick: () => urlInput.value && importUrl(urlInput.value) }, t('home.load')))),
        h('label', t('home.paste'), paste, h('div.row', h('button', { onclick: () => paste.value.trim() && importText(paste.value) }, t('home.load')))),
      ),
      h('p.muted.small', t('home.hubNote')),
    ),
  );
}

// ---------- editor ----------
function renderEditor() {
  const pkg = state.pkg;
  const sections = SECTIONS[pkg.type] || [{ id: 'meta' }];
  const st = stats(pkg);
  mount(app,
    header(true),
    h('div.layout',
      h('nav.side',
        h('div.pkg-title',
          h('strong', pkg.name || '—'),
          h('span.muted.small', `${t(`type.${pkg.type}`)} · v${pkg.version || '?'}`),
          h('span.muted.small', Object.entries(st).filter(([, n]) => n).map(([k, n]) => t(`stats.${k}`, { n })).join(' · ')),
        ),
        h('ul', sections.map(s => h('li', h('button', {
          class: s.id === state.section ? 'active' : '',
          onclick: () => { state.section = s.id; changed(); renderEditor(); },
        }, t(`sec.${s.id}`)))),
        h('li', h('a.check-link', { href: '#check' }, t('nav.check'), ' ', h('span#check-badge.badge')))),
      ),
      h('main.editor', h('div#section'), h('aside#check.card')),
    ),
  );
  renderSection();
  renderCheck();
}

function renderSection() {
  const box = document.getElementById('section');
  const def = (SECTIONS[state.pkg.type] || []).find(s => s.id === state.section) || { id: 'meta' };
  const editor = EDITORS[def.id];
  const api = { changed, rerender: renderSection };
  state.rerender = renderSection;
  mount(box, h('h1', t(`sec.${def.id}`)),
    editor ? (def.id === 'meta' ? editor(def) : editor(state, api)) : rawEditor(def, false),
    def.id !== 'meta' && (def.key || def.keys) ? h('details.rawbox', h('summary.small.muted', t('raw.title')), rawEditor(def, true)) : null);
}

// ---------- section: details ----------
const LICENSES = ['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'CC0-1.0', 'MIT', 'All rights reserved'];

function field(label, input, help) {
  return h('label.field', h('span.label', label), input, help ? h('span.help', help) : null);
}

function textInput(key, attrs = {}) {
  return h('input', { type: 'text', value: state.pkg[key] ?? '', ...attrs,
    oninput: e => { setKey(state.pkg, key, e.target.value); changed(); attrs.after?.(e.target.value); } });
}

function metaEditor() {
  const pkg = state.pkg;
  const idInput = textInput('id', { pattern: '[A-Za-z0-9][A-Za-z0-9_.\\-]*', spellcheck: 'false' });
  // While the id was never typed by hand, it follows the name.
  let follows = !pkg.id || pkg.id === slug(pkg.name);
  const name = textInput('name', { after: v => { if (follows) { setKey(pkg, 'id', slug(v)); idInput.value = pkg.id; } } });
  idInput.addEventListener('input', () => { follows = false; });

  const license = h('input', { type: 'text', value: pkg.license ?? '', list: 'licenses',
    oninput: e => { setKey(pkg, 'license', e.target.value); changed(); } });
  const desc = h('textarea', { rows: 4, value: pkg.description ?? '',
    oninput: e => { setKey(pkg, 'description', e.target.value); changed(); } });

  return h('div.form',
    field(t('meta.type'), h('input', { type: 'text', value: t(`type.${pkg.type}`), disabled: true })),
    field(t('meta.name'), name, t('meta.name.help')),
    field(t('meta.id'), h('div.row', idInput, h('button.ghost', { type: 'button', onclick: () => { pkg.id = slug(pkg.name); idInput.value = pkg.id; changed(); } }, t('meta.id.auto'))), t('meta.id.help')),
    h('div.grid3',
      field(t('meta.version'), textInput('version', { placeholder: '1.0.0' }), t('meta.version.help')),
      field(t('meta.author'), textInput('author')),
      field(t('meta.language'), textInput('language', { list: 'langs', placeholder: 'pt-BR' }), t('meta.language.help')),
    ),
    field(t('meta.license'), license, t('meta.license.help')),
    h('datalist#licenses', LICENSES.map(l => h('option', { value: l }))),
    h('datalist#langs', ['pt-BR', 'en', 'es', 'fr', 'de', 'it'].map(l => h('option', { value: l }))),
    field(t('meta.description'), desc),
  );
}

// ---------- fallback: edit a part of the package as JSON ----------
function rawEditor(def, always = true) {
  const pkg = state.pkg;
  const keys = def.keys || (def.key ? [def.key] : []);
  const single = keys.length === 1;
  const current = () => (single ? pkg[keys[0]] : Object.fromEntries(keys.filter(k => k in pkg).map(k => [k, pkg[k]])));
  const exists = single ? keys[0] in pkg : true;
  const area = h('textarea.code', { rows: 24, spellcheck: 'false', value: exists ? JSON.stringify(current(), null, 2) : '' });
  const msg = h('p.small');

  const apply = () => {
    let v;
    try { v = JSON.parse(area.value); } catch (e) { msg.textContent = t('raw.bad', { error: e.message }); msg.className = 'small bad'; return; }
    if (single) setKey(pkg, keys[0], v);
    else {
      for (const k of keys) if (!(k in v)) deleteKey(pkg, k);
      for (const k of keys) if (k in v) setKey(pkg, k, v[k]);
    }
    msg.textContent = t('raw.applied'); msg.className = 'small ok';
    changed();
    if (always) renderSection();
  };

  if (single && !exists) {
    return h('div',
      h('p.muted', t('raw.missing')),
      h('button.primary', { onclick: () => { setKey(pkg, keys[0], structuredClone(def.empty ?? {})); changed(); renderSection(); } }, t('raw.create')));
  }
  return h('div.raw',
    h('p.muted', t(always ? 'raw.helpAlways' : 'raw.help')),
    area,
    h('div.row',
      h('button.primary', { onclick: apply }, t('raw.apply')),
      h('button.ghost', { onclick: () => { area.value = JSON.stringify(current(), null, 2); msg.textContent = ''; } }, t('raw.revert')),
      single ? h('button.ghost.danger', { onclick: () => { deleteKey(pkg, keys[0]); changed(); renderSection(); } }, t('raw.remove')) : null,
    ),
    msg,
  );
}

const EDITORS = { ...SECTION_EDITORS, meta: metaEditor };

// ---------- start ----------
setLang(store.get(LANG_KEY) || browserLang());
renderHome();
loadEngine().then(engine => {
  engine.setLanguage(getLang());
  state.engine = engine;
  runCheck();
  renderCheck();
}).catch(e => { console.error(e); toast(String(e.message || e), 'bad'); });
