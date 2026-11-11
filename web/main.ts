import {
  type Calculation,
  COMPETITIONS,
  calculate,
  filterCompetitions,
  PLAYERS,
  type WorkerReply,
} from "./model";
import "./style.css";

declare const __SOURCE_VERSION__: string;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Application root is missing.");
const root = app;
const pages = ["overview", "lab", "competitions", "method"] as const;
type Page = (typeof pages)[number];
const titles: Record<Page, string> = {
  overview: "Court overview",
  lab: "Matchup lab",
  competitions: "Competitions",
  method: "Method & record",
};
const initial = (): Calculation => ({
  tour: "ATP",
  surface: "Hard",
  model: "blend",
  playerA: "a1",
  playerB: "a2",
  ratingA: 1620,
  ratingB: 1560,
});
let input = initial();
let query = "";
let family = "All";
let worker: Worker | undefined;
let timeout: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
const page = (): Page => pages.find((p) => p === location.hash.slice(1)) ?? "overview";
const court = `<svg class="court" viewBox="0 0 440 260" aria-hidden="true"><path class="court-fill" d="M40 25h360v210H40z"/><g fill="none"><path d="M40 25h360v210H40zM40 130h360M85 25v210M355 25v210M85 78h270v104H85zM220 78v104"/><path class="net" d="M25 130h390"/></g><circle cx="306" cy="80" r="7"/><path class="ball-trail" d="M298 82q-49 18-80 50" fill="none"/></svg>`;

function cancel() {
  generation++;
  worker?.terminate();
  worker = undefined;
  clearTimeout(timeout);
}

function overview() {
  return `<section class="hero panel"><div><p class="eyebrow">TENNIS, WITH THE ASSUMPTIONS VISIBLE</p><h1 id="page-title" tabindex="-1">Read the court.<br><span>Question the number.</span></h1><p class="lede">Explore how ratings and surfaces change a matchup. Start with a transparent, fictional example — then see exactly where the evidence stops.</p><a class="button primary" href="#lab">Open matchup lab <span aria-hidden="true">↗</span></a><a class="text-link" href="#method">Read the method →</a></div>${court}</section>
  <div class="stats"><div><span class="eyebrow">DATA MODE</span><strong>Synthetic</strong><span>Original fictional inputs</span></div><div><span class="eyebrow">LIVE FEEDS</span><strong>Not connected</strong><span>No fixtures or results service</span></div><div><span class="eyebrow">CALIBRATION</span><strong>Not measured</strong><span>No real-world accuracy claim</span></div></div>
  <div class="section-heading"><h2>Explore the baseline</h2><span class="eyebrow">01 / THE WORKBENCH</span></div>
  <div class="two-columns"><a class="feature panel" href="#lab"><span class="tag">INTERACTIVE · BROWSER ONLY</span><h3>A surface can change the story.</h3><p>Compare global Elo with a 50/50 global–surface blend. Change the inputs and inspect the arithmetic behind the result.</p><span class="text-link">Build a demo matchup →</span></a><a class="feature panel" href="#competitions"><span class="tag">COVERAGE DIRECTORY</span><h3>One sport. Many competitions.</h3><p>Tour singles, the four Grand Slams, development circuits and other formats. Each category states what is still unavailable.</p><span class="text-link">Explore competition coverage →</span></a></div>
  <section class="notice"><h2>What you are looking at</h2><p>This is an early prototype, not a live prediction service. Demo A1 and Demo W1 are fictional identifiers. The displayed ratings were authored for this interface, not learned from athlete records. Nothing here is a validated real-player forecast or betting recommendation.</p></section>`;
}

function options(side: "A" | "B") {
  return PLAYERS.filter((p) => p.tour === input.tour)
    .map(
      (p) =>
        `<option value="${p.id}" ${p.id === input[`player${side}`] ? "selected" : ""}>${p.name}</option>`,
    )
    .join("");
}

