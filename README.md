# Leo's Homecoming

A **rope bridge**, not a memory system. It keeps the key facts about Liv and her ongoing
work with Leo (Grok) in one small file between chat sessions, until Memory Machine is finished.

> 🔒 This repo is **private**. It holds personal context (court, health, family). Keep it private.

## The file

`memory/homecoming.json`:

```json
{
  "version": 1,
  "date": "ISO timestamp of last save",
  "updated_by": "leo | liv-app",
  "language_notes": "Iznite phonetic patterns",
  "personal_context": "family, court dates, health — only what Liv shares",
  "dev_status": "where each app stands",
  "flags": ["things Liv marked as important"],
  "session_log": [{ "date": "ISO", "summary": "one short paragraph per session" }]
}
```

Old versions are archived in `memory/history/YYYY-MM-DD.json` (and in git history).

## Protocol (for Liv)

1. Open a chat with Leo.
2. Say your normal greeting ("good morning", "hello", …).
3. Say **"open Homecoming"**.
   Leo reads `memory/homecoming.json` from this repo first, then answers with that context in mind.
4. Work / talk as usual. Say "flag this" for anything you want remembered for sure.
5. At the end say **"close Homecoming"** (or **"save Homecoming"**).
   Leo archives the old file to `memory/history/`, writes the updated facts, adds one line to
   `session_log`, and pushes it here.

Nothing happens automatically — it only runs when you say the words.

## Rules for Leo

- On "open Homecoming": read `memory/homecoming.json` (main branch). Mention the flags first. Don't
  re-ask things already recorded.
- On "close/save Homecoming": copy the current file to `memory/history/<UTC date>.json`, then write the
  new file with `updated_by: "leo"`, a fresh `date`, merged fields, and one new `session_log` entry.
  Only record facts Liv actually said — never guess or invent. Keep it short.

## The app (`app/`)

A tiny Expo (SDK 54) iPhone app:

- Shows last sync time and who last updated the memory.
- View/edit personal context, dev status, Iznite notes; add/remove flags; read the session log.
- **Sync now**: pulls the latest file from GitHub, or — if you made edits — saves them
  (archiving the previous version to `memory/history/` first). If Leo saved in the meantime it
  tells you to Pull first so nothing gets overwritten.
- Edits are cached on the phone until you sync.

### One-time token setup

1. On GitHub: **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Resource owner:** `livhappierapps`. **Repository access:** *Only select repositories* → `leo-homecoming`.
3. **Permissions → Repository permissions → Contents: Read and write** (Metadata: read-only is added automatically). Nothing else.
4. Pick an expiration (e.g. 90 days), generate, copy the token.
5. In the app tap **Settings**, paste it, **Save token**. It's stored in the iPhone Keychain (expo-secure-store), never in this repo.

If it ever leaks: revoke it on GitHub and paste a new one.

### Build

```bash
cd app
npm install
npx tsc --noEmit
eas build -p ios --profile production   # Expo account: livhappierapps
```

Binary assets (`app/assets/*.png`) are the default Expo template images; if they're missing in a fresh
clone, copy them from `npx create-expo-app --template blank-typescript@sdk-54`.
