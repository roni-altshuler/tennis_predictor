# Architecture

The public implementation is a small offline Python module. It has no server, database, background job, authentication, upload flow or provider integration.

## Included processing

1. `read_files(paths)` accepts local filenames in the form `atp_matches_YYYY.csv` or `wta_matches_YYYY.csv`. It checks required headers, reports input SHA-256 and rejection counts, removes exact duplicates and rejects conflicting match identities. A checksum identifies local bytes; it is not proof of publisher authenticity or reuse permission.
2. `normalize(row, tour)` validates supported metadata and ordinary completed best-of-three/five score formats. It excludes unsupported levels, qualifying rounds, ambiguous surfaces, alternative formats and unrecognized Grand Slam names. Retirement and walkover records are not evaluated.
3. `Match` holds pre-normalized records. Direct callers must meet that contract; constructing a dataclass does not independently validate an external dataset. ATP and WTA identifiers occupy separate rating pools.
4. `fold(matches, year)` rejects inconsistent event dates, checks train/test match overlap and reserves an intervening event-start year.
5. `Elo.fit()` performs offline, same-date batch updates. Match identifiers provide deterministic iteration, not chronological availability. Incremental use is not validated as a live prediction protocol.
6. `evaluate()` calculates cohort metrics from a frozen fitting state, reporting low-history counts and chronology limitations. No source-availability verification is inferred from an event date.

`synthetic_demo()` constructs fictional records and demonstrates the fitting/prediction API without loading data. It does not calculate or advertise real-world benchmark accuracy.

## External integration boundary

The caller owns the data-rights, provenance and availability contract. A production integration would additionally need timestamped fixtures, verified result completion/publication times, identity mapping, duplicate/correction handling, monitoring and a separately validated user interface. None of those systems is supplied or claimed by this module.
