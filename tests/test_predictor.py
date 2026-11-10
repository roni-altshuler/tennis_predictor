from __future__ import annotations

import copy
import csv
import json
import math
import subprocess
import sys
import tempfile
import unittest
from dataclasses import replace
from datetime import date
from pathlib import Path
from typing import cast
from unittest.mock import patch

from tennis_predictor import (
    Elo,
    Match,
    completed_score,
    evaluate,
    fold,
    metrics,
    normalize,
    read_files,
    synthetic_demo,
)


def fixture(**changes: str) -> dict[str, str]:
    row = {
        "tourney_id": "2022-fixture",
        "tourney_name": "Synthetic Open",
        "surface": "Hard",
        "tourney_level": "A",
        "tourney_date": "20220101",
        "match_num": "1",
        "winner_id": "B",
        "loser_id": "A",
        "score": "6-4 7-6(3)",
        "best_of": "3",
        "round": "F",
    }
    row.update(changes)
    return row


def match(
    *,
    event_date: date = date(2022, 1, 1),
    match_id: str = "1",
    a_won: bool = False,
    player_a: str = "A",
    player_b: str = "B",
    event_id: str | None = None,
) -> Match:
    return Match(
        "atp",
        event_id if event_id is not None else f"synthetic-{event_date.isoformat()}",
        "Synthetic Open",
        event_date,
        match_id,
        "Hard",
        "A",
        player_a,
        player_b,
        a_won,
    )


class EligibilityTests(unittest.TestCase):
    def test_ids_are_canonical_not_winner_first(self) -> None:
        m, _ = normalize(fixture(), "atp")
        assert m is not None
        self.assertEqual((m.player_a, m.player_b, m.a_won), ("A", "B", False))
        other, _ = normalize(fixture(winner_id="A", loser_id="B"), "atp")
        assert other is not None
        self.assertEqual(
            (other.player_a, other.player_b, other.a_won), ("A", "B", True)
        )

    def test_current_match_post_result_fields_never_enter_features(self) -> None:
        a, _ = normalize(fixture(), "atp")
        b, _ = normalize(
            fixture(
                winner_rank="1",
                loser_rank="999",
                minutes="999",
                w_ace="999",
                winner_rank_points="999999",
                odds="1.01",
            ),
            "atp",
        )
        self.assertEqual(a, b)

    def test_each_grand_slam_is_explicitly_supported_for_both_tours(self) -> None:
        for tour in ("atp", "wta"):
            for name in ("Australian Open", "Roland Garros", "Wimbledon", "Us Open"):
                m, status = normalize(
                    fixture(tourney_name=name, tourney_level="G"), tour
                )
                self.assertIsNotNone(m)
                self.assertEqual(status, "accepted")
        self.assertEqual(
            normalize(fixture(tourney_name="Other Slam", tourney_level="G"), "atp")[1],
            "unrecognized_slam",
        )

    def test_unknown_competitions_and_qualifiers_are_withheld(self) -> None:
        for level in ("D", "O", "W", "50+H", "35+H", "C", "S", ""):
            self.assertEqual(
                normalize(fixture(tourney_level=level), "wta")[1], "unsupported_level"
            )
        self.assertEqual(normalize(fixture(round="Q1"), "atp")[1], "unsupported_round")
        self.assertEqual(
            normalize(fixture(tourney_name="Next Gen Finals"), "atp")[1],
            "unsupported_format",
        )

    def test_unsupported_tour_fails_instead_of_guessing(self) -> None:
        with self.assertRaises(ValueError):
            normalize(fixture(), "itf")

    def test_scores_must_describe_completed_match_won_by_recorded_winner(self) -> None:
        for score in (
            "",
            "W/O",
            "6-4 2-1 RET",
            "DEF",
            "6-4",
            "0-0",
            "6-4 6-4 6-4",
            "4-6 4-6",
        ):
            self.assertFalse(completed_score(score, 3), score)
        for score in ("6-4 6-4", "6-7(3) 7-5 6-2", "7-6(10) 6-4"):
            self.assertTrue(completed_score(score, 3), score)
        self.assertTrue(completed_score("6-3 4-6 6-2 6-4", 5))
        self.assertFalse(completed_score("6-4 6-4", 5))

    def test_dates_identity_and_surfaces_validate_without_inventing_values(
        self,
    ) -> None:
        for fields in (
            {"tourney_date": "20220230"},
            {"tourney_date": "2022-01-01"},
            {"winner_id": ""},
            {"loser_id": "B"},
            {"match_num": ""},
            {"surface": ""},
            {"surface": "Moon"},
        ):
            self.assertIsNone(normalize(fixture(**fields), "atp")[0])
        m, _ = normalize(fixture(surface=" clay "), "atp")
        assert m is not None
        self.assertEqual(m.surface, "Clay")


