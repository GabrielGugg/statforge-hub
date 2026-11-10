// ============================================================
// Field specs for every part of a package (see FORMAT.md of StatForge).
// Labels and help come in pt-BR and English: L('pt', 'en').
// ============================================================
import { getLang } from './i18n.js';
import { formulaId } from './model.js';

export const L = (pt, en) => (getLang() === 'pt-BR' ? pt : en);

/** The package being edited (set by main.js). */
let current = () => ({});
export function setPackageGetter(fn) { current = fn; }
const pkg = () => current();

// ---------- option lists read from the package ----------
const VALUE_SECTIONS = ['attributes', 'skills', 'derived', 'resources', 'counters'];
const SEC_LABEL = () => ({ attributes: L('atributo', 'attribute'), skills: L('perícia', 'skill'), derived: L('calculado', 'derived'),
  resources: L('recurso', 'resource'), counters: L('contador', 'counter') });

export function valueIds() {
  const p = pkg(), lab = SEC_LABEL();
  return VALUE_SECTIONS.flatMap(s => (Array.isArray(p[s]) ? p[s] : []).filter(o => o?.id).map(o => ({ value: o.id, label: `${o.name || ''} · ${lab[s]}` })));
}
export const attributeOptions = () => (pkg().attributes || []).filter(a => a?.id).map(a => ({ value: a.id, label: `${a.name || a.id} (${a.id})` }));
export const collectionOptions = () => Object.entries(pkg().collections || {}).map(([id, c]) => ({ value: id, label: `${c?.name || id} (${id})` }));
export function entityRefs(col) {
  const out = [];
  for (const [c, list] of Object.entries(pkg().entities || {})) {
    if (col && c !== col) continue;
    for (const e of Array.isArray(list) ? list : []) if (e?.id) out.push({ value: `${c}/${e.id}`, label: e.name || '' });
  }
  return out;
}
export const fieldOptions = col => Object.entries(pkg().collections?.[col]?.fields || {}).map(([id, f]) => ({ value: id, label: `${f?.label || id} (${id})` }));
export function allTags() {
  const set = new Set();
  for (const list of Object.values(pkg().entities || {})) for (const e of Array.isArray(list) ? list : []) for (const tg of e?.tags || []) set.add(tg);
  return [...set].sort().map(x => ({ value: x }));
}
const notesIds = () => (pkg().layout?.tabs || []).flatMap(tb => (tb.blocks || []).filter(b => b.block === 'notes' && b.id).map(b => ({ value: b.id, label: b.title || '' })));
const ownEffectTargets = () => [...valueIds(), { value: 'initiative', label: '' }];

// ---------- small helpers ----------
const id = (extra = {}) => ({ key: 'id', label: 'id', kind: 'text', required: true, group: 'top', help: L('Usado nas fórmulas: sem espaços nem hífens.', 'Used in formulas: no spaces or hyphens.'), ...extra });
const name = (extra = {}) => ({ key: 'name', label: L('Nome', 'Name'), kind: 'text', required: true, group: 'top', ...extra });
const abbr = () => ({ key: 'abbr', label: L('Abreviação', 'Abbreviation'), kind: 'text', group: 'top' });
const description = () => ({ key: 'description', label: L('Descrição', 'Description'), kind: 'textarea', rows: 4 });
const ifField = (help) => ({ key: 'if', label: L('Só quando (condição)', 'Only when (condition)'), kind: 'formula', help: help || L('Opcional. Ex.: has(\'humano\') ou level >= 3', 'Optional. E.g. has(\'human\') or level >= 3') });

// ---------- effects ----------
export const EFFECT_TYPES = () => [
  { value: 'add', label: L('Somar a um valor', 'Add to a value') },
  { value: 'set', label: L('Definir a base de um valor', 'Set a value\'s base') },
  { value: 'grant', label: L('Conceder outro item', 'Grant another item') },
  { value: 'block', label: L('Bloquear efeitos de coleção/tag', 'Block a collection/tag') },
  { value: 'advantage', label: L('Vantagem', 'Advantage') },
  { value: 'disadvantage', label: L('Desvantagem', 'Disadvantage') },
  { value: 'immunity', label: L('Imunidade', 'Immunity') },
  { value: 'resistance', label: L('Resistência', 'Resistance') },
  { value: 'vulnerability', label: L('Vulnerabilidade', 'Vulnerability') },
  { value: 'note', label: L('Lembrete na ficha', 'Reminder on the sheet') },
];