function lab() {
  return `<div class="section-heading page-heading"><div><p class="eyebrow">02 / MATCHUP LAB</p><h1 id="page-title" tabindex="-1">Explore a matchup.</h1><p class="lede">Fictional players. Explicit inputs. A calculation you can inspect.</p></div><span class="tag">SYNTHETIC DEMONSTRATION</span></div>
  <div class="lab-grid"><section class="panel lab-controls" aria-labelledby="inputs-title"><h2 id="inputs-title">Set the court</h2><form id="matchup-form" novalidate><div class="control-row"><label>Tour<select id="tour" name="tour"><option ${input.tour === "ATP" ? "selected" : ""}>ATP</option><option ${input.tour === "WTA" ? "selected" : ""}>WTA</option></select></label><label>Surface<select id="surface" name="surface">${["Hard", "Clay", "Grass"].map((s) => `<option ${input.surface === s ? "selected" : ""}>${s}</option>`).join("")}</select></label></div>
  <label>Calculation<select id="model" name="model"><option value="blend" ${input.model === "blend" ? "selected" : ""}>50/50 global–surface blend</option><option value="global" ${input.model === "global" ? "selected" : ""}>Global Elo only</option></select></label><p class="field-help">The blend is experimental. It has not been shown to improve real-match predictions.</p>
  <fieldset><legend>Player A</legend><label>Demo player A<select id="playerA" name="playerA">${options("A")}</select></label><label>Overall rating A<input id="ratingA" name="ratingA" type="number" min="800" max="2400" step="any" value="${input.ratingA}" aria-describedby="rating-help"></label></fieldset>
  <fieldset><legend>Player B</legend><label>Demo player B<select id="playerB" name="playerB">${options("B")}</select></label><label>Overall rating B<input id="ratingB" name="ratingB" type="number" min="800" max="2400" step="any" value="${input.ratingB}" aria-describedby="rating-help"></label></fieldset>
  <p id="rating-help" class="field-help">Overall ratings are editable (800–2400). Surface ratings are fixed synthetic inputs, shown with the result. No records are uploaded or stored.</p>
  <div class="actions"><button class="button primary" type="submit" id="calculate">Calculate matchup <span aria-hidden="true">→</span></button><button type="button" class="button secondary" id="cancel" hidden>Cancel</button></div><div class="actions minor"><button type="button" class="text-button" id="swap">Swap players</button><button type="button" class="text-button" id="reset">Reset demo</button></div></form></section>
  <section class="panel result-panel" aria-labelledby="result-title"><p class="eyebrow">ILLUSTRATIVE OUTPUT</p><h2 id="result-title">The number needs context.</h2><div id="result" aria-live="polite" aria-atomic="true"><div class="result-empty"><span class="empty-symbol" aria-hidden="true">↗</span><h3>No calculation yet</h3><p>Choose two different demo players and calculate to see both probabilities and the exact input ratings.</p></div></div><p id="calculation-status" class="status" role="status"></p><p id="calculation-error" class="error" role="alert"></p></section></div>
  <section class="notice"><h2>Read this as an experiment</h2><p>A percentage is the output of the Elo formula, not a confidence score, confidence interval or validated chance of winning. The lab does not model injuries, rankings, schedules, best-of-five effects, doubles or real player history. There is no bookmaker or live-data connection.</p><a href="#method">Inspect the method and evidence limits →</a></section>`;
}

function competitions() {
  return `<div class="page-heading"><p class="eyebrow">03 / COMPETITION DIRECTORY</p><h1 id="page-title" tabindex="-1">The whole map.<br><span>The honest gaps.</span></h1><p class="lede">Browse competition categories, including all four Grand Slams. This is a navigation taxonomy, not a complete tournament catalogue or a claim of data coverage.</p></div><div class="notice compact"><strong>No live competition feed is connected.</strong><p>Unknown coverage is shown as unavailable, never as zero scheduled matches. The matchup lab uses synthetic singles inputs only.</p></div>
  <section aria-label="Competition filters" class="filters panel"><label>Find a competition<input id="competition-search" type="search" placeholder="Try Wimbledon, doubles or ITF" maxlength="150"></label><label>Category<select id="competition-family">${["All", "Tour", "Grand Slam", "Development", "Other formats"].map((f) => `<option ${family === f ? "selected" : ""}>${f}</option>`).join("")}</select></label><button class="button secondary" id="clear-filters" type="button">Clear filters</button></section><p id="coverage-count" role="status" class="field-help"></p><div id="competition-list" class="competition-list"></div>`;
}

