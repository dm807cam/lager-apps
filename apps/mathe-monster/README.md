# Mathe-Monster

Endloses Mathe-Spiel für die Klassen 1 bis 4: Aufgaben lösen, Monster besiegen, Münzen sammeln und Helden freischalten.

**Language:** German · **Category:** education · **Status:** stable · **Deployed version:** 4

## Notes

Maths practice for primary school (Klasse 1–4). Progress is saved per signed-in child in their private area. Uses the Baloo 2 font from Google Fonts.

## Capabilities

| Capability | Used for |
|---|---|
| `db` | stores the app's data in the instance |
| `user` | knows who is signed in (for private areas and names) |

## External hosts

`fonts.googleapis.com`

## Install

1. Deploy `index.html` as the app `mathe-monster` with the `title`, `description`, `themeColor` (as `theme_color`) and `capabilities` from [`lager.json`](lager.json).

## Tests

The [smoke tests](../../tests/smoke.spec.mjs) run for this app automatically.
