# <img src="icon.svg" width="40" height="40" alt="" align="top"> Sealed

End-to-end encrypted messenger: private chats, groups and photos with signed messages, safety numbers and disappearing messages.

**Language:** English · **Category:** social · **Status:** beta · **Deployed version:** 1

Everyone who has access to the same instance can find each other and chat, much like a messenger where everyone on the server is in your address book. Messages and photos are encrypted in the browser before they are stored; the server, its owner and other users only ever see ciphertext.

## Features

- One-to-one chats and groups (the creator is admin: rename, add, remove; anyone can leave)
- Photos, re-encoded on the device (strips location and camera metadata), then encrypted
- Replies, copy, delete for me, delete for everyone
- Read receipts (can be turned off; off means you neither send nor see them)
- Disappearing messages per chat: 1 hour, 24 hours, 7 days, 30 days
- Safety numbers (60 digits, identical on both phones) and a "verified" mark per contact
- Key-change warnings that pause sending until the new key is reviewed
- Block contacts, nicknames, unread counts, light and dark mode, works on a phone home screen

## How the encryption works

All cryptography is the browser's built-in WebCrypto. No third-party code is loaded.

| Part | Algorithm |
|---|---|
| Identity | ECDSA P-256 (signing) + ECDH P-256 (key agreement), one pair each per person |
| Key storage | private keys AES-256-GCM encrypted under PBKDF2-SHA256 (600 000 iterations, random salt) from the passphrase, stored in the person's private area `data/users/<id>/keyring` |
| Message | random 256-bit content key, AES-256-GCM; header (message id, sender, chat, time, ephemeral key) bound as associated data |
| Key wrapping | per message a fresh ephemeral ECDH key; per recipient ECDH → HKDF-SHA256 (salt: message id, info: ephemeral key and recipient) → AES-256-GCM wrap of the content key |
| Authenticity | ECDSA signature by the sender over header, ciphertext and all wrapped keys; verified against the pinned key of the sender |
| Contacts | trust on first use, pinned in the encrypted vault; safety numbers for out-of-band verification |
| Vault | contacts, chats and settings AES-256-GCM encrypted with a random vault key that lives inside the encrypted keyring; the document path is bound as associated data |

The passphrase never leaves the device. "Stay unlocked on this device" keeps the passphrase-derived key as a non-exportable WebCrypto key in IndexedDB of that browser; "Lock" always asks for the passphrase again.

## Threat model

Protected against:

- the server's storage, backups and exports, other users of the instance and the instance owner reading messages, photos, contacts or chat names
- forged or altered messages (shown as "couldn't verify")
- a substituted public key in the directory, once you have verified safety numbers; any later key change is flagged and pauses sending

Not protected against:

- **The code itself.** Lager serves the app's HTML. Whoever controls the server could serve modified code that leaks keys. Run Sealed on a server whose operator you trust (typically: your own).
- **Metadata.** The server sees which accounts exchange messages, when, and how large they are. It does not see content, photos or group names.
- **Forward secrecy.** History is kept server-side so every device can show it, which means a stolen passphrase plus the keyring can decrypt old messages. Use disappearing messages for sensitive chats and reset your keys if you suspect a leak.
- An unlocked device in someone else's hands.

## Data

| Path | Content | Who can read | Who can write |
|---|---|---|---|
| `directory/<id>` | name and public keys, self-signed | everyone with access | only `<id>` |
| `inbox/<id>/msgs/<msgId>` | encrypted messages for `<id>` | only `<id>` | anyone with write access (drop box; ids are random and unreadable to others) |
| `data/users/<id>/keyring` | encrypted private keys | only `<id>` | only `<id>` |
| `data/users/<id>/vault`, `…/vault/contacts/*`, `…/vault/chats/*` | encrypted settings, contacts, chats | only `<id>` | only `<id>` |

These rules are declared in `lager.json` under `capabilities.db.rules`. Lager's private area `data/users/<id>/` is closed even to the instance owner.

## Capabilities

| Capability | Used for |
|---|---|
| `db` | directory of public keys, encrypted inboxes, encrypted private vault (with access rules) |
| `user` | the signed-in person's id and default display name |

## Install

1. Deploy `index.html` as the app `sealed` with the `title`, `description`, `themeColor` (as `theme_color`), `icon.svg` (as `icon_svg`) and `capabilities` (including the `db.rules`) from [`lager.json`](lager.json).
2. Set the instance's visibility to `users` so every signed-in person on the server can join, or share it with specific people at level `interact`. People with only `view` access can't create keys.
3. Everyone opens the URL, picks a passphrase and appears in each other's "New chat" list.

## Limits

- Photos are shrunk to fit about 160 KB before encryption (Lager's 256 KiB document limit).
- A chat shows its newest 1000 messages; the chat list looks at the newest 1000 messages overall.
- Groups up to 64 members.
- No push notifications: the tab title shows the unread count while the app is open.

## Tests

The [smoke tests](../../tests/smoke.spec.mjs) run for this app automatically. [`tests/e2e.spec.mjs`](tests/e2e.spec.mjs) runs two people against the mock runtime and checks that keys are stored only encrypted, a wrong passphrase is refused, messages arrive and the server holds only ciphertext, tampered messages are rejected, message text can't inject HTML, key changes pause sending, drafts survive background updates, and safety numbers match on both sides.