class ChronologyTests(unittest.TestCase):
    def test_fold_uses_event_date_and_full_year_buffer(self) -> None:
        rows = [
            match(event_date=date(y, 12, 31), match_id=str(y))
            for y in (2022, 2023, 2024, 2025)
        ]
        train, test, cutoff = fold(rows, 2024)
        self.assertEqual([m.match_id for m in train], ["2022"])
        self.assertEqual([m.match_id for m in test], ["2024"])
        self.assertEqual(cutoff, date(2023, 1, 1))
        self.assertLess(max(m.event_date for m in train), cutoff)

    def test_evaluation_outcomes_cannot_change_frozen_predictions(self) -> None:
        train = [
            match(a_won=True, match_id=str(i), event_date=date(2022, 1, i))
            for i in range(1, 8)
        ]
        target = match(event_date=date(2024, 1, 1), match_id="target")
        left = train + [target]
        right = train + [replace(target, a_won=not target.a_won)]
        a = Elo()
        a.fit(fold(left, 2024)[0])
        b = Elo()
        b.fit(fold(right, 2024)[0])
        self.assertEqual(
            a.predict("atp", "A", "B", "Hard"), b.predict("atp", "A", "B", "Hard")
        )
        self.assertEqual(a.global_ratings, b.global_ratings)

    def test_evaluation_and_future_rows_cannot_change_training_state(self) -> None:
        rows = [
            match(event_date=date(2022, 1, 1)),
            match(event_date=date(2024, 1, 1), match_id="eval"),
        ]
        extra = match(event_date=date(2026, 1, 1), match_id="future", a_won=True)
        self.assertEqual(fold(rows, 2024), fold(rows + [extra], 2024))

    def test_evaluation_freezes_model_for_entire_year(self) -> None:
        data = [
            match(event_date=date(2022, 1, 1)),
            match(event_date=date(2024, 1, 1), match_id="early"),
            match(event_date=date(2024, 12, 1), match_id="late", a_won=True),
        ]
        before = copy.deepcopy(data)
        result = evaluate(data, 2024)
        self.assertEqual(data, before)
        self.assertEqual(result["training_matches"], 1)
        self.assertEqual(result["evaluation_matches"], 2)
        frozen = Elo()
        frozen.fit(fold(data, 2024)[0])
        p = frozen.predict("atp", "A", "B", "Hard", False)
        groups = cast(dict[str, dict[str, object]], result["metrics"])
        self.assertEqual(groups["atp"]["global_elo"], metrics([(p, False), (p, True)]))

    def test_flipped_early_evaluation_label_cannot_affect_later_evaluation_probability(
        self,
    ) -> None:
        rows = [
            match(event_date=date(2022, 1, 1)),
            match(event_date=date(2024, 1, 1), match_id="early"),
            match(event_date=date(2024, 12, 1), match_id="late", a_won=True),
        ]
        original = Elo.predict
        observed: list[list[float]] = []
        for early_won in (False, True):
            probabilities: list[float] = []

            def capture(
                model: Elo, tour: str, a: str, b: str, surface: str, hybrid: bool = True
            ) -> float:
                p = original(model, tour, a, b, surface, hybrid)
                probabilities.append(p)
                return p

            changed = [rows[0], replace(rows[1], a_won=early_won), rows[2]]
            with patch.object(Elo, "predict", new=capture):
                evaluate(changed, 2024)
            self.assertEqual(len(probabilities), 4)
            observed.append(probabilities)
        self.assertEqual(observed[0][-2:], observed[1][-2:])

    def test_same_date_batch_is_permutation_invariant(self) -> None:
        batch = [
            match(player_a="A", player_b="B", a_won=True, match_id="1"),
            match(player_a="A", player_b="C", a_won=True, match_id="2"),
        ]
        a, b = Elo(), Elo()
        a.fit(batch)
        b.fit(list(reversed(batch)))
        self.assertEqual(a.global_ratings, b.global_ratings)
        self.assertEqual(a.global_ratings[("atp", "A")], 1524.0)
        self.assertEqual(a.global_ratings[("atp", "B")], 1488.0)

    def test_event_identity_overlap_fails(self) -> None:
        with self.assertRaisesRegex(ValueError, "overlap"):
            fold(
                [
                    match(event_date=date(2022, 1, 1), event_id="overlapping-event"),
                    match(event_date=date(2024, 1, 1), event_id="overlapping-event"),
                ],
                2024,
            )

    def test_inconsistent_event_dates_reject_even_distinct_match_ids(self) -> None:
        data = [
            match(event_date=date(2022, 12, 31), match_id="1", event_id="same-event"),
            match(
                event_date=date(2024, 1, 1), match_id="arbitrary", event_id="same-event"
            ),
        ]
        with self.assertRaisesRegex(ValueError, "Inconsistent tournament-start"):
            evaluate(data, 2024)

    def test_arbitrary_match_ids_and_row_order_do_not_supply_fit_chronology(
        self,
    ) -> None:
        data = [
            match(player_a="A", player_b="B", a_won=True, match_id="300"),
            match(player_a="A", player_b="C", a_won=False, match_id="1"),
            match(player_a="B", player_b="C", a_won=True, match_id="z"),
        ]
        relabeled = [
            replace(m, match_id=new_id)
            for m, new_id in zip(reversed(data), ("99", "alpha", "0"), strict=True)
        ]
        first, second = Elo(), Elo()
        first.fit(data)
        second.fit(relabeled)
        for a, b in (("A", "B"), ("A", "C"), ("B", "C")):
            self.assertAlmostEqual(
                first.predict("atp", a, b, "Hard"),
                second.predict("atp", a, b, "Hard"),
                places=12,
            )

    def test_week_labels_cannot_establish_result_availability(self) -> None:
        # A Jan3-starting event might finish Jan16, after a Jan10 event starts.
        # Naively applying all its outcomes for Jan10 produces a false advantage.
        earlier_week = match(event_date=date(2022, 1, 3), a_won=True)
        naive, unavailable = Elo(), Elo()
        naive.fit([earlier_week])
        self.assertGreater(
            naive.predict("atp", "A", "B", "Hard"),
            unavailable.predict("atp", "A", "B", "Hard"),
        )
        # The actual evaluated cohort freezes only old rows, not weekly updates.
        evaluation = match(event_date=date(2024, 1, 1), match_id="holdout")
        train, _, cutoff = fold([earlier_week, evaluation], 2024)
        self.assertEqual(cutoff, date(2023, 1, 1))
        self.assertEqual(train, [earlier_week])

    def test_audit_reports_gap_without_claiming_publication_verification(self) -> None:
        result = evaluate(
            [match(event_date=date(2022, 12, 31)), match(event_date=date(2024, 1, 1))],
            2024,
        )
        audit = cast(dict[str, object], result["chronology_audit"])
        self.assertEqual(audit["minimum_tournament_start_gap_days"], 366)
        self.assertFalse(audit["match_number_is_timestamp"])
        self.assertFalse(audit["historical_outcome_availability_verified"])
        self.assertFalse(audit["live_or_prospective_validation"])


