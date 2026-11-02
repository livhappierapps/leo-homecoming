# memory/history

Archive of previous versions of `memory/homecoming.json`.

Before the Homecoming app (or Leo) overwrites `memory/homecoming.json`, it copies the
current version here as `memory/history/YYYY-MM-DD.json` (UTC date). If several saves
happen on the same day, that day's file holds the version from just before the latest save.
Git history keeps every version as well.
