# StatForge Hub

[Leia em português](README.pt-BR.md)

The official collection of packages for [StatForge](https://github.com/GabrielGugg/statforge), the character sheet for any tabletop RPG. Systems, homebrews, themes and tables, all in one place, checked automatically and installable with one tap.

## For players and GMs

In StatForge, open **Packages › Hub**. Search, filter by type or language, and tap **Install**. The app also tells you when a package you have gets a new version.

You can also install a single package by link: every file here works as a link. To try it, the example table from StatForge installs a system, a homebrew and a theme at once:

```
https://raw.githubusercontent.com/GabrielGugg/statforge/main/examples/en/table.json
```

## For creators: add your package

No package yet? The [package builder](https://gabrielgugg.github.io/statforge-hub/builder/) lets you make a system, homebrew, theme or table without writing code, checks it with the StatForge validator and exports the `.json` (see [builder/README.md](builder/README.md)).

Anyone with a GitHub account can send a package. You do not need to install anything; it all works in the browser.

1. Check your file with the StatForge validator (`npm run validate -- your-package.json` in the StatForge repo), or just send it: the hub checks it for you.
2. In this repository, open the `packages` folder and click **Add file › Upload files**, then drag a folder named after your package (with your .json inside) into the page. Or use **Add file › Create new file**, type the path `packages/my-system/my-system.json` and paste the file's content.
3. GitHub creates a copy (fork) for you and offers to **open a pull request**. Do it, describing what the package is.
4. The automatic check runs on your pull request. If something is wrong, it says what; fix it and upload again.
5. GabrielGugg reviews and merges. A minute later the package shows up in the app's Hub.

Prefer not to use pull requests? Open an issue with the **Submit a package** form and attach the .json.

The full rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

## What is checked automatically

- The file is valid JSON and a valid StatForge package (same rules as the app).
- It has `author`, `version` and `language`.
- Its `id` is not used by another package in the hub.
- When you change a package, its `version` goes up (otherwise players never get the update).
- Pull requests only touch files inside `packages/`.

## How it works

- `packages/<folder>/*.json` are the packages. One folder can hold a system with its themes and table.
- `index.json` is the list the app reads. It is rebuilt automatically after every merge; do not edit it by hand.
- `scripts/hub.mjs` checks the packages and builds the index. It uses the validator from the StatForge app, so both always agree.

## License

The hub's own files: MIT © GabrielGugg. Each package belongs to its author and follows its own `license` field.
