# Satz

Fokussiertes Schreiben für ganze Bücher – mit Kapiteln, Fokusmodus und einer sortierbaren Ablage für Gedankenfetzen.

**Language:** German · **Category:** writing · **Status:** stable · **Deployed version:** 3

## Notes

Books, chapters and notes are stored in each writer's private area. Export as a file through `downloads`.

## Capabilities

| Capability | Used for |
|---|---|
| `db` | stores the app's data in the instance |
| `downloads` | offers exports as files |
| `user` | knows who is signed in (for private areas and names) |

## External hosts

`cdn.jsdelivr.net`

## Install

1. Deploy `index.html` as the app `satz` with the `title`, `description`, `themeColor` (as `theme_color`) and `capabilities` from [`lager.json`](lager.json).

## Tests

The [smoke tests](../../tests/smoke.spec.mjs) run for this app automatically.