function method() {
  return `<div class="page-heading"><p class="eyebrow">04 / METHOD & RECORD</p><h1 id="page-title" tabindex="-1">Evidence before confidence.</h1><p class="lede">The public prototype makes its assumptions inspectable. It has no published real-data benchmark or validated live forecast.</p></div><div class="stats"><div><span class="eyebrow">REAL-MATCH ACCURACY</span><strong>Not measured</strong><span>No public eligible evaluation cohort</span></div><div><span class="eyebrow">DATA FRESHNESS</span><strong>Fixed demo inputs</strong><span>No automatic data updates</span></div><div><span class="eyebrow">DATA PRIVACY</span><strong>Browser only</strong><span>No uploads, account or saved history</span></div></div>
  <div class="two-columns"><section class="panel prose"><span class="tag">THE LAB</span><h2>One transparent formula</h2><p>For effective ratings R<sub>A</sub> and R<sub>B</sub>, the illustrative output for A is:</p><code class="formula">1 / (1 + 10^((R_B − R_A) / 400))</code><p>Global mode uses the editable overall ratings. Blend mode averages each overall rating with that demo player’s surface rating, then applies the same formula. B receives the complementary probability.</p><p>All six demo players and their ratings are original synthetic examples. The lab does not train a model, fetch records or infer an athlete’s ability.</p></section><section class="panel prose"><span class="tag">THE OFFLINE FOUNDATION</span><h2>A conservative evaluation contract</h2><p>The separate Python library starts at 1500, uses K=24 and keeps ATP/WTA pools separate. It validates eligible local singles rows and batches updates sharing a tournament-start date.</p><p>Event-week dates and match numbers cannot establish result availability. Yearly evaluation therefore withholds the entire intervening tournament-start year and freezes the model for the evaluation cohort. This remains a retrospective convention, not a reconstruction of live predictions.</p><p>Neither the experimental surface blend nor any accuracy improvement has been validated by this website.</p></section></div>
  <section class="panel prose"><h2>What would make a real forecast credible?</h2><ol class="method-list"><li><strong>Verified data rights and coverage.</strong> A downloadable dataset is not automatically licensed for a public product. No third-party records, weights or private benchmark artifacts are bundled.</li><li><strong>Availability-aware evaluation.</strong> Match completion, original publication and correction timestamps must be distinguished from event start dates.</li><li><strong>Untouched chronological tests.</strong> Compare against simple references, report Brier/log loss, calibration and low-history limitations before claiming improvement.</li><li><strong>Visible operational evidence.</strong> A connected feed would need its source, retrieval time, missing competitions and failures shown alongside results.</li></ol><a class="text-link" href="https://github.com/roni-altshuler/tennis_predictor">Read the public code, data policy and evaluation protocol ↗</a></section>`;
}

function render(focus = false) {
  cancel();
  const current = page();
  document.title = `${titles[current]} — Baseline Tennis Predictor`;
  root.innerHTML = `<a class="skip-link" href="#main">Skip to content</a><aside class="sidebar"><a class="brand" href="#overview" aria-label="Baseline home"><span class="brand-mark" aria-hidden="true">II</span><span>BASELINE<small>TENNIS PREDICTOR</small></span></a><p class="nav-label">THE TENNIS DESK</p><nav aria-label="Primary">${pages.map((p, i) => `<a href="#${p}" ${current === p ? 'aria-current="page"' : ""}><span class="nav-number" aria-hidden="true">0${i + 1}</span>${titles[p]}</a>`).join("")}</nav><div class="sidebar-bottom"><span class="tag">EARLY PROTOTYPE</span><p>Transparent by design.<br>Evidence still to come.</p><a href="https://github.com/roni-altshuler/tennis_predictor">Source & documentation ↗</a></div></aside><div class="shell"><header class="topbar"><a class="mobile-brand" href="#overview">BASELINE</a><span class="breadcrumb">TENNIS / ${titles[current].toUpperCase()}</span><span class="mode"><span aria-hidden="true">◇</span> SYNTHETIC DEMO</span></header><main id="main" tabindex="-1">${({ overview, lab, competitions, method })[current]()}</main><footer><span>BASELINE / TENNIS PREDICTOR</span><span>Prototype v0.2.0 · Source ${__SOURCE_VERSION__.slice(0, 12)} · No live feed</span></footer></div>`;
  document.querySelector(".skip-link")?.addEventListener("click", (event) => {
    event.preventDefault();
    document.querySelector<HTMLElement>("#main")?.focus();
  });
  if (current === "lab") bindLab();
  if (current === "competitions") bindCompetitions();
  if (focus) document.querySelector<HTMLElement>("#page-title")?.focus();
}

