# <img src="icon.svg" width="40" height="40" alt="" align="top"> Gesichtsschutz

Erkennt Gesichter in deinen Fotos und macht sie direkt im Browser unkenntlich – irreversibel und ohne Upload.

**Language:** German · **Category:** privacy · **Status:** stable · **Deployed version:** 3

## Notes

Faces are detected and blurred entirely in the browser; photos never leave the device. The face-detection model is loaded from jsDelivr. The app stores nothing.

## Capabilities

None: the app runs entirely in the browser and stores nothing.

## External hosts

`cdn.jsdelivr.net`

## Install

1. Deploy `index.html` as the app `gesichtsschutz` with the `title`, `description`, `themeColor` (as `theme_color`), `icon.svg` (as `icon_svg`) and `capabilities` from [`lager.json`](lager.json).

## Tests

The [smoke tests](../../tests/smoke.spec.mjs) run for this app automatically.
