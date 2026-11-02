// ============================================================
// Assistant (wizard) model: turns the simple answers of the assistant
// into a real package. Pure functions, no DOM, so the tests can use them.
// ============================================================
import { newPackage, slug, formulaId } from './model.js';

/** Ready-made attribute sets. Names follow the interface language. */
export const ATTRIBUTE_PRESETS = {
  d20: {
    dice: '1d20', modifier: 'floor((value - 10) / 2)',
    attrs: lang => (lang === 'pt-BR'
      ? [['Força', 'FOR'], ['Destreza', 'DES'], ['Constituição', 'CON'], ['Inteligência', 'INT'], ['Sabedoria', 'SAB'], ['Carisma', 'CAR']]
      : [['Strength', 'STR'], ['Dexterity', 'DEX'], ['Constitution', 'CON'], ['Intelligence', 'INT'], ['Wisdom', 'WIS'], ['Charisma', 'CHA']])
      .map(([name, abbr]) => ({ name, abbr, min: 1, max: 20, default: 10 })),
  },
  special: {
    dice: '1d20', modifier: 'value - 5',
    attrs: lang => (lang === 'pt-BR'
      ? [['Força', 'FOR'], ['Percepção', 'PER'], ['Resistência', 'RES'], ['Carisma', 'CAR'], ['Inteligência', 'INT'], ['Agilidade', 'AGI'], ['Sorte', 'SOR']]
      : [['Strength', 'STR'], ['Perception', 'PER'], ['Endurance', 'END'], ['Charisma', 'CHA'], ['Intelligence', 'INT'], ['Agility', 'AGI'], ['Luck', 'LCK']])
      .map(([name, abbr]) => ({ name, abbr, min: 1, max: 10, default: 5 })),
  },
  simple: {
    dice: '2d6', modifier: 'value',
    attrs: lang => (lang === 'pt-BR'
      ? [['Corpo', 'COR'], ['Mente', 'MEN'], ['Agilidade', 'AGI'], ['Presença', 'PRE']]
      : [['Body', 'BOD'], ['Mind', 'MIN'], ['Agility', 'AGI'], ['Presence', 'PRE']])
      .map(([name, abbr]) => ({ name, abbr, min: 0, max: 5, default: 1 })),
  },
};

export const DICE = ['1d20', '2d6', '3d6', '1d100', '1d10', '1d6'];
export const MODIFIERS = [
  { id: 'd20', formula: 'floor((value - 10) / 2)' },
  { id: 'minus5', formula: 'value - 5' },
  { id: 'value', formula: 'value' },
];

/** The assistant's answers for a new system. */
export function emptyAnswers(lang = 'pt-BR') {
  return {
    name: '', author: '', language: lang, description: '',
    dice: '1d20', modifier: 'floor((value - 10) / 2)',
    attributes: [], skills: [], resources: [],
    creation: { attributes: true, points: 6, skills: false, skillPoints: 4, maxPerSkill: 2, story: true },
  };
}

/** Id usable in formulas, upper case for attributes ("Força"/"FOR" → "FOR"). */
export const attrId = a => formulaId(a.abbr || a.name).toUpperCase();
const lowId = x => formulaId(x);

function unique(base, used) {
  let id = base || 'x', n = 2;
  while (used.has(id)) id = `${base}_${n++}`;
  used.add(id);
  return id;
}