function bindCompetitions() {
  const search = document.querySelector<HTMLInputElement>("#competition-search");
  const select = document.querySelector<HTMLSelectElement>("#competition-family");
  if (!search || !select) return;
  search.value = query;
  const update = () => {
    query = search.value;
    family = select.value;
    const items = filterCompetitions(query, family);
    const list = document.querySelector<HTMLDivElement>("#competition-list");
    const count = document.querySelector("#coverage-count");
    if (!list || !count) return;
    count.textContent = `${items.length} of ${COMPETITIONS.length} directory entries · Data unavailable for every category`;
    list.innerHTML = items.length
      ? items
          .map(
            (item) =>
              `<details class="panel competition"><summary><span><span class="eyebrow">${item.family}</span><strong>${item.name}</strong><span class="competition-examples">${item.examples}</span></span><span class="availability">DATA UNAVAILABLE <span aria-hidden="true">＋</span></span></summary><div class="competition-detail"><p>${item.contract}</p><p>No fixtures, results or real-player probabilities are available here.</p><a href="#method">Read the evidence requirements →</a></div></details>`,
          )
          .join("")
      : '<div class="panel empty"><h2>No directory entries match</h2><p>Try a broader term or clear the filters. This does not mean there are no real competitions.</p></div>';
  };
  search.addEventListener("input", update);
  select.addEventListener("change", update);
  document.querySelector("#clear-filters")?.addEventListener("click", () => {
    search.value = "";
    select.value = "All";
    update();
    search.focus();
  });
  update();
}