function effectSpec(ef, vars = []) {
  const ty = ef.type;
  const f = [{ key: 'type', label: L('Tipo de efeito', 'Effect type'), kind: 'select', options: EFFECT_TYPES, noEmpty: true, rerender: true, required: true }];
  if (['add', 'set', 'advantage', 'disadvantage'].includes(ty)) {
    f.push({ key: 'target', label: L('Alvo', 'Target'), kind: 'ref', options: ownEffectTargets, help: L('O id de um atributo, perícia, valor calculado, recurso ou contador.', 'The id of an attribute, skill, derived value, resource or counter.') });
  }
  if (['add', 'set'].includes(ty)) f.push({ key: 'value', label: L('Valor', 'Value'), kind: 'numformula', vars, keepEmpty: false });
  if (ty === 'grant') f.push({ key: 'ref', label: L('Item concedido', 'Granted item'), kind: 'ref', options: () => entityRefs(), help: 'coleção/id' });
  if (ty === 'block') {
    f.push({ key: 'collection', label: L('Coleção', 'Collection'), kind: 'select', options: collectionOptions });
    f.push({ key: 'tag', label: 'Tag', kind: 'ref', options: allTags });
  }
  if (ty === 'immunity') {
    f.push({ key: 'ref', label: L('Imune a (itens/contadores)', 'Immune to (items/counters)'), kind: 'refs', options: () => [...entityRefs(), ...(pkg().counters || []).map(c => ({ value: c.id, label: c.name }))],
      help: L('Opcional. Esses itens deixam de ser oferecidos na ficha.', 'Optional. These are no longer offered on the sheet.') });
    f.push({ key: 'tag', label: L('Imune à tag', 'Immune to tag'), kind: 'ref', options: allTags });
  }
  if (ty !== 'grant' && ty !== 'block') f.push({ key: 'text', label: L('Texto', 'Text'), kind: 'text', wide: true });
  f.push(ifField());
  return f;
}

export function effectsField(vars = []) {
  return {
    key: 'effects', label: L('Efeitos', 'Effects'), kind: 'list',
    help: L('O que isto muda na ficha enquanto estiver ativo.', 'What this changes on the sheet while active.'),
    spec: ef => effectSpec(ef, vars),
    summary: ef => {
      const ty = EFFECT_TYPES().find(x => x.value === ef.type)?.label || ef.type || '?';
      const what = ef.type === 'add' || ef.type === 'set' ? `${ef.target ?? '?'} ${ef.type === 'add' ? '+=' : '='} ${ef.value ?? '?'}`
        : ef.ref ? [].concat(ef.ref).join(', ') : ef.collection || ef.tag || ef.text || ef.target || '';
      return `${ty}: ${what}${ef.if ? `  [${L('se', 'if')} ${ef.if}]` : ''}`;
    },
    newItem: () => ({ type: 'add', target: '', value: '1' }),
  };
}