/** Builds the system package from the answers. */
export function buildSystem(a) {
  const pt = a.language === 'pt-BR';
  const pkg = newPackage('system', { name: a.name.trim(), author: a.author.trim(), language: a.language });
  pkg.description = a.description.trim();
  pkg.rolls = { default: a.dice || '1d20', modifier: a.modifier || 'value' };
  const used = new Set(['level', 'xp', 'value', 'points']);
  const attrs = a.attributes.filter(x => x.name.trim()).map(x => ({
    id: unique(attrId(x), used), name: x.name.trim(), abbr: (x.abbr || '').trim() || undefined,
    min: num(x.min, 0), max: num(x.max, 10), default: num(x.default, num(x.min, 0)),
  }));
  const attrIds = new Set(attrs.map(x => x.id));
  pkg.attributes = attrs.map(clean);
  pkg.skills = a.skills.filter(x => x.name.trim()).map(x => clean({
    id: unique(lowId(x.name), used), name: x.name.trim(), attribute: attrIds.has(x.attribute) ? x.attribute : undefined,
  }));
  pkg.resources = a.resources.filter(x => x.name.trim()).map(x => clean({
    id: unique(lowId(x.abbr || x.name), used), name: x.name.trim(), abbr: (x.abbr || '').trim() || undefined,
    max: String(x.max ?? '').trim() || '0',
  }));
  // Sheet layout: resources as tiles on top, attributes and skills side by side, notes and dice.
  const blocks = [];
  for (const r of pkg.resources) blocks.push({ id: `res_${r.id}`, block: 'resources', items: [r.id], w: 3 });
  if (pkg.attributes.length) blocks.push({ id: 'attributes', block: 'attributes', w: 6 });
  if (pkg.skills.length) blocks.push({ id: 'skills', block: 'skills', w: 6 });
  if (a.creation.story) blocks.push({ id: 'story', block: 'notes', title: pt ? 'História' : 'Backstory', w: 12 });
  blocks.push({ id: 'roller', block: 'roller', w: 12, shortcuts: pkg.attributes.slice(0, 4).map(x => `${pkg.rolls.default} + mod(${x.id})`) });
  pkg.layout = { tabs: [{ id: 'main', name: pt ? 'Ficha' : 'Sheet', blocks }] };
  // Character creation assistant.
  const steps = [];
  if (a.creation.attributes && pkg.attributes.length) {
    steps.push({ type: 'attributes', title: pt ? 'Atributos' : 'Attributes', points: num(a.creation.points, 0) });
  }
  if (a.creation.skills && pkg.skills.length) {
    steps.push({ type: 'skills', title: pt ? 'Perícias' : 'Skills', points: num(a.creation.skillPoints, 0), max_per_skill: num(a.creation.maxPerSkill, 1) });
  }
  if (a.creation.story) {
    steps.push({ type: 'notes', title: pt ? 'História' : 'Backstory', items: [{ id: 'story', title: pt ? 'História' : 'Backstory', placeholder: pt ? 'Quem é o seu personagem?' : 'Who is your character?' }] });
  }
  if (steps.length) pkg.creation = { steps };
  return pkg;
}

const num = (v, d) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? d : Number(v));
function clean(o) { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; }

// ---------- themes ----------

const hex = c => /^#[0-9a-f]{6}$/i.test(c || '');
function mix(a, b, t) {
  const p = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const m = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}
const light = c => { const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); return (r * 299 + g * 587 + b * 114) / 1000 > 140; };

/** Full theme colors from three choices: background, text and accent. */
export function themeColors({ bg, text, accent }) {
  if (![bg, text, accent].every(hex)) throw new Error('color');
  const dark = !light(bg);
  return {
    '--bg': bg,
    '--surface': mix(bg, text, dark ? 0.06 : 0.03),
    '--surface-2': mix(bg, text, dark ? 0.11 : 0.07),
    '--text': text,
    '--text-muted': mix(text, bg, 0.4),
    '--border': mix(bg, text, dark ? 0.2 : 0.15),
    '--accent': accent,
    '--accent-text': light(accent) ? '#111111' : '#ffffff',
    '--danger': dark ? '#ff6b6b' : '#c62f2f',
    '--warning': dark ? '#f0b445' : '#a86a00',
    '--ok': dark ? '#5dd28e' : '#1e7a45',
  };
}

export const THEME_PRESETS = [
  { id: 'night', bg: '#101317', text: '#e8eaee', accent: '#7a9cff' },
  { id: 'paper', bg: '#f7f3ea', text: '#2b2620', accent: '#9b3d1e' },
  { id: 'terminal', bg: '#0a0f0a', text: '#4cff7a', accent: '#4cff7a' },
  { id: 'royal', bg: '#14101f', text: '#efe8ff', accent: '#d4af37' },
];

export const FONTS = [
  { id: '', css: '' },
  { id: 'serif', css: "Georgia, 'Times New Roman', serif" },
  { id: 'mono', css: "ui-monospace, 'Cascadia Code', Consolas, monospace" },
  { id: 'rounded', css: "'Trebuchet MS', 'Segoe UI', sans-serif" },
];

export function buildTheme({ name, author, bg, text, accent, font }) {
  const pkg = newPackage('theme', { name: name.trim(), author: author.trim(), language: '*' });
  pkg.colors = themeColors({ bg, text, accent });
  if (font) pkg.font = font;
  if (light(bg)) pkg.scheme = 'light';
  return pkg;
}

// ---------- tables ----------

/** A table package from hub entries: { system, extensions: [], theme }. URLs are absolute. */
export function buildTable({ name, author, language, description, system, extensions = [], theme = null }) {
  const pkg = newPackage('table', { name: name.trim(), author: author.trim(), language });
  pkg.description = (description || '').trim();
  pkg.system = { url: system.url };
  pkg.packages = extensions.map(e => ({ url: e.url }));
  if (theme) pkg.theme = { url: theme.url }; else delete pkg.theme;
  return pkg;
}

// ---------- extensions ----------

export function buildExtension({ name, author, language, description, system }) {
  const pkg = newPackage('extension', { name: name.trim(), author: author.trim(), language });
  pkg.description = (description || '').trim();
  pkg.system = system || '';
  return pkg;
}

export { slug };
