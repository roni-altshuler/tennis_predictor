"""Experimental offline tennis calculations. No bundled real data or live forecasts."""

from __future__ import annotations

import csv
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from itertools import groupby
from pathlib import Path
from typing import TypedDict

__version__ = "0.1.0-dev"

LEVELS = {
    "atp": frozenset({"A", "M", "F", "G"}),
    "wta": frozenset({"I", "P", "PM", "F", "G"}),
}

SURFACES = {s.casefold(): s for s in ("Hard", "Clay", "Grass", "Carpet")}

SLAMS = {
    "australian open": "Australian Open",
    "roland garros": "Roland Garros",
    "wimbledon": "Wimbledon",
    "us open": "US Open",
}

REQUIRED = {
    "tourney_id",
    "tourney_name",
    "tourney_date",
    "tourney_level",
    "surface",
    "match_num",
    "winner_id",
    "loser_id",
    "score",
    "best_of",
    "round",
}

ROUNDS = frozenset({"R128", "R64", "R32", "R16", "QF", "SF", "F", "RR"})


class FileAudit(TypedDict):
    sha256: str
    counts: dict[str, int]
    source_levels: dict[str, int]


@dataclass(frozen=True)
class Match:
    tour: str
    event_id: str
    event_name: str
    event_date: date  # Tournament start, NOT the match or result publication time.
    match_id: str
    surface: str
    level: str
    player_a: str  # Canonical player ID order; never winner-first.
    player_b: str
    a_won: bool

    @property
    def key(self) -> tuple[str, str, str]:
        return self.tour, self.event_id, self.match_id


def completed_score(score: str, best_of: int) -> bool:
    """Accept ordinary completed best-of-3/5 scores; retirements never train/score."""
    if best_of not in (3, 5):
        return False
    tokens = score.strip().split()
    if not tokens or len(tokens) > best_of:
        return False
    wins = losses = 0
    needed = best_of // 2 + 1
    for index, token in enumerate(tokens):
        parsed = re.fullmatch(r"(\d{1,2})-(\d{1,2})(?:\(\d{1,2}\))?", token)
        if not parsed:
            return False
        a, b = map(int, parsed.groups())
        hi, lo = max(a, b), min(a, b)
        if not (
            (hi == 6 and lo <= 4)
            or (hi == 7 and lo in (5, 6))
            or (hi >= 8 and hi - lo == 2)
        ):
            return False
        wins += a > b
        losses += b > a
        if max(wins, losses) == needed and index != len(tokens) - 1:
            return False
    return wins == needed and losses < needed


def normalize(row: dict[str, str], tour: str) -> tuple[Match | None, str]:
    if tour not in LEVELS:
        raise ValueError("Tour must be explicitly atp or wta")
    if any(not isinstance(row.get(key), str) for key in REQUIRED):
        return None, "invalid_row"
    if row.get("tourney_level") not in LEVELS[tour]:
        return None, "unsupported_level"
    event = row.get("tourney_name", "").strip()
    if "next gen" in event.casefold():
        return None, "unsupported_format"
    if row.get("round") not in ROUNDS:
        return None, "unsupported_round"
    surface = SURFACES.get(row.get("surface", "").strip().casefold())
    if not surface:
        return None, "unknown_surface"
    if row.get("tourney_level") == "G":
        if event.casefold() not in SLAMS:
            return None, "unrecognized_slam"
        event = SLAMS[event.casefold()]
    try:
        when = date.fromisoformat(
            row.get("tourney_date", "")[:4]
            + "-"
            + row.get("tourney_date", "")[4:6]
            + "-"
            + row.get("tourney_date", "")[6:8]
        )
        if not re.fullmatch(r"\d{8}", row.get("tourney_date", "")):
            raise ValueError("Invalid date")
        best_of = int(row.get("best_of", ""))
    except (ValueError, TypeError):
        return None, "invalid_date_or_format"
    if not completed_score(row.get("score", ""), best_of):
        return None, "incomplete_or_unrecognized_score"
    winner, loser = row.get("winner_id", "").strip(), row.get("loser_id", "").strip()
    event_id, match_id = (
        row.get("tourney_id", "").strip(),
        row.get("match_num", "").strip(),
    )
    if not all([event, event_id, match_id, winner, loser]) or winner == loser:
        return None, "invalid_identity"
    a, b = sorted((winner, loser))
    return Match(
        tour,
        event_id,
        event,
        when,
        match_id,
        surface,
        row["tourney_level"],
        a,
        b,
        winner == a,
    ), "accepted"