class ModelTests(unittest.TestCase):
    def test_tour_pools_are_separate_even_with_identical_player_ids(self) -> None:
        model = Elo()
        model.fit([match(a_won=True)])
        self.assertGreater(model.predict("atp", "A", "B", "Hard"), 0.5)
        self.assertEqual(model.predict("wta", "A", "B", "Hard"), 0.5)

    def test_player_reversal_is_complement_and_missing_history_is_neutral(self) -> None:
        model = Elo()
        self.assertEqual(model.predict("atp", "unseen-A", "unseen-B", "Grass"), 0.5)
        model.fit([match(a_won=True)])
        self.assertAlmostEqual(
            model.predict("atp", "A", "B", "Hard")
            + model.predict("atp", "B", "A", "Hard"),
            1.0,
        )

    def test_prediction_context_errors_are_explicit(self) -> None:
        model = Elo()
        for args in (
            ("other", "A", "B", "Hard"),
            ("atp", "A", "A", "Hard"),
            ("atp", "A", "B", "Unknown"),
            ("atp", "", "B", "Hard"),
        ):
            with self.assertRaises(ValueError):
                model.predict(*args)

    def test_probability_is_read_only(self) -> None:
        model = Elo()
        snapshot = copy.deepcopy(model.__dict__)
        model.predict("atp", "A", "B", "Hard")
        self.assertEqual(model.__dict__, snapshot)

    def test_metrics_have_comparable_binary_definition_and_tie_rule(self) -> None:
        result = metrics([(0.5, True), (0.5, False)])
        loss = result["log_loss"]
        assert isinstance(loss, float)
        self.assertAlmostEqual(loss, math.log(2))
        self.assertEqual(result["brier"], 0.25)
        self.assertEqual(result["accuracy"], 0.5)
        self.assertEqual(metrics([])["log_loss"], None)
        for p in (float("nan"), float("inf"), -0.1, 1.1):
            with self.assertRaises(ValueError):
                metrics([(p, True)])

    def test_empty_fold_is_insufficient_not_claimed_validation(self) -> None:
        self.assertEqual(evaluate([], 2024)["status"], "insufficient_data")


