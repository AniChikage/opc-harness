# Design and product adaptation

Before editing the starter, establish a compact brief from the user's product intent and any provided references. Record it in `.opc/design-brief.md`: audience, primary task, first useful result, necessary screens, visual direction, and any explicit constraints. Infer reasonable defaults from the project; do not ask the user to choose every implementation detail.

The starter's Paperplane product is a runnable example. Change its title, copy, inputs, outputs and purchase promise when building another product. Ensure that a paid entitlement unlocks the thing the page actually offers. Keep a free product free when payments are not requested.

When a reference URL or screenshot is provided, inspect it using an available browser or image tool. Describe the relevant layout, typography, spacing, color and interaction choices before adapting them. Avoid copying unrelated branding or claiming to have inspected an inaccessible reference.

For the default editorial direction, use warm neutral surfaces, strong readable type, one clear accent, ample spacing and visible interface states. Prioritize the task over decoration. Native CSS and SVG are sufficient where imagery adds no useful information.

Before handoff, inspect the rendered product at desktop and narrow mobile widths. Exercise the main input-to-result path, the purchase button, a rejected or pending payment, and the paid result where applicable. Check keyboard access, focus indicators, form labels, overflow and readable error messages. Retain screenshots when the browser tooling supports them.

`verify` checks only the invariants implemented by the CLI. Report browser checks independently, including any unavailable browser evidence. A screenshot alone does not establish that checkout or the core tool works.
