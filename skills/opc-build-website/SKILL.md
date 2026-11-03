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

The MVP starter supports buildless HTML/CSS/JavaScript, Cloudflare Workers + D1, and one-time payments using either an explicit demonstration mode or Stripe test mode. Report unsupported combinations accurately; do not silently replace an existing application with this starter.

## Implement the requested product

- For a new project, use `scaffold` after checking its target files. Preserve existing source and project instructions. A starter is a starting point: adapt its product, copy, functionality and design to the user's task.
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