class InputTests(unittest.TestCase):
    def write(
        self, root: Path, rows: list[dict[str, str]], name: str = "atp_matches_2022.csv"
    ) -> Path:
        path = root / name
        with path.open("w", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(fixture()))
            writer.writeheader()
            writer.writerows(rows)
        return path

    def test_exact_duplicates_count_once_but_conflicts_fail(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            p = self.write(Path(directory), [fixture(), fixture()])
            matches, audit = read_files([p])
            self.assertEqual(len(matches), 1)
            self.assertEqual(audit[p.name]["counts"]["duplicate"], 1)
            p = self.write(
                Path(directory), [fixture(), fixture(winner_id="A", loser_id="B")]
            )
            with self.assertRaisesRegex(ValueError, "Conflicting duplicate"):
                read_files([p])

    def test_source_schema_and_filename_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / "atp_matches_2022.csv"
            p.write_text("winner,loser\nA,B\n")
            with self.assertRaisesRegex(ValueError, "Missing required"):
                read_files([p])
            q = self.write(Path(directory), [fixture()], "unknown.csv")
            with self.assertRaisesRegex(ValueError, "file name"):
                read_files([q])

    def test_truncated_source_rows_are_counted_as_invalid(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / "atp_matches_2022.csv"
            p.write_text(",".join(fixture()) + "\ntruncated,row\n")
            matches, audit = read_files([p])
            self.assertEqual(matches, [])
            self.assertEqual(audit[p.name]["counts"]["invalid_row"], 1)


class DemoTests(unittest.TestCase):
    def test_demo_is_explicitly_synthetic_and_deterministic(self) -> None:
        first = synthetic_demo()
        self.assertEqual(first, synthetic_demo())
        self.assertEqual(first["example_kind"], "synthetic_fictional_records")
        self.assertFalse(first["real_world_validated"])
        self.assertEqual(first["training_rows"], 3)
        self.assertNotIn("accuracy", first)

    def test_cli_runs_without_data_keys_or_network_configuration(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            script = Path(__file__).resolve().parents[1] / "tennis_predictor.py"
            result = subprocess.run(
                [sys.executable, str(script)],
                cwd=directory,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout), synthetic_demo())

    def test_cli_rejects_unimplemented_live_prediction_arguments(self) -> None:
        script = Path(__file__).resolve().parents[1] / "tennis_predictor.py"
        result = subprocess.run(
            [sys.executable, str(script), "--live"],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("unrecognized arguments", result.stderr)


if __name__ == "__main__":
    unittest.main()