// ---------- system: values ----------
export const SPECS = {
  rolls: () => [
    { key: 'modifier', label: L('Modificador do atributo', 'Attribute modifier'), kind: 'formula', vars: ['value'],
      help: L('Como o modificador sai do valor do atributo (value). Fallout: value - 5. D&D: floor((value - 10) / 2). Vazio: sem modificador.', 'How the modifier comes from the attribute value. Fallout: value - 5. D&D: floor((value - 10) / 2). Empty: no modifier.') },
    { key: 'default', label: L('Rolagem padrão', 'Default roll'), kind: 'dice', placeholder: '1d20' },
  ],
  progression: () => [
    { key: 'xp_per_level', label: L('XP para o próximo nível', 'XP for next level'), kind: 'formula', help: L('Total de XP. Ex.: level * 1000', 'Total XP. E.g. level * 1000') },
    { key: 'max_level', label: L('Nível máximo', 'Max level'), kind: 'number' },
    { key: 'level_up', label: L('Assistente de subir de nível', 'Level-up assistant'), kind: 'object', empty: { summary: [], steps: [] },
      help: L('Passos que rodam ao subir de nível (mesmos tipos da criação). As fórmulas já veem o novo level.', 'Steps run when leveling up (same types as creation). Formulas already see the new level.'),
      addLabel: L('Criar assistente', 'Create assistant'), spec: () => creationSpec() },
  ],
  attributes: () => [
    id(), name(), abbr(),
    { key: 'min', label: L('Mínimo', 'Min'), kind: 'number', group: 'nums' },
    { key: 'max', label: L('Máximo', 'Max'), kind: 'number', group: 'nums' },
    { key: 'default', label: L('Valor inicial', 'Default'), kind: 'number', group: 'nums' },
    description(), effectsField(),
  ],
  skills: () => [
    id(), name(),
    { key: 'attribute', label: L('Atributo', 'Attribute'), kind: 'select', options: attributeOptions, group: 'top' },
    { key: 'total', label: L('Total (regra diferente)', 'Total (custom rule)'), kind: 'formula', vars: ['points'],
      help: L('Opcional. Padrão: points + mod(atributo).', 'Optional. Default: points + mod(attribute).') },
    description(), effectsField(),
  ],
  derived: () => [
    id(), name(), abbr(),
    { key: 'formula', label: L('Fórmula', 'Formula'), kind: 'numformula', required: true },
    { key: 'unit', label: L('Unidade', 'Unit'), kind: 'text', group: 'opts' },
    { key: 'editable_bonus', label: L('Jogador pode digitar um bônus extra', 'Player may type an extra bonus'), kind: 'bool' },
    ifField(L('Só mostra o valor quando a condição vale.', 'Only shows the value when this holds.')), description(), effectsField(),
  ],
  resources: () => [
    id(), name(), abbr(),
    { key: 'max', label: L('Máximo', 'Maximum'), kind: 'numformula', required: true },
    { key: 'display', label: L('Exibição', 'Display'), kind: 'select', emptyLabel: L('Número e barra (padrão)', 'Number and bar (default)'),
      options: () => [{ value: 'toggles', label: L('Caixinhas (uma por ponto)', 'Checkboxes (one per point)') }, { value: 'card', label: L('Só o total (sem atual)', 'Total only (no current)') }] },
    { key: 'recovery', label: L('Recuperação', 'Recovery'), kind: 'text', wide: true },
    description(), effectsField(),
  ],
  counters: () => [
    id(), name(),
    { key: 'max', label: L('Máximo', 'Maximum'), kind: 'numformula', group: 'top' },
    description(),
    { ...effectsField(['n']), help: L('Valem enquanto o contador estiver acima de 0. Use n para o nível atual.', 'Apply while above 0. Use n for the current level.') },
  ],
  auto_conditions: () => [
    { key: 'ref', label: L('Condição', 'Condition'), kind: 'ref', options: () => entityRefs(), required: true, help: 'coleção/id' },
    { key: 'when', label: L('Quando', 'When'), kind: 'formula', required: true, help: L('Ex.: current(\'pv\') <= 0', 'E.g. current(\'hp\') <= 0') },
    { key: 'text', label: L('Mensagem', 'Message'), kind: 'text', wide: true },
  ],
};

// ---------- collections ----------
export const FIELD_TYPES = () => [
  { value: 'text', label: L('Texto', 'Text') }, { value: 'number', label: L('Número', 'Number') },
  { value: 'dice', label: L('Dados (1d6)', 'Dice (1d6)') }, { value: 'boolean', label: L('Sim/não', 'Yes/no') },
  { value: 'list', label: L('Lista', 'List') }, { value: 'range', label: L('Alcance/distância', 'Range/distance') },
];

const collectionFieldSpec = () => [
  { key: 'label', label: L('Rótulo', 'Label'), kind: 'text', group: 'top' },
  { key: 'type', label: L('Tipo', 'Type'), kind: 'select', options: FIELD_TYPES, noEmpty: true, group: 'top', rerender: true },
  { key: 'unit', label: L('Unidade', 'Unit'), kind: 'text', group: 'top', help: L('Ex.: kg, lb, ft', 'E.g. kg, lb, ft') },
  { key: 'per', label: L('Multiplicado pelo atributo', 'Multiplied by attribute'), kind: 'select', options: attributeOptions, if: f => f.type === 'range',
    help: L('Com isso, "x10/x20" vira 10× e 20× o atributo.', 'Then "x10/x20" means 10× and 20× the attribute.') },
  { key: 'links', label: L('Termos viram links para a coleção', 'Terms link to collection'), kind: 'select', options: collectionOptions, if: f => !f.type || f.type === 'text' },
];