def read_files(paths: Iterable[Path]) -> tuple[list[Match], dict[str, FileAudit]]:
    seen: dict[tuple[str, str, str], Match] = {}
    audit: dict[str, FileAudit] = {}
    for path in sorted(paths):
        match = re.fullmatch(r"(atp|wta)_matches_(\d{4})\.csv", path.name)
        if not match:
            raise ValueError(f"Unrecognized source file name: {path.name}")
        tour = match.group(1)
        counts: Counter[str] = Counter()
        levels: Counter[str] = Counter()
        with path.open(newline="", encoding="utf-8-sig") as stream:
            reader = csv.DictReader(stream)
            if not REQUIRED.issubset(reader.fieldnames or []):
                raise ValueError(f"Missing required columns in {path.name}")
            for row in reader:
                counts["rows"] += 1
                levels[row.get("tourney_level", "")] += 1
                parsed, reason = normalize(row, tour)
                if parsed is not None and parsed.key in seen:
                    if seen[parsed.key] != parsed:
                        raise ValueError(f"Conflicting duplicate: {parsed.key}")
                    reason = "duplicate"
                elif parsed is not None:
                    seen[parsed.key] = parsed
                counts[reason] += 1
        audit[path.name] = {
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "counts": dict(counts),
            "source_levels": dict(levels),
        }
    return sorted(seen.values(), key=lambda m: (m.event_date, m.key)), audit


class Elo:
    """Predeclared K=24, 1500 prior; separate tour and surface pools."""

    def __init__(self) -> None:
        self.global_ratings: dict[tuple[str, str], float] = {}
        self.surface_ratings: dict[tuple[str, str, str], float] = {}
        self.counts: Counter[tuple[str, str]] = Counter()
        self.surface_counts: Counter[tuple[str, str, str]] = Counter()

    @staticmethod
    def probability(a: float, b: float) -> float:
        return 1.0 / (1.0 + math.pow(10.0, (b - a) / 400.0))

    def predict(
        self, tour: str, a: str, b: str, surface: str, hybrid: bool = True
    ) -> float:
        if (
            tour not in LEVELS
            or surface not in SURFACES.values()
            or not a
            or not b
            or a == b
        ):
            raise ValueError("Unsupported or invalid prediction context")
        ga = self.global_ratings.get((tour, a), 1500.0)
        gb = self.global_ratings.get((tour, b), 1500.0)
        if hybrid:
            ga = (ga + self.surface_ratings.get((tour, a, surface), 1500.0)) / 2
            gb = (gb + self.surface_ratings.get((tour, b, surface), 1500.0)) / 2
        return self.probability(ga, gb)

    def fit(self, matches: Iterable[Match]) -> None:
        # Offline fitting convention, NOT a replay of result availability.
        # Tournament-week dates cannot order individual match completions.
        # All same-date rows use one prior snapshot; arbitrary match IDs only
        # provide deterministic iteration within that batch, never timestamps.
        ordered = sorted(matches, key=lambda m: (m.event_date, m.key))
        for _, batch_iter in groupby(ordered, key=lambda m: m.event_date):
            batch = list(batch_iter)
            global_delta: defaultdict[tuple[str, str], float] = defaultdict(float)
            surface_delta: defaultdict[tuple[str, str, str], float] = defaultdict(float)
            for m in batch:
                a, b = (m.tour, m.player_a), (m.tour, m.player_b)
                sa, sb = (*a, m.surface), (*b, m.surface)
                p = self.probability(
                    self.global_ratings.get(a, 1500.0),
                    self.global_ratings.get(b, 1500.0),
                )
                sp = self.probability(
                    self.surface_ratings.get(sa, 1500.0),
                    self.surface_ratings.get(sb, 1500.0),
                )
                delta, sdelta = 24 * (m.a_won - p), 24 * (m.a_won - sp)
                global_delta[a] += delta
                global_delta[b] -= delta
                surface_delta[sa] += sdelta
                surface_delta[sb] -= sdelta
                self.counts.update((a, b))
                self.surface_counts.update((sa, sb))
            for key, change in global_delta.items():
                self.global_ratings[key] = self.global_ratings.get(key, 1500.0) + change
            for skey, change in surface_delta.items():
                self.surface_ratings[skey] = (
                    self.surface_ratings.get(skey, 1500.0) + change
                )


def fold(matches: list[Match], year: int) -> tuple[list[Match], list[Match], date]:
    event_dates: dict[tuple[str, str], date] = {}
    for match in matches:
        event = (match.tour, match.event_id)
        if event in event_dates and event_dates[event] != match.event_date:
            raise ValueError(
                f"Inconsistent tournament-start date for event identity; unsafe cohort overlap: {event}"
            )
        event_dates[event] = match.event_date
    # A full intervening calendar year avoids pretending a tournament-start date
    # is a result timestamp. No outcomes from that buffer year or evaluation year
    # enter the frozen model. Actual historical publication times remain unknown.
    cutoff = date(year - 1, 1, 1)
    train = [m for m in matches if m.event_date < cutoff]
    test = [m for m in matches if m.event_date.year == year]
    if {m.key for m in train} & {m.key for m in test}:
        raise ValueError("Train/test identity overlap")
    return train, test, cutoff


