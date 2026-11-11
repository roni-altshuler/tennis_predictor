# Static website deployment

The browser app can be published with GitHub Pages from this public repository. It has no server, real-data service, account, upload flow or paid dependency. The Python library and private research datasets are not part of the website artifact. Public source availability remains separate from a software licence grant; see [NOTICE](../NOTICE.md).

## Initial owner setup

Before merging the Pages workflow, a repository administrator must open **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source, and save if prompted. No working website is claimed until deployment and live browser verification succeed. Preserve any existing environment approvals, branch restrictions, HTTPS requirements and domain configuration.

The workflow deliberately uses `configure-pages` with `enablement: false`. Initial setup requires Pages and administration permissions not supplied by the normal workflow token. Complete that one-time setup through an authorized administrator's trusted GitHub session; the deployment workflow needs no personal access token or additional credential. Preserve certificate validation when configuring or verifying the website.

Official references: [Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Pages setup permissions](https://docs.github.com/en/rest/pages/pages#create-a-github-pages-site), and [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). GitHub Pages and standard Actions runners are available free for public repositories; hosting limits and GitHub's terms still apply. This synthetic educational prototype is not a commercial transaction service.

## Build, deploy and verify

The existing `Checks and Pages` workflow retains the full Python and browser checks. Only a push to `main` can publish. The web job builds once, tests that production build, records its source fingerprint and uploads only `dist/`. The deploy job requires both the Python and web jobs and has only `pages: write` and `id-token: write`; build and live-verification jobs keep read-only repository access. New Pages actions are pinned to verified commit SHAs. No manual workflow-dispatch trigger, alternate deployment branch or credential is introduced.

After deployment, a separate read-only job runs the entire production browser suite against the exact `page_url` returned by GitHub Pages, with the expected fingerprint from the tested build. Empty URLs and missing fingerprints fail instead of silently falling back to localhost. Navigation, controls, synthetic results, repeat/reset/cancel flows, loading/error/empty states, keyboard/axe checks and 360/768/1440-pixel layouts run against the live site. Reports include screenshots of all four destinations. Main runs serialize through live verification so a later deployment cannot replace the page during those checks.

The Vite build uses relative asset URLs and hash routes, so it supports a repository subdirectory without server rewrites. Local QA additionally serves the build under `/tennis_predictor/` and runs the same suite against that prefix. The browser footer shows a deterministic fingerprint of the application sources/build inputs. Pair that fingerprint with the workflow's exact checked-out commit, successful deployment result and live browser report; a badge alone does not verify a live version.

If any check or live flow fails, report the exact commit, URL, failure and untested functionality. Do not advertise the site as verified, bypass TLS, weaken tests or use repeated deployments to debug. Once live verification passes, add the server-returned working URL to the README and repository Website field using an authorized supported control. This document does not substitute an expected URL for a verified one.

## Local browser verification of a hosted build

The normal `npm run test:browser` command starts a local production preview of the already built `dist/` directory. To test an already deployed build, provide its actual root URL and the 12-character source fingerprint from its successful build:

```sh
PLAYWRIGHT_BASE_URL=https://example.github.io/repository/ \
EXPECTED_SOURCE_VERSION=0123456789ab \
npm run test:browser
```

The URL and fingerprint above are placeholders, not a deployed project link. `PLAYWRIGHT_EXECUTABLE_PATH` can select an already installed Chromium as documented in the README; this does not claim equivalence to CI's pinned browser. External verification never disables certificate validation. Manual visual/assistive-technology review remains distinct from automated checks.