export function collectionSpec(colId) {
  return col => [
    { key: 'name', label: L('Nome', 'Name'), kind: 'text', required: true, group: 'top' },
    { key: 'max', label: L('Máximo na ficha', 'Max on sheet'), kind: 'number', group: 'top', help: L('Ex.: 1 classe.', 'E.g. 1 class.') },
    { key: 'equippable', label: L('Equipável', 'Equippable'), kind: 'bool', help: L('Efeitos só valem com o item equipado.', 'Effects only apply when equipped.') },
    { key: 'quantity', label: L('Tem quantidade', 'Has quantity'), kind: 'bool' },
    { key: 'unique', label: L('Único (talentos, traços)', 'Unique (perks, traits)'), kind: 'bool', help: L('Cada item só uma vez, ou quantas o "repeat" dele permitir.', 'Each item once, or as many as its "repeat".') },
    { key: 'quick_remove', label: L('Remover sem confirmar', 'Remove without asking'), kind: 'bool', help: L('Bom para condições.', 'Good for conditions.') },
    { key: 'fields', label: L('Campos dos itens', 'Item fields'), kind: 'map', keyPlaceholder: L('id do campo (ex.: dano)', 'field id (e.g. damage)'),
      makeKey: formulaId, newItem: k => ({ type: 'text', label: k }), spec: collectionFieldSpec,
      summary: f => `${f?.label || ''} · ${FIELD_TYPES().find(x => x.value === f?.type)?.label || f?.type || ''}`,
      addLabel: L('campo', 'field') },
    { key: 'wear', label: L('Desgaste', 'Wear'), kind: 'object', empty: { max: 10 }, addLabel: L('Ativar desgaste', 'Enable wear'), spec: () => [
      { key: 'max', label: L('Máximo', 'Maximum'), kind: 'number', group: 'w' },
      { key: 'breaks', label: L('Quebra no máximo (efeitos param)', 'Breaks at max (effects stop)'), kind: 'bool' },
      { key: 'text', label: L('Explicação da regra', 'Rule text'), kind: 'textarea' },
      { key: 'stats', label: L('Números que só existem com desgaste', 'Numbers that only exist while worn'), kind: 'list',
        spec: () => [{ key: 'label', label: L('Rótulo', 'Label'), kind: 'text', group: 's' }, { key: 'value', label: L('Valor', 'Value'), kind: 'formula', vars: ['wear'], group: 's' }],
        summary: s => `${s.label || '?'}: ${s.value || ''}`, newItem: () => ({ label: '', value: '-wear' }) },
      { key: 'fields', label: L('Campos depois do desgaste', 'Fields after wear'), kind: 'json', rows: 4,
        help: L('{ "campo": "fórmula" } com value (base) e wear. Ex.: { "df": "max(10, value - floor(wear / 2))" }', '{ "field": "formula" } using value and wear.') },
    ] },
    { key: 'mods', label: L('Aceita modificações da coleção', 'Accepts mods from collection'), kind: 'select', options: collectionOptions },
    { key: 'custom', label: L('Itens personalizados', 'Custom items'), kind: 'custom', render: o => customEditor(o) },
    { key: 'currency', label: L('Dinheiro', 'Money'), kind: 'object', empty: { value: '', base: '' }, addLabel: L('Usar esta coleção como dinheiro', 'Use this collection as money'), spec: () => [
      { key: 'value', label: L('Campo com o valor de cada moeda', 'Field with each coin\'s worth'), kind: 'select', options: () => fieldOptions(colId), group: 'c' },
      { key: 'base', label: L('Moeda base (id)', 'Base coin (id)'), kind: 'ref', options: () => entityRefs(colId).map(r => ({ value: r.value.split('/')[1], label: r.label })), group: 'c' },
    ] },
  ];
}

function customEditor(o) {
  // custom: true | ["field"] | { fields: [...], magazine: "collection" }
  const holder = document.createElement('div');
  holder.className = 'field wide';
  return holder.appendChild(customInner(o, holder)) && holder;
}
let customInner = () => document.createElement('div');
export function setCustomRenderer(fn) { customInner = fn; }

// ---------- entities ----------
const FIELD_KIND = { number: 'number', dice: 'dice', boolean: 'bool', list: 'tags', text: 'text', range: 'text' };

function startingItemSpec() {
  return [
    { key: 'ref', label: L('Item', 'Item'), kind: 'ref', options: () => entityRefs(), group: 'a', help: L('Ou deixe vazio e use Texto.', 'Or leave empty and use Text.') },
    { key: 'qty', label: L('Qtd.', 'Qty'), kind: 'number', group: 'a' },
    { key: 'equipped', label: L('Equipado', 'Equipped'), kind: 'bool' },
    { key: 'wear', label: L('Desgaste', 'Wear'), kind: 'number', group: 'b' },
    { key: 'name', label: L('Nome próprio', 'Own name'), kind: 'text', group: 'b' },
    { key: 'text', label: L('Texto (sem item, vai para as notas)', 'Text (no item, goes to notes)'), kind: 'text', wide: true },
    ifField(),
  ];
}

