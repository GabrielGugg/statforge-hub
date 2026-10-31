# StatForge package builder

[Leia em português abaixo](#construtor-de-pacotes-statforge)

A visual editor for making StatForge packages (system, extension, theme or table) without writing code. It exports a `.json` file; it does **not** publish to the hub. To submit a package, follow the [hub README](../README.md).

## Use

Open `builder/index.html` through any web server (GitHub Pages, or `npx serve .` / `python -m http.server` in the repository root, then visit `/builder/`). Browsers do not run JavaScript modules from a file opened by double-click.

- **Start a new package** or **open** an existing one (file, link or pasted JSON).
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
| `js/model.js` | Package model (pure functions, also used by the tests). |
| `js/engine.js` | Loads the StatForge engine (CDN first, then `vendor/`). |
| `js/i18n.js` | Interface text in pt-BR and English. |
| `vendor/statforge/` | Copy of the StatForge engine (`COMMIT` says which commit). Refresh it by copying `site/js/engine/{package,formula,calc}.js`, `site/js/i18n.js` and `site/js/locales/` from StatForge. |
| `tests/` | `npm test` inside `builder/`: every hub package must round-trip unchanged and new packages must pass the validator. |

---

# Construtor de pacotes StatForge

Um editor visual para criar pacotes do StatForge (sistema, extensão, tema ou mesa) sem escrever código. Ele exporta um arquivo `.json`; **não** publica no hub. Para enviar um pacote, siga o [README do hub](../README.pt-BR.md).

Abra `builder/index.html` por um servidor web (GitHub Pages, ou `npx serve .` / `python -m http.server` na raiz do repositório e depois `/builder/`). O rascunho fica salvo no navegador, **Exportar .json** baixa o arquivo e o painel **Verificação** usa o validador do próprio app StatForge.
