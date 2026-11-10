// ============================================================
// Compendium packages: ready-made sheets (creatures, NPCs, enemies) for one system, used only in GM mode.
//
// { "type": "compendium", "system": "<system id>", "entries": [ { id, name, kind, tags, description, sheet } ] }
// entry.sheet holds only what differs from an empty sheet: level, attributes, skills, resources, items
// (that refer to the system's entities) and notes. The values (HP, defense, initiative…) are calculated
// with the system's own rules, so an entry works like any sheet; a stat block whose numbers do not follow
// those rules writes them in sheet.fixed ({ "<skill, derived or resource id>": number }), which replaces
// the formula (effects still go on top).
// entry.sections: the stat block's text (traits, actions, loot…): [{ title, items: [{ name, text }] }].
// Everything is data: text is shown with textContent, never as HTML.
// ============================================================
import { emptySheet } from './calc.js';
import { t } from '../i18n.js';

export const ENTRY_KINDS = ['creature', 'npc', 'enemy', 'other'];
export const MAX_ENTRIES = 2000;
export const MAX_SECTIONS = 20, MAX_SECTION_ITEMS = 60;
const ID_OK = /^[\w.-]{1,80}$/;
const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩]/g, '').slice(0, max) : '');
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

/** Structure checks, called by validatePackage for type "compendium". */
export function checkCompendium(p, errors, warnings) {
  if (typeof p.system !== 'string' || !p.system) errors.push(t('val.compendiumSystem'));
  if (!Array.isArray(p.entries)) { errors.push(t('val.notList', { what: 'entries' })); return; }
  if (p.entries.length > MAX_ENTRIES) errors.push(t('val.tooMany', { what: 'entries', max: MAX_ENTRIES }));
  const seen = new Set();
  p.entries.forEach((e, i) => {
    const where = `entries[${i}]`;
    if (!isObj(e)) { errors.push(t('val.notObjectAt', { where })); return; }
    if (!e.id || !ID_OK.test(e.id)) errors.push(t('val.noId', { what: where }));
    else if (seen.has(e.id)) errors.push(t('val.dupId', { what: 'entries', id: e.id }));
    else seen.add(e.id);
    if (!e.name) errors.push(t('val.needs', { where, op: 'entry', field: 'name' }));
    if (e.kind !== undefined && !ENTRY_KINDS.includes(e.kind)) warnings.push(t('val.entryKind', { where, kinds: ENTRY_KINDS.join(', ') }));
    if (e.tags !== undefined && (!Array.isArray(e.tags) || e.tags.some(x => typeof x !== 'string'))) errors.push(t('val.notList', { what: `${where}.tags` }));
    if (e.sheet !== undefined && !isObj(e.sheet)) errors.push(t('val.notObjectAt', { where: `${where}.sheet` }));
    for (const k of ['attributes', 'skills', 'resources', 'notes']) if (e.sheet?.[k] !== undefined && !isObj(e.sheet[k])) errors.push(t('val.notObjectAt', { where: `${where}.sheet.${k}` }));
    if (e.sheet?.items !== undefined && !Array.isArray(e.sheet.items)) errors.push(t('val.notList', { what: `${where}.sheet.items` }));
    if (e.sheet?.fixed !== undefined) {
      if (!isObj(e.sheet.fixed)) errors.push(t('val.notObjectAt', { where: `${where}.sheet.fixed` }));
      else for (const [k, v] of Object.entries(e.sheet.fixed)) if (typeof v !== 'number' || !Number.isFinite(v)) errors.push(t('val.notNumberAt', { where: `${where}.sheet.fixed.${k}` }));
    }
    if (e.sections !== undefined) {
      if (!Array.isArray(e.sections)) errors.push(t('val.notList', { what: `${where}.sections` }));
      else {
        if (e.sections.length > MAX_SECTIONS) errors.push(t('val.tooMany', { what: `${where}.sections`, max: MAX_SECTIONS }));
        e.sections.forEach((sec, j) => {
          const w = `${where}.sections[${j}]`;
          if (!isObj(sec)) { errors.push(t('val.notObjectAt', { where: w })); return; }
          if (!Array.isArray(sec.items)) { errors.push(t('val.notList', { what: `${w}.items` })); return; }
          if (sec.items.length > MAX_SECTION_ITEMS) errors.push(t('val.tooMany', { what: `${w}.items`, max: MAX_SECTION_ITEMS }));
          sec.items.forEach((it, k) => { if (!isObj(it) || (!it.name && !it.text)) errors.push(t('val.needs', { where: `${w}.items[${k}]`, op: 'item', field: 'name, text' })); });
        });
      }
    }
    (e.sheet?.items || []).forEach((it, j) => { if (!it?.collection || !it?.ref) errors.push(t('val.needs', { where: `${where}.sheet.items[${j}]`, op: 'item', field: 'collection, ref' })); });
  });
  if (p.tables !== undefined && !Array.isArray(p.tables)) errors.push(t('val.notList', { what: 'tables' }));
}

