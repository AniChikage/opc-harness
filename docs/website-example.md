# Paperplane: an English website example

[README](../README.md) · [Configuration](configuration.md)

**Paperplane** is the included project brief starter: enter an idea, preview a document for free, and unlock a Markdown export through a clearly labeled demo checkout. This walkthrough uses fictional English content throughout.

## The request

```text
Build a simple project brief website for independent makers.
Let visitors preview a brief for free and purchase Markdown export access.
Use an editorial design and verify the demo checkout before deployment.
```

After [personal setup](configuration.md#personal-setup), start a fresh Codex or Claude Code session in your projects folder and describe the website. The installed entry Skill directs the agent to initialize the selected directory and follow its project-local workflow. The agent can adapt this starter or preserve an existing application.

![Paperplane editor with a fictional English project brief](images/website.png)

## What the starter provides

- A responsive editorial layout with an idea, audience, and desired outcome.
- A free document preview, copy action, and browser-local draft storage.
- A one-time $19 USD example export product, with distinct demo and Stripe test modes.
- Server-confirmed export access, durable orders, and capability-protected downloads.
- A Cloudflare Worker and D1 backend, deployment identity checks, and scoped evidence.

The draft stays in the browser. When export is unlocked, the application verifies the order and download entitlement with the server, then builds the downloaded Markdown from the current draft. The complete export adds a launch checklist and a next experiment section.

## Reproduce the demo

Create a project without installing personal instructions if you prefer:

```sh
npx --yes opc-harness@0.4.0 init \
  --dir ./paperplane --name paperplane --host both --template paperplane --payment demo \
  --brief 'An English project brief website with free preview and Markdown export'
cd paperplane
node .opc/runtime/bin/opc.mjs scaffold
node .opc/runtime/bin/opc.mjs dev --port 8787
```

Open `http://127.0.0.1:8787` and:

1. Enter a fictional idea, audience, and outcome; select **Create brief** and check the preview.
2. Select Markdown export and open the demo checkout.
3. Confirm the simulated purchase. The backend records the demo order and grants export access.
4. Return to the editor and download the Markdown document.
5. Change the draft and export again. Confirm the new file contains the updated content.

![Paperplane confirming a demo purchase and unlocking Markdown export](images/payment-confirmed.png)

The demo page and exported document identify the payment as simulated. No Stripe transaction or real charge occurs in this mode. To run the automated demo API checks against a running instance:

```sh
node .opc/runtime/bin/opc.mjs payments test --url http://127.0.0.1:8787 --json
```

## Switch to Stripe test payments

Follow [Stripe test configuration](configuration.md#stripe-test-payments) with your own testing environment, matching test Price, and endpoint signing secret. Complete an actual Stripe-hosted test Checkout, verify the signed event at the deployed Webhook, and check the resulting paid entitlement and export. A return redirect alone cannot unlock a download.

The English screenshots here demonstrate **demo** mode. Separate Stripe acceptance in a custom application is documented in the [verification record](verification.md); it is not presented as a transaction from this demo.

## Continue with your product

The harness supplies instructions, a runnable recipe, payment/deployment primitives, and verification commands. The coding agent still designs the finished product, writes its specific fields and output, and verifies browser behavior. Use the starter as a working base and adapt its product definition before testing a different price or currency.

Live payments, settlement, subscriptions, taxes, and merchant eligibility are outside this MVP.
