// ============================================================
// Loads the StatForge engine (validator, formulas, sheet math).
// First from the StatForge repository itself, so the builder checks
// packages with exactly the rules of the current app; if that fails
// (offline, CDN down), from the copy in ../vendor/statforge.
// ============================================================

const REMOTE = 'https://cdn.jsdelivr.net/gh/GabrielGugg/statforge@main/site/js/';
const LOCAL = new URL('../vendor/statforge/js/', import.meta.url).href;

let loaded = null;

async function from(base) {
  const [pkg, formula, calc, i18n] = await Promise.all([
    import(base + 'engine/package.js'),
    import(base + 'engine/formula.js'),
    import(base + 'engine/calc.js'),
    import(base + 'i18n.js'),
  ]);
  return { ...pkg, parseFormula: formula.parse, evaluate: formula.evaluate, identifiers: formula.identifiers,
    FormulaError: formula.FormulaError, compute: calc.compute, emptySheet: calc.emptySheet,
    setLanguage: i18n.setLanguage, source: base };
}

/** Returns the engine; `source` says where it came from. */
export function loadEngine({ preferLocal = false } = {}) {
  if (!loaded) {
    loaded = (async () => {
      if (!preferLocal) {
        try { return { ...(await from(REMOTE)), remote: true }; } catch (e) { console.warn('StatForge engine: CDN failed, using local copy', e); }
      }
      return { ...(await from(LOCAL)), remote: false };
    })();
  }
  return loaded;
}
