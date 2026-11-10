// Run: node --test builder/tests
// The builder must open every hub package and export it unchanged,
// and its new packages must pass the StatForge validator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { newPackage, parseImport, exportText, setKey, sameJson, slug, TYPES } from '../js/model.js';
import { validatePackage } from '../vendor/statforge/js/engine/package.js';

const ROOT = new URL('../../packages/', import.meta.url).pathname;
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const hubFiles = walk(ROOT).filter(f => f.endsWith('.json'));

for (const file of hubFiles) {
  test(`round trip: ${file.slice(ROOT.length)}`, () => {
    const text = readFileSync(file, 'utf8');
    const { pkg, indent, trailingNewline } = parseImport(text);
    const out = exportText(pkg, { indent, trailingNewline });
    assert.ok(sameJson(JSON.parse(out), JSON.parse(text)), 'same content');
    assert.equal(out, text, 'same text, byte for byte');
  });
}

for (const type of TYPES) {
  test(`new ${type} is valid`, () => {
    const pkg = newPackage(type, { name: 'Meu Pacote', author: 'Alguém' });
    if (type === 'extension') pkg.system = 'algum-sistema';
    if (type === 'table') pkg.system = { url: 'sistema.json' };
    const { errors } = validatePackage(JSON.parse(exportText(pkg)));
    assert.deepEqual(errors, []);
  });
}

test('slug makes valid ids', () => {
  assert.equal(slug('Fallout TTRPG 2.2 (pt-BR)'), 'fallout-ttrpg-2.2-pt-br');
  assert.equal(slug('Ação & Reação'), 'acao-reacao');
});

test('setKey keeps existing order and places new keys', () => {
  const p = { format: 1, id: 'x', name: 'X', type: 'system', layout: {} };
  setKey(p, 'attributes', []);
  assert.deepEqual(Object.keys(p), ['format', 'id', 'name', 'type', 'attributes', 'layout']);
  setKey(p, 'version', '1.0.0');
  assert.deepEqual(Object.keys(p), ['format', 'id', 'name', 'version', 'type', 'attributes', 'layout']);
});

import { parseTable, importRows, tableOf, toCsv, csvSafe } from '../js/model.js';

test('spreadsheet paste becomes entities', () => {
  const col = { fields: { dano: { type: 'dice', label: 'Dano' }, carga: { type: 'number', label: 'Carga' }, pesada: { type: 'boolean', label: 'Pesada' } } };
  const text = 'Nome\tDano\tCarga\tPesada\tTags\tCor\nFaca\t1d4\t0,5\t\tleve, corte\tazul\nMachado de Guerra\t1d8\t3\tsim\t\t\n';
  const r = importRows(parseTable(text), col, [{ id: 'faca', name: 'Faca', dano: '1d3', description: 'velha' }]);
  assert.equal(r.added, 1); assert.equal(r.updated, 1); assert.deepEqual(r.ignored, ['Cor']);
  assert.deepEqual(r.list[0], { id: 'faca', name: 'Faca', dano: '1d4', description: 'velha', carga: 0.5, tags: ['leve', 'corte'] });
  assert.deepEqual(r.list[1], { id: 'machado_de_guerra', name: 'Machado de Guerra', dano: '1d8', carga: 3, pesada: true });
});

test('csv with quotes and semicolons', () => {
  assert.deepEqual(parseTable('id;nome\n"a;b";"Diz ""oi"""\n'), [['id', 'nome'], ['a;b', 'Diz "oi"']]);
});

test('collection table round trip through csv', () => {
  const col = { fields: { dano: { type: 'dice', label: 'Dano' }, carga: { type: 'number', label: 'Carga' } } };
  const list = [{ id: 'faca', name: 'Faca, curta', dano: '1d4', carga: 1, tags: ['a', 'b'] }];
  const back = importRows(parseTable(toCsv(tableOf(col, list))), col, []);
  assert.deepEqual(back.list, list);
  const pt = importRows(parseTable(toCsv(tableOf(col, list, 'pt-BR'), ';')), col, []);
  assert.deepEqual(pt.list, list);
});

test('csv export never hands a spreadsheet a formula, and import undoes it', () => {
  assert.equal(csvSafe('=HYPERLINK("http://x")'), `'=HYPERLINK("http://x")`);
  assert.equal(csvSafe('+2 em Furtividade'), "'+2 em Furtividade");
  assert.equal(csvSafe('@SUM(1)'), "'@SUM(1)");
  assert.equal(csvSafe('-cmd'), "'-cmd");
  assert.equal(csvSafe('-2'), '-2');
  assert.equal(csvSafe('1,5'), '1,5');
  assert.equal(csvSafe('Faca'), 'Faca');
  const rows = [['id', 'nome'], ['a', '=1+1'], ['b', '+2 PV']];
  assert.deepEqual(parseTable(toCsv(rows, ';')), rows);
});
