# Configuration

See [the module guide](modules.md) for stack choices and downloadable project configurations. These examples use v0.6.1. Source users should run `npm ci` and `npm run build`, then use `node bin/opc.mjs` from the checkout.

[README](../README.md)

## Personal setup

Install once for both coding agents with Node.js 22.13 or later:

```sh
npx --yes opc-harness@latest setup --global --host both
```

Use `@0.6.1` instead of `@latest` to pin this release. Add `--dry-run --json` to preview paths without changing the installation. Choose `--host codex` or `--host claude` to install for one agent only. Repeat setup to update the copied runtime; deleting the npx cache does not remove it.

If you prefer a persistent command on your PATH:

```sh
npm install --global opc-harness
opc-harness setup --global --host both
```

The package also provides the shorter `opc` command. Installing the npm package alone does not edit agent instructions; the explicit `setup` command performs that installation.

The default profile contains preferences only. Use `preferences --interactive` to select a complete template and save future-project defaults; see [the template guide](templates.md).

```json
{
  "schemaVersion": 1,
  "design": { "preset": "editorial", "template": "paperplane" },
  "payments": { "mode": "demo" },
  "deploy": { "provider": "cloudflare", "tier": "preview" }
}
```

| Item | Default location |
| --- | --- |
| Personal profile | `~/.config/opc-harness/profile.json` |
| Standalone runtime | `~/.local/share/opc-harness/runtime/` |
| Codex entry Skill | `~/.agents/skills/opc-harness/` |
| Codex instructions | `~/.codex/AGENTS.md`, or an active nonempty `AGENTS.override.md` |
| Claude Code entry Skill | `~/.claude/skills/opc-harness/` |
| Claude Code instructions | `~/.claude/CLAUDE.md` |

`CODEX_HOME` and `CLAUDE_CONFIG_DIR` are respected. `--codex-home`, `--claude-home`, and `--profile` select explicit paths. `--home` selects an alternative installation root for testing without changing the process's home environment.

Setup backs up changed files, preserves unrelated user instructions, and rolls back on failure. It refuses conflicting edits to owned files. Read its reported paths and conflicts before retrying. It does not change model settings or provision model credentials.

Start a new host session after installation. User-level Skills and instructions need to be loaded by that host; automatic selection is not a runtime guarantee. Where the host protects agent configuration directories, use its normal approval mechanism for the exact installation command. A noninteractive runner unable to request approval should report the prerequisite rather than silently installing only one host.

## Project-only installation

Global installation is optional:

```sh
npx --yes opc-harness@latest init \
  --dir /path/to/my-site --name my-paid-site --host both \
  --brief 'A small paid tool with a free preview and Markdown export'
cd /path/to/my-site
node .opc/runtime/bin/opc.mjs inspect --json
node .opc/runtime/bin/opc.mjs plan --json
node .opc/runtime/bin/opc.mjs scaffold
node .opc/runtime/bin/opc.mjs dev --port 8787
```

Inspect an existing app before scaffolding. The starter is optional; conflicting user edits are preserved. Generated project instructions point both hosts to `opc-build-website`, installed under `.agents/skills/` and `.claude/skills/`.

The project configuration is independent of later changes to your personal defaults:

```json
{
  "schemaVersion": 1,
  "name": "my-paid-site",
  "design": { "preset": "editorial", "template": "paperplane" },
  "payments": { "mode": "demo" },
  "deploy": { "provider": "cloudflare", "tier": "preview" }
}
```

For new projects, profile resolution is explicit `--profile`, then `OPC_HARNESS_PROFILE`, then the global installation record, then the default personal profile. Explicit `--payment` overrides a new project's profile choice. Existing `.opc/project.json` takes precedence; edit it deliberately to change an existing project.

## Stripe test payments

The starter's default server product is a one-time **$19 USD** purchase. `configure --amount 2900 --currency cny` changes the generated server and browser product together. Free sites use `--payment none` and require no payment database. If adapting the product, change its server definition and create an exactly matching test Price. The agent still needs to implement and verify the product's actual output.

