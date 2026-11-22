# App standard

Every app in this repository follows the same shape, so it can be validated, tested, listed and deployed by tools without knowing anything about the app itself. `tools/validate.mjs` enforces the rules marked **must**.

## Folder

```
apps/<slug>/
  index.html        must: the complete app
  lager.json        must: the manifest
  README.md         must: description, data model, install notes
  icon.svg          should: square app icon
  seed/*.json       may: starter data
  tests/*.spec.mjs  should for apps with logic beyond display (see TESTING.md)
```

The folder name **must** equal the Lager slug: lowercase letters, digits and hyphens, at most 63 characters.

## The app file

- **must** be one self-contained HTML file starting with `<!doctype html>`, with `<meta name="viewport">` and a `<title>`. Lager serves exactly this file, so there are no local script or style files; libraries come inline or from a CDN listed in `externalHosts`.
- **must** keep its data in `lager.use("db")`. `localStorage` and friends are allowed only as an offline cache (the validator warns so it stays visible).
- **must** reach Lager only through `window.lager`. No `window.claude` or `window.storage` (claude.ai APIs).
- **must** call `lager.use("x")` only for capabilities declared in `lager.json` (`db`, `user` and `permissions` are always there).
- **must** treat everything from outside (ingest endpoints, guest writes, other apps) as untrusted: render it with `textContent` or escaping, never as HTML.
- **should** follow the phone's light and dark mode and work at 375 px width without horizontal scrolling (the smoke test checks both).
- **should** check every `lager.use()` result for `null` and hide the feature instead of breaking.

## lager.json

```json
{
  "$schema": "../../schema/lager-app.schema.json",
  "slug": "habit-tracker",
  "title": "Habits",
  "description": "One plain sentence, at most 200 characters.",
  "version": 1,
  "status": "beta",
  "language": "en",
  "category": "health",
  "themeColor": "#c2521f",
  "entry": "index.html",
  "icon": "icon.svg",
  "capabilities": { "db": {}, "user": {} },
  "seed": ["seed/facts.json"],
  "externalHosts": ["cdn.jsdelivr.net"],
  "integrations": { "activity-api/v1": "receiver" }
}
```

| Field | Rule |
|---|---|
| `slug` | must equal the folder name |
| `title` | at most 100 characters |
| `description` | one line, at most 200 characters (Lager's limit) |
| `version` | the Lager version number this code was deployed as; bump it with every deploy |
| `status` | `stable` (default), `beta` or `deprecated` |
| `language` | two-letter code of the UI language |
| `category` | one of the categories in `schema/lager-app.schema.json` |
| `themeColor` | hex colour matching the icon background |
| `capabilities` | exactly what to pass to `deploy_app`. Origins of other apps on the same server are written `https://<slug>.${LAGER_APPS_DOMAIN}`, never with a real domain |
| `seed` | files of `[{path, data}]` to import after the first deploy; at most 1000 documents per file; never under `data/users/` |
| `externalHosts` | every non-Lager host the app loads from; the smoke test fails if the app contacts any other |
| `integrations` | cross-app APIs the app sends or receives, e.g. `"activity-api/v1": "sender"` |

## Icon

`icon.svg` uses the subset of SVG Lager accepts for app icons: root `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">`, a filled background covering the square, shapes and gradients only. No text, images, masks, filters, `use`, `style` or `class`. The validator checks the element and attribute lists.

## Versions and deploying

The code in `main` is the source of truth. After changing an app, deploy it to Lager, then set `version` in `lager.json` to the version Lager returned, and run `npm run catalog`. Data formats must stay backward compatible: instances keep their data across versions.

## Adding an app

1. Create `apps/<slug>/` with the files above.
2. `npm run validate -- <slug>` until there are no errors.
3. Add `tests/*.spec.mjs` if the app does more than display data.
4. `npm run catalog`, then `npm run check`.
5. Open a pull request; the checklist in the template covers privacy.
