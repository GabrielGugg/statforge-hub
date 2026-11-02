// ============================================================
// Assistant: builds a new package one simple question at a time,
// like the character creation of the app. At the end the package
// can be downloaded or opened in the full editor for the details.
// ============================================================
import { h, mount, toast } from './h.js';
import { getLang } from './i18n.js';
import { L } from './schema.js';
import { DICE, MODIFIERS, ATTRIBUTE_PRESETS, THEME_PRESETS, FONTS, emptyAnswers, attrId,
  buildSystem, buildTheme, buildTable, buildExtension, themeColors } from './wizard-model.js';

const LANGS = () => [
  { value: 'pt-BR', label: 'Português (Brasil)' }, { value: 'en', label: 'English' }, { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' }, { value: 'de', label: 'Deutsch' }, { value: 'it', label: 'Italiano' },
];
const WIZ_KEY = 'statforge-builder:wizard';
const store = {
  get() { try { return JSON.parse(localStorage.getItem(WIZ_KEY) || 'null'); } catch { return null; } },
  set(v) { try { localStorage.setItem(WIZ_KEY, JSON.stringify(v)); } catch { /* private mode */ } },
  del() { try { localStorage.removeItem(WIZ_KEY); } catch { /* nothing */ } },
};

/** A wizard left halfway in this browser: { type, step, answers } or null. */
export const savedWizard = () => store.get();
export const discardWizard = () => store.del();

let hubIndex = null;
async function hub() {
  if (!hubIndex) {
    hubIndex = fetch('../index.json').then(r => (r.ok ? r.json() : { packages: [] }))
      .then(i => (i.packages || []).map(p => ({ ...p, url: new URL(`../${p.url}`, location.href).href })))
      .catch(() => []);
  }
  return hubIndex;
}

/**
 * Starts (or resumes) the assistant.
 * env = { app, header(), engine(), finish(pkg, how) } where how is 'export' or 'editor'.
 */
export function startWizard(env, type, resume = null) {
  const lang = getLang();
  const w = resume || { type, step: 0, answers: initial(type, lang) };
  const steps = STEPS[w.type]();
  const save = () => store.set(w);

  function draw() {
    const step = steps[w.step];
    const body = h('div.wiz-body');
    const next = h('button.primary', { onclick: async () => {
      const problem = step.check?.(w.answers);
      if (problem) { toast(problem, 'bad'); return; }
      if (w.step < steps.length - 1) { w.step++; save(); draw(); window.scrollTo(0, 0); }
    } }, L('Próximo →', 'Next →'));
    mount(env.app,
      env.header(),
      h('main.wizard',
        h('ol.wiz-steps', steps.map((s, i) => h('li', { class: i === w.step ? 'now' : i < w.step ? 'done' : '' },
          h('button', { onclick: () => { if (i <= w.step || !steps.slice(w.step, i).some(x => x.check?.(w.answers))) { w.step = i; save(); draw(); } } }, s.title())))),
        h('section.card.wiz-card',
          h('h1', step.title()),
          step.intro ? h('p.lead', step.intro()) : null,
          body,
          h('div.row.wiz-nav',
            w.step ? h('button.ghost', { onclick: () => { w.step--; save(); draw(); } }, L('← Voltar', '← Back')) : h('button.ghost', { onclick: () => env.cancel() }, L('Cancelar', 'Cancel')),
            h('div.spacer'),
            w.step < steps.length - 1 ? next : null))));
    step.render(body, w.answers, { save, redraw: draw, env, finish: how => { const pkg = BUILD[w.type](w.answers); if (env.finish(pkg, how) !== false) store.del(); } });
  }
  save();
  draw();
}

function initial(type, lang) {
  if (type === 'system') return emptyAnswers(lang);
  if (type === 'theme') return { name: '', author: '', ...THEME_PRESETS[0], font: '' };
  return { name: '', author: '', language: lang, description: '', system: null, extensions: [], theme: null };
}

const BUILD = {
  system: buildSystem,
  theme: buildTheme,
  table: a => buildTable(a),
  extension: a => buildExtension({ ...a, system: a.system?.id || a.systemId || '' }),
};

// ---------- small form helpers ----------
function field(label, input, help) {
  return h('label.field', h('span.label', label), input, help ? h('span.help', help) : null);
}
function text(a, key, save, attrs = {}) {
  return h('input', { type: 'text', value: a[key] ?? '', ...attrs, oninput: e => { a[key] = e.target.value; save(); attrs.after?.(); } });
}
function select(a, key, options, save, after) {
  return h('select', { onchange: e => { a[key] = e.target.value; save(); after?.(); } },
    options.map(o => h('option', { value: o.value, selected: a[key] === o.value }, o.label)));
}
const need = (v, msg) => (String(v ?? '').trim() ? null : msg);

function aboutStep({ language = true, description = true } = {}) {
  return {
    title: () => L('Nome', 'Name'),
    check: a => need(a.name, L('Dê um nome ao pacote.', 'Give the package a name.')) || need(a.author, L('Diga quem fez (seu nome ou apelido).', 'Say who made it (your name or nickname).')),
    render(body, a, { save }) {
      body.append(h('div.form',
        field(L('Nome do pacote', 'Package name'), text(a, 'name', save, { placeholder: L('Ex.: Meu RPG de Fantasia', 'E.g. My Fantasy RPG') })),
        field(L('Seu nome ou apelido', 'Your name or nickname'), text(a, 'author', save), L('Aparece como autor no Hub.', 'Shown as the author in the Hub.')),
        language ? field(L('Idioma dos textos do pacote', 'Language of the package texts'), select(a, 'language', LANGS(), save)) : null,
        description ? field(L('Descrição curta (opcional)', 'Short description (optional)'),
          h('textarea', { rows: 3, value: a.description || '', oninput: e => { a.description = e.target.value; save(); } })) : null));
    },
  };
}

// ---------- the steps of each type ----------
const STEPS = {
  system: () => [
    aboutStep(),
    {
      title: () => L('Dados', 'Dice'),
      intro: () => L('Qual dado o jogo usa nos testes, e como um atributo vira bônus na rolagem?', 'Which die does the game roll for tests, and how does an attribute become a roll bonus?'),
      render(body, a, { save, redraw }) {
        body.append(
          h('h3', L('Dado principal', 'Main die')),
          h('div.wiz-choices', DICE.map(d => h('button.wiz-choice', { class: a.dice === d ? 'on' : '', onclick: () => { a.dice = d; save(); redraw(); } }, d))),
          field(L('Outro dado', 'Another die'), text(a, 'dice', save, { placeholder: '1d20' })),
          h('h3', L('Bônus do atributo (modificador)', 'Attribute bonus (modifier)')),
          h('div.wiz-options', [
            [MODIFIERS[0].formula, L('Estilo D&D: (valor − 10) ÷ 2, para baixo. Força 14 dá +2.', 'D&D style: (score − 10) ÷ 2, rounded down. Strength 14 gives +2.')],
            [MODIFIERS[1].formula, L('Valor − 5. Atributo 7 dá +2.', 'Score − 5. A score of 7 gives +2.')],
            [MODIFIERS[2].formula, L('O próprio valor. Atributo 3 dá +3.', 'The score itself. A score of 3 gives +3.')],
          ].map(([f, label]) => h('label.check', h('input', { type: 'radio', name: 'mod', checked: a.modifier === f, onchange: () => { a.modifier = f; save(); redraw(); } }), h('span', label)))),
          h('details', h('summary.small', L('Escrever minha própria regra', 'Write my own rule')),
            field(L('Fórmula (use "value" para o valor do atributo)', 'Formula (use "value" for the score)'), text(a, 'modifier', save), L('Ex.: floor(value / 3)', 'E.g. floor(value / 3)'))));
      },
    },
    {
      title: () => L('Atributos', 'Attributes'),
      intro: () => L('As características básicas do personagem. Comece de um modelo ou do zero.', 'The character\'s basic traits. Start from a template or from scratch.'),
      check: a => (a.attributes.some(x => !x.name.trim()) ? L('Todo atributo precisa de um nome (ou remova a linha).', 'Every attribute needs a name (or remove the row).') : null),
      render(body, a, { save, redraw }) {
        const lang = a.language;
        const preset = key => {
          if (a.attributes.length && !confirm(L('Trocar os atributos pelos do modelo?', 'Replace the attributes with the template?'))) return;
          const p = ATTRIBUTE_PRESETS[key];
          a.attributes = p.attrs(lang);
          if (a.modifier !== p.modifier) { a.modifier = p.modifier; toast(L('O bônus do atributo foi ajustado para combinar com o modelo. Dá para trocar no passo Dados.', 'The attribute bonus was adjusted to fit the template. You can change it in the Dice step.')); }
          save(); redraw();
        };
        body.append(
          h('div.wiz-choices',
            h('button.wiz-choice', { onclick: () => preset('d20') }, L('Estilo D&D (6 atributos, 1–20)', 'D&D style (6 attributes, 1–20)')),
            h('button.wiz-choice', { onclick: () => preset('special') }, L('Estilo Fallout (7 atributos, 1–10)', 'Fallout style (7 attributes, 1–10)')),
            h('button.wiz-choice', { onclick: () => preset('simple') }, L('Simples (4 atributos, 0–5)', 'Simple (4 attributes, 0–5)'))),
          rows(a.attributes, [
            { key: 'name', label: L('Nome', 'Name'), wide: true, placeholder: L('Força', 'Strength') },
            { key: 'abbr', label: L('Sigla', 'Short'), placeholder: 'FOR' },
            { key: 'min', label: L('Mínimo', 'Min'), type: 'number' },
            { key: 'max', label: L('Máximo', 'Max'), type: 'number' },
            { key: 'default', label: L('Inicial', 'Start'), type: 'number' },
          ], () => ({ name: '', abbr: '', min: 1, max: 10, default: 1 }), save, redraw, L('+ Atributo', '+ Attribute')),
          h('p.help', L('A sigla é usada nas fórmulas, por exemplo mod(FOR).', 'The short name is used in formulas, e.g. mod(STR).')));
      },
    },
    {
      title: () => L('Perícias', 'Skills'),
      intro: () => L('Coisas que o personagem sabe fazer. Cada uma pode somar o bônus de um atributo. Pode pular se o jogo não tiver.', 'Things the character is trained in. Each can add an attribute bonus. Skip it if the game has none.'),
      check: a => (a.skills.some(x => !x.name.trim()) ? L('Toda perícia precisa de um nome (ou remova a linha).', 'Every skill needs a name (or remove the row).') : null),
      render(body, a, { save, redraw }) {
        const opts = [{ value: '', label: L('(nenhum)', '(none)') }, ...a.attributes.filter(x => x.name.trim()).map(x => ({ value: attrId(x), label: `${x.name} (${attrId(x)})` }))];
        body.append(rows(a.skills, [
          { key: 'name', label: L('Nome', 'Name'), wide: true, placeholder: L('Furtividade', 'Stealth') },
          { key: 'attribute', label: L('Atributo', 'Attribute'), options: opts },
        ], () => ({ name: '', attribute: opts[1]?.value || '' }), save, redraw, L('+ Perícia', '+ Skill')));
      },
    },
    {
      title: () => L('Recursos', 'Resources'),
      intro: () => L('Valores que sobem e descem no jogo, como Pontos de Vida e Mana. O máximo pode ser um número ou uma conta com os atributos.', 'Values that go up and down in play, like Hit Points and Mana. The maximum can be a number or a sum with the attributes.'),
      check: a => (a.resources.some(x => !x.name.trim()) ? L('Todo recurso precisa de um nome (ou remova a linha).', 'Every resource needs a name (or remove the row).') : null),
      render(body, a, { save, redraw, env }) {
        const ids = a.attributes.filter(x => x.name.trim()).map(attrId);
        body.append(
          rows(a.resources, [
            { key: 'name', label: L('Nome', 'Name'), wide: true, placeholder: L('Pontos de Vida', 'Hit Points') },
            { key: 'abbr', label: L('Sigla', 'Short'), placeholder: L('PV', 'HP') },
            { key: 'max', label: L('Máximo', 'Maximum'), wide: true, placeholder: ids[0] ? `10 + mod(${ids[2] || ids[0]})` : '10', formula: true },
          ], () => ({ name: '', abbr: '', max: '10' }), save, redraw, L('+ Recurso', '+ Resource'), env),
          ids.length ? h('p.help', L('Na conta você pode usar: ', 'In the maximum you can use: '), ids.map(id => h('code', ` ${id} `)), L(` (o valor), mod(${ids[0]}) (o bônus), level (o nível) e as contas + − * /.`, ` (the score), mod(${ids[0]}) (the bonus), level, and the math signs + − * /.`)) : null);
      },
    },
    {
      title: () => L('Criação', 'Creation'),
      intro: () => L('Como o jogador monta um personagem novo no app. Você pode mudar tudo depois.', 'How a player makes a new character in the app. You can change everything later.'),
      render(body, a, { save, redraw }) {
        const c = a.creation;
        const box = (key, label, extra) => h('div.wiz-opt', h('label.check', h('input', { type: 'checkbox', checked: !!c[key], onchange: e => { c[key] = e.target.checked; save(); redraw(); } }), h('span', h('strong', label))), c[key] ? extra : null);
        const n = (key, label) => field(label, h('input', { type: 'number', min: 0, value: c[key], oninput: e => { c[key] = e.target.value; save(); } }));
        body.append(
          a.attributes.length ? box('attributes', L('Distribuir pontos nos atributos', 'Spend points on attributes'),
            h('div.grid3', n('points', L('Pontos para distribuir', 'Points to spend')))) : null,
          a.skills.length ? box('skills', L('Distribuir pontos nas perícias', 'Spend points on skills'),
            h('div.grid3', n('skillPoints', L('Pontos', 'Points')), n('maxPerSkill', L('Máximo por perícia', 'Max per skill')))) : null,
          box('story', L('Campo de história do personagem', 'A backstory box')));
      },
    },
    {
      title: () => L('Pronto', 'Done'),
      render(body, a, { finish, env }) {
        const pkg = buildSystem(a);
        body.append(
          summaryList([
            [L('Dado', 'Die'), `${pkg.rolls.default} · ${L('bônus', 'bonus')}: ${({ [MODIFIERS[0].formula]: L('estilo D&D', 'D&D style'), [MODIFIERS[1].formula]: L('valor − 5', 'score − 5'), [MODIFIERS[2].formula]: L('o próprio valor', 'the score itself') })[pkg.rolls.modifier] || pkg.rolls.modifier}`],
            [L('Atributos', 'Attributes'), pkg.attributes.map(x => x.abbr || x.id).join(', ') || '—'],
            [L('Perícias', 'Skills'), String(pkg.skills.length)],
            [L('Recursos', 'Resources'), pkg.resources.map(x => `${x.abbr || x.name} (${x.max})`).join(', ') || '—'],
            [L('Ficha', 'Sheet'), L('uma aba com recursos, atributos, perícias, história e dados', 'one tab with resources, attributes, skills, backstory and dice')],
          ]),
          checkBox(env, pkg),
          h('p', L('Itens, magias, classes, raças e regras especiais entram no editor completo (Coleções e Itens das coleções).', 'Items, spells, classes, races and special rules are added in the full editor (Collections and Collection items).')),
          finishButtons(finish));
      },
    },
  ],

  theme: () => [
    aboutStep({ language: false, description: false }),
    {
      title: () => L('Cores', 'Colors'),
      intro: () => L('Escolha um ponto de partida e ajuste três cores. O resto é calculado.', 'Pick a starting point and adjust three colors. The rest is worked out.'),
      check: a => { try { themeColors(a); return null; } catch { return L('Use cores no formato #rrggbb.', 'Use colors as #rrggbb.'); } },
      render(body, a, { save, redraw }) {
        const prev = h('div');
        const drawPrev = () => { try { prev.replaceChildren(preview(themeColors(a), a.font)); } catch { /* typing */ } };
        const color = (key, label) => {
          const pick = h('input', { type: 'color', value: a[key] });
          pick.addEventListener('input', () => { a[key] = pick.value; save(); drawPrev(); });
          return h('label.color', h('span', label), pick);
        };
        body.append(
          h('div.wiz-choices', THEME_PRESETS.map(p => h('button.wiz-choice.swatch', { style: { background: p.bg, color: p.text, borderColor: p.accent }, onclick: () => { Object.assign(a, { bg: p.bg, text: p.text, accent: p.accent }); save(); redraw(); } },
            { night: L('Noite', 'Night'), paper: L('Papel', 'Paper'), terminal: L('Terminal', 'Terminal'), royal: L('Real', 'Royal') }[p.id]))),
          h('div.themegrid',
            h('div.form',
              color('bg', L('Fundo', 'Background')), color('text', L('Texto', 'Text')), color('accent', L('Destaque (botões, barras)', 'Accent (buttons, bars)')),
              field(L('Fonte', 'Font'), h('select', { onchange: e => { a.font = e.target.value; save(); drawPrev(); } },
                FONTS.map(f => h('option', { value: f.css, selected: a.font === f.css }, { '': L('A do app', 'The app\'s'), serif: L('Clássica (serifa)', 'Classic (serif)'), mono: L('Máquina de escrever', 'Typewriter'), rounded: L('Arredondada', 'Rounded') }[f.id]))))),
            prev));
        drawPrev();
      },
    },
    {
      title: () => L('Pronto', 'Done'),
      render(body, a, { finish, env }) {
        const pkg = buildTheme(a);
        body.append(preview(pkg.colors, pkg.font), h('p.help', L('O tema serve para qualquer idioma ("language": "*").', 'The theme fits any language ("language": "*").')), checkBox(env, pkg), finishButtons(finish));
      },
    },
  ],

  table: () => [
    aboutStep(),
    pickStep('system', () => L('Sistema', 'System'), () => L('Qual jogo a mesa usa? A lista vem do StatForge Hub.', 'Which game does the table use? The list comes from the StatForge Hub.')),
    pickStep('extensions', () => L('Homebrews', 'Homebrews'), () => L('Regras da casa e suplementos para esse sistema (pode escolher vários ou nenhum).', 'House rules and supplements for that system (any number, or none).')),
    pickStep('theme', () => L('Tema', 'Theme'), () => L('As cores do app para os jogadores (opcional).', 'App colors for the players (optional).')),
    {
      title: () => L('Pronto', 'Done'),
      render(body, a, { finish, env }) {
        const pkg = buildTable(a);
        body.append(
          summaryList([[L('Sistema', 'System'), a.system?.name], [L('Homebrews', 'Homebrews'), a.extensions.map(e => e.name).join(', ') || '—'], [L('Tema', 'Theme'), a.theme?.name || '—']]),
          checkBox(env, pkg),
          h('p', L('Depois de baixar, hospede o arquivo (GitHub, Gist ou o próprio Hub) e mande aos jogadores o link pronto que o editor completo monta em "Links".', 'After downloading, host the file (GitHub, Gist or the Hub itself) and send players the ready link the full editor builds under "Links".')),
          finishButtons(finish));
      },
    },
  ],

  extension: () => [
    aboutStep(),
    pickStep('system', () => L('Sistema base', 'Base system'), () => L('A homebrew muda qual sistema?', 'Which system does the homebrew change?')),
    {
      title: () => L('Pronto', 'Done'),
      render(body, a, { finish, env }) {
        const pkg = buildExtension({ ...a, system: a.system?.id || '' });
        body.append(
          h('p', L('O começo está pronto. As mudanças em si (novos itens, regras trocadas, valores alterados) são feitas em "Mudanças" no editor completo, escolhendo da lista do sistema base.', 'The start is ready. The changes themselves (new items, replaced rules, changed values) are made under "Patches" in the full editor, picking from the base system\'s lists.')),
          checkBox(env, pkg),
          h('div.row.wiz-finish', h('button.primary', { onclick: () => finish('editor') }, L('Abrir no editor para fazer as mudanças', 'Open in the editor to make the changes'))));
      },
    },
  ],
};

/** Picks hub packages: 'system' (one, required), 'extensions' (many, for that system), 'theme' (one, optional). */
function pickStep(kind, title, intro) {
  return {
    title, intro,
    check: a => (kind === 'system' && !a.system ? L('Escolha um sistema.', 'Pick a system.') : null),
    render(body, a, { save, redraw }) {
      const list = h('div.wiz-list', h('p.muted', L('Carregando o Hub…', 'Loading the Hub…')));
      body.append(list);
      hub().then(all => {
        const items = all.filter(p => (kind === 'system' ? p.type === 'system' : kind === 'theme' ? p.type === 'theme' : p.type === 'extension' && p.system === a.system?.id));
        const isOn = p => (kind === 'extensions' ? a.extensions.some(e => e.id === p.id) : a[kind]?.id === p.id);
        const toggle = p => {
          const entry = { id: p.id, name: p.name, url: p.url };
          if (kind === 'extensions') a.extensions = isOn(p) ? a.extensions.filter(e => e.id !== p.id) : [...a.extensions, entry];
          else if (kind === 'theme' && isOn(p)) a.theme = null;
          else { a[kind] = entry; if (kind === 'system') a.extensions = []; }
          save(); redraw();
        };
        mount(list,
          !all.length ? h('p.bad', L('Não deu para ler o Hub (sem internet?). Use o editor completo e cole os links à mão.', 'Could not read the Hub (offline?). Use the full editor and paste the links by hand.')) : null,
          all.length && !items.length ? h('p.muted', kind === 'extensions' ? L('Nenhuma homebrew para esse sistema no Hub ainda. Pode seguir.', 'No homebrew for that system in the Hub yet. You can go on.') : L('Nada no Hub ainda.', 'Nothing in the Hub yet.')) : null,
          items.map(p => h('button.wiz-pick', { class: isOn(p) ? 'on' : '', onclick: () => toggle(p) },
            h('strong', p.name), h('span.muted.small', ` v${p.version || '?'} · ${p.language === '*' ? L('qualquer idioma', 'any language') : p.language || ''} · ${p.author || ''}`),
            p.description ? h('span.small', p.description) : null)));
      });
    },
  };
}

// ---------- shared pieces ----------
function rows(list, cols, make, save, redraw, addLabel, env) {
  const table = h('div.wiz-rows');
  list.forEach((item, i) => {
    table.append(h('div.wiz-row',
      cols.map(c => {
        let input;
        if (c.options) input = h('select', { onchange: e => { item[c.key] = e.target.value; save(); } }, c.options.map(o => h('option', { value: o.value, selected: (item[c.key] ?? '') === o.value }, o.label)));
        else input = h('input', { type: c.type || 'text', value: item[c.key] ?? '', placeholder: c.placeholder || '', oninput: e => { item[c.key] = e.target.value; save(); if (c.formula) check(e.target, msg); } });
        const msg = c.formula ? h('span.help.fstatus') : null;
        if (c.formula) setTimeout(() => check(input, msg));
        return h('label.field', { class: c.wide ? 'wide' : '' }, h('span.label.small', c.label), input, msg);
      }),
      h('button.icon', { title: L('Remover', 'Remove'), 'aria-label': L('Remover', 'Remove'), onclick: () => { list.splice(i, 1); save(); redraw(); } }, '✕')));
  });
  function check(input, msg) {
    const engine = env?.engine?.();
    if (!engine || !msg) return;
    try { engine.parseFormula(input.value || '0'); msg.textContent = ''; } catch (e) { msg.textContent = e.message; msg.className = 'help fstatus bad'; }
  }
  return h('div', table, h('button', { onclick: () => { list.push(make()); save(); redraw(); } }, addLabel));
}

function summaryList(pairs) {
  return h('dl.wiz-summary', pairs.map(([k, v]) => [h('dt', k), h('dd', v || '—')]));
}

function checkBox(env, pkg) {
  const engine = env.engine();
  if (!engine) return h('p.muted.small', L('Verificação ainda carregando…', 'Check still loading…'));
  let res;
  try { res = engine.validatePackage(pkg); } catch (e) { res = { errors: [String(e.message || e)], warnings: [] }; }
  if (!res.errors.length) return h('p.ok', L('✓ O pacote está válido para o StatForge.', '✓ The package is valid for StatForge.'));
  return h('div', h('p.bad', L('O StatForge ainda reclama de:', 'StatForge still complains about:')), h('ul.msgs.bad', res.errors.map(e => h('li', e))));
}

function finishButtons(finish) {
  return h('div.row.wiz-finish',
    h('button.primary', { onclick: () => finish('export') }, L('Baixar o .json', 'Download the .json')),
    h('button', { onclick: () => finish('editor') }, L('Continuar no editor completo', 'Continue in the full editor')));
}

function preview(colors, font) {
  const css = Object.entries(colors || {}).map(([k, v]) => `${k}:${v}`).join(';');
  return h('div.tpreview', { style: `${css};${font ? `--font:${font};font-family:${font}` : ''}` },
    h('div.tp-card', h('strong', L('Ficha de exemplo', 'Sample sheet')), h('p.tp-muted', L('Texto secundário', 'Muted text')),
      h('div.row', h('span.tp-btn', L('Botão', 'Button')), h('span.tp-ok', 'OK'), h('span.tp-warn', '!'), h('span.tp-bad', '✗')),
      h('div.tp-bar', h('div'))));
}