def metrics(predictions: list[tuple[float, bool]]) -> dict[str, float | int | None]:
    if not predictions:
        return {"n": 0, "log_loss": None, "brier": None, "accuracy": None}
    ll = brier = correct = 0.0
    for p, y in predictions:
        if not math.isfinite(p) or not 0 <= p <= 1:
            raise ValueError("Invalid probability")
        q = min(1 - 1e-12, max(1e-12, p))
        ll -= math.log(q if y else 1 - q)
        brier += (p - y) ** 2
        correct += 0.5 if p == 0.5 else float((p > 0.5) == y)
    n = len(predictions)
    return {"n": n, "log_loss": ll / n, "brier": brier / n, "accuracy": correct / n}


def evaluate(matches: list[Match], year: int) -> dict[str, object]:
    """Calculate a retrospective cohort; source rights and availability are external."""
    train, test, cutoff = fold(matches, year)
    model = Elo()
    model.fit(train)
    results: defaultdict[str, defaultdict[str, list[tuple[float, bool]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    cold: Counter[str] = Counter()
    for m in test:
        groups = [m.tour, f"{m.tour}/surface/{m.surface}"]
        if m.level == "G":
            groups += [f"{m.tour}/Grand Slams", f"{m.tour}/{m.event_name}"]
        if (
            min(model.counts[(m.tour, m.player_a)], model.counts[(m.tour, m.player_b)])
            < 5
        ):
            cold[m.tour] += 1
        predictions = {
            "coin_flip": 0.5,
            "global_elo": model.predict(
                m.tour, m.player_a, m.player_b, m.surface, False
            ),
            "surface_blend_elo": model.predict(
                m.tour, m.player_a, m.player_b, m.surface
            ),
        }
        for group in groups:
            for name, p in predictions.items():
                results[group][name].append((p, m.a_won))
    latest = max((m.event_date for m in train), default=None)
    earliest_test = min((m.event_date for m in test), default=None)
    return {
        "evaluation_year_by_tournament_start": year,
        "training_cutoff_exclusive": cutoff.isoformat(),
        "training_matches": len(train),
        "evaluation_matches": len(test),
        "latest_training_tournament_start": latest.isoformat()
        if latest is not None
        else None,
        "status": "measured_retrospective_holdout"
        if train and test
        else "insufficient_data",
        "chronology_audit": {
            "event_date_consistency_checked": True,
            "withheld_tournament_start_year": year - 1,
            "first_evaluation_tournament_start": earliest_test.isoformat()
            if earliest_test is not None
            else None,
            "minimum_tournament_start_gap_days": (earliest_test - latest).days
            if earliest_test is not None and latest is not None
            else None,
            "match_number_is_timestamp": False,
            "historical_outcome_availability_verified": False,
            "live_or_prospective_validation": False,
        },
        "low_history_evaluation_matches_fewer_than_5_prior": dict(cold),
        "metrics": {
            g: {name: metrics(ps) for name, ps in models.items()}
            for g, models in sorted(results.items())
        },
    }


def synthetic_demo() -> dict[str, object]:
    """An original fictional example; it contains no real player or match records."""
    games = [
        Match(
            "atp",
            "demo-2022-01",
            "Fictional Event One",
            date(2022, 1, 3),
            "a",
            "Hard",
            "A",
            "fictional-A",
            "fictional-B",
            True,
        ),
        Match(
            "atp",
            "demo-2022-02",
            "Fictional Event Two",
            date(2022, 2, 7),
            "b",
            "Hard",
            "A",
            "fictional-A",
            "fictional-C",
            False,
        ),
        Match(
            "atp",
            "demo-2022-03",
            "Fictional Event Three",
            date(2022, 3, 7),
            "c",
            "Clay",
            "A",
            "fictional-B",
            "fictional-C",
            True,
        ),
        Match(
            "atp",
            "demo-2024",
            "Fictional Evaluation Event",
            date(2024, 1, 1),
            "d",
            "Hard",
            "A",
            "fictional-A",
            "fictional-B",
            False,
        ),
    ]
    train, _, cutoff = fold(games, 2024)
    model = Elo()
    model.fit(train)
    return {
        "version": __version__,
        "example_kind": "synthetic_fictional_records",
        "real_world_validated": False,
        "training_cutoff_exclusive": cutoff.isoformat(),
        "training_rows": len(train),
        "illustrative_probability_for_fictional_A": model.predict(
            "atp", "fictional-A", "fictional-B", "Hard"
        ),
        "notice": "Toy calculation only; no real tennis forecast or performance claim.",
    }


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Run a synthetic offline example. No real data or live forecasts."
    )
    parser.add_argument("--version", action="version", version=__version__)
    parser.parse_args()
    print(json.dumps(synthetic_demo(), indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
