# Verification record

## v0.5.0 web workspace separation — November 10, 2026

The website and Studio source now live in the private `web/` workspace, with independent development, build, strict checks and tests. The root package retains only the harness implementation, generated-project templates and the built Studio assets used by `gallery`. Homepage markup, motion code and font assets are excluded from the npm archive.

The split preserves all 144 regression cases as 131 harness tests and 13 web tests. Both suites and strict checks passed. The actual package smoke test additionally verifies that marketing files are absent, installed `site` reports the separate source workspace, and offline gallery export still works for all templates. The old source-checkout `site` command delegates to `web/` and its custom-folder export was exercised.

The rebuilt website passed desktop/mobile template interactions, seven homepage viewport sizes and the complete animation check again. The release includes separately packaged harness and static website assets. These checks preserve the external-integration limits recorded below.

## TypeScript migration — November 10, 2026

This is local acceptance of the prepared v0.5.0 source and npm tarball, not a new npm publication or remote deployment.

| Check | Observed result |
| --- | --- |
| Strict TypeScript | `strict: true` covers the CLI, shared contracts, browser modules, payment Worker, tests and release/build scripts. No `any` annotations, `@ts-ignore` or `@ts-nocheck` bypasses were introduced. Four compile-only negative assertions verify unsupported contracts are rejected. |
| Regression suite | 144/144 passed on Node.js 22.13.1, 24.22.2 and 26.7.0 on macOS. The pre-migration baseline was 142/142; added checks cover malformed configuration boundaries and the Studio's browser name pattern. |
| Build | TypeScript emits `.mjs` / `.js` into `dist/`; the build assembles templates, fonts, skills and portable runtime metadata. The existing `bin/opc.mjs` launcher and copied runtime CLI paths are preserved. |
| npm installation | The actual tarball was installed through npx into an isolated home for both hosts, on Node 22.13.1 and Node 26.7.0. Removing its npx cache did not break generation. All 11 templates and 11 recipes were generated. Repeating setup changed zero files. |
| Consumer dependencies | A copied project's CLI automatically installed pinned Wrangler with development dependencies omitted, completed a real local deployment dry run and passed its emitted-JavaScript checks. TypeScript, Node type definitions, ts-node and tsx were absent from that runtime. |
| Package contents | Compiled CLI, browser and Worker code, skills, fonts and assets are included. TypeScript sources and test fixtures are excluded. Product-site and catalogue exports and packaged documentation links were checked. |
| Existing installations | Upgrading an isolated installation made by the previous JavaScript implementation preserved personal defaults, both host entries and an edited existing page. The upgraded project-local CLI ran independently and repeated setup changed zero files. |
| Payment persistence | The signed Stripe-event, idempotency, entitlement, negative-path and rollback tests passed against real SQLite with controlled provider responses. A real local Wrangler/D1 demo also passed all eight checkout-to-delivery checks. |
| Browser payment path | The generated storefront's workspace completed demo checkout, confirmed server-side access, retained the edited draft and downloaded Markdown. The saved file was read and contained the current idea, audience, outcome and launch checklist. |

### Browser acceptance

The flow under test was the compiled product site → catalogue selection and live branding → generated-template interactions, plus a separate local demo checkout → confirmed access → actual Markdown download. Browser tooling used isolated headless Chrome through Playwright, following the previously authorized local fallback after the connected-browser timeout. Browser requests were restricted to `http://127.0.0.1:8788`.

| Check | Result |
| --- | --- |
| Page identity and content | Correct titles, headings and meaningful content; no blank pages or framework error overlays. |
| Responsive layout | All 11 templates at 1488px and 390px, plus homepage checks at seven viewport sizes from 320px to 1488px. No page-level horizontal overflow. |
| Homepage animation | Two complete six-second cycles, 751 synchronized samples, all Design / Payments / Deployment stages, six manual prompts, earlier harness completion and both final completion states. Reduced motion and keyboard tab navigation passed. |
| Studio | Category filters, template selection, live brand/headline/description preview, mobile preview, compatible recipe selection and downloaded project configuration passed. The actual downloaded JSON was parsed and checked. |
| Template behavior | Brief generation/persistence, portfolio filtering, detail dialogs, directory favorites/search, documentation navigation/search, SaaS walkthrough, Orbit tabs, task and contact CRUD/persistence/CSV contents, and calendar file contents passed. |
| Console | No application exceptions or console errors in the final pass. Trusted local preview iframes retain the existing browser warning about combining `allow-scripts` with `allow-same-origin`. |
| Screenshot evidence | Captured homepage desktop/mobile views, all 22 template/viewport combinations, Studio live branding, confirmed demo access and successful Markdown export. Screenshots use fictional local data. |