export function entitySpec(colId) {
  return () => {
    const p = pkg();
    const col = p.collections?.[colId] || {};
    const own = Object.entries(col.fields || {}).map(([k, f]) => ({
      key: k, label: f?.label || k, kind: FIELD_KIND[f?.type] || 'text', group: 'own',
      help: f?.unit ? `${L('Unidade', 'Unit')}: ${f.unit}` : (f?.type === 'range' && f.per ? `× ${f.per}` : undefined),
    }));
    const isModTarget = Object.values(p.collections || {}).some(c => c?.mods === colId);
    const anyWear = Object.values(p.collections || {}).some(c => c?.wear);
    const spec = [
      { key: 'id', label: 'id', kind: 'text', required: true, group: 'top' },
      { key: 'name', label: L('Nome', 'Name'), kind: 'text', required: true, group: 'top' },
      ...(col.currency ? [{ key: 'abbr', label: L('Abreviação', 'Abbreviation'), kind: 'text', group: 'top' }] : []),
      ...own,
      description(),
      { key: 'tags', label: 'Tags', kind: 'tags', datalist: undefined },
      { key: 'requires', label: L('Requisito', 'Requirement'), kind: 'formula', group: 'req', help: L('Ex.: FOR >= 5 and level >= 3', 'E.g. STR >= 5 and level >= 3') },
      { key: 'repeat', label: L('Pode ser pego quantas vezes', 'Times it can be taken'), kind: 'number', group: 'req' },
      effectsField(['qty', 'wear']),
      { key: 'starting_items', label: L('Itens iniciais', 'Starting items'), kind: 'list', spec: startingItemSpec,
        help: L('Usados pelo passo "Equipamento" da criação.', 'Used by the creation "items" step.'),
        summary: s => `${s.ref || s.text || '?'}${s.qty > 1 ? ` ×${s.qty}` : ''}${s.if ? `  [${s.if}]` : ''}`, newItem: () => ({ ref: '', qty: 1 }) },
      { key: 'magazine', label: L('Pente / munição', 'Magazine / ammo'), kind: 'object', empty: { capacity: 1, ammo: [] }, addLabel: L('Usa munição', 'Uses ammo'), spec: () => [
        { key: 'capacity', label: L('Capacidade', 'Capacity'), kind: 'number', group: 'm' },
        { key: 'per_shot', label: L('Por disparo', 'Per shot'), kind: 'number', group: 'm' },
        { key: 'charge', label: L('Uma unidade enche tudo (célula de energia)', 'One unit fills it (energy cell)'), kind: 'bool' },
        { key: 'ammo', label: L('Munições aceitas', 'Accepted ammo'), kind: 'refs', options: () => entityRefs() },
      ] },
      ...(isModTarget ? [{ key: 'magazine_bonus', label: L('Bônus de pente ao instalar', 'Magazine bonus when installed'), kind: 'number' }] : []),
      ...(anyWear ? [{ key: 'wear_ignore', label: L('Ignora os primeiros níveis de desgaste', 'Ignores first wear levels'), kind: 'number' }] : []),
    ];
    return spec;
  };
}

// ---------- layout ----------
export const BLOCK_TYPES = () => [
  { value: 'attributes', label: L('Atributos', 'Attributes') }, { value: 'skills', label: L('Perícias', 'Skills') },
  { value: 'derived', label: L('Valores calculados', 'Derived values') }, { value: 'resources', label: L('Recursos', 'Resources') },
  { value: 'counters', label: L('Contadores', 'Counters') }, { value: 'effects', label: L('Efeitos ativos', 'Active effects') },
  { value: 'list', label: L('Lista de uma coleção', 'Collection list') }, { value: 'inventory', label: L('Inventário', 'Inventory') },
  { value: 'money', label: L('Dinheiro', 'Money') }, { value: 'notes', label: L('Anotação', 'Note') },
  { value: 'notebook', label: L('Caderno de notas', 'Notebook') }, { value: 'roller', label: L('Rolador de dados', 'Dice roller') },
];

function itemsFor(block) {
  const map = { attributes: 'attributes', skills: 'skills', derived: 'derived', resources: 'resources', counters: 'counters' };
  const s = map[block];
  return s ? () => (pkg()[s] || []).map(o => ({ value: o.id, label: o.name })) : null;
}

