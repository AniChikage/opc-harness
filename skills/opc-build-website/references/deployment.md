# Cloudflare deployment

The MVP targets a Cloudflare Worker serving static assets with a D1 database for durable orders. Inspect the generated Wrangler configuration and current project configuration before executing platform commands. The user may already have a suitable account or resource; use detected identifiers and avoid creating duplicates on retries.

Run `node .opc/runtime/bin/opc.mjs deploy --dry-run --json` before a remote deployment. Resolve configuration or packaging failures before proceeding. A dry run is packaging evidence, not a published URL.

When deployment is within the user's authorization, run `node .opc/runtime/bin/opc.mjs deploy --json`. Follow its concrete prerequisites for Cloudflare authentication, D1 binding/migrations and secrets. Preserve returned resource identifiers and stop repeating a failing external mutation when the prerequisite has not changed. Do not print credentials or place secrets in Wrangler's public variables.

Keep the deployed payment mode explicit. Publishing demo mode produces a demonstration site. Publishing `stripe_test` still requires the appropriate Stripe test configuration and verification before claiming that its payment flow works. This MVP does not establish production payment readiness.

After a successful deployment, run `verify --url <returned-url> --json` and, where supported and authorized, `payments test --url <returned-url> --json`. Inspect the remote main flow with available browser tooling. A response from a local dev server does not verify the remote environment.

Report the URL, deployment result, remote checks and any outstanding prerequisites separately. If platform authentication is unavailable, leave the project runnable locally, retain a passing dry-run result if achieved, and report remote deployment as blocked.

Primary references: [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/) and [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/). Consult current official guidance when changing the adapter.
