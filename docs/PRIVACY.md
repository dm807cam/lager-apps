# Privacy rules

This repository is public. Anything committed here, including in old commits, can be read by anyone. The apps run on private servers with personal data; none of that data, and nothing that identifies the people or servers behind it, belongs here.

## Never commit

- **Data from an instance**: exports, database dumps, screenshots with real entries, real values in tests or seed files. Seed files hold only generic starter content (example facts, demo posts).
- **Anything under `data/users/`**, in any file.
- **Server addresses**: the domain of a real Lager server, instance URLs, IP addresses. In manifests write `https://<slug>.${LAGER_APPS_DOMAIN}`; in examples use `example.com`.
- **Secrets**: Lager tokens, ingest keys, API keys, passwords, private keys, `.env` files.
- **Personal details** in code or prompts: real names, e-mail addresses, health or training details, financial figures, children's names. Use invented examples.

## How it is enforced

1. `npm run validate` scans every tracked file for token formats (GitHub, AWS, Google, Slack, JWT, private keys, keys in URLs), e-mail addresses and IP addresses.
2. It also checks a **private denylist**: terms that must never appear, such as your server's domain or your real name. Because listing them in the repository would publish them, they come from
   - the GitHub Actions secret `PRIVACY_DENYLIST` (one term per line) in CI, and
   - an untracked `.privacy-denylist` file locally (ignored by git).
   Matches are reported by file, line and term number only, never by the term itself, so CI logs stay clean.
3. CI runs [gitleaks](https://github.com/gitleaks/gitleaks) over the full history.
4. The pull request template asks for a manual check.

## If something slipped through

Deleting it in a new commit is not enough: it stays in the history. Rotate the secret first (new Lager token, new ingest key), then rewrite the history (`git filter-repo`) and force-push, and ask GitHub support to purge cached views if needed.