function blockSpec(b) {
  const ty = b.block;
  const f = [
    { key: 'block', label: L('Tipo de bloco', 'Block type'), kind: 'select', options: BLOCK_TYPES, noEmpty: true, rerender: true, group: 'top' },
    { key: 'id', label: 'id', kind: 'text', group: 'top', help: L('Guarda a arrumação do jogador entre versões.', 'Keeps the player\'s arrangement across versions.') },
    { key: 'title', label: L('Título', 'Title'), kind: 'text', group: 'top' },
    { key: 'w', label: L('Largura (colunas de 12)', 'Width (of 12 columns)'), kind: 'select', options: ['3', '4', '6', '8', '12'].map(x => ({ value: x, label: x })), group: 'size',
      // stored as a number
      onchange: (o, v) => { if (v !== undefined) o.w = Number(v); } },
    { key: 'wide', label: L('Largura total', 'Full width'), kind: 'bool' },
  ];
  // select stores text; show numbers correctly
  if (typeof b.w === 'number') f[3] = { ...f[3], kind: 'custom', render: o => wSelect(o) };
  if (itemsFor(ty)) f.push({ key: 'items', label: L('Quais e em que ordem', 'Which ones, in order'), kind: 'refs', options: itemsFor(ty), help: L('Vazio: todos.', 'Empty: all.') });
  if (ty === 'skills') {
    f.push({ key: 'budget', label: L('Total de pontos esperado', 'Expected point total'), kind: 'numformula' });
    f.push({ key: 'points_label', label: L('Nome da coluna "Pontos"', '"Points" column name'), kind: 'text' });
  }
  if (ty === 'counters') f.push({ key: 'only_active', label: L('Mostrar só os acima de 0', 'Only show those above 0'), kind: 'bool' });
  if (ty === 'list' || ty === 'money') f.push({ key: 'collection', label: L('Coleção', 'Collection'), kind: 'select', options: collectionOptions, rerender: true });
  if (ty === 'list') {
    f.push({ key: 'columns', label: L('Colunas', 'Columns'), kind: 'refs', options: () => fieldOptions(b.collection) });
    f.push({ key: 'view', label: L('Visão', 'View'), kind: 'select', emptyLabel: L('Lista (padrão)', 'List (default)'), options: () => [{ value: 'equipped', label: L('Só equipados, em cartões', 'Equipped only, as cards') }] });
    f.push({ key: 'hide_empty', label: L('Esconder quando vazio', 'Hide when empty'), kind: 'bool' });
  }
  if (ty === 'inventory') {
    f.push({ key: 'collections', label: L('Coleções', 'Collections'), kind: 'refs', options: collectionOptions });
    f.push({ key: 'card_fields', label: L('Campos nos cartões', 'Card fields'), kind: 'json', rows: 3, help: L('Lista, ou { "coleção": [...], "*": [...] }', 'A list, or { "collection": [...], "*": [...] }') });
    f.push({ key: 'list_fields', label: L('Campos na lista', 'List fields'), kind: 'json', rows: 3 });
  }
  if (ty === 'notebook') {
    f.push({ key: 'import_notes', label: L('Importar anotações antigas', 'Import older notes'), kind: 'tags' });
    f.push({ key: 'import_titles', label: L('Títulos das importadas', 'Titles of imported'), kind: 'json', rows: 3 });
  }
  if (ty === 'roller') f.push({ key: 'shortcuts', label: L('Atalhos de rolagem', 'Roll shortcuts'), kind: 'tags', placeholder: '1d20 + mod(FOR), 2d6' });
  return f;
}

let wSelect = () => document.createElement('span');
export function setWidthRenderer(fn) { wSelect = fn; }

export function layoutSpec() {
  return [{
    key: 'tabs', label: L('Abas', 'Tabs'), kind: 'list', keepEmpty: true,
    summary: tb => `${tb.name || tb.id || '?'} · ${(tb.blocks || []).length} ${L('blocos', 'blocks')}`,
    newItem: () => ({ id: '', name: '', blocks: [] }),
    addLabel: L('aba', 'tab'),
    spec: () => [
      { key: 'id', label: 'id', kind: 'text', group: 'top' },
      { key: 'name', label: L('Nome', 'Name'), kind: 'text', group: 'top' },
      { key: 'blocks', label: L('Blocos', 'Blocks'), kind: 'list', keepEmpty: true, spec: blockSpec,
        summary: b => `${BLOCK_TYPES().find(x => x.value === b.block)?.label || b.block}${b.title ? `: ${b.title}` : ''}${b.collection ? ` (${b.collection})` : ''} · w${b.wide ? 12 : b.w || 6}`,
        types: BLOCK_TYPES().map(bt => ({ label: bt.label, make: () => ({ block: bt.value }) })) },
    ],
  }];
}

// ---------- creation / level up ----------
export const STEP_TYPES = () => [
  { value: 'pick', label: L('Escolher itens de uma coleção', 'Pick from a collection') },
  { value: 'attributes', label: L('Distribuir pontos de atributo', 'Attribute point-buy') },
  { value: 'skills', label: L('Perícias', 'Skills') },
  { value: 'items', label: L('Equipamento inicial', 'Starting equipment') },
  { value: 'choice', label: L('Escolha entre opções', 'Choice between options') },
  { value: 'info', label: L('Informação', 'Information') },
  { value: 'notes', label: L('Textos (história etc.)', 'Texts (backstory etc.)') },
];