The final browser pass also caught an existing Studio project-name pattern that newer Chrome rejected. The pattern now escapes the hyphen correctly; a regression checks both valid slugs and unsafe names.

### Reproduce

```sh
npm ci
npm run typecheck
npm run check
npm test
npm run check:release
npm run test:package
npm pack --dry-run
npm --prefix web run dev -- --port 8788
```

`test:package` uses an actual archive and isolated host directories. It never installs into the developer's personal agent configuration. Runtime source code lives in `.mts` / `.ts`; generated projects and npm consumers continue to run JavaScript without a TypeScript compiler.

This pass did not initiate a new external Stripe transaction, remote Cloudflare/Vercel deployment, or Codex/Claude model session. Provider contracts, actual local execution and host installation are separate evidence. Native Windows host setup remains unverified. CI is configured to run strict checking, the compiled tests and package smoke checks on Linux with Node 22 and 24; local results do not claim a new remote CI run.


## v0.5.0 development branch — November 9, 2026

This record distinguishes the prepared source from a published package. npm `latest` was checked live and remains **0.3.0**. Version 0.5.0 is not an npm release or a verified remote Vercel deployment.

- 122 regression tests passed, including all eleven templates, eleven compatible recipes, full project configuration import, saved stack defaults, incompatible selection rejection and Vercel API failure/resume behavior.
- The actual studio create command was copied through Chrome, then executed against the local source CLI. The selected contact admin, portable stack and a brand containing an apostrophe were preserved.
- The actual downloaded `opc-project.json` was read from disk and used by `create --project-config` to generate the selected website with both host entries.
- The contact admin was exercised in Chrome: create, edit, change stage, reload persistence, search, delete and export. The saved CSV was read from disk and contained the edited contact, current stage and note. A form-control naming collision found during browser QA was corrected.
- All eleven example pages were opened at a measured 1488px desktop width and a measured 390px mobile width. Each contained its intended heading and had no page-level horizontal overflow. The studio's own 390px layout and mobile configuration shortcut were also exercised. Desktop/mobile screenshots were captured from the actual pages; the last template pass returned no relevant warning/error logs.
- Orbit's live feature tabs and the studio's mobile preview mode were exercised. The catalog shows independent reference-site links alongside exact reusable OPC examples.
- The original paid Cloudflare recipe was packaged with real Wrangler, then served against local D1. HTTP checks and all eight demo checkout/entitlement/download checks passed. No new external Stripe transaction or Cloudflare deployment was performed in this pass.
- A real Vercel static dry-run built the selected frontend and source-identity marker without remote requests. API fixtures checked explicit project/team scope, static-only uploads, preview targeting, source identity, repeat/resume behavior and uncertain-upload refusal. Real remote Vercel acceptance remains unverified without the selected project's credentials.
- The shared project Skill passed its validator. Actual new Codex/Claude Code model sessions were not launched in this pass; generated entries and the copied runtime are checked independently of model routing.

Source syntax, English release text, documentation links, package contents and isolated tarball installation are checked separately before publication. Do not treat a local archive as proof of npm availability.

# Verification record

This is a reviewed summary for v0.4.0, recorded on **2026-11-03**. Private credentials, account identifiers, machine paths, order tokens, and raw deployment records are not published.

## Harness regression tests

