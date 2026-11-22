# Deutsch-Dino

Endloses Deutsch-Spiel für die Klassen 1 bis 4: Aufgaben lösen, Dino-Eier knacken und alle Dinos für den Dino-Park sammeln.

**Language:** German · **Category:** education · **Status:** stable · **Deployed version:** 4

## Notes

German spelling and grammar practice for primary school (Klasse 1–4). Progress is saved per signed-in child in their private area.

## Capabilities

| Capability | Used for |
|---|---|
| `db` | stores the app's data in the instance |
| `user` | knows who is signed in (for private areas and names) |

## External hosts

`fonts.googleapis.com`

## Install

1. Deploy `index.html` as the app `deutsch-dino` with the `title`, `description`, `themeColor` (as `theme_color`) and `capabilities` from [`lager.json`](lager.json).

## Tests

The [smoke tests](../../tests/smoke.spec.mjs) run for this app automatically.
