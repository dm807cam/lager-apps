# Activity API v1

How apps tell the [Habit Tracker](../apps/habit-tracker) about finished activities, so habits linked to them tick themselves. Senders today: [Workout Tracker](../apps/workout-tracker) and [Stillwater](../apps/stillwater).

## Transport

The Habit Tracker declares two Lager ingest endpoints that add documents to its `inbox` collection:

| Endpoint | Auth | For |
|---|---|---|
| `https://habit-tracker.<apps-domain>/_ingest/activity` | none; only listed origins may send | apps on the same Lager server (sent from the browser) |
| `https://habit-tracker.<apps-domain>/_ingest/activity-key` | `Authorization: Bearer <key>` | scripts, phone shortcuts, other servers |

The receiving page processes the inbox while its owner has it open: each batch is validated, applied to `activities/<app>~<id>`, and deleted from the inbox.

Responses come from Lager: `202` accepted (no body), `403` origin not allowed, `404` no Habit Tracker on this server, `413` larger than 64 KB, `429` too many requests.

## Batch

One JSON object per request, at most 64 KB and 500 events:

```json
{
  "v": 1,
  "source": {
    "app": "workout-tracker",
    "name": "Workout Tracker",
    "url": "https://workout-tracker.example.com/",
    "kinds": [{ "kind": "workout", "label": "Workout", "unit": "min" }]
  },
  "sentAt": "2026-11-22T10:15:00.000Z",
  "events": [
    { "op": "upsert", "id": "s_1795200000000", "kind": "workout", "date": "2026-11-21",
      "start": "2026-11-21T16:00:00.000Z", "end": "2026-11-21T16:52:00.000Z",
      "minutes": 52, "value": 12450, "unit": "kg", "title": "Full Body",
      "url": "https://workout-tracker.example.com/#history" },
    { "op": "delete", "id": "s_1795100000000" }
  ]
}
```

| Field | Rule |
|---|---|
| `v` | `1` |
| `source` | object, or just the app slug as a string |
| `source.app` | required; lowercase slug, at most 40 characters; identifies the sender |
| `source.name`, `source.url` | optional display name and link |
| `source.kinds` | optional list of what the app reports; Habits offers them when linking a habit. A batch with only `kinds` and no events announces the app |

## Events

| Field | Rule |
|---|---|
| `id` | required, at most 120 characters; stable and unique within the sending app. Sending an id again replaces that activity |
| `op` | `upsert` (default) or `delete` (only `id` needed) |
| `kind` | required for upsert; lowercase slug such as `workout`, `meditation`, `reading` |
| `date` | the local day the activity counts for, `YYYY-MM-DD`. Required unless `start` is given (then the receiver's local day of `start` is used). Senders should always send it, because only they know the person's time zone |
| `start`, `end` | optional ISO 8601 times |
| `minutes` | optional number ≥ 0; habits can require a minimum per day (summed over that day's activities) |
| `value`, `unit` | optional main measure, e.g. volume in kg |
| `title` | optional label, at most 80 characters |
| `url` | optional deep link back into the sending app (http or https) |

Invalid events are skipped and counted; the rest of the batch is applied. A batch with a wrong `v` or a missing `source.app` is dropped whole. Receivers render all of it as text, never as HTML.

## What a sender should do

The reference implementation is the `habitBridge` function in `apps/workout-tracker/index.html`:

- Keep a record of what was sent (`data/users/<uid>/bridge/habit-tracker/state`: id → hash of the event) and post only changes: new and edited activities as upsert, removed ones as delete. The first run sends the whole history.
- Wait until the app has loaded its data from Lager before comparing, so an empty local cache on a new device is never mistaken for deletions.
- Resend everything every 30 days; upserts are idempotent, and this repairs anything that got lost.
- Derive the receiver's address from your own host (`habit-tracker.` + your apps domain); stop for the session on `403` or `404`, back off on other failures.
- Send only what a habit needs. Journal notes, moods, weights per set and other details stay in the sending app.

## Versioning

New optional fields may be added within v1; receivers ignore fields they do not know. Anything that changes the meaning of existing fields becomes v2, and receivers keep accepting v1.