The local baseline is **96 passing tests** on macOS with Node.js 26.7.0, plus the JavaScript syntax checks. The CI workflow runs the same source suite on Node.js 22 and 24; check [Actions](https://github.com/AniChikage/opc-harness/actions) for the latest result rather than treating this document as a live badge.

| Scope | Covered behavior |
| --- | --- |
| CLI and configuration | Initialization, profiles, preserved existing choices, missing credentials, scoped evidence and freshness |
| User-level setup | Both host entries, repeated installation, conflicts, backups, rollback, home overrides and unrelated instruction preservation |
| Payment persistence | Real SQLite queries and transactions, capabilities, signature checks, amount/currency/environment matching and idempotent fulfillment |
| Deployment | Packaging and ownership preflight, uncertain creation, version identity, secret allowlist, local build packaging |
| Shared D1 | Namespaced additive migrations, old-table isolation, pinned provenance, separate migration ledger and safe subsequent deployment |
| Forward flow | Project creation, starter, inspection, planning and scoped checks in isolated test directories |

The unit and deployment-contract suites use controlled provider responses. They do not create cloud accounts, make real Stripe calls, or prove a particular user's credentials work.

## Template acceptance

All eight templates were opened in connected Chrome at a 1488px desktop width and a 390×844 mobile viewport. Each rendered meaningful content, had no page-level horizontal overflow, and produced no relevant browser warning/error logs in that pass. Screenshots were captured separately from the HTTP checks.

Observed interactions: gallery selection and brand command generation; task creation, status changes, filtering and reload persistence; documentation search and article selection; directory search, favorites and detail dialog; portfolio filtering and detail dialog; SaaS walkthrough selection; event agenda filtering and calendar download confirmation.

The generated storefront also ran against a real local Wrangler Worker and SQLite-backed D1. Its HTTP checks and eight demo payment checks passed. Connected Chrome followed storefront → editor → demo checkout → verified access → editor with the retained custom draft → download confirmation. The browser reported the download; this release's local browser check did not inspect a saved Markdown file on disk. The backend download endpoint was separately exercised by the payment check. No new external Stripe transaction or cloud deployment is implied by this local pass.

## Host acceptance

Codex CLI **0.162.1** and Claude Code **2.1.304** were each given an ordinary website-building request without naming the harness. Both selected the installed entry, initialized a new project for both hosts, and completed inspection/planning successfully.

This validates those observed sessions on that installation. It does not guarantee automatic selection in every future session or bypass a host's sandbox. Model authentication and model-provider configuration remain host responsibilities.

## Package installation

The package smoke check installs the actual npm tarball through npx into an isolated home, verifies the Codex and Claude Code entry files, deletes that npx cache, and creates every English template using the copied runtime, and verifies the saved directory-template default. Repeating setup must make no changes. Release checks also validate English text, documentation links, matching versions, and public dependency archive URLs. These checks do not require access to the developer's personal host configuration.

## English demo

The [Paperplane walkthrough](website-example.md) uses the included English starter in demo mode. Its screenshots show fictional English input and a simulated purchase. This example does not represent a real Stripe transaction.

## Separate Stripe acceptance

A custom requirements application has **48 application/configuration tests** and its own external acceptance. These are not added to the harness's regression suite. That application includes product-specific fields and server-side document generation maintained separately from this repository.

| Check | Observed result |
| --- | --- |
| Cloudflare preview | Deployed Worker, configured D1, reachable page/assets, matching source build fingerprint |
| Stripe-hosted Checkout | One-time CNY 29 test Session, `livemode=false`, completed with the official test card |
| Real Webhook | Matching Stripe event recorded by the Worker; order paid and entitlement present; no pending Webhook deliveries at the check |
| Actual export | Browser-downloaded Markdown contains all 13 custom fields; changed draft exports current content without another purchase |
| Remote negative cases | Demo completion disabled, invalid signatures rejected, wrong order and export credentials denied |
| Browser | Connected Chrome desktop at 1504×871 and mobile at 390×844; no relevant application warning/error logs |
| Existing data | Original tables in the shared demonstration database retained their row counts; isolated SQLite tests also compared original schema, rows and ledger |

The browser download-event listener timed out, so file completion was verified separately by a direct UI click, the application's download confirmation, and the actual downloaded file. That tooling failure was not counted as an application pass by itself.

Earlier remote browser attempts in another browser path failed to connect. The later connected-Chrome acceptance described above reached the actual deployed app and Stripe Checkout. Local checks and successful packaging alone were not used to claim that external flow worked.

## Not verified

- Live payments, settlement, subscriptions, refunds, taxes, or merchant eligibility.
- Remote declined-card, 3DS, or asynchronous-payment UI flows; backend fixtures separately cover unpaid and later-success events.
- Universal automatic routing across agent hosts, models, and sessions.
- Native Windows global installation, Vercel, or arbitrary frontend frameworks.

Re-run affected checks when changing code, provider settings, or deployment configuration. A historical success does not establish the current state of an external service.
