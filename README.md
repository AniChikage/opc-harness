<p align="center"><img src="docs/images/logo.svg" alt="OPC Harness" width="88" height="88"></p>

<h1 align="center">OPC Harness</h1>

<p align="center">Describe the website. Keep your defaults. Ship with evidence.</p>

<p align="center">
  <a href="#getting-started">Get started</a> · <a href="#how-it-works">How it works</a> · <a href="docs/website-example.md">Real example</a> · <a href="docs/configuration.md">Configuration</a> · <a href="CONTRIBUTING.md">Contributing</a> · <a href="LICENSE">MIT License</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/opc-harness"><img src="https://img.shields.io/npm/v/opc-harness?color=244b3e" alt="npm version"></a>
  <a href="https://github.com/AniChikage/opc-harness/actions/workflows/ci.yml"><img src="https://github.com/AniChikage/opc-harness/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-244b3e" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A522.13-244b3e" alt="Node.js 22.13 or later">
</p>

OPC Harness connects **Codex and Claude Code** to a repeatable website-building workflow: your design preferences, payment setup, Cloudflare deployment, and checks that show what actually works.

Configure it once. In a new project, describe the website you want. The agent loads your defaults, initializes the project, adapts the application, and continues through implementation and verification.

**Status: early MVP, v0.3.0.** The included stack is HTML/CSS/JavaScript, Cloudflare Workers + D1, and demo or Stripe **test** payments. It uses host instructions and Skills; it is not a mandatory runtime hook or a replacement for your coding agent. Accounts and credentials remain yours.

![Paperplane — the included English project brief website](docs/images/website.png)

*The included English example: Paperplane, a project brief tool with free preview and demo checkout for Markdown export. The screenshots show the actual application with fictional sample data. Demo checkout collects no real payment. [Follow the walkthrough](docs/website-example.md).*

## Features

- **One setup, two agents** — install user-level entry Skills and instructions for Codex and Claude Code. Describe the next website without manually initializing every project.
- **Personal defaults** — keep design, payment mode, and hosting choices in a reusable profile. Existing projects retain their own configuration.
- **A working starting point** — generate a responsive paid-tool application with a free preview, Checkout, server-confirmed entitlements, and a Markdown download. The agent adapts it to your product.
- **Server-confirmed payment delivery** — demo mode for development, or Stripe-hosted test Checkout with signed Webhooks, amount/currency matching, and durable duplicate handling.
- **Cloudflare delivery** — package, provision D1, migrate, deploy the Worker, and verify its project identity and build fingerprint. Record resource ownership for later deployments.
- **Checks you can inspect** — separate HTTP checks, payment tests, packaging, and deployment evidence. Source changes mark earlier evidence as stale; browser acceptance remains a distinct check.
- **Work you can resume** — project-local configuration, instructions, runtime, and evidence let the next session inspect the current state before acting.

## Getting started

You need **Node.js 22.13+**, npm, and an installed, authenticated Codex or Claude Code. Deployment needs your Cloudflare account; Stripe test mode needs your own Stripe testing environment. The harness itself does not need a model API key.

### 1. Install once

```sh
npx --yes opc-harness@latest setup --global --host both
```

No source checkout or global npm installation is required. Setup copies a standalone runtime into your user directory and adds marked instructions for both agents. That runtime works independently of the npx cache. Setup preserves existing personal instructions, backs up changed files, and leaves model configuration and credentials alone. Review target paths first by adding `--dry-run --json`.

To install this exact release, replace `@latest` with `@0.3.0`. To update later, run the same setup command again. See [configuration](docs/configuration.md) for individual hosts, a persistent CLI, and project-only installation.

### 2. Describe a website

Start a **new Codex or Claude Code session** in your projects folder and say:

```text
Build an English project requirements website for independent consultants.
Offer a free preview and paid Markdown export.
Use my defaults and complete design, payment testing, and a Cloudflare preview deployment.
```

The personal Skill directs the agent to choose a project directory, initialize it, read its plan, and carry out the work. Missing login or credentials become specific prerequisites while independent work continues.

Automatic selection depends on the host loading the installed user instructions and Skills. If an existing session has not refreshed them, start a new one or explicitly ask it to use `opc-harness`. Host permissions and project instructions still apply.

### 3. Keep working in the project

```sh
cd /path/to/your-site
node .opc/runtime/bin/opc.mjs inspect --json
node .opc/runtime/bin/opc.mjs plan --json
node .opc/runtime/bin/opc.mjs dev --port 8787
```

Open `http://127.0.0.1:8787`. Without an existing application, `dev` generates the starter and applies local D1 migrations. For an existing app, inspect before scaffolding: conflicting edits are reported rather than overwritten.

