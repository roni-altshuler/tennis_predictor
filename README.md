# Tennis Predictor

A transparent tennis exploration prototype: a responsive browser workbench, an explicit competition-coverage directory, and an offline Python foundation for surface-aware Elo and conservative retrospective evaluation.

**Status: early prototype — synthetic demonstrations only.** The browser app and command-line example use original fictional inputs. There is no live fixture feed, real-player forecast, trained real-data model or public benchmark. No live or prospective accuracy is claimed.

**Website:** [Explore Baseline Tennis Predictor](https://roni-altshuler.github.io/tennis_predictor/) — the public, browser-only synthetic demonstration. All players and ratings remain fictional; the website is not a live prediction feed.

The [GitHub Pages deployment guide](docs/deployment.md) explains owner setup, check-gated publication and browser verification of the actual deployed version. Each main deployment runs the full responsive browser suite against the published URL and checks its source fingerprint.

## What is included

| Capability | Current scope |
| --- | --- |
| Browser workbench | Interactive ATP/WTA synthetic matchup lab, three surfaces, editable overall ratings, global/blended Elo, inspectable inputs, cancellation and error recovery |
| Competition directory | Searchable tour, Grand Slam, development and other-format categories; unavailable data shown explicitly |
| Result normalization | A local CSV adapter with explicit identity, score, surface, round and competition filters |
| Baseline models | Global Elo and a fixed 50/50 global–surface rating blend, with separate ATP/WTA pools |
| Retrospective evaluation | Frozen yearly cohorts with an intervening tournament-start year withheld |
| Evidence and controls | Coin-flip reference, binary Brier score, log loss, explicit tie handling and low-history counts |
| Reproducible example | Fictional players and matches only; no account, key, dataset or runtime dependency installation |
| Regression tests | Synthetic fixtures covering chronology, winner orientation, malformed records, metrics and CLI behavior |

These are software capabilities, not evidence that any real competition is fully covered. Four Grand Slam names are recognized by the adapter; no Grand Slam dataset is bundled or validated by the public test suite. Challenger, ITF, qualifying, doubles, mixed doubles, wheelchair, junior, collegiate, team and alternative-format competitions are outside the included evaluation contract.

## Browser app

Use **Node.js 24.19.0** and npm. From the repository root:

```sh
npm ci --ignore-scripts
npm run dev
```

Open the printed local URL (normally `http://127.0.0.1:5173`). The app has four destinations: court overview, matchup lab, competitions, and method/record. Try the same demo matchup on Hard and Clay, switch between global Elo and the experimental surface blend, then inspect the input table. All ratings are authored synthetic values, not real athletes or fitted model estimates. Changing inputs clears previous output; reset/cancel/navigation stop pending calculations.

The competition directory includes ATP/WTA tours, each Grand Slam, Challenger, WTA 125, ITF, qualifying, doubles/mixed doubles, team events, Olympics/multi-sport events, juniors, wheelchair, collegiate/domestic and other competitions. These are navigation categories, not an exhaustive tournament list or a claim that those competitions are modeled. **Every category currently has unavailable data.** No unknown schedule is represented as zero games.

The static app needs no account, API key, backend or paid service. Calculations run in a local Web Worker. Inputs remain in memory only; no uploads, local storage, analytics or tennis-provider calls are implemented. The hosting service may keep normal request logs. The footer exposes a deterministic source fingerprint for deployed-version checks.

For a production build and browser checks:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

The preview serves `http://127.0.0.1:4173`. Stop it before the browser test runner starts its own production preview:

```sh
# If the Playwright-managed Chromium is not already installed:
npx playwright install --with-deps chromium
npm run test:browser
```

An already installed compatible Chromium can be selected with `PLAYWRIGHT_EXECUTABLE_PATH=/absolute/path/to/chromium npm run test:browser`. This does not establish equivalence to the pinned CI browser. CI uses Ubuntu 24.04, Node 24.19.0 and the Chromium supplied by Playwright 1.65.0. Browser tests exercise 360, 768 and 1440 CSS-pixel layouts, keyboard navigation, axe accessibility rules, real local calculations, validation, repeat/reset/cancel/navigation flows, empty filters and a simulated worker failure. Automated accessibility checks do not replace assistive-technology testing.

## Python quick start

Use **Python 3.12**. From the repository root:

```sh
python tennis_predictor.py --help
python tennis_predictor.py
python -m unittest discover -s tests -v
```

The example prints JSON labelled `synthetic_fictional_records`, including an illustrative probability and `real_world_validated: false`. It reads no external data and makes no network requests. Its numbers describe the toy example, not a real player's chances or model accuracy. `--live` and real-match prediction arguments are not implemented.

For development checks:

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m unittest discover -s tests -v
ruff check tennis_predictor.py tests
ruff format --check tennis_predictor.py tests
mypy --strict tennis_predictor.py tests
python -m compileall -q tennis_predictor.py tests
```

On Windows, activate with `.venv\Scripts\Activate.ps1` instead. Runtime code uses only the Python standard library. Pinned developer tools are listed in `requirements-dev.txt`; no paid API or cloud service is required.

## How it works

`read_files()` audits locally supplied, appropriately licensed CSVs. `normalize()` converts eligible rows to immutable match records, with players ordered by stable IDs rather than winner/loser position. `fold()` validates event dates and separates old fitting rows from the evaluation cohort. `Elo.fit()` updates global and surface ratings in batches; `evaluate()` keeps those ratings frozen while calculating cohort metrics.

The initial rating is 1500, K is 24, and the experimental surface blend weights global and surface ratings equally. These fixed parameters are not presented as optimized. Current-match rankings, aces, duration, odds and other post-result statistics are not prediction features. See the [architecture](docs/architecture.md) and [evaluation protocol](docs/evaluation.md).

## Chronology and interpretation

Tournament dates usually describe an event week. Match numbers can be arbitrary identifiers. Sorting either field does not establish when an outcome was available.

The included evaluation withholds the entire intervening tournament-start year: a 2024 cohort fits starts before 2023-01-01, and a 2025 cohort fits starts before 2024-01-01. Each evaluation model remains frozen. Rows sharing a fitting date use one prior snapshot, and inconsistent dates within one event are rejected. This is a conservative offline convention; it does not reconstruct match completion, original publication or later correction timestamps.

Eligibility is retrospective because completed-score information is used to select rows. Metrics therefore apply to an eligible completed-match cohort, not a prospective set of fixtures. Exact 0.5 probabilities receive half credit in accuracy; binary Brier is the mean of `(p-y)^2`, and log loss uses natural logarithms. Uncalibrated probabilities and low-history players require particular caution. The surface blend is an experimental comparator, not a demonstrated improvement over global Elo.

## Data and licensing

No third-party dataset, real athlete records, learned ratings, model weights, real-data evaluation outputs or upstream documentation copies are distributed here. Only original synthetic examples and dataset-independent tests are included. Do not copy a dataset into this repository merely because it is free to download.

The [data policy](docs/data-policy.md) describes the reviewed source family and its non-commercial/share-alike restrictions. Any separate retrieval and use must satisfy the source's current terms. The code does not fetch data, grant dataset rights or verify historical source availability. No software-wide license has been selected; see [NOTICE.md](NOTICE.md).

## Project layout

```text
index.html / web/        Static browser app, original fixtures and local worker
web-tests/              Browser-domain regression tests
browser-tests/          Production-build responsive and accessibility checks
vite.config.ts          Static build and deterministic source fingerprint
package*.json           Pinned web development dependencies
tennis_predictor.py        Offline library and synthetic command-line example
tests/test_predictor.py   Dataset-independent regression tests
docs/architecture.md     Included components and integration boundaries
docs/evaluation.md       Chronology, metrics and evidence limits
docs/data-policy.md      External-data rights and retrieval requirements
requirements-dev.txt     Pinned development tools
.github/workflows/ci.yml Python/web checks, main-only Pages deployment and live QA
docs/deployment.md      Owner setup, least-privilege publication and live verification
```

## Development priorities

The next stages are a verified data-rights contract for the intended use, result-availability timestamps, reproducible dataset-specific evaluation and calibration. The current browser workbench is synthetic. Real upcoming fixtures, validated competition expansion and operational data freshness require separate implementation and validation. No delivery date or readiness claim is implied.

For changes, start with [CONTRIBUTING.md](CONTRIBUTING.md). Handle sensitive reports as described in [SECURITY.md](SECURITY.md). This project has no affiliation with or endorsement from the ATP, WTA, Grand Slam organizers or dataset publishers.
