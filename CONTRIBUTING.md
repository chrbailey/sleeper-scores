# Contributing

Thanks for looking.

## Before opening a PR

1. **Open an issue first** for anything larger than a typo.
2. **If you change a number, change the explanation.** Every computed value on the site has a "show your work" panel. If you touch `engine/`, update the corresponding `explain.js` output.
3. **Match the existing code style.** ES modules, no build step, no transpile.
4. **Test in-browser.** Load `index.html` locally and verify the card renders and the explain panel shows correct math.

## What this project will not accept

sleeper-scores is a zero-backend, zero-build, "show your work" project. The architecture rule is load-bearing: `engine/` has zero imports from `api/` or `ui/`. Changes that break these invariants will be declined.

- PRs that add a build step (webpack, vite, esbuild). The site must be editable by opening files in a browser.
- PRs that add a backend, database, or any server-side component.
- PRs that introduce opaque scoring — every number on the site must be explainable via the explain panel, with formulas, inputs, and caveats shown.
- PRs that add authentication, user accounts, or any data collection about visitors.
- PRs that upload user league or roster data to any external service.
- PRs that violate the dependency direction (`engine/` importing from `api/` or `ui/`).

## Reporting security issues

See [SECURITY.md](SECURITY.md). Do not file security issues in the public tracker.

## Author

[Christopher Bailey](https://github.com/chrbailey).