Prefer explicit project installation? See [manual setup](docs/configuration.md#project-only-installation). Global setup is optional.

## How it works

```text
Your request + personal profile
              ↓
Codex / Claude Code loads the entry Skill
              ↓
Project configuration + shared website Skill
              ↓
Design → implement → test payments → deploy → verify
              ↓
Project-local evidence with a source fingerprint
```

The coding agent makes product and design decisions. The shared Skill defines the workflow. The CLI handles repeatable operations such as initialization, configuration inspection, resource checks, and deployment. Browser and real Stripe acceptance use the agent's available tools when the CLI does not automate that step.

| Area | Included in v0.3.0 |
| --- | --- |
| Hosts | Codex and Claude Code user instructions + Skills |
| Frontend | Buildless HTML, CSS, and JavaScript; one `editorial` preset |
| Backend | Cloudflare Worker and D1 |
| Payments | Demo and Stripe TEST, one-time purchase |
| Hosting | Cloudflare preview deployment |
| Evidence | HTTP, demo payment, package and deployment records; agent-recorded browser/Stripe acceptance |

Existing frameworks and project instructions take precedence. The included recipe does not provide adapters for every framework.

## Payments and deployment

The starter uses a **$19 USD** example product. The agent may adapt the server-side product and create a matching Stripe test Price for your website.

| Mode | What it proves |
| --- | --- |
| `demo` | Simulated checkout → server confirmation → entitlement → download. No Stripe transaction. |
| `stripe_test` | Requires an actual Stripe test Checkout, a signed event delivered to this deployment, and verified export. |

`payments test` automates the demo path. In Stripe mode it reports that a real test transaction is needed; it does not simulate a successful Stripe payment. The agent must complete and record that external flow separately. A success-page redirect alone never grants access.

Cloudflare commands run from the generated project:

```sh
node .opc/runtime/bin/opc.mjs deploy --dry-run --json
node .opc/runtime/bin/opc.mjs deploy --json
node .opc/runtime/bin/opc.mjs verify --url https://your-worker.workers.dev --json
```

Deployment creates real Cloudflare resources in your account. Keep its `.opc/resources.json` ownership record locally; deployment does not adopt an unknown same-name resource. Local D1 and remote D1 are separate databases. [Payment setup and deployment details](docs/configuration.md#stripe-test-payments).

## An English example

The [Paperplane walkthrough](docs/website-example.md) shows the included starter with this English request:

```text
Build a simple project brief website for independent makers.
Let visitors preview a brief for free and purchase Markdown export access.
Use an editorial design and verify the demo checkout before deployment.
```

**Free preview → demo checkout → server-confirmed entitlement → Markdown download.** The draft stays in the browser; the starter checks export access with the server and generates Markdown from the current draft. Demo checkout is a simulation, clearly labeled in the application.

Real Stripe test Checkout and signed Webhook delivery were separately exercised in a custom application. See the [verification record](docs/verification.md) for the distinction between package checks, the English demo, and that external acceptance.

## Development

```sh
npm ci
npm test
npm run check
npm run check:release
npm run test:package
npm pack --dry-run
```

The CLI is plain ESM JavaScript. Tests use Node's test runner and actual SQLite for payment queries and transactions; they do not require Stripe keys or a Cloudflare account. Dependency archives are pinned through the public npm registry.

| Path | Responsibility |
| --- | --- |
| `src/global.mjs` | User-level installation, profiles, backups and rollback |
| `src/workflows.mjs` | Project setup, verification, payment checks and deployment |
| `src/core.mjs` | Configuration, managed writes, fingerprints and evidence |
| `skills/opc-build-website/` | Shared workflow and design/payment/deployment references |
| `templates/paid-site/` | The working starter |
| `test/` | CLI, installation, payment and deployment regression tests |
| `scripts/` | English release checks and isolated package installation checks |

## Current limits

- Live payments, settlement, subscriptions, automatic merchant signup, and Vercel deployment are outside this MVP.
- Agent routing is instruction-based; it depends on the host and its permission policy. Installation is local to each machine.
- The `editorial` preset is a starting direction. Reference matching and finished visual design need agent work and browser inspection.
- Secrets belong in environment variables, an ignored `.dev.vars`, or Worker Secrets, never in a profile, Skill, or public evidence.
- macOS installation and both host entry paths have been exercised. Native Windows installation is not yet verified; CI covers the Node test suite separately.

Bug reports, focused fixes, and reproducible examples are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) or open an [issue](https://github.com/AniChikage/opc-harness/issues).

## License

[MIT](LICENSE). Dependencies retain their own licenses. Codex, Claude Code, Stripe, and Cloudflare are third-party products; OPC Harness is an independent project.