function stepSpec(st) {
  const ty = st.type;
  const f = [
    { key: 'type', label: L('Tipo de passo', 'Step type'), kind: 'select', options: STEP_TYPES, noEmpty: true, rerender: true, group: 'top' },
    { key: 'title', label: L('Título', 'Title'), kind: 'text', group: 'top' },
    { key: 'description', label: L('Descrição', 'Description'), kind: 'textarea', rows: 2 },
  ];
  if (ty === 'pick') {
    f.push({ key: 'collection', label: L('Coleção', 'Collection'), kind: 'select', options: collectionOptions, group: 'p', rerender: true });
    f.push({ key: 'min', label: L('Mínimo', 'Min'), kind: 'numformula', group: 'p2' }, { key: 'max', label: L('Máximo', 'Max'), kind: 'numformula', group: 'p2' });
    f.push({ key: 'match_field', label: L('Filtrar pelo campo', 'Filter by field'), kind: 'select', options: () => fieldOptions(st.collection), group: 'p',
      help: L('Esconde itens cujo campo nomeia algo que o personagem não tem (ex.: variante por raça).', 'Hides entities whose field names something the character lacks.') });
    f.push({ key: 'tag', label: L('Só com a tag', 'Only with tag'), kind: 'ref', options: allTags, group: 'p' });
    f.push({ key: 'repeat', label: L('Mostrar o que já tem', 'Show what is owned'), kind: 'bool' });
  }
  if (ty === 'attributes') {
    f.push({ key: 'points', label: L('Pontos para distribuir', 'Points to spend'), kind: 'numformula', group: 'a' });
    f.push({ key: 'decrease', label: L('Pode baixar abaixo do inicial', 'May lower below default'), kind: 'custom', render: o => decreaseToggle(o) });
  }
  if (ty === 'skills') {
    f.push({ key: 'choose', label: L('Escolher quantas perícias', 'Choose how many skills'), kind: 'numformula', group: 's' });
    f.push({ key: 'bonus', label: L('Bônus em cada escolhida', 'Bonus for each chosen'), kind: 'numformula', group: 's' });
    f.push({ key: 'points', label: L('Ou: pontos livres', 'Or: free points'), kind: 'numformula', group: 's2' });
    f.push({ key: 'max_per_skill', label: L('Máximo por perícia', 'Max per skill'), kind: 'numformula', group: 's2' });
    f.push({ key: 'from', label: L('Limitar às perícias de um campo', 'Limit to skills in a field'), kind: 'object', empty: { collection: '', field: '' }, addLabel: L('Limitar', 'Limit'),
      spec: o => [{ key: 'collection', label: L('Coleção', 'Collection'), kind: 'select', options: collectionOptions, group: 'f', rerender: true },
        { key: 'field', label: L('Campo', 'Field'), kind: 'select', options: () => fieldOptions(o.collection), group: 'f' }] });
  }
  if (ty === 'items') {
    f.push({ key: 'from', label: L('Pegar os itens iniciais de', 'Take starting items from'), kind: 'select', options: collectionOptions, group: 'i' });
    f.push({ key: 'field', label: L('Campo (padrão starting_items)', 'Field (default starting_items)'), kind: 'text', group: 'i' });
    f.push({ key: 'note', label: L('Bloco de notas para textos', 'Notes block for texts'), kind: 'ref', options: notesIds, group: 'i' });
    f.push({ key: 'take_label', label: L('Texto do botão "levar equipamento"', '"Take kit" button text'), kind: 'text' });
    f.push({ key: 'alternative', label: L('Alternativa (ex.: dinheiro)', 'Alternative (e.g. money)'), kind: 'object', empty: { label: '' }, addLabel: L('Oferecer alternativa', 'Offer an alternative'), spec: () => [
      { key: 'label', label: L('Rótulo', 'Label'), kind: 'text' },
      { key: 'text', label: L('Texto para as notas', 'Text for the notes'), kind: 'text' },
      { key: 'items', label: L('Ou itens', 'Or items'), kind: 'list', spec: () => [
        { key: 'ref', label: L('Item', 'Item'), kind: 'ref', options: () => entityRefs(), group: 'x' }, { key: 'qty', label: L('Qtd.', 'Qty'), kind: 'number', group: 'x' }],
        summary: s => `${s.ref || '?'} ×${s.qty ?? 1}`, newItem: () => ({ ref: '', qty: 1 }) },
    ] });
  }
  if (ty === 'info') {
    f.push({ key: 'text', label: L('Texto', 'Text'), kind: 'textarea' });
    f.push({ key: 'show', label: L('Mostrar a descrição do escolhido em', 'Show description of pick in'), kind: 'select', options: collectionOptions });
  }
  if (ty === 'notes') {
    f.push({ key: 'items', label: L('Caixas de texto', 'Text boxes'), kind: 'list', spec: () => [
      { key: 'id', label: L('id do bloco de notas', 'notes block id'), kind: 'ref', options: notesIds, group: 'n' },
      { key: 'title', label: L('Título', 'Title'), kind: 'text', group: 'n' },
      { key: 'placeholder', label: L('Dica no campo', 'Placeholder'), kind: 'text' }],
    summary: n => n.title || n.id || '?', newItem: () => ({ id: '', title: '' }) });
  }
  if (ty === 'choice') {
    f.push({ key: 'id', label: L('id da resposta', 'answer id'), kind: 'text', help: L('Outros passos usam no "Só quando": use == 2 (1 = primeira opção).', 'Later steps use it in "Only when": use == 2 (1 = first option).') });
    f.push({ key: 'options', label: L('Opções', 'Options'), kind: 'list', spec: () => [
      { key: 'label', label: L('Rótulo', 'Label'), kind: 'text' }, { key: 'text', label: L('Explicação', 'Explanation'), kind: 'text' }],
    summary: (o, i) => `${i + 1}. ${o.label || '?'}`, newItem: () => ({ label: '' }) });
  }
  f.push(ifField());
  return f;
}

