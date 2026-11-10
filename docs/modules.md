# Compose a website by module

[README](../README.md) · [Templates](templates.md) · [Configuration](configuration.md)

Start with a result you can inspect. Open the studio, compare complete example websites, and select a frontend before choosing infrastructure.

Build a source checkout first with `npm ci` and `npm run build`. Published npm installations already include the compiled runtime.

```sh
node bin/opc.mjs gallery
node bin/opc.mjs modules --json
node bin/opc.mjs recipes --json
```

These commands run from a source checkout. For a published version that includes the studio, substitute `opc-harness` after installing that version. See the README for current release availability.

## The five modules

| Module | Available choices | What the choice changes |
| --- | --- | --- |
| Frontend | Landing, admin, content, portfolio, commerce, event | A complete layout, responsive styles, sample content and working interactions |
| Stack | Cloudflare Workers, Vercel Static, portable static | Runtime, provider configuration, local server, deployment and verification |
| Content | Site configuration | Brand, headline, description, accent, email, resource items and event settings |
| Data | Browser-local state; D1 payment orders when enabled | Drafts, favorites, contacts and tasks stay local; paid Cloudflare flows persist orders server-side |
| Payments | Free, demo checkout, Stripe test checkout | Checkout, fulfillment, entitlement checks and export access |

Frontend and stack are separate. A contact admin can run on Vercel, Cloudflare or an ordinary static host, with the same interface and local behavior. Choosing Vercel does not turn local data into a shared database. Authentication, multi-user authorization, arbitrary payment products and live payments are not bundled.

## Frontend examples before configuration

The studio includes eleven exact local examples, grouped into six frontend categories. Each card shows the website itself, included controls and a related reference link when available. Open a preview to interact with the site and switch between desktop and a 390px mobile layout. Open the example in a separate tab for an unscaled view.

Reference websites such as [Linear](https://linear.app/), [Cal.com](https://cal.com/), [shadcn/ui](https://ui.shadcn.com/examples/dashboard) and [Astro documentation](https://docs.astro.build/en/getting-started/) help compare interface patterns. They are independent sites, not bundled source, exact clones or affiliated products. The OPC example is the implementation that will be generated.

Use `?type=landing`, `?type=admin`, or `?template=pulse` on the reported studio URL to focus a conversation. Agents should link the actual running preview and show matching choices before resolving an unspecified visual direction. An exact user selection can proceed directly.

## Compatible combinations

| Stack | Free | Demo checkout | Stripe test | Local preview | Deployment |
| --- | --- | --- | --- | --- | --- |
| `cloudflare` | Yes | Yes | Yes | Wrangler; D1 only for paid modes | Workers preview with build identity verification |
| `vercel` | Yes | No | No | Dependency-free static server | Preview in an explicitly selected Vercel project |
| `static` | Yes | No | No | Dependency-free static server | Portable folder export |

Incompatible combinations fail before creating the project. The studio disables unsupported payments when selecting a static stack and shows the resulting free mode. CLI flags specifying an incompatible pair return `INCOMPATIBLE_MODULES` rather than silently changing the request.

## Ready-made recipes

```sh
node bin/opc.mjs create --dir ./my-product --recipe bold-launch --host both
node bin/opc.mjs create --dir ./my-admin --recipe personal-admin --host both
node bin/opc.mjs create --dir ./my-tool --recipe paid-tool --host both
```

Recipes select a template, stack and payment mode together. Explicit flags override recipe choices, and recipe choices override saved defaults. `recipes --json` lists all combinations. Use the studio for previews rather than guessing a layout from its ID.

A direct combination is also supported:

```sh
node bin/opc.mjs create --dir ./my-product --template pulse \
  --stack vercel --payment none --brand 'North Star' --host both
```

## Download once, reuse in an agent

Choose the frontend, stack, payments and branding in the studio. Download `opc-project.json` or copy the create command. No account is needed for these steps, and the studio makes no remote mutations.

```sh
node bin/opc.mjs create --dir ./my-website \
  --project-config ./opc-project.json --host both
```

The downloaded configuration is ordinary JSON:

```json
{
  "schemaVersion": 1,
  "name": "my-website",
  "design": { "preset": "editorial", "template": "console" },
  "site": {
    "brand": "North Star",
    "headline": "Keep the next conversation moving.",
    "description": "A personal pipeline for the next useful conversation.",
    "accent": "#335bba",
    "contactEmail": "hello@example.com"
  },
  "payments": { "mode": "none" },
  "deploy": { "provider": "static", "tier": "preview" }
}
```

Never put credentials in this file. Public site content is copied to frontend assets. Save future-project defaults with `preferences --template console --stack static --payment none`. Existing projects retain their choices; changing an existing provider requires a separate project rather than an implicit migration.

## Vercel prerequisites and verification

Select or create the intended project in your Vercel account and configure these values in the environment or `.dev.vars`:

```dotenv
VERCEL_TOKEN=
VERCEL_PROJECT_ID=
VERCEL_TEAM_ID=
```

`VERCEL_TOKEN` and `VERCEL_PROJECT_ID` are required. `VERCEL_TEAM_ID` is required for a team project. The CLI reports missing values together. The adapter does not pick an arbitrary project or create a remote one.

Run the following from the generated Vercel project:

```sh
node .opc/runtime/bin/opc.mjs doctor --json
node .opc/runtime/bin/opc.mjs deploy --dry-run --json
node .opc/runtime/bin/opc.mjs deploy --json
node .opc/runtime/bin/opc.mjs verify --url https://your-preview.vercel.app --json
```

The adapter uploads only static output through the [official Vercel deployment API](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment). It records upload intent, deployment ID and build identity. A repeat command resumes a building deployment. An uncertain upload response requires inspecting the saved record and selected project before trying a new upload. The initial adapter limits inline output to 4 MB; larger sites can use static export and direct hosting.

Public verification checks `opc-build.json`, current source identity, HTML and CSS. A provider authentication wall does not count as a verified site. The CLI does not disable deployment protection. A passing API fixture or local build does not establish a real Vercel release; record external acceptance separately.

## Share the whole example library

```sh
node bin/opc.mjs gallery --out ./studio-site
```

Serve this folder at an HTTP(S) origin root to share every example, its assets, the configuration form and recipe catalog. This is a static, reusable showroom, not a deployment control panel. It does not include payment processing.

## Extend the library

`src/modules.mts` is the shared module and recipe catalog. `src/catalog.mts` describes templates and references; `src/pages.mts` and `templates/library/` supply their complete implementations. The CLI, terminal wizard, visual studio and agent Skills consume these same definitions. Add a new provider only with its configuration rules, runnable adapter, prerequisite report, scoped verification and meaningful failure tests.
