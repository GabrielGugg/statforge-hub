// ============================================================
// App interface translations. Packages are not translated here:
// each package declares its own "language".
//   t('key', { name: 'X' })  →  "Text with X"
//   A string may be { one, other } and is picked by vars.n.
// ============================================================
import en from './locales/en.js';
import ptBR from './locales/pt-BR.js';

export const LANGUAGES = { en: 'English', 'pt-BR': 'Português (Brasil)' };
const DICTS = { en, 'pt-BR': ptBR };

let current = 'en';

/** Best match for a browser language tag ("pt", "pt-PT", "en-US"...). */
export function matchLanguage(tag) {
  const t = String(tag || '').toLowerCase();
  const exact = Object.keys(LANGUAGES).find(l => l.toLowerCase() === t);
  if (exact) return exact;
  const base = t.split('-')[0];
  return Object.keys(LANGUAGES).find(l => l.toLowerCase().split('-')[0] === base) || 'en';
}

export function setLanguage(lang) { current = DICTS[lang] ? lang : matchLanguage(lang); }
export const getLanguage = () => current;

export function t(key, vars = {}) {
  let s = DICTS[current][key] ?? en[key] ?? key;
  if (s && typeof s === 'object') s = (vars.n === 1 ? s.one : s.other) ?? s.other;
  return String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Readable name of a language tag, in the current interface language. */
export function languageName(tag) {
  if (!tag) return '';
  try { return new Intl.DisplayNames([current], { type: 'language' }).of(tag) || tag; } catch { return tag; }
}
