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
