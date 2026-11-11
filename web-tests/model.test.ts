import { describe, expect, it } from "vitest";
import {
  type Calculation,
  COMPETITIONS,
  calculate,
  filterCompetitions,
  PLAYERS,
} from "../web/model";

const base: Calculation = {
  tour: "ATP",
  surface: "Hard",
  model: "blend",
  playerA: "a1",
  playerB: "a2",
  ratingA: 1620,
  ratingB: 1560,
};

describe("synthetic Elo lab", () => {
  it("uses exactly the documented equal global–surface blend", () => {
    const result = calculate(base);
    expect(result.effectiveA).toBe(1630);
    expect(result.effectiveB).toBe(1540);
    expect(result.probabilityA).toBeCloseTo(1 / (1 + 10 ** (-90 / 400)), 14);
    expect(result.probabilityA + result.probabilityB).toBe(1);
  });
  it("global mode ignores surface ratings", () => {
    expect(calculate({ ...base, model: "global", surface: "Clay" })).toEqual(
      calculate({ ...base, model: "global", surface: "Grass" }),
    );
  });
  it("surface selection can reverse the synthetic ordering", () => {
    expect(calculate(base).probabilityA).toBeGreaterThan(0.5);
    expect(calculate({ ...base, surface: "Clay" }).probabilityA).toBeLessThan(0.5);
  });
  it("matches known Python Elo probability reference values", () => {
    expect(
      calculate({ ...base, model: "global", ratingA: 1900, ratingB: 1500 }).probabilityA,
    ).toBeCloseTo(10 / 11, 14);
    expect(calculate({ ...base, model: "global", ratingA: 1500, ratingB: 1500 }).probabilityA).toBe(
      0.5,
    );
  });
  it("swapping players and inputs complements the probability", () => {
    const swapped = calculate({
      ...base,
      playerA: base.playerB,
      playerB: base.playerA,
      ratingA: base.ratingB,
      ratingB: base.ratingA,
    });
    expect(swapped.probabilityA).toBeCloseTo(calculate(base).probabilityB, 14);
  });
  it("isolates the ATP and WTA fixture pools", () => {
    expect(() => calculate({ ...base, tour: "WTA" })).toThrow("same tour");
    expect(
      calculate({ ...base, tour: "WTA", playerA: "w1", playerB: "w2" }).probabilityA,
    ).toBeGreaterThan(0.5);
  });
  it.each([NaN, Infinity, -Infinity, 799, 2401])(
    "rejects invalid editable ratings %s",
    (rating) => {
      expect(() => calculate({ ...base, ratingA: rating })).toThrow("800 and 2400");
      expect(() => calculate({ ...base, ratingB: rating })).toThrow("800 and 2400");
    },
  );
  it.each([800, 2400, 1500.5])("accepts documented rating bounds and decimals %s", (rating) => {
    const result = calculate({ ...base, ratingA: rating });
    expect(result.probabilityA).toBeGreaterThan(0);
    expect(result.probabilityA).toBeLessThan(1);
  });
  it.each([
    { playerB: "a1" },
    { playerA: "unknown" },
    { playerB: "w1" },
    { surface: "Carpet" },
    { model: "validated" },
    { tour: "ITF" },
  ])("rejects unsupported contexts %j", (override) => {
    expect(() => calculate({ ...base, ...override } as Calculation)).toThrow();
  });
  it("has only original demo identifiers and fixed finite inputs", () => {
    expect(PLAYERS).toHaveLength(6);
    for (const player of PLAYERS) {
      expect(player.name).toMatch(/^Demo [AW][123]$/);
      expect(Object.values(player.surface).every(Number.isFinite)).toBe(true);
    }
  });
});

describe("competition directory, not event coverage", () => {
  it("contains the four Slams and all required category families", () => {
    expect(COMPETITIONS.filter((c) => c.family === "Grand Slam").map((c) => c.name)).toEqual([
      "Australian Open",
      "Roland Garros",
      "Wimbledon",
      "US Open",
    ]);
    for (const id of [
      "atp",
      "wta",
      "challenger",
      "wta125",
      "itf",
      "qualifying",
      "doubles",
      "team",
      "olympics",
      "juniors",
      "wheelchair",
      "college",
      "other",
    ]) {
      expect(COMPETITIONS.some((c) => c.id === id)).toBe(true);
    }
    expect(new Set(COMPETITIONS.map((c) => c.id)).size).toBe(COMPETITIONS.length);
  });
  it("combines normalized search and category filters", () => {
    expect(filterCompetitions("  wImBlEdOn ", "Grand Slam").map((c) => c.name)).toEqual([
      "Wimbledon",
    ]);
    expect(filterCompetitions("wimbledon", "Tour")).toHaveLength(0);
    expect(filterCompetitions("Ｄａｖｉｓ", "All").map((c) => c.id)).toEqual(["team"]);
    expect(filterCompetitions("", "All")).toHaveLength(COMPETITIONS.length);
  });
  it("returns no invented events for unknown or markup-shaped queries", () => {
    expect(filterCompetitions("unlisted tournament 2099", "All")).toHaveLength(0);
    expect(filterCompetitions("<img src=x onerror=alert(1)>", "All")).toHaveLength(0);
  });
});
