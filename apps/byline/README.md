# <img src="icon.svg" width="40" height="40" alt="" align="top"> Byline

Cookie-free blog analytics: readers, read time, read-through, sources, trending posts and the best time to publish.

**Language:** English · **Category:** analytics · **Status:** beta · **Deployed version:** 1

## Notes

Paste the snippet the app shows into your blog; page views arrive through the `hits` ingest endpoint (no key; you add your blog's address on the instance page or in the app). No cookies, no IP addresses: Lager's daily visitor id counts unique readers. Optional AI summaries use `lager.complete`.

## Capabilities

| Capability | Used for |
|---|---|
| `complete` | asks the server's language model |
| `db` | stores the app's data in the instance |
| `downloads` | offers exports as files |
| `ingest` | receives data from outside (another website, app or script) |

Database rules: `hits` read admin / write admin, `state` read admin / write admin, `locks` read admin / write admin, `sites` read view / write admin, `chunks` read view / write admin, `settings` read view / write admin.

## Install

1. Deploy `index.html` as the app `byline` with the `title`, `description`, `themeColor` (as `theme_color`), `icon.svg` (as `icon_svg`) and `capabilities` from [`lager.json`](lager.json).

## Tests

The [smoke tests](../../tests/smoke.spec.mjs) run for this app automatically.
