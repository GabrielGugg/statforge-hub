// Run: node --test builder/tests
// Every answer set of the assistant must give a package the StatForge validator accepts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTRIBUTE_PRESETS, THEME_PRESETS, FONTS, emptyAnswers, attrId, buildSystem, buildTheme, buildTable, buildExtension, themeColors } from '../js/wizard-model.js';
import { exportText } from '../js/model.js';
import { validatePackage } from '../vendor/statforge/js/engine/package.js';

const valid = pkg => assert.deepEqual(validatePackage(JSON.parse(exportText(pkg))).errors, []);

for (const [key, preset] of Object.entries(ATTRIBUTE_PRESETS)) {
  for (const lang of ['pt-BR', 'en']) {
    test(`system from the ${key} template (${lang}) is valid`, () => {
      const a = emptyAnswers(lang);
      Object.assign(a, { name: 'Meu Jogo', author: 'Alguém', dice: preset.dice, modifier: preset.modifier, attributes: preset.attrs(lang) });
      const ids = a.attributes.map(attrId);
      a.skills = [{ name: 'Furtividade', attribute: ids[1] }, { name: 'Sem atributo', attribute: '' }];
      a.resources = [{ name: 'Pontos de Vida', abbr: 'PV', max: `10 + mod(${ids[2]}) * level` }, { name: 'Sorte', abbr: '', max: '3' }];
      a.creation.skills = true;
      const pkg = buildSystem(a);
      valid(pkg);
      assert.equal(pkg.attributes.length, preset.attrs(lang).length);
      assert.equal(pkg.skills[0].attribute, ids[1]);
      assert.equal(pkg.creation.steps.length, 3);
      assert.ok(pkg.layout.tabs[0].blocks.some(b => b.block === 'roller'));
    });
  }
}

test('empty system (only a name) is valid', () => {
  const a = emptyAnswers('en');
  Object.assign(a, { name: 'Bare', author: 'Me' });
  valid(buildSystem(a));
});

test('repeated names get unique ids and blank rows are ignored', () => {
  const a = emptyAnswers('pt-BR');
  Object.assign(a, { name: 'X', author: 'Y' });
  a.attributes = [{ name: 'Força', abbr: 'FOR', min: 1, max: 5, default: 1 }, { name: 'Fôlego', abbr: 'FOR', min: 1, max: 5, default: 1 }, { name: ' ', abbr: '' }];
  a.resources = [{ name: 'Vida', max: '' }, { name: 'Vida', max: '5' }];
  const pkg = buildSystem(a);
  valid(pkg);
  assert.deepEqual(pkg.attributes.map(x => x.id), ['FOR', 'FOR_2']);
  assert.deepEqual(pkg.resources.map(x => x.id), ['vida', 'vida_2']);
  assert.equal(pkg.resources[0].max, '0');
});

for (const p of THEME_PRESETS) {
  for (const f of FONTS) {
    test(`theme ${p.id} ${f.id || 'default font'} is valid`, () => {
      const pkg = buildTheme({ name: 'Tema', author: 'Alguém', ...p, font: f.css });
      valid(pkg);
      assert.equal(pkg.language, '*');
      assert.equal(Object.keys(pkg.colors).length, 11);
    });
  }
}

test('light background makes a light theme', () => {
  assert.equal(buildTheme({ name: 'T', author: 'A', bg: '#ffffff', text: '#111111', accent: '#2255cc', font: '' }).scheme, 'light');
  assert.equal(buildTheme({ name: 'T', author: 'A', bg: '#000000', text: '#eeeeee', accent: '#2255cc', font: '' }).scheme, undefined);
  assert.throws(() => themeColors({ bg: 'red', text: '#000000', accent: '#000000' }));
});

test('table and extension are valid', () => {
  valid(buildTable({ name: 'Mesa', author: 'A', language: 'pt-BR', system: { url: 'https://x.org/s.json' }, extensions: [{ url: 'https://x.org/e.json' }], theme: { url: 'https://x.org/t.json' } }));
  valid(buildTable({ name: 'Mesa', author: 'A', language: 'en', system: { url: 'https://x.org/s.json' } }));
  valid(buildExtension({ name: 'Casa', author: 'A', language: 'pt-BR', system: 'fallout-2.2-pt' }));
});
