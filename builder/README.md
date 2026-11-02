# StatForge package builder

[Leia em português abaixo](#construtor-de-pacotes-statforge)

A visual editor for making StatForge packages (system, extension, theme or table) without writing code. It exports a `.json` file; it does **not** publish to the hub. To submit a package, follow the [hub README](../README.md).

## Use

Open `builder/index.html` through any web server (GitHub Pages, or `npx serve .` / `python -m http.server` in the repository root, then visit `/builder/`). Browsers do not run JavaScript modules from a file opened by double-click.

- **Create with the assistant** (recommended for beginners): one question per step, like the character creation in the app. A system asks for the dice, attributes (with D&D, Fallout or simple templates), skills, resources and character creation; a theme needs three colors; a table is picked from the hub's systems, homebrews and themes. At the end, download the .json or keep going in the full editor. A half-done assistant is kept in the browser and can be resumed.
- **Start blank** in the full editor, or **open** an existing package (file, link or pasted JSON).
- The draft is saved in your browser as you type. **Export .json** downloads the file.
- The **Check** panel uses the validator from the StatForge app itself, loaded from the StatForge repository, so the builder and the app always agree. Offline, it uses the copy in `vendor/statforge/`.
- Opening a package and exporting it without changes gives back the same file, byte for byte.
- **Collection items → Spreadsheet** downloads a collection as .csv and imports rows pasted from Excel or Google Sheets (same id updates, new ids are added).
- For an extension, the base system is loaded from the hub by its id (or from a file) and remembered, so patch targets can be picked from a list.

## Develop

Plain HTML, CSS and JavaScript modules; no build step.

| Path | What |
| --- | --- |
| `index.html`, `builder.css` | Page and styles. |
| `js/main.js` | Screens, state, draft saving, import and export. |
| `js/wizard.js`, `js/wizard-model.js` | The assistant: its steps, and the pure functions that turn the answers into a package (tested in `tests/wizard.test.mjs`). |
| `js/model.js` | Package model (pure functions, also used by the tests). |
| `js/engine.js` | Loads the StatForge engine (CDN first, then `vendor/`). |
| `js/i18n.js` | Interface text in pt-BR and English. |
| `vendor/statforge/` | Copy of the StatForge engine (`COMMIT` says which commit or version). Refresh it by copying `site/js/engine/{package,formula,calc}.js`, `site/js/i18n.js` and `site/js/locales/` from StatForge. |
| `tests/` | `npm test` inside `builder/`: every hub package must round-trip unchanged and new packages must pass the validator. |

---

# Construtor de pacotes StatForge

Um editor visual para criar pacotes do StatForge (sistema, extensão, tema ou mesa) sem escrever código. Ele exporta um arquivo `.json`; **não** publica no hub. Para enviar um pacote, siga o [README do hub](../README.pt-BR.md).

Para quem está começando, use **Criar com o assistente**: uma pergunta por passo, como a criação de personagem do app (dados, atributos com modelos D&D, Fallout ou simples, perícias, recursos e criação; tema com três cores; mesa escolhendo do Hub). No fim, baixe o .json ou continue no editor completo. O assistente pela metade fica salvo no navegador.

Abra `builder/index.html` por um servidor web (GitHub Pages, ou `npx serve .` / `python -m http.server` na raiz do repositório e depois `/builder/`). O rascunho fica salvo no navegador, **Exportar .json** baixa o arquivo e o painel **Verificação** usa o validador do próprio app StatForge.
