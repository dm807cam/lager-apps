# <img src="icon.svg" width="40" height="40" alt="" align="top"> Satchel

Encrypted file sharing: private and team folders, previews, zip downloads and share links with expiry and an optional password.

**Language:** English · **Category:** productivity · **Status:** beta · **Deployed version:** 1

Satchel is a small Dropbox for your own Lager server. Keep files in **My files**, share them with everyone on the instance in **Team**, or hand them to anyone with a **share link**. Every file is encrypted in the browser before it is stored, so the database only ever holds ciphertext.

## Features

- **My files** (private to you) and **Team** (everyone with contributor access), each with nested folders
- Upload files or whole folders: picker, drag and drop onto the window, or paste
- Upload tray with per-file progress, cancel and retry; uploads continue while you browse
- List and grid views, sort by name, date or size, search across all folders, filters for images, videos, audio, documents and archives
- Thumbnails for photos and videos, generated on the device and stored encrypted
- Previews for images, video, audio, PDF, text and code, and CSV as a table; arrow keys or swipe to page through
- Select several items (checkbox, Ctrl/⌘-click, long press on phones) to share, download as zip, move or delete them
- Move files between My files and Team
- **Share links** for one file, a selection or a whole folder:
  - their own key, carried in the link's `#fragment`, which browsers never send to the server
  - optional password (PBKDF2-SHA256, 310 000 iterations) on top of the key
  - expiry after 1 hour, 1 day, 7 days, 30 days or never
  - optional title and note
  - opens and downloads counted without cookies
  - delete a link to stop it working right away
- Recipient page: preview each file, download it, download everything as a zip, or (for members) save it to My files
- Light and dark mode, works at phone width and from the home screen

## How the encryption works

All cryptography is the browser's built-in WebCrypto; no third-party code is loaded.

| Part | How |
|---|---|
| File content | random 256-bit key per file; split into 180 KiB chunks, each AES-256-GCM with a random IV and the blob id, chunk number and chunk count as associated data (so chunks can't be swapped, reordered or dropped) |
| Thumbnail | 360 px WebP made on the device, encrypted with the file's key |
| File key, name, type | stored in the file's metadata document: in your private area for My files, in the team collection for Team |
| Share link | a random 256-bit link key in the URL fragment. The link document holds the title, note, sender name and, for every file, its name, size and file key, all AES-256-GCM encrypted with the link key |
| Password | with a password, the link key is PBKDF2-SHA256(password, random salt and the fragment key), so you need both the link and the password |

## Who can see what

| | Can read | Can change |
|---|---|---|
| My files (names, folders, keys) | only you (`data/users/<id>/…`, closed even to the instance owner) | only you |
| Team (names, folders, keys) | everyone with **contributor** access or higher | everyone with contributor access |
| Encrypted chunks (`blobs/<id>/…`) | everyone who can open the instance, guests too, but only as ciphertext | only the uploader |
| Link documents (`links/<id>/…`) | everyone who can open the instance, as ciphertext | only the person who made the link |
| Link counters (`hits`) | contributors | anyone can add (no reading, changing or deleting) |

**Not protected against:**

- **The server operator and the code.** The keys for My files sit in your private area in the database. Whoever can read the raw database file or change the app's code could read your files. Run Satchel on a server whose operator you trust (typically: your own).
- **Metadata.** The server sees how many files each person stores, their sizes and when they were uploaded, and when links are opened.
- **Copies.** Deleting a link stops new downloads; files someone already downloaded stay with them. Expiry is checked by the recipient's browser and the link document is deleted the next time you open Satchel after it expires.

## Data

| Path | Content |
|---|---|
| `data/users/<id>/drive` | your view and sort settings |
| `data/users/<id>/drive/files/<fileId>` | `{name, type, size, folder, key, blob: {o, id}, thumb, createdAt, updatedAt, by, byName}` |
| `data/users/<id>/drive/folders/<folderId>` | `{name, parent, createdAt, updatedAt, by, byName}` |
| `data/users/<id>/drive/links/<linkId>` | your copy of each link: secret, title, counts, expiry (so you can copy the link again) |
| `team/space/files/<fileId>`, `team/space/folders/<folderId>` | the same as above, for Team |
| `blobs/<id>/files/<blobId>` | manifest `{v, size, chunks, chunkSize, createdAt}` |
| `blobs/<id>/files/<blobId>/c/<n>` | encrypted chunk `{iv, d}` |
| `blobs/<id>/files/<blobId>/t/0` | encrypted thumbnail `{iv, d, t}` |
| `links/<id>/l/<linkId>` | `{v, createdAt, expiresAt, pw: {salt, iter} \| null, box: {iv, d}}` |
| `hits/<auto>` | `{l: linkId, o: ownerId, e: "open" \| "dl", at}` |

Satchel tidies up after itself: when you open it, it deletes your stored blobs that no file refers to any more (after an hour, so uploads in progress are safe) and the link documents of your expired links.

## Capabilities

| Capability | Used for |
|---|---|
| `db` | metadata, encrypted chunks and links, with the access rules above |
| `user` | your id and name, and whether you may add files |

Satchel stores files in the database rather than through `assets`, so any file type works and contributors (not only managers) can upload.

## Install

1. Deploy `index.html` as the app `satchel` with the `title`, `description`, `themeColor` (as `theme_color`), `icon.svg` (as `icon_svg`) and `capabilities` (including the `db.rules`) from [`lager.json`](lager.json).
2. Decide who uses it:
   - **Just you:** keep the instance `private`.
   - **A team:** share the instance with each person at level `interact`, or set visibility to `users`.
   - **Links for people without an account:** set visibility to `public`. Guests then see only the link they open, never your files or Team. Note that with `public` every signed-in user of the server also gets the level for signed-in users (default `interact`, see `list_shares`) and so can use My files and Team.
3. Open the URL and upload something.

## Limits

- Files up to 250 MB each; in practice the instance's storage (default 50 MB) is the limit. Encryption and storage as text add about a third.
- Uploads go at the database's write rate (300 writes a minute per person), about 0.9 MB/s; downloads at about 1.8 MB/s.
- Each space shows up to 1000 files and 1000 folders.
- A link holds up to 500 files. It shares files as they are when you create it; files added to a folder later aren't included.
- Previews decrypt the whole file first, up to 60 MB (120 MB for video and audio).
- Zip downloads are built in memory without compression.

## Tests

The [smoke tests](../../tests/smoke.spec.mjs) run for this app automatically. [`tests/e2e.spec.mjs`](tests/e2e.spec.mjs) uploads through the UI and checks that only ciphertext is stored, files round-trip byte for byte (also across several chunks), names can't inject HTML, folders and moves work, share links open for a guest, passwords are enforced, and deleted and expired links stop working.
