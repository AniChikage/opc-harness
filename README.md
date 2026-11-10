<p align="center"><img src="docs/images/logo.svg" alt="OPC Harness" width="88" height="88"></p>

<h1 align="center">OPC Harness</h1>

<p align="center">Reusable website delivery for Codex and Claude Code.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/opc-harness"><img src="https://img.shields.io/npm/v/opc-harness?color=244b3e" alt="npm version"></a>
  <a href="https://github.com/AniChikage/opc-harness/actions/workflows/ci.yml"><img src="https://github.com/AniChikage/opc-harness/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-244b3e" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A522.13-244b3e" alt="Node.js 22.13 or later">
</p>

OPC Harness gives **Codex and Claude Code** a reusable website delivery workflow. Choose a finished frontend by its actual appearance, combine a compatible stack and payment mode, then generate, run and verify the project.

Choose a finished layout instead of describing every visual detail. The site's catalogue previews use the same renderer and assets as generated projects. Set your brand and content through configuration; the agent preserves the selected design.

**Version 0.5.0** adds eleven complete templates, eleven ready-made recipes, Cloudflare / Vercel / static delivery, a visual module catalogue, design preservation and strict TypeScript throughout. Documentation, prompts and examples are in English.

> Distribution: v0.5.0 is available from this GitHub source/release. Its npm publication is separate; the version-pinned npm examples below require v0.5.0 to be published. To use this source now:

```sh
git clone https://github.com/AniChikage/opc-harness.git
cd opc-harness
npm ci
npm run build
node bin/opc.mjs setup --global --host both
node bin/opc.mjs gallery
```

