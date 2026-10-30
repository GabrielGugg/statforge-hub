# Contributing to the StatForge Hub

[Leia em português](CONTRIBUTING.pt-BR.md)

Thanks for sharing your work! These rules keep the hub easy to use and safe for everyone.

## What you can send

- `system`, `extension` (homebrew, supplement, errata), `theme` and `table` packages in the [StatForge format](https://github.com/GabrielGugg/statforge/blob/main/FORMAT.md).
- Only content you have the right to share. Rules text copied or translated from a published book usually belongs to its publisher: check their fan-content policy, or send only what you wrote yourself (numbers, formulas, short summaries).
- No personal data, no ads, nothing offensive.

## How to organize it

- One folder per project: `packages/<folder>/`. Put a system together with its themes and table, if you like.
- File names in lowercase, with `-` instead of spaces: `my-system.json`.
- Every package needs `author` (your name or GitHub user), `version` and `language`. Add `license` (for example `CC-BY-4.0`, `MIT`, or `All rights reserved`) so players know how they may reuse it.
- The `id` must be unique in the hub and never change after it is published: sheets refer to packages by id. A translation is a new package with its own id (`my-system-en`, `my-system-pt`).
- Relative links in a table (`"url": "my-system.json"`) work, since files in the same folder sit side by side.

## Updating your package

Change the file and raise its `version` (1.0.0 → 1.0.1 for fixes, 1.1.0 for new content, 2.0.0 for changes that break old sheets). Only the original author, or someone they agree with, should update a package; the reviewer checks this.

## Review

The automatic check must pass. Then GabrielGugg reviews the pull request and may ask for changes. Merged packages appear in the app's Hub within a minute or two.

By sending a package you agree that it may be distributed through this hub and the StatForge app.
