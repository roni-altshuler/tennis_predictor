import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("overview, navigation, back and truthful method record", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(response.url());
  });
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Read the court.");
  await expect(page.locator(".mode")).toContainText("SYNTHETIC DEMO");
  await page.getByRole("link", { name: "Read the method" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Evidence before confidence.");
  await expect(page.getByText("No public eligible evaluation cohort")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Read the court.");
  await expect(page.locator("nav a[aria-current=page]")).toHaveAttribute("href", "#overview");
  expect(errors).toEqual([]);
});

test("real local worker calculates, changes invalidate, swaps complement, resets", async ({
  page,
}) => {
  await page.goto("./#lab");
  await expect(page.getByRole("heading", { name: "No calculation yet" })).toBeVisible();
  await page.getByRole("button", { name: "Calculate matchup" }).click();
  await expect(page.locator(".probabilities")).toContainText("62.7");
  await expect(page.getByRole("table")).toContainText("1630");
  await page.getByRole("combobox", { name: "Surface", exact: true }).selectOption("Clay");
  await expect(page.locator(".probabilities")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Inputs changed" })).toBeVisible();
  await page.getByRole("button", { name: "Calculate matchup" }).click();
  await expect(page.locator(".probabilities")).toContainText("40.1");
  await page.getByRole("button", { name: "Swap players" }).click();
  await page.getByRole("button", { name: "Calculate matchup" }).click();
  await expect(page.locator(".probabilities > div").first()).toContainText("59.9");
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByRole("combobox", { name: "Surface", exact: true })).toHaveValue("Hard");
  await expect(page.getByLabel("Overall rating A")).toHaveValue("1620");
  await expect(page.locator(".probabilities")).toHaveCount(0);
});

test("WTA, global-only, input validation and repeat calculations", async ({ page }) => {
  await page.goto("./#lab");
  await page.getByRole("combobox", { name: "Tour", exact: true }).selectOption("WTA");
  await expect(page.getByRole("combobox", { name: "Demo player A", exact: true })).toHaveValue(
    "w1",
  );
  await page.getByRole("combobox", { name: "Calculation", exact: true }).selectOption("global");
  await page.getByLabel("Overall rating A").fill("1500");
  await page.getByLabel("Overall rating B").fill("1500");
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Calculate matchup" }).click();
    await expect(page.locator(".probabilities")).toContainText("50.0");
  }
  await page.getByRole("combobox", { name: "Demo player B", exact: true }).selectOption("w1");
  await page.getByRole("button", { name: "Calculate matchup" }).click();
  await expect(page.getByRole("alert")).toContainText("two different");
  await expect(page.locator(".probabilities")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Demo player B", exact: true }).selectOption("w2");
  for (const value of ["", "2401", "799"]) {
    await page.getByLabel("Overall rating A").fill(value);
    await page.getByRole("button", { name: "Calculate matchup" }).click();
    await expect(page.getByRole("alert")).toContainText("800 and 2400");
  }
  await page.getByLabel("Overall rating A").fill("1500");
  await page.getByRole("button", { name: "Calculate matchup" }).click();
  await expect(page.locator(".probabilities")).toBeVisible();
  await expect(page.locator("#calculation-error")).toBeEmpty();
});

test("coverage filters, empty state, details and safe untrusted query", async ({ page }) => {
  await page.goto("./#competitions");
  await expect(page.locator("details")).toHaveCount(17);
  await page.getByRole("combobox", { name: "Category", exact: true }).selectOption("Grand Slam");
  await expect(page.locator("details")).toHaveCount(4);
  await page.getByLabel("Find a competition").fill("wimbledon");
  await page.getByText("Wimbledon", { exact: true }).click();
  await expect(
    page.getByText("No fixtures, results or real-player probabilities are available here."),
  ).toBeVisible();
  await page.getByLabel("Find a competition").fill("<img src=x onerror=alert(1)>");
  await expect(page.getByRole("heading", { name: "No directory entries match" })).toBeVisible();
  await expect(page.locator("#competition-list img")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator("details")).toHaveCount(17);
  await expect(page.getByLabel("Find a competition")).toBeFocused();
  for (const term of [
    "Challenger",
    "ITF",
    "Qualifying",
    "Doubles",
    "Team",
    "Olympic",
    "Junior",
    "Wheelchair",
    "Collegiate",
    "Exhibitions",
  ]) {
    await page.getByLabel("Find a competition").fill(term);
    await expect(page.locator("details").first()).toBeVisible();
  }
});

test("pending work can be canceled and cannot overwrite changed or navigated state", async ({
  page,
}) => {
  // A deterministic slow local-worker fixture exercises cancellation without a provider call.
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      postMessage(message: unknown) {
        setTimeout(() => {
          try {
            super.postMessage(message);
          } catch {
            /* terminated worker */
          }
        }, 700);
      }
    };
  });
  await page.goto("./#lab");
  await page.getByRole("button", { name: "Calculate matchup" }).click();
  await expect(page.getByRole("status")).toContainText("Calculating in your browser");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("canceled");
  await page.getByRole("button", { name: "Calculate matchup" }).click();
  await page.getByRole("combobox", { name: "Surface", exact: true }).selectOption("Grass");
  await expect(page.getByRole("status")).toContainText("Previous output cleared");
  await page.getByRole("button", { name: "Calculate matchup" }).click();
  await page.getByRole("navigation").getByRole("link", { name: "Method & record" }).click();
  await page.waitForTimeout(850);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Evidence before confidence.");
  await page.goBack();
  await expect(page.locator(".probabilities")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Surface", exact: true })).toHaveValue("Grass");
  await page.getByRole("button", { name: "Calculate matchup" }).click();
  await expect(page.locator(".probabilities")).toBeVisible();
});