/** An entry's text sections (traits, actions, loot…), cleaned: [{ title, items: [{ name, text }] }]. */
export function cleanSections(list) {
  return (Array.isArray(list) ? list : []).filter(isObj).slice(0, MAX_SECTIONS).map(sec => ({
    title: str(sec.title, 80),
    items: (Array.isArray(sec.items) ? sec.items : []).filter(isObj).slice(0, MAX_SECTION_ITEMS)
      .map(it => ({ name: str(it.name, 160), text: str(it.text, 3000) })).filter(it => it.name || it.text),
  })).filter(sec => sec.items.length);
}

/** The entries, cleaned for showing in lists. */
export const entries = pkg => (Array.isArray(pkg?.entries) ? pkg.entries : []).filter(e => isObj(e) && ID_OK.test(e.id || '')).map(e => ({
  id: e.id, name: str(e.name, 120) || e.id, kind: ENTRY_KINDS.includes(e.kind) ? e.kind : 'other',
  tags: Array.isArray(e.tags) ? e.tags.map(x => str(x, 40)).filter(Boolean).slice(0, 20) : [],
  description: str(e.description, 5000), level: Number(e.sheet?.level) || 1, sections: cleanSections(e.sections),
}));

/**
 * A new sheet from an entry, with the rules of the system (and the extensions the GM chose).
 * Only ids the rules know are kept; an item whose entity does not exist is left out and reported.
 * Returns { sheet, missing: ['collection/ref', …] }.
 */
export function entrySheet(rules, pkg, entryId, extra = {}) {
  const e = (pkg.entries || []).find(x => x?.id === entryId);
  if (!e) throw new Error('ENTRY_NOT_FOUND');
  const src = isObj(e.sheet) ? e.sheet : {};
  const sheet = emptySheet(rules, { name: str(e.name, 120) || e.id, ...extra });
  sheet.level = Math.max(1, Math.round(Number(src.level) || 1));
  const num = v => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  for (const [k, v] of Object.entries(isObj(src.attributes) ? src.attributes : {})) if (rules.attributes[k] && num(v) !== null) sheet.attributes[k] = num(v);
  for (const [k, v] of Object.entries(isObj(src.skills) ? src.skills : {})) if (rules.skills[k] && num(v) !== null) sheet.skills[k] = num(v);
  for (const [k, v] of Object.entries(isObj(src.resources) ? src.resources : {})) if (rules.resources[k] && num(v) !== null) sheet.resources[k] = num(v);
  for (const [k, v] of Object.entries(isObj(src.fixed) ? src.fixed : {})) {
    if ((rules.skills[k] || rules.derived?.[k] || rules.resources[k]) && num(v) !== null) (sheet.fixed ||= {})[k] = num(v);
  }
  for (const [k, v] of Object.entries(isObj(src.notes) ? src.notes : {})) if (ID_OK.test(k) && typeof v === 'string') sheet.notes[k] = str(v, 20000);
  const missing = [];
  for (const it of Array.isArray(src.items) ? src.items : []) {
    const col = String(it?.collection || ''), ref = String(it?.ref || '');
    if (!rules.entities[col]?.[ref]) { missing.push(`${col}/${ref}`); continue; }
    sheet.items.push({ uid: Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4), collection: col, ref,
      qty: Math.max(1, Math.round(Number(it.qty) || 1)), equipped: !!it.equipped,
      ...(Number(it.wear) > 0 ? { wear: Math.min(100, Math.round(Number(it.wear))) } : {}) });
  }
  return { sheet, missing, description: str(e.description, 5000), sections: cleanSections(e.sections) };
}
