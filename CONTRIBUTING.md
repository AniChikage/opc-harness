# Contributing

Focused fixes, documentation improvements, and reproducible bug reports are welcome.

## Run the project

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
npm pack --dry-run
```

Use Node.js 22.13 or later. Edit `.mts` and `.ts` sources, then rebuild; `dist/` and `bin/opc.mjs` are generated. Keep `strict` enabled and model untrusted JSON as `unknown` until validated. Do not bypass errors with `any` or TypeScript suppression comments. The intentional `@ts-expect-error` assertions in the compile-only contract test verify that invalid values remain rejected. Automated tests do not require payment credentials or a Cloudflare account.

This repository owns the harness runtime, generated-project templates, offline template picker and integrations. Marketing pages, homepage animation, website fonts and website tests belong in [opc-harness-web](https://github.com/AniChikage/opc-harness-web). Do not add a sibling checkout requirement, website build step or website-only CI job here. The public `gallery --out DIR` export is the boundary used by the separate website; keep it compatible with offline selection and generated templates.

## Report a problem

Include the Node version, operating system, agent host/version, command, expected behavior, and minimal reproduction. Remove credentials, account IDs, order capabilities, personal paths, private hostnames, and unrelated instructions from logs before opening a public issue.

If the problem involves automatic routing, include whether a new host session loaded the entry Skill and global instructions. If it involves deployment, distinguish packaging, upload, remote identity verification, and the actual website/payment flow.

## Change the implementation

Keep the responsibilities clear:

- Skills guide the coding agent; they do not replace the agent or override user authorization.
- The CLI handles deterministic operations and records precisely scoped results.
- A template provides a runnable starting point; it must not overwrite application edits.
- Provider login, missing credentials, and account prerequisites are explicit states.

For payment changes, test the actual SQL and transaction behavior, unsigned/wrong-environment events, retry safety, and protected delivery. Never replace a real provider acceptance with a signed fixture and call it an external success.

For installation or deployment changes, test ownership/conflict behavior before mutation and recovery after failure. Keep tests isolated from the developer's actual home, credentials, and cloud resources.

New providers or stacks should include a working recipe, concrete prerequisites, scoped verification, and documentation of supported behavior. Open an issue before introducing a large additional control layer.

## Documentation and assets

Keep documentation, prompts, examples, and screenshots in English. Use screenshots from the real application with fictional data; no private account screens, machine paths, or internal service references. Ensure local links work in a fresh checkout and the package includes the documentation it links to. `check:release` checks English release text, local links, matching versions, and public dependency URLs. `test:package` installs the actual tarball into an isolated home, checks both hosts, removes its npx cache, and creates a fresh English project with the copied runtime.

## Pull requests

Describe the user-visible problem, resulting behavior, and validation. Include a concrete reproduction when helpful. Public CI runs strict type checking, the compiled test suite, emitted JavaScript syntax checks, and actual tarball installation; external Stripe/Cloudflare acceptance needs separate evidence and your own test resources.

Contributions are distributed under the repository's [MIT license](LICENSE).