let decreaseToggle = () => document.createElement('span');
export function setDecreaseRenderer(fn) { decreaseToggle = fn; }

export function creationSpec() {
  return [
    { key: 'summary', label: L('Valores no topo de cada passo', 'Values at the top of each step'), kind: 'refs', options: valueIds, help: L('Vazio: todos os recursos.', 'Empty: all resources.') },
    { key: 'steps', label: L('Passos', 'Steps'), kind: 'list', keepEmpty: true, spec: stepSpec,
      summary: (s, i) => `${i + 1}. ${s.title || STEP_TYPES().find(x => x.value === s.type)?.label || s.type}${s.collection ? ` (${s.collection})` : ''}${s.if ? `  [${s.if}]` : ''}`,
      types: STEP_TYPES().map(st => ({ label: st.label, make: () => ({ type: st.value }) })) },
  ];
}

// ---------- extension ----------
export const PATCH_OPS = () => [
  { value: 'modify', label: L('Alterar campos', 'Modify fields') }, { value: 'rename', label: L('Renomear', 'Rename') },
  { value: 'replace', label: L('Substituir inteiro', 'Replace') }, { value: 'remove', label: L('Remover', 'Remove') },
  { value: 'add', label: L('Adicionar novo', 'Add new') },
];

export function dependenciesSpec() {
  return [
    { key: 'system', label: L('Sistema (id)', 'System (id)'), kind: 'text', required: true, help: L('O id do sistema que esta extensão modifica, ex.: fallout-2.1-pt', 'The id of the system this changes, e.g. fallout-2.1-en') },
    { key: 'requires', label: L('Requer', 'Requires'), kind: 'tags', placeholder: 'fallout-2.1-pt@>=1.0', help: L('Pacotes que precisam estar ativos. id@>=versão', 'Packages that must be active. id@>=version') },
    { key: 'conflicts', label: L('Conflita com', 'Conflicts with'), kind: 'tags' },
    { key: 'load_after', label: L('Carregar depois de', 'Load after'), kind: 'tags' },
  ];
}

// ---------- table ----------
const linkSpec = () => [
  { key: 'url', label: L('Link do .json', '.json link'), kind: 'text', wide: true, placeholder: 'https://raw.githubusercontent.com/…' },
  { key: 'id', label: L('Ou id (se já instalado)', 'Or id (if installed)'), kind: 'text' },
];
export function tableSpec() {
  return [
    { key: 'system', label: L('Sistema', 'System'), kind: 'object', required: true, empty: { url: '' }, spec: linkSpec },
    { key: 'packages', label: L('Extensões', 'Extensions'), kind: 'list', spec: linkSpec, summary: x => x.url || x.id || '?', newItem: () => ({ url: '' }), addLabel: L('extensão', 'extension') },
    { key: 'theme', label: L('Tema', 'Theme'), kind: 'object', empty: { url: '' }, addLabel: L('Adicionar tema', 'Add theme'), spec: linkSpec },
  ];
}
