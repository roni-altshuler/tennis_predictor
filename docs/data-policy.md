# External data policy

No external data is required for the bundled synthetic example or tests. Runtime code never downloads data or asks for a provider key.

## Reviewed historical source family

The Jeff Sackmann / Tennis Abstract ATP and WTA archive family has been inspected separately. The [Aneeshers archival mirror](https://github.com/Aneeshers/tennis-sackmann-archive) preserves source documentation and identifies its data as [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/): attribution, non-commercial use and share-alike requirements apply. Its [pinned licence notice](https://github.com/Aneeshers/tennis-sackmann-archive/blob/83733587353df8a41f2fd4f516147d5aa83f5a8d/LICENSE) grants no additional rights. Original ATP/WTA repository URLs were unavailable when checked.

These records, upstream document copies and derived historical outputs are **not included** here. No commercial, live-feed, universal-coverage or redistribution permission is inferred. The archive is a historical snapshot, and tournament-week labels do not prove when a result or correction became available.

## Separate retrieval requirements

Before obtaining or importing any real data:

1. Confirm the publisher, current terms and whether the intended use is permitted. Do not assume a repository's software licence also licenses its data.
2. Retain the required attribution, licence notices, permitted-use conditions and modification history outside this source repository.
3. Record the exact source version, retrieval time, file hashes, schema and competition/date coverage. Hashes establish byte identity, not legal rights or historical availability.
4. Establish result-completion/publication timestamps before claiming a point-in-time evaluation. Do not substitute tournament dates, scheduled starts or the final state of a partial point tape for verified outcome availability.
5. Keep raw data, private mappings, derived rating files and reports outside source control. Review redistribution rights before sharing any of them.

The local adapter expects the familiar ATP/WTA result-file schema, including tournament identity/date/level, surface, match identifier, winner/loser IDs, final score, best-of and round. Providing that schema does not grant rights to a source or establish that the source is complete. Other providers and competition tiers require independent validation; no provider account or paid service is configured here.
