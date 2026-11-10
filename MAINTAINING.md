# Maintaining the hub

[Leia em português](MAINTAINING.pt-BR.md)

Notes for the hub owner (GabrielGugg).

## One-time setup

1. Create the public repository `GabrielGugg/statforge-hub` and upload these files to `main`.
2. **Settings › Actions › General › Workflow permissions**: choose **Read and write permissions**. The "Build index" workflow needs it to commit `index.json`.
3. On the same page, keep **Require approval for first-time contributors** for pull requests from forks, so nobody runs workflows here without you seeing it first.
4. Run **Actions › Build index › Run workflow** once to create `index.json`.

Branch protection is optional: only you can push to `main`; everyone else can only send pull requests. If you add a ruleset, do not require pull requests on `main`, or the index workflow will not be able to commit.

## Reviewing a pull request

1. Wait for **Check packages** to pass. It reports exactly what is wrong when it fails.
2. Look at **Files changed**: only `packages/`, content the author may share, sensible ids and names.
3. If someone updates a package they did not create, ask the original author first.
4. **Merge**. The index is rebuilt and the package appears in the app.

## After each StatForge release

1. With both repositories side by side, run `node scripts/update-vendor.mjs ../statforge`. It refreshes `builder/vendor/statforge`, the only copy of the engine the builder uses.
2. Run `node --test builder/tests/*.test.mjs` and commit `builder/vendor`.

## Workflows

The workflows pin every GitHub Action to a commit (the tag is in a comment). To update one, replace the commit with the one of the new tag. Checkouts that never push use `persist-credentials: false`.

## Submissions by issue

Download the attached file, put it in `packages/<folder>/`, commit, and close the issue with a thank-you.

## Removing a package

Delete its file and commit. Players who already installed it keep their copy; it just disappears from the Hub list.
