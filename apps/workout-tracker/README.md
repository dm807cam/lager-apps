# <img src="icon.svg" width="40" height="40" alt="" align="top"> Workout Tracker

Workout tracker: plans, custom exercises, workouts from a plan or on the go, records, charts, a yearly heatmap and an AI coach.

**Language:** English · **Category:** health · **Status:** stable · **Deployed version:** 5

## Notes

The coach plans the next session with `lager.complete`; without a model configured on the server the app falls back to its own progression rules. Finished workouts are sent to the Habit Tracker on the same server through the [Activity API v1](../../docs/ACTIVITY_API.md).

## Capabilities

| Capability | Used for |
|---|---|
| `complete` | asks the server's language model |
| `db` | stores the app's data in the instance |
| `downloads` | offers exports as files |
| `user` | knows who is signed in (for private areas and names) |

## Integrations

- `activity-api/v1`: sender

## Install

1. Deploy `index.html` as the app `workout-tracker` with the `title`, `description`, `themeColor` (as `theme_color`), `icon.svg` (as `icon_svg`) and `capabilities` from [`lager.json`](lager.json).

## Tests

The [smoke tests](../../tests/smoke.spec.mjs) run for this app automatically. App tests: [`habit-bridge.spec.mjs`](tests/habit-bridge.spec.mjs).
