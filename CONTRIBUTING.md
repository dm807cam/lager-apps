# Contributing

1. Read the [app standard](docs/APP_STANDARD.md), the [testing standard](docs/TESTING.md) and the [privacy rules](docs/PRIVACY.md).
2. Create or change `apps/<slug>/`, then run `npm run validate -- <slug>` and `npx playwright test apps/<slug>`.
3. Run `npm run catalog` so `catalog.json` and the README table match the manifests.
4. Run `npm run check`, then open a pull request. CI repeats every check.
