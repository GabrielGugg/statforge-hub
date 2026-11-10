// ============================================================
// Loads the StatForge engine (validator, formulas, sheet math)
// from the copy in ../vendor/statforge, on this same site.
// The builder never runs code from another site (no CDN): the copy is
// refreshed with `node scripts/update-vendor.mjs` after each StatForge
// release, and vendor/statforge/COMMIT says which version it is.
// ============================================================

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
export function loadEngine() {
  if (!loaded) {
    loaded = (async () => {
      const version = await fetch(new URL('../COMMIT', LOCAL)).then(r => (r.ok ? r.text() : '')).catch(() => '');
      return { ...(await from(LOCAL)), version: version.trim() };
    })();
  }
  return loaded;
}
