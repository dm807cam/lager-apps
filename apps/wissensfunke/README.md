# <img src="icon.svg" width="40" height="40" alt="" align="top"> Wissensfunke

Jeden Tag ein überraschender Funfact aus der Wissenschaft – mit Archiv und Merkliste.

**Language:** German · **Category:** education · **Status:** stable · **Deployed version:** 4

## Notes

**Import `seed/facts.json` after the first deploy**: the app shows one of these facts per day. Favourites are stored in each viewer's private area.

## Capabilities

| Capability | Used for |
|---|---|
| `db` | stores the app's data in the instance |
| `user` | knows who is signed in (for private areas and names) |

Database rules: `facts` read view / write owner.

## Install

1. Deploy `index.html` as the app `wissensfunke` with the `title`, `description`, `themeColor` (as `theme_color`), `icon.svg` (as `icon_svg`) and `capabilities` from [`lager.json`](lager.json).
2. Import `seed/facts.json` with `import_data`.

## Tests

The [smoke tests](../../tests/smoke.spec.mjs) run for this app automatically. App tests: [`facts.spec.mjs`](tests/facts.spec.mjs).
