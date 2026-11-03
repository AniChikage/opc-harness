# Template selection and design

Run `templates --json` to see complete layouts and included interactions. When a user chooses a template, keep that template's layout, spacing, typography, and responsive behavior. Do not redraw it or ask for cosmetic adjustments. `gallery` previews the same renderer and assets used by `create` and `scaffold`.

Set the site brand, headline, description, accent, email, content items and event details with configuration. Use `configure --site-config FILE` for larger content sets. `configure` checks for user edits before changing generated files and project settings. Use `preferences` only when the user wants to change future-project defaults.

Offer matching choices in conversation when needed: portfolio for work and contact; docs for searchable guides; directory for resources; dashboard for local tasks; event for an agenda and calendar; saas for a software homepage; store for the included brief kit; paperplane for the editor itself. Preserve an existing application's framework and source.

The complete templates include sample content and the listed interactions. Tasks, favorites and drafts are browser-local. An event calendar does not register attendees. An arbitrary product, shared team backend, login system or new workflow still needs implementation; do not label those capabilities as included.

Read a provided reference URL or screenshot only when the user requests a custom design. Record intentional differences from the selected template in `.opc/design-brief.md`. A custom design request can override the default template-preservation rule.

Inspect desktop and narrow mobile layouts and exercise the main workflow. Check keyboard focus, labels, empty states and error messages. Report browser evidence separately from CLI HTTP and payment checks.
