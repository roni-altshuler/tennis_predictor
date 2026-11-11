import { defineConfig, devices } from "@playwright/test";

const liveUrl = process.env.PLAYWRIGHT_BASE_URL;
if (liveUrl !== undefined && !liveUrl.trim()) {
  throw new Error("External browser verification requires a nonempty site URL.");
}
const external = liveUrl ? new URL(liveUrl) : undefined;
if (external && (external.search || external.hash || external.username || external.password)) {
  throw new Error(
    "The external browser URL must be a site root without credentials, query or hash.",
  );
}
if (
  external &&
  external.protocol !== "https:" &&
  !(external.protocol === "http:" && external.hostname === "127.0.0.1")
) {
  throw new Error("External browser verification requires HTTPS (except local QA).");
}
const baseURL = external ? `${external.href.replace(/\/$/, "")}/` : "http://127.0.0.1:4173/";
if (liveUrl && !/^[a-f0-9]{12}$/.test(process.env.EXPECTED_SOURCE_VERSION ?? "")) {
  throw new Error("External browser verification requires the expected source fingerprint.");
}

export default defineConfig({
  testDir: "./browser-tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 } } },
  ],
  webServer: liveUrl
    ? undefined
    : {
        command: "npm run preview",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: false,
        timeout: 30000,
      },
});
