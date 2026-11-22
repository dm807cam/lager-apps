# <img src="icon.svg" width="40" height="40" alt="" align="top"> Habits

Daily and weekly habits with streaks and a yearly heatmap. Your workout and meditation apps tick linked habits by themselves.

**Language:** English · **Category:** health · **Status:** beta · **Deployed version:** 2

## Notes

Receives finished activities from other apps through the [Activity API v1](../../docs/ACTIVITY_API.md). In `capabilities`, replace `${LAGER_APPS_DOMAIN}` with your apps domain so Workout Tracker and Stillwater on the same server may send. Scripts and phone shortcuts use the `activity-key` endpoint; its key is shown to the owner in the app under Apps.

## Capabilities

| Capability | Used for |
|---|---|
| `db` | stores the app's data in the instance |
| `ingest` | receives data from outside (another website, app or script) |
| `user` | knows who is signed in (for private areas and names) |

## Integrations

- `activity-api/v1`: receiver

## Install

1. Deploy `index.html` as the app `habit-tracker` with the `title`, `description`, `themeColor` (as `theme_color`), `icon.svg` (as `icon_svg`) and `capabilities` from [`lager.json`](lager.json).

## Tests

The [smoke tests](../../tests/smoke.spec.mjs) run for this app automatically. App tests: [`activity-api.spec.mjs`](tests/activity-api.spec.mjs).
