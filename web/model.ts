export const SURFACES = ["Hard", "Clay", "Grass"] as const;
export type Surface = (typeof SURFACES)[number];
export type Tour = "ATP" | "WTA";
export type Model = "global" | "blend";
export type Player = {
  id: string;
  tour: Tour;
  name: string;
  global: number;
  surface: Record<Surface, number>;
};

// Independently authored illustrative inputs, never learned from real match records.
export const PLAYERS: readonly Player[] = [
  {
    id: "a1",
    tour: "ATP",
    name: "Demo A1",
    global: 1620,
    surface: { Hard: 1640, Clay: 1500, Grass: 1680 },
  },
  {
    id: "a2",
    tour: "ATP",
    name: "Demo A2",
    global: 1560,
    surface: { Hard: 1520, Clay: 1700, Grass: 1490 },
  },
  {
    id: "a3",
    tour: "ATP",
    name: "Demo A3",
    global: 1500,
    surface: { Hard: 1500, Clay: 1500, Grass: 1500 },
  },
  {
    id: "w1",
    tour: "WTA",
    name: "Demo W1",
    global: 1600,
    surface: { Hard: 1660, Clay: 1530, Grass: 1580 },
  },
  {
    id: "w2",
    tour: "WTA",
    name: "Demo W2",
    global: 1540,
    surface: { Hard: 1490, Clay: 1660, Grass: 1560 },
  },
  {
    id: "w3",
    tour: "WTA",
    name: "Demo W3",
    global: 1500,
    surface: { Hard: 1500, Clay: 1500, Grass: 1500 },
  },
];

export type Calculation = {
  tour: Tour;
  surface: Surface;
  model: Model;
  playerA: string;
  playerB: string;
  ratingA: number;
  ratingB: number;
};

export function calculate(input: Calculation) {
  const a = PLAYERS.find((p) => p.id === input.playerA && p.tour === input.tour);
  const b = PLAYERS.find((p) => p.id === input.playerB && p.tour === input.tour);
  if (!a || !b || a.id === b.id)
    throw new Error("Choose two different demo players in the same tour.");
  if (!SURFACES.includes(input.surface) || !["global", "blend"].includes(input.model)) {
    throw new Error("Choose a supported surface and model.");
  }
  if (![input.ratingA, input.ratingB].every((r) => Number.isFinite(r) && r >= 800 && r <= 2400)) {
    throw new Error("Both overall ratings must be numbers between 800 and 2400.");
  }
  const effectiveA =
    input.model === "blend" ? (input.ratingA + a.surface[input.surface]) / 2 : input.ratingA;
  const effectiveB =
    input.model === "blend" ? (input.ratingB + b.surface[input.surface]) / 2 : input.ratingB;
  const probabilityA = 1 / (1 + 10 ** ((effectiveB - effectiveA) / 400));
  return { probabilityA, probabilityB: 1 - probabilityA, effectiveA, effectiveB };
}
export type Result = ReturnType<typeof calculate>;
export type WorkerReply = { result: Result } | { error: string };

export type Competition = {
  id: string;
  name: string;
  family: "Tour" | "Grand Slam" | "Development" | "Other formats";
  examples: string;
  contract: string;
};

// A navigation taxonomy, not an exhaustive event schedule or data-coverage claim.
export const COMPETITIONS: readonly Competition[] = [
  {
    id: "atp",
    name: "ATP Tour singles",
    family: "Tour",
    examples: "Masters 1000 · ATP 500 · ATP 250 · Finals",
    contract:
      "The offline adapter recognizes selected ATP main-draw levels. No licensed records or upcoming fixtures are connected.",
  },
  {
    id: "wta",
    name: "WTA Tour singles",
    family: "Tour",
    examples: "WTA 1000 · WTA 500 · WTA 250 · Finals",
    contract:
      "The offline adapter recognizes selected WTA main-draw levels. No licensed records or upcoming fixtures are connected.",
  },
  ...["Australian Open", "Roland Garros", "Wimbledon", "US Open"].map(
    (name, i): Competition => ({
      id: `slam-${i}`,
      name,
      family: "Grand Slam",
      examples: "Grand Slam · Singles · Qualifying · Doubles · Juniors · Wheelchair",
      contract:
        "The offline adapter recognizes the event name for eligible ATP/WTA singles. This does not validate the other draws. No event feed is connected.",
    }),
  ),
  {
    id: "challenger",
    name: "ATP Challenger Tour",
    family: "Development",
    examples: "Challenger singles and doubles",
    contract:
      "Outside the current evaluation contract; a licensed feed, format rules and separate validation are needed.",
  },
  {
    id: "wta125",
    name: "WTA 125",
    family: "Development",
    examples: "WTA 125 singles and doubles",
    contract: "Not separately validated by the public baseline. No event feed is connected.",
  },
  {
    id: "itf",
    name: "ITF World Tennis Tour",
    family: "Development",
    examples: "Men’s and women’s professional events",
    contract:
      "Outside the current evaluation contract. Coverage, identity mapping and data rights require verification.",
  },
  {
    id: "qualifying",
    name: "Qualifying draws",
    family: "Other formats",
    examples: "Tour · Grand Slam · Development",
    contract:
      "Not modeled by the included offline evaluation. Main-draw coverage must never be presented as qualifying coverage.",
  },
  {
    id: "doubles",
    name: "Doubles & mixed doubles",
    family: "Other formats",
    examples: "Tour · Grand Slam · Team pairs",
    contract:
      "The singles Elo example does not model pairs, changing partnerships or alternative scoring.",
  },
  {
    id: "team",
    name: "Team competitions",
    family: "Other formats",
    examples: "Davis Cup · Billie Jean King Cup · United Cup · Laver Cup",
    contract: "No team-tie aggregation or event-specific lineup/scoring model is implemented.",
  },
  {
    id: "olympics",
    name: "Olympic & multi-sport events",
    family: "Other formats",
    examples: "Olympics · Paralympics · Regional games",
    contract: "No verified entry list, event feed or competition-specific evaluation is connected.",
  },
  {
    id: "juniors",
    name: "Junior tennis",
    family: "Other formats",
    examples: "ITF juniors · Junior Grand Slams",
    contract: "No junior data, player profiles or forecasts are included.",
  },
  {
    id: "wheelchair",
    name: "Wheelchair tennis",
    family: "Other formats",
    examples: "ITF wheelchair · Quad · Grand Slam draws",
    contract: "No wheelchair or quad-specific data or validated model is included.",
  },
  {
    id: "college",
    name: "Collegiate & domestic tennis",
    family: "Other formats",
    examples: "College · National · Regional · Club competitions",
    contract:
      "No verified domestic catalogue or model is included. This category is a coverage placeholder.",
  },
  {
    id: "other",
    name: "Exhibitions & other competitions",
    family: "Other formats",
    examples: "Invitational · Alternative formats · Unlisted competitions",
    contract:
      "Not modeled. This directory groups competition categories; it does not enumerate every tournament worldwide.",
  },
];

export function filterCompetitions(query: string, family: string): readonly Competition[] {
  const normalized = query.trim().normalize("NFKD").toLocaleLowerCase();
  return COMPETITIONS.filter(
    (item) =>
      (family === "All" || item.family === family) &&
      `${item.name} ${item.examples}`.normalize("NFKD").toLocaleLowerCase().includes(normalized),
  );
}