This repository contains the harness only: agent setup, template generation, the offline selection interface, payments and deployment adapters. The independent product website lives in [opc-harness-web](https://github.com/AniChikage/opc-harness-web). Building or installing the harness does not require that repository.

[Module guide and compatibility matrix](docs/modules.md) · [Complete frontend examples](docs/templates.md)

## Start once

Requires **Node.js 22.13+**, npm, and an installed, authenticated Codex or Claude Code.

```sh
npx --yes opc-harness@0.5.0 setup --global --host both
```

Start a new agent session and describe the website:

```text
Build a portfolio for my independent design studio.
Show me the matching example websites, let me choose a frontend and stack,
and use that design exactly. Keep it free and deploy a Cloudflare preview.
```

The installed Skill uses your profile, offers matching layouts when needed, creates the intended project, and follows its local workflow. An exact user-selected template proceeds directly; an unresolved frontend is shown as matching examples, with a saved default highlighted when applicable. Existing applications retain their framework and instructions.

Setup copies a standalone runtime that survives npx cache removal, preserves unrelated personal instructions, and backs up changed files. Add `--dry-run --json` to inspect paths first. Automatic selection depends on the host loading its instructions and Skills; use a new session after installation.

## Or choose directly

Browse the actual templates:

```sh
npx --yes opc-harness@0.5.0 gallery
```

Choose and generate interactively:

```sh
npx --yes opc-harness@0.5.0 create --interactive
```

Or use one explicit command:

```sh
npx --yes opc-harness@0.5.0 create \
  --dir ./my-studio --name my-studio --template portfolio \
  --brand 'North Star Studio' --email hello@example.com --host both
cd my-studio
node .opc/runtime/bin/opc.mjs dev
```

Without `--dir`, `create` uses a new `my-website` subdirectory. The command generates the website, local runtime, and both project Skills together. No model API key, hosting account, or payment account is required to create or preview a free site.

## Eleven complete templates

| Template | Use it for | Included behavior |
| --- | --- | --- |
| `paperplane` | Project brief tool | Preview, autosave, checkout, Markdown export |
| `saas` | Software homepage | Product walkthrough, pricing, FAQ, brief workspace |
| `portfolio` | Studio or personal work | Category filters, project details, email contact |
| `docs` | Documentation | Guide search, article navigation, outline copying |
| `directory` | Curated resources | Search, category filters, details, saved favorites |
| `dashboard` | Personal task workspace | Create/delete tasks, change status, filter, export CSV |
| `store` | Digital brief kit | Product page, FAQ, complete brief editor and export |
| `event` | Event homepage | Agenda filters, session details, calendar download |
| `pulse` | Bold product landing | Interactive workflow preview, feature tabs, brief workspace |
| `studio` | Service landing | Service selection, project details, email inquiries |
| `console` | Personal contact admin | Create/edit/delete contacts, stages, search, CSV export |

Each template includes responsive layouts, keyboard focus, English sample content, and working controls. Local data is labeled accurately: tasks, favorites, and drafts are saved in the browser. Add your own product-specific backend when you need shared accounts, team data, or additional business workflows.

[Template catalog and configuration](docs/templates.md) · [English paid-tool walkthrough](docs/website-example.md)

## Compose the modules

Choose frontend, stack, content, data and payments separately. The studio shows exact template previews, desktop/mobile modes, included functionality and related example websites before generation. Copy a command, download a configuration, or copy an agent prompt.

| Stack | Runtime and output | Payments |
| --- | --- | --- |
| Cloudflare | Buildless frontend + Worker; D1 for orders | Free, demo, Stripe test |
| Vercel | Complete static frontend in your selected project | Free |
| Portable static | Complete frontend and folder export | Free |

Browser-local tasks, contacts, drafts and favorites remain local. Shared user accounts and authentication are additional backend work.

```sh
# From this checkout; use opc-harness after the npm version is published.
node bin/opc.mjs create --dir ./my-launch --recipe bold-launch --host both
node bin/opc.mjs create --dir ./my-admin --recipe personal-admin --host both
node bin/opc.mjs create --dir ./my-site --project-config ./opc-project.json --host both
node bin/opc.mjs templates --type landing --json
node bin/opc.mjs modules --json
```

The eleven recipes choose compatible modules together. Explicit flags override recipes; recipes override saved defaults. Vercel deployment needs `VERCEL_TOKEN` and `VERCEL_PROJECT_ID`, plus `VERCEL_TEAM_ID` for team projects. Cloudflare deployment preserves the existing ownership and recovery checks. The catalogue exports through `gallery --out DIR`. The independent [website repository](https://github.com/AniChikage/opc-harness-web) builds its own static output and consumes a pinned harness showcase export.

[Read the module guide](docs/modules.md) for combinations, prerequisites, verification and extension points.

## Configure once, reuse later

Choose a default for future websites:

```sh
npx --yes opc-harness@0.5.0 preferences --interactive
```

Or configure a generated project:

```sh
node .opc/runtime/bin/opc.mjs configure \
  --brand 'North Star Studio' --headline 'Useful design for thoughtful people.'
node .opc/runtime/bin/opc.mjs configure --site-config ./site.json
```

The site JSON supports branding, headline, description, accent, contact email, content items, and event details. Template selection lives in `design.template`; payment and hosting choices stay in the same profile. [See examples](docs/templates.md#configure-without-editing-html-or-css).

`configure --template ID` switches an untouched template safely. Edited files are reported before any configuration changes. Existing projects keep their choices when personal defaults change.

## Payments and deployment

| Choice | Behavior |
| --- | --- |
| `none` | Free export, no checkout, no payment database |
| `demo` | Simulated checkout, server confirmation, entitlement, download |
| `stripe_test` | Stripe-hosted test Checkout, signed webhook, durable fulfillment |

Paid templates default to a $19 USD example product. Set the amount and currency through configuration, then supply an exactly matching Stripe test Price:

```sh
node .opc/runtime/bin/opc.mjs configure --amount 2900 --currency cny
node .opc/runtime/bin/opc.mjs doctor --json
```

`doctor` reports local prerequisites together. Stripe test mode requires your testing environment and three server values: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET`. The harness reports their presence without printing them. Deployment requires your Cloudflare login or environment credentials.

```sh
node .opc/runtime/bin/opc.mjs deploy --dry-run --json
node .opc/runtime/bin/opc.mjs deploy --json
node .opc/runtime/bin/opc.mjs verify --url https://your-worker.workers.dev --json
```

Free deployments skip D1 entirely. Paid deployments provision or validate the owned database, migrate it, upload the Worker, and verify source identity. Unknown same-name resources are refused. Keep the private `.opc/resources.json` record for later deployments.

For another static host, export a free site:

```sh
node .opc/runtime/bin/opc.mjs export --out ../static-site
```

Paid static exports are refused. [Payment setup, ownership, and deployment details](docs/configuration.md).

## What is verified

The regression suite covers both host entries, all eleven templates, design-lock drift detection, preserved edits, safe configuration changes, free deployments without D1, configurable pricing, payment transactions, signatures, idempotency, and resource ownership.

The package smoke check installs the actual tarball in an isolated home, removes the npx cache, generates every template with the copied runtime, verifies saved defaults, and repeats setup without changes. Browser acceptance is recorded separately from API tests and packaging.

[Verification details](docs/verification.md) · [GitHub Actions](https://github.com/AniChikage/opc-harness/actions)

## Development

The harness uses TypeScript with `strict: true`, including the CLI, browser code, payment Worker, tests and release tooling. Node ESM sources use `.mts`; browser sources use `.ts`.

```sh
git clone https://github.com/AniChikage/opc-harness.git
cd opc-harness
npm ci
npm run typecheck
npm run build
npm test
npm run check
npm run check:release
npm run test:package
node bin/opc.mjs gallery
```

| Path | Responsibility |
| --- | --- |
| `src/catalog.mts`, `src/pages.mts`, `src/render.mts` | Template catalog, complete pages, deterministic generation |
| `src/design.mts` | Design lock and drift detection for the selected layout |
| `src/interactive.mts`, `src/gallery.mts` | Terminal selection, exact template previews and serving the built catalogue |
| `src/studio.mts`, `templates/studio/` | Offline template selection UI used by the CLI and exported showcase |
| `src/global.mts` | Host setup, profiles, backups, and rollback |
| `src/workflows.mts`, `src/core.mts` | Configuration, generation, payment, deployment, and evidence |
| `templates/` | Bundled frontend assets and Worker/D1 payment backend |
| `skills/opc-build-website/` | Shared workflow for both coding agents |
| `src/types.mts`, `types/` | Shared configuration, provider, browser and runtime contracts |
| `test/`, `scripts/` | Strictly checked regression, release, build and package installation checks |

`npm run build` emits the portable JavaScript runtime into `dist/` and refreshes the compatibility launcher at `bin/opc.mjs`. Rebuild after editing TypeScript. The npm tarball includes compiled `.mjs` / `.js` and runtime assets; users do not need TypeScript, ts-node or a build step. Global and project-local installations keep their existing CLI paths and work independently of the original checkout or npx cache.

## Current scope

The automated backend recipe is Cloudflare Workers, with D1 only for payments. Static free sites can use other static hosts. Live payments, subscriptions, merchant onboarding, user authentication, and shared team storage are not included. The gallery does not claim that sample content is your finished business or that arbitrary new functionality appears without implementation.

Templates preserve their exact shipped design. Explicit redesigns, existing frameworks, and product-specific behavior remain coding-agent work. Credentials belong in environment variables, an ignored `.dev.vars`, or Worker Secrets. Installation is local to each machine; native Windows host setup has not yet been verified.

## License

[MIT](LICENSE). Dependencies retain their own licenses. Codex, Claude Code, Stripe, and Cloudflare are third-party products; OPC Harness is an independent project.

Focused fixes and reproducible reports are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) or open an [issue](https://github.com/AniChikage/opc-harness/issues).