1. Obtain a Stripe testing environment and a test server key.
2. Set both `.opc/project.json` → `payments.mode` and `wrangler.jsonc` → `vars.PAYMENT_MODE` to `stripe_test`.
3. Copy `.dev.vars.example` to `.dev.vars`. Configure `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` there, or through environment variables. Only test keys are accepted; live keys fail closed.
4. Register the deployed URL's `/api/webhooks/stripe`, subscribing to `checkout.session.completed` and `checkout.session.async_payment_succeeded` in the same Stripe testing environment. Use that endpoint's signing secret.
5. Deploy, complete a real Stripe test Checkout, confirm the delivered event and server-side paid entitlement, and download the actual output.

Hosted Checkout does not require a publishable key in this application. Keys remain server-side. An endpoint signing secret differs from the secret produced by a local Stripe CLI listener.

For local testing, forward events with Stripe CLI to `http://127.0.0.1:8787/api/webhooks/stripe` and use that listener's secret. Local D1 and remote D1 are independent; a remote Webhook cannot fulfill an order stored only in the local database.

The CLI's `payments test` automates **demo** purchases only. In `stripe_test`, it explicitly reports that real external acceptance remains necessary. An agent can use available browser/API tools and record the resulting evidence. This CLI does not automatically create a Stripe account, complete onboarding, or submit a live payment.

Reference: [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment), [testing](https://docs.stripe.com/testing), and [Webhook setup](https://docs.stripe.com/webhooks).

## Cloudflare deployment

```sh
node .opc/runtime/bin/opc.mjs deploy --dry-run --json
node .opc/runtime/bin/opc.mjs deploy --json
node .opc/runtime/bin/opc.mjs verify --url https://my-site.example.workers.dev --json
```

Use your existing Wrangler login or Cloudflare environment credentials. Deployment packages first, verifies account and resource identity, creates D1 if needed, applies migrations, uploads the Worker and assets, and checks the returned deployment's build fingerprint. Keep `.opc/resources.json` locally so later sessions can establish ownership.

Stripe deployment uploads only the three supported test values to Worker Secrets, using a temporary owner-only file that is removed afterward. It may also reuse an owned Worker's already-configured secrets. It does not publish credentials as Worker variables.

If the initial remote check sees an older version during propagation, repeat `verify` after checking the deployment. A matching build identity is required to recover its verified state; an unrelated HTTP 200 is insufficient.

### Sharing an already-owned D1

If a database quota prevents creating another D1, an explicit opt-in can share a database previously created and recorded by this harness:

```sh
node .opc/runtime/bin/opc.mjs deploy \
  --reuse-database-from /path/to/owned-source-project --json
```

The destination must define a distinct `deploy.databaseNamespace`, use its own matching `migrations_table`, and isolate the app's SQL tables and queries. This requires application changes; setting the namespace alone does not rewrite a starter's queries.

The harness validates same-account ownership, remote database identity, an unused namespace on first binding, and additive namespaced migrations. Subsequent deployments validate the persisted database, namespace, migration ledger, and actual migrations directory again. It does not delete existing databases or upgrade an account plan.

## Evidence and recovery

| File | Purpose |
| --- | --- |
| `.opc/project.json` | Portable project choices |
| `.opc/design-brief.md` | Product and design requirements |
| `.opc/state.json`, `.opc/evidence/` | Local verification records, with source fingerprints |
| `.opc/resources.json` | Local Cloudflare ownership/provenance record |
| `.opc/runtime/` | Copied CLI, templates, Skills and runtime dependencies |

Keep credentials, local paths, service-account identifiers, order capabilities, generated evidence, and private resource records out of a public repository. Publish a reviewed summary and synthetic example instead. Preserve private resource records separately when transferring deployment ownership.

After cloning a generated project, restore its ignored runtime with the installed harness:

```sh
npx --yes opc-harness@latest init --dir /path/to/my-site --host both
```

Initialization preserves project choices and application edits. `inspect` reports missing prerequisites and stale evidence before work resumes.
