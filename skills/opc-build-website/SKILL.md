---
name: opc-build-website
description: Build or update a website using the project's OPC Harness configuration, from product intent and visual design through checkout, deployment and evidence-based verification.
---

# OPC Build Website

Use the user's request and the project's existing choices to deliver a working website. Run commands from the project root. The installed harness entrypoint is `node .opc/runtime/bin/opc.mjs`; do not depend on a global installation or an unpublished npm package.

## Read the current situation

1. Run `node .opc/runtime/bin/opc.mjs inspect --json`, then read `.opc/project.json` and relevant existing application files. Treat detected accounts and configuration as facts to check, not permission for unrelated actions.
2. Run `node .opc/runtime/bin/opc.mjs plan --json`. Reconcile its capability plan with the actual request. Add payments only when the product requires them; preserve the existing framework and user choices when updating a site.
3. Resolve routine choices from the request and project configuration. Ask only for a missing fact that materially changes the implementation or a required external action. Reuse authorization already given in this conversation. Continue independent work while an external prerequisite is missing.

The harness provides complete buildless HTML/CSS/JavaScript templates grouped by frontend type: landing, admin, content, portfolio, commerce and event. Run `modules --json`, `recipes --json` and `templates --type landing --json` for current choices. Before choosing an unresolved frontend, start `gallery`, use its actual returned URL, and show two or three relevant complete examples with their included interactions and related example websites. Use `?type=landing` or another type to focus the gallery. Its live desktop/mobile previews use the generated source; third-party reference links are inspiration, not copied implementations. An exact user selection needs no repeated confirmation.

Select frontend, stack, data and payments independently. `--stack cloudflare` supports free, demo and Stripe test checkout; D1 stores orders only. `--stack vercel` deploys a free static preview to the explicitly configured project. `--stack static` provides local preview and portable export. Use `recipes --json` for tested compatible combinations or `--project-config FILE` to use the downloaded studio configuration. Incompatible payment/stack combinations must fail explicitly. Preserve existing frameworks when updating applications.

Browser-local contacts, tasks, favorites and drafts are not shared user data. No login, multi-user authorization or live-payment module is included. Show this scope before users choose a backend; do not present a browser-local admin template as a secure multi-user admin system.

## Implement the requested product

- For a new project, use `create --template ID --stack PROVIDER --payment MODE`, `create --recipe ID`, or `init` followed by selection flags followed by `scaffold`. Reuse the selected layout exactly. Set brand, headline, description, accent, email and content items through `configure` or `--site-config`. Do not redesign a chosen template or require cosmetic fine tuning. Implement additional business requirements only when they exceed the selected template's included functionality.
- Use `preferences --template ID` for future-project defaults. Use `configure --template ID` to deliberately switch an existing project; it refuses edited template files before making changes. `doctor` reports account and configuration prerequisites together. For Vercel these are `VERCEL_TOKEN` and `VERCEL_PROJECT_ID`, plus `VERCEL_TEAM_ID` for teams. Keep values in the environment or `.dev.vars`, never in exported configuration. Free sites can use `export --out DIR` for static hosting. `gallery --out DIR` exports the entire selectable example library for static hosting.
- For visual decisions and browser checks, read [design](references/design.md). Record the chosen brief in `.opc/design-brief.md` so another agent can continue without reinterpreting it.
- For a paid product, read [payments](references/payments.md). Preserve server-side payment validation and delivery invariants while adapting the product.
- For preview or publishing, read [deployment](references/deployment.md). Use `deploy --dry-run` to validate packaging before a remote deployment.

Load only the references relevant to the current task. Use available tools directly when the harness does not implement an operation; explain any remaining incompatibility rather than marking the operation complete.

## Verify and resume

Run `node .opc/runtime/bin/opc.mjs dev --port 8787` for local preview. In another terminal, run:

```text
node .opc/runtime/bin/opc.mjs verify --url http://127.0.0.1:8787 --json
node .opc/runtime/bin/opc.mjs payments test --url http://127.0.0.1:8787 --json
```

Run payment tests only against an environment belonging to this task. Perform browser checks for the actual product flow and responsive layout; a successful HTTP response does not establish visual quality or usability. Re-run affected verification after source or configuration changes.

The CLI maintains `.opc/state.json` and verification evidence. Read current output when resuming; keep real secrets in environment variables or the platform's secret store, and keep credentials, order tokens and raw secret-bearing output out of reports.

Report separately what was implemented, what was checked, and what remains blocked. Distinguish demonstration payments, Stripe test payments and actual production payments. Distinguish a local preview, a successful deployment command and a remotely verified website. Link usable output and evidence; never manufacture a successful state or treat an unchecked starter as the completed product.
