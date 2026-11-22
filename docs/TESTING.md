# Testing standard

Tests run in a real browser (Chromium via [Playwright](https://playwright.dev)) against `tools/lager-mock.js`, an in-memory stand-in for the Lager runtime. No test ever talks to a real Lager server or touches real data.

There are three levels. Levels 1 and 2 apply to every app automatically; level 3 is what an app adds itself.

## Level 1: static checks (`npm run validate`)

`tools/validate.mjs` checks every app without running it:

- manifest fields and limits (see [APP_STANDARD.md](APP_STANDARD.md))
- every `lager.use("x")` in the code is declared in `capabilities`, and every declared one is used
- inline scripts parse; no local script files; no claude.ai APIs
- `externalHosts` matches the CDN hosts the code references
- the icon uses only SVG that Lager accepts
- seed files are valid `[{path, data}]` with no private paths
- the privacy scan over the whole repository (see [PRIVACY.md](PRIVACY.md))

## Level 2: smoke tests (`tests/smoke.spec.mjs`)

For every folder in `apps/`, with no code of its own:

| Test | Passes when |
|---|---|
| loads without errors (light, dark) | no uncaught exception within 1.5 s and the page shows content |
| fits a phone screen | no horizontal scrolling at 375 px |
| only contacts the hosts it declares | every request goes to the app's own host or to `externalHosts` |

The app is served at `https://<slug>.lager.test/` so code that derives other apps' addresses from its own host works as on a real server. Seed files from `lager.json` are loaded into the mock database.

## Level 3: app tests (`apps/<slug>/tests/*.spec.mjs`)

Required for apps that have integrations or capabilities beyond `db` and `user`, and for any logic that would be costly to get wrong (streaks, money, parsing input from outside). Recommended for everything else.

Use the shared fixture:

```js
import { test, expect, seedOf } from "../../../tests/fixtures.mjs";

test("a linked habit ticks itself", async ({ openApp }) => {
  const { page, errors, ingested } = await openApp("habit-tracker", {
    seed: [],                               // documents to start with (default: the app's seed files)
    user: { id: "u1", name: "Ada", owner: true },
    completeReply: '{"ok":true}'            // what lager.complete() returns (default: rejects not_configured)
  });
  await page.evaluate(b => window.__lager.ingest("inbox", b), { v: 1, source: "test", events: [] });
  await expect(page.getByText("Work out")).toBeVisible();
  expect(errors).toEqual([]);
});
```

`openApp` returns:

- `page`: the Playwright page
- `errors`: uncaught exceptions
- `requests`: every URL the page requested
- `ingested`: every POST to an ingest endpoint of any app (`{slug, endpoint, origin, body}`), for testing apps that send data

Inside the page, `window.__lager` drives the mock: `store` (path → data), `writes` (every write), `downloads` (files offered for download), `ingest(collection, body)`, `set(path, data)`, `flush()` and `dump()`.

### Rules for app tests

- Test behaviour a person or another app can see: what is shown, what is stored, what is sent. Not internal function names.
- Assert on stored data through `window.__lager`, because that is the contract with the instance's existing data.
- Every test starts from its own data; never depend on another test.
- No fixed sleeps for results; use `expect.poll` or Playwright's auto-waiting assertions.
- Dates relative to today, not hard-coded, unless the test is about a specific date.
- Test data is invented. Never paste real exports, names or entries into a test (see PRIVACY.md).
- Name files after the feature: `activity-api.spec.mjs`, `streaks.spec.mjs`.

## Running

```sh
npm install
npx playwright install chromium        # or: export CHROME_PATH=/path/to/chrome
npm test                               # everything
npx playwright test apps/stillwater    # one app's tests
npx playwright test -g habit-tracker   # smoke and app tests whose title mentions the app
npx playwright show-report             # after a failure
```

## In GitHub Actions

`.github/workflows/ci.yml` runs on every push to `main` and every pull request:

1. **validate**: `npm run validate` (with the `PRIVACY_DENYLIST` secret) and `npm run catalog:check`
2. **secrets**: gitleaks over the full git history
3. **test**: all Playwright tests; the HTML report is uploaded as an artifact when something fails

A pull request can only be merged when all three pass (enable branch protection on `main` and mark the three jobs as required).
