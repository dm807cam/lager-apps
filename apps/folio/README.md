# <img src="icon.svg" width="40" height="40" alt="" align="top"> Folio

An ebook reader for EPUB and text: pages or scroll, themes and fonts, highlights and notes, synced progress, reading stats and Habits.

**Language:** English · **Category:** reading · **Status:** beta · **Deployed version:** 1

## What it does

- **Library.** Add DRM-free EPUB 2/3 books, plain text (Project Gutenberg headers and licences are removed, chapters detected), Markdown and HTML, by the + button or by dropping files on the page. Covers, a "continue reading" card tinted from the cover, filters (reading, to read, finished), sorting and search.
- **Reader.** Real pages built from CSS columns, with swipe, tap zones, arrow keys and the mouse wheel; two pages side by side on wide screens; or continuous scroll. Six themes (auto, paper, sepia, dusk, night, black), six fonts, size, line spacing, margins, justification, hyphenation, indented or spaced paragraphs. Contents with nested entries, a scrubber, search in the book, "back to where you were" after jumps, footnotes that open in place, and a screen that stays on while you read.
- **Highlights and notes** in four colours, bookmarks, and a notebook across all books, exportable as Markdown.
- **Progress everywhere.** The place in each book is a character offset, not a page number, so it stays correct across devices, fonts and screen sizes. If another device is further along, the reader offers to jump there.
- **Stats.** Daily goal ring, streaks, this week, a yearly heatmap, a yearly book challenge, reading speed, time left in the chapter and the book from your own speed, and CSV/JSON export.

## Habits

Every reading session (a minute or more) is sent to the [Habit Tracker](../habit-tracker) on the same server through the [Activity API v1](../../docs/ACTIVITY_API.md) as kind `reading`, with its minutes and the pages read (1,500 characters a page). Linked habits such as "Read 15 minutes" tick themselves. Book titles are sent; highlights, notes and the books themselves never are.

Reading time counts while a book is open and visible and you have turned a page, scrolled or tapped recently (three times the time the current page normally takes, between two and ten minutes). A break of more than ten minutes starts a new session.

## Data

Everything is private to the signed-in person, under `data/users/<uid>/`:

| Path | Holds |
|---|---|
| `lib/books/<id>` | metadata, chapter list (title, characters, parts), contents with offsets, cover, progress `{ch, off, pct, at, dev}`, `finishedAt` |
| `lib/books/<id>/ch/<chapter>_<part>` | sanitised chapter HTML, at most 60,000 characters per document |
| `lib/marks/<id>` | highlights (`kind: "hl"`, `start`/`end` offsets in the chapter, colour, note) and bookmarks (`kind: "bm"`) |
| `lib/sessions/<id>` | reading sessions: book, start, end, `ms`, characters read |
| `settings` | reading settings and goals |
| `bridge/habit-tracker/state` | what was already sent to Habits |

Pictures and covers are uploaded with `assets`; without it, small pictures are kept inline. Chapter HTML is rebuilt from the book on import: only known tags survive, scripts, styles, forms and event attributes are dropped, and the book's CSS only contributes italic, bold, centred, right-aligned, small caps, underline, no-indent and hidden.

## Capabilities

| Capability | Used for |
|---|---|
| `db` | the library, notes, sessions and settings |
| `assets` | covers and pictures from books (`upload: interact`, so contributors can add books) |
| `downloads` | Markdown notes, CSV sessions and the JSON export |
| `user` | the private area of the signed-in person |

External hosts: `cdn.jsdelivr.net` (JSZip, loaded only when an EPUB is added) and Google Fonts (Literata, Source Serif 4, EB Garamond, Atkinson Hyperlegible).

## Integrations

- `activity-api/v1`: sender

## Install

1. Deploy `index.html` as the app `folio` with the `title`, `description`, `themeColor` (as `theme_color`), `icon.svg` (as `icon_svg`) and `capabilities` from [`lager.json`](lager.json).
2. The Habit Tracker must list `https://folio.${LAGER_APPS_DOMAIN}` among the origins of its `activity` endpoint (it does from Habits version 3).

## Tests

The [smoke tests](../../tests/smoke.spec.mjs) run for this app automatically. App tests, with invented books from [`make-book.mjs`](tests/make-book.mjs): [`import.spec.mjs`](tests/import.spec.mjs), [`reading.spec.mjs`](tests/reading.spec.mjs), [`habit-bridge.spec.mjs`](tests/habit-bridge.spec.mjs). JSZip comes from `node_modules` in the tests, so they don't need the CDN.
