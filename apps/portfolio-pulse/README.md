# <img src="icon.svg" width="40" height="40" alt="" align="top"> Portfolio Pulse

Log your portfolio value and see it plotted over time against 1–10% yearly growth lines.

**Language:** English · **Category:** finance · **Status:** stable · **Deployed version:** 3

## Notes

Values are stored in the instance's shared collections, so everyone the instance is shared with sees them; keep it private.

## Capabilities

| Capability | Used for |
|---|---|
| `db` | stores the app's data in the instance |

## Install

1. Deploy `index.html` as the app `portfolio-pulse` with the `title`, `description`, `themeColor` (as `theme_color`), `icon.svg` (as `icon_svg`) and `capabilities` from [`lager.json`](lager.json).

## Tests

The [smoke tests](../../tests/smoke.spec.mjs) run for this app automatically.