function bindLab() {
  const form = document.querySelector<HTMLFormElement>("#matchup-form");
  const status = document.querySelector<HTMLElement>("#calculation-status");
  const error = document.querySelector<HTMLElement>("#calculation-error");
  const result = document.querySelector<HTMLElement>("#result");
  const button = document.querySelector<HTMLButtonElement>("#calculate");
  const stop = document.querySelector<HTMLButtonElement>("#cancel");
  if (!form || !status || !error || !result || !button || !stop) return;
  const control = (name: string) =>
    form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
  let returnToCalculate = false;
  const idle = () => {
    button.disabled = false;
    stop.hidden = true;
    form.removeAttribute("aria-busy");
    if (returnToCalculate && document.activeElement === document.body) button.focus();
    returnToCalculate = false;
  };
  const invalidate = () => {
    cancel();
    idle();
    error.textContent = "";
    result.innerHTML =
      '<div class="result-empty"><h3>Inputs changed</h3><p>Calculate again to see a result for this selection.</p></div>';
    status.textContent = "Previous output cleared. Ready for a new calculation.";
  };
  const read = () => {
    input = {
      ...input,
      surface: control("surface").value as Calculation["surface"],
      model: control("model").value as Calculation["model"],
      playerA: control("playerA").value,
      playerB: control("playerB").value,
      ratingA: Number.parseFloat(control("ratingA").value),
      ratingB: Number.parseFloat(control("ratingB").value),
    };
  };
  form.addEventListener("input", (event) => {
    if (event.target instanceof HTMLInputElement) {
      read();
      invalidate();
    }
  });
  form.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.name === "tour") {
      input =
        target.value === "WTA"
          ? {
              ...initial(),
              tour: "WTA",
              playerA: "w1",
              playerB: "w2",
              ratingA: 1600,
              ratingB: 1540,
            }
          : initial();
      render();
      document.querySelector<HTMLElement>("#tour")?.focus();
      return;
    }
    if (target.name === "playerA" || target.name === "playerB") {
      const side = target.name === "playerA" ? "A" : "B";
      const chosen = PLAYERS.find((p) => p.id === target.value);
      if (chosen) control(`rating${side}`).value = String(chosen.global);
    }
    read();
    invalidate();
  });
  stop.addEventListener("click", () => {
    cancel();
    idle();
    status.textContent = "Calculation canceled. No result was kept.";
    button.focus();
  });
  document.querySelector("#swap")?.addEventListener("click", () => {
    read();
    input = {
      ...input,
      playerA: input.playerB,
      playerB: input.playerA,
      ratingA: input.ratingB,
      ratingB: input.ratingA,
    };
    render();
    document.querySelector<HTMLElement>("#swap")?.focus();
  });
  document.querySelector("#reset")?.addEventListener("click", () => {
    input = initial();
    render();
    document.querySelector<HTMLElement>("#reset")?.focus();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    read();
    cancel();
    idle();
    error.textContent = "";
    status.textContent = "";
    result.innerHTML = "";
    try {
      calculate(input);
    } catch (failure) {
      error.textContent = failure instanceof Error ? failure.message : "Check your inputs.";
      return;
    }
    const token = generation;
    const fail = () => {
      if (generation !== token) return;
      cancel();
      idle();
      status.textContent = "";
      error.textContent =
        "The local calculation could not finish. Your inputs are unchanged. Try Calculate matchup again, or reset the demo.";
    };
    status.textContent = "Calculating in your browser…";
    returnToCalculate = document.activeElement === button;
    button.disabled = true;
    stop.hidden = false;
    form.setAttribute("aria-busy", "true");
    try {
      worker = new Worker(new URL("./calculator.worker.ts", import.meta.url), { type: "module" });
      worker.onerror = fail;
      worker.onmessageerror = fail;
      worker.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
        if (generation !== token) return;
        cancel();
        idle();
        status.textContent = "";
        if ("error" in data) {
          error.textContent = data.error;
          return;
        }
        const { probabilityA, effectiveA, effectiveB } = data.result;
        const a = PLAYERS.find((p) => p.id === input.playerA);
        const b = PLAYERS.find((p) => p.id === input.playerB);
        if (!a || !b) return;
        const percent = Math.round(probabilityA * 1000) / 10;
        result.innerHTML = `<p class="result-context">${input.tour} demo · ${input.surface} · ${input.model === "blend" ? "50/50 blend" : "Global Elo"}</p><div class="probabilities"><div class="probability-cell"><span>${a.name}</span><strong>${percent.toFixed(1)}<small>%</small></strong></div><span class="versus">VS</span><div class="probability-cell"><span>${b.name}</span><strong>${(100 - percent).toFixed(1)}<small>%</small></strong></div></div><div class="probability-track" aria-hidden="true"><span style="width:${percent}%"></span></div><p class="result-caveat">Illustrative formula outputs. Uncalibrated; not real-player win probabilities.</p><h3>Inspect the inputs</h3><div class="table-wrap"><table><caption>Ratings used for this synthetic calculation</caption><thead><tr><th scope="col">Input</th><th scope="col">${a.name}</th><th scope="col">${b.name}</th></tr></thead><tbody><tr><th scope="row">Overall (editable)</th><td>${input.ratingA}</td><td>${input.ratingB}</td></tr><tr><th scope="row">${input.surface} (fixed demo)</th><td>${a.surface[input.surface]}</td><td>${b.surface[input.surface]}</td></tr><tr><th scope="row">Effective rating</th><td>${effectiveA}</td><td>${effectiveB}</td></tr></tbody></table></div><p class="field-help">${input.model === "blend" ? "Effective = (overall + surface) / 2." : "Effective = overall. Surface ratings are not used in global mode."} Source: original fixed synthetic fixture v1. No real match history.</p>`;
      };
      timeout = setTimeout(fail, 5000);
      worker.postMessage({ ...input });
    } catch {
      fail();
    }
  });
}

window.addEventListener("hashchange", () => {
  if (location.hash === "#main") {
    document.querySelector<HTMLElement>("#main")?.focus();
    return;
  }
  render(true);
  window.scrollTo(0, 0);
});
render();
