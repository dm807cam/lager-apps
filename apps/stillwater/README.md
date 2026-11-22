# <img src="icon.svg" width="40" height="40" alt="" align="top"> Stillwater

A calm meditation timer with breathing guide, synthesised bells and ambience, a journal, and stats with streaks and a yearly heatmap.

**Language:** English · **Category:** health · **Status:** stable · **Deployed version:** 4

## Notes

Sends finished sessions (date, length, practice) to the Habit Tracker on the same server through the [Activity API v1](../../docs/ACTIVITY_API.md). Journal notes and moods are never sent.

## Capabilities

| Capability | Used for |
|---|---|
| `db` | stores the app's data in the instance |
| `downloads` | offers exports as files |
| `user` | knows who is signed in (for private areas and names) |

## Integrations

- `activity-api/v1`: sender

## Install

1. Deploy `index.html` as the app `stillwater` with the `title`, `description`, `themeColor` (as `theme_color`), `icon.svg` (as `icon_svg`) and `capabilities` from [`lager.json`](lager.json).

## Tests

The [smoke tests](../../tests/smoke.spec.mjs) run for this app automatically. App tests: [`habit-bridge.spec.mjs`](tests/habit-bridge.spec.mjs).