test("local worker failure is visible and reset remains usable", async ({ page }) => {
  await page.addInitScript(() => {
    window.Worker = class {
      constructor() {
        throw new Error("Synthetic worker unavailable");
      }
    } as unknown as typeof Worker;
  });
  await page.goto("./#lab");
  await page.getByRole("button", { name: "Calculate matchup" }).click();
  await expect(page.getByRole("alert")).toContainText("local calculation could not finish");
  await expect(page.getByRole("button", { name: "Calculate matchup" })).toBeEnabled();
  await expect(page.locator(".probabilities")).toHaveCount(0);
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByLabel("Overall rating A")).toHaveValue("1620");
  await expect(page.getByRole("heading", { name: "No calculation yet" })).toBeVisible();
});

test("keyboard skip link, complete navigation and focused headings", async ({ page }) => {
  await page.goto("./");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  for (const name of ["Matchup lab", "Competitions", "Method & record", "Court overview"]) {
    await page.getByRole("navigation").getByRole("link", { name }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  }
});

for (const route of ["overview", "lab", "competitions", "method"]) {
  test(`${route} has no axe violations or page overflow`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push(response.url());
    });
    await page.goto(`./#${route}`);
    if (route === "lab") {
      await page.getByRole("button", { name: "Calculate matchup" }).click();
      await expect(page.locator(".probabilities")).toBeVisible();
    }
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
        .violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
    await testInfo.attach(`${route}-${testInfo.project.name}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
}

test("built source fingerprint identifies the tested version", async ({ page }) => {
  await page.goto("./");
  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText(/Source [a-f0-9]{12}/);
  const expected = process.env.EXPECTED_SOURCE_VERSION;
  if (expected) await expect(footer).toContainText(`Source ${expected}`);
});

for (const failure of ["error", "messageerror", "timeout"] as const) {
  test(`asynchronous worker ${failure} is visible and a repeat calculation recovers`, async ({
    page,
  }) => {
    await page.clock.install();
    await page.addInitScript((kind) => {
      const OriginalWorker = window.Worker;
      let attempts = 0;
      window.Worker = class extends OriginalWorker {
        postMessage(message: unknown) {
          if (++attempts > 1) {
            super.postMessage(message);
            return;
          }
          if (kind === "error") setTimeout(() => this.onerror?.(new ErrorEvent("error")), 10);
          if (kind === "messageerror")
            setTimeout(() => this.onmessageerror?.(new MessageEvent("messageerror")), 10);
        }
      };
    }, failure);
    await page.goto("./#lab");
    const calculate = page.getByRole("button", { name: "Calculate matchup" });
    await calculate.focus();
    await page.keyboard.press("Enter");
    await page.clock.fastForward(failure === "timeout" ? 5100 : 100);
    await expect(page.getByRole("alert")).toContainText("local calculation could not finish");
    await expect(calculate).toBeFocused();
    await expect(page.getByLabel("Overall rating A")).toHaveValue("1620");
    await calculate.click();
    await expect(page.locator(".probabilities")).toBeVisible();
    await expect(page.locator("#calculation-error")).toBeEmpty();
  });
}

test("skip from lab preserves route history, reset and keyboard calculation focus", async ({
  page,
}) => {
  await page.goto("./#lab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page).toHaveURL(/#lab$/);
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Explore a matchup.");
  const calculate = page.getByRole("button", { name: "Calculate matchup" });
  await calculate.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".probabilities")).toBeVisible();
  await expect(calculate).toBeFocused();
  await page.getByRole("navigation").getByRole("link", { name: "Method & record" }).click();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Explore a matchup.");
});
