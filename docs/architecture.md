# Architecture

The public implementation has two independent entry points: an offline Python module and a static TypeScript browser application. Neither has a database, background data job, authentication, upload flow or provider integration.

## Browser application

Vite builds `index.html` and `web/` to the ignored `dist/` directory. Four hash-routed destinations (overview, matchup lab, competition directory, method/record) work on ordinary static hosting, including browser back/forward. There is no server route or environment secret.

`web/model.ts` owns original fictional player/rating fixtures, context validation, Elo arithmetic and the competition taxonomy. The lab mirrors `Elo.probability()` and its equal-weight surface blend; it does not fit the Python model or read its private evaluation artifacts. Ratings are illustrative inputs, not fitted estimates. Only Hard, Clay and Grass are exposed in the lab; the offline adapter additionally recognizes Carpet.

The real local Web Worker calculates lab output. Input changes, navigation, cancellation and reset terminate pending work, clear old results and prevent stale messages from restoring them. Worker startup/errors/timeouts have visible states and retry keeps the inputs. Search is treated as text, never rendered into HTML. Input data is not persisted or sent to a service. Browser tests cover the production build at 360, 768 and 1440 CSS pixels, including keyboard and axe checks.

The directory represents tour, Slam, development and other-format categories. All data is currently unavailable. Category navigation is distinct from adapter eligibility, which is distinct from validated competition coverage; none implies a live feed or an exhaustive event catalogue.

## Included processing

1. `read_files(paths)` accepts local filenames in the form `atp_matches_YYYY.csv` or `wta_matches_YYYY.csv`. It checks required headers, reports input SHA-256 and rejection counts, removes exact duplicates and rejects conflicting match identities. A checksum identifies local bytes; it is not proof of publisher authenticity or reuse permission.
2. `normalize(row, tour)` validates supported metadata and ordinary completed best-of-three/five score formats. It excludes unsupported levels, qualifying rounds, ambiguous surfaces, alternative formats and unrecognized Grand Slam names. Retirement and walkover records are not evaluated.
3. `Match` holds pre-normalized records. Direct callers must meet that contract; constructing a dataclass does not independently validate an external dataset. ATP and WTA identifiers occupy separate rating pools.
4. `fold(matches, year)` rejects inconsistent event dates, checks train/test match overlap and reserves an intervening event-start year.
5. `Elo.fit()` performs offline, same-date batch updates. Match identifiers provide deterministic iteration, not chronological availability. Incremental use is not validated as a live prediction protocol.
6. `evaluate()` calculates cohort metrics from a frozen fitting state, reporting low-history counts and chronology limitations. No source-availability verification is inferred from an event date.

`synthetic_demo()` constructs fictional records and demonstrates the fitting/prediction API without loading data. It does not calculate or advertise real-world benchmark accuracy.

## External integration boundary

The caller owns the data-rights, provenance and availability contract. A real-data production integration would additionally need timestamped fixtures, verified result completion/publication times, identity mapping, duplicate/correction handling, monitoring and real-data validation of every displayed claim. None of those systems is supplied or claimed here.
