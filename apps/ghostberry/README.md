# Ghostberry

A Ghost-style blog: write with cards, publish or schedule, tags, authors, members, Ghost themes. Almanac is the default theme.

**Language:** English · **Category:** publishing · **Status:** beta · **Deployed version:** 1

## Notes

The editor (admin) is not in `index.html`: it is a larger bundle stored in the database. **Import `seed/system.json` after the first deploy**, or the admin shows "The admin bundle is not installed yet". The Almanac theme and its fonts load from jsDelivr, pinned to a commit of the `ghostberry` repository.

## Capabilities

| Capability | Used for |
|---|---|
| `assets` | stores uploaded files |
| `db` | stores the app's data in the instance |
| `downloads` | offers exports as files |
| `user` | knows who is signed in (for private areas and names) |

Database rules: `settings` read view / write admin, `themes` read view / write admin, `posts` read view / write admin, `html` read view / write admin, `tags` read view / write admin, `authors` read view / write admin, `system` read view / write owner, `drafts` read admin / write admin, `draftbody` read admin / write admin, `revisions` read admin / write admin, `subscribers` read admin / write anyone.

## External hosts

`cdn.jsdelivr.net`, `data.jsdelivr.com`

## Install

1. Deploy `index.html` as the app `ghostberry` with the `title`, `description`, `themeColor` (as `theme_color`) and `capabilities` from [`lager.json`](lager.json).
2. Import `seed/system.json` with `import_data`.

## Tests

The [smoke tests](../../tests/smoke.spec.mjs) run for this app automatically.
