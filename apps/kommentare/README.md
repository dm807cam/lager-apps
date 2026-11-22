# Kommentare

Einbettbares Kommentarsystem mit verschachtelten Antworten, Daumen hoch/runter, Moderation und Site-Auswahl für mehrere Websites.

**Language:** German · **Category:** publishing · **Status:** stable · **Deployed version:** 4

## Notes

An embeddable comment box with moderation. The instance must be **public** so visitors can read and write; you add the websites that may embed it on the instance page. Opening the app directly shows the moderation view.

## Capabilities

| Capability | Used for |
|---|---|
| `db` | stores the app's data in the instance |
| `downloads` | offers exports as files |
| `embed` | can be shown inside other websites |
| `user` | knows who is signed in (for private areas and names) |

Database rules: `settings` read view / write admin, `approved` read view / write admin, `inbox` read admin / write anyone, `open` read view / write anyone, `votes` read view / write anyone.

## Install

1. Deploy `index.html` as the app `kommentare` with the `title`, `description`, `themeColor` (as `theme_color`) and `capabilities` from [`lager.json`](lager.json).

## Tests

The [smoke tests](../../tests/smoke.spec.mjs) run for this app automatically.
