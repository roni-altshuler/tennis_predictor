# Evaluation protocol and limits

This public snapshot provides calculation code and synthetic regression tests. It does not publish a real-data benchmark, a trained artifact or evidence of live prediction quality. No public forecasting-validation result is provided.

## Cohorts

For a requested year Y, fitting accepts tournament-start labels strictly earlier than January 1 of Y−1. Evaluation uses start labels within year Y, and the fitted model remains frozen throughout that cohort. The full intervening start-date year is omitted. Dates must be consistent within each `(tour, event_id)`; identical match identities cannot cross fitting and evaluation.

All fitting rows sharing a date use a common prior snapshot. This prevents an arbitrary match number from becoming a supposed within-event result order. Different week batches still reflect a coarse offline fitting convention, not an audited sequence of outcome availability. A longer guessed delay cannot establish missing publication or correction timestamps.

The importer filters completed, recognized scores after the event. This changes the evaluated population: retirements, walkovers, cancelled fixtures, incomplete records and unsupported competitions are excluded. These metrics do not describe prospective fixture eligibility or the excluded population.

## Controls and metric definitions

- Coin flip: probability 0.5 for either canonical player.
- Global Elo: fixed 1500 prior and K = 24; no evaluation-driven parameter fitting.
- Surface blend: equal weights for global and surface-specific ratings; an experimental control.
- Log loss: mean negative log-likelihood using natural logarithms.
- Brier: mean single-Bernoulli squared error `(p-y)^2`; a coin flip has Brier score 0.25.
- Accuracy: the higher-probability side is selected; an exact 0.5 tie receives 0.5 credit.
- Low history: either player has fewer than five eligible fitting matches. Reporting that count does not calibrate uncertainty.

Canonical player-ID orientation avoids treating the first position in a winner/loser CSV as a prediction feature. Separate tour pools prevent identifier collisions from transferring ratings between ATP and WTA.

## What tests establish

Synthetic tests cover frozen evaluation under counterfactual held-out labels, event-date consistency, arbitrary identifiers, input row permutation, winner orientation, malformed records, probability symmetry, metric definitions and the explicitly synthetic CLI. They are software regressions, not competition-coverage or forecasting-accuracy validation.

Real-data adoption requires a separately reviewed dataset licence and provenance, original availability timestamps, predeclared evaluation cohorts, calibration and uncertainty analysis, missingness/coverage reporting and independent review. No historical point-in-time, live or prospective accuracy is established by this repository.
