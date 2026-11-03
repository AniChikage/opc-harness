# One-time payments

Read the project's selected payment mode and the server's health response before testing. The MVP has two explicit modes:

| Mode | Meaning | Evidence required |
| --- | --- | --- |
| `demo` | A simulated purchase exercises the application's order and entitlement flow. No money is charged. | Create an order, complete the demonstration checkout, and read its server-confirmed paid state. |
| `stripe_test` | Stripe-hosted Checkout using test credentials. No live payments are supported by this MVP. | A real Stripe test Checkout, a correctly signed event delivered to this environment, and the matching server-confirmed entitlement. |

Use `payments test --url <task-environment> --json` for the automated checks the current mode supports. A passing demonstration or signed fixture does not prove that Stripe credentials, the external Checkout or a deployed Stripe webhook work. When credentials are missing, report the precise missing environment variable and continue the rest of the implementation.

The Stripe adapter uses Checkout Sessions for the server-selected product and price. Keep `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `STRIPE_PRICE_ID` out of source and client code. Use test credentials only. Do not convert this MVP to live payments without implementing and verifying that additional scope.

Fulfill the purchased result from the server's validated order state. Retain these invariants when adapting the starter:

- A redirect to the success page cannot grant access.
- Validate the webhook signature over the original request body, with timestamp tolerance.
- Match the order, Checkout session, product, amount, currency and payment environment before granting access.
- Unpaid or failed events do not grant access. Asynchronous payment success needs its own validated event.
- Duplicate events remain safe through durable idempotency.
- Reading an order or entitlement requires its capability token; do not expose other buyers' orders.

After changing payment logic, run the relevant backend tests and an end-to-end purchase in the appropriate environment. Preserve the visible simulation label in demo mode. Report external account onboarding or webhook setup as an unresolved prerequisite until actually verified.

Primary references: [Stripe Checkout Sessions](https://docs.stripe.com/api/checkout/sessions) and [Stripe webhooks](https://docs.stripe.com/webhooks). Check current official documentation when changing provider behavior.
