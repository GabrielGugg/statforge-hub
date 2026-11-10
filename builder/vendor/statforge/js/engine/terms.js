// ============================================================
// Linked terms (weapon properties…) whose rule depends on the item.
// A term entity may carry "variants": the first one that fits the item
// replaces the term's description in the tooltip and the details.
//   "variants": [
//     { "collection": "explosivos", "description": "…" },
//     { "collection": "armas", "match": { "tipo": ["Armas Cortantes", "Armas Contundentes"] }, "description": "…" }
//   ]
// "collection": the item's collection. "match": item fields that must have one of the values given.
// Pure functions: no DOM, no storage.
// ============================================================
import { t } from '../i18n.js';

const list = v => (Array.isArray(v) ? v : [v]).map(x => String(x));

/** Does this variant fit the item? ctx = { collection, ent } (the item that shows the term). */
export function variantFits(v, ctx) {
  if (!v || typeof v !== 'object') return false;
  if (v.collection !== undefined && v.collection !== ctx?.collection) return false;
  if (v.match && typeof v.match === 'object') {
    for (const [field, want] of Object.entries(v.match)) {
      if (!list(want).includes(String(ctx?.ent?.[field] ?? ''))) return false;
    }
  }
  return true;
}

/** The variant of a term for this item, or null (then the term's own description applies). */
export function termVariant(term, ctx) {
  if (!ctx || !Array.isArray(term?.variants)) return null;
  return term.variants.find(v => variantFits(v, ctx)) || null;
}

/** The description to show for a term next to this item. */
export const termDescription = (term, ctx) => termVariant(term, ctx)?.description ?? term?.description ?? '';

/** Package validation of "variants" (called for every entity). */
export function checkVariants(variants, where, pkg, errors, warnings) {
  if (variants === undefined) return;
  if (!Array.isArray(variants)) { errors.push(t('val.notArrayAt', { where: `${where}.variants` })); return; }
  variants.forEach((v, i) => {
    const at = `${where}.variants[${i}]`;
    if (!v || typeof v !== 'object' || Array.isArray(v)) { errors.push(t('val.notObjectAt', { where: at })); return; }
    if (typeof v.description !== 'string' || !v.description.trim()) errors.push(t('val.variantDescription', { where: at }));
    if (v.collection === undefined && v.match === undefined) warnings.push(t('val.variantAlways', { where: at }));
    if (v.collection !== undefined && typeof v.collection !== 'string') errors.push(t('val.variantCollection', { where: at, col: String(v.collection) }));
    else if (v.collection !== undefined && pkg?.type === 'system' && !pkg.collections?.[v.collection]) warnings.push(t('val.variantCollection', { where: at, col: v.collection }));
    if (v.match !== undefined) {
      if (!v.match || typeof v.match !== 'object' || Array.isArray(v.match)) errors.push(t('val.notObjectAt', { where: `${at}.match` }));
      else for (const [f, want] of Object.entries(v.match)) {
        if (!(typeof want === 'string' || typeof want === 'number' || (Array.isArray(want) && want.every(x => typeof x === 'string' || typeof x === 'number')))) {
          errors.push(t('val.variantMatch', { where: at, field: f }));
        }
      }
    }
  });
}
