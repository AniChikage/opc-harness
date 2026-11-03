import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { TEMPLATES, siteDefaults, templateById } from "./catalog.mjs";
import { fail } from "./core.mjs";
export async function chooseOptions(
  opts,
  { input = stdin, output = stdout } = {},
) {
  if (!input.isTTY || !output.isTTY)
    fail(
      "Interactive selection needs a terminal. Use --template, --brand and --payment, or ask your agent to show the template catalog.",
      "TTY_REQUIRED",
    );
  const rl = createInterface({ input, output });
  async function ask(label, value) {
    const answer = await rl.question(`${label} [${value}]: `);
    return answer.trim() || value;
  }
  try {
    output.write("\nChoose a complete website template:\n");
    TEMPLATES.forEach((t, i) =>
      output.write(`${i + 1}. ${t.name} (${t.id}) — ${t.description}\n`),
    );
    let selected;
    while (!selected) {
      const answer = await ask(
        "Template number or ID",
        opts.template || "paperplane",
      );
      selected = TEMPLATES[Number(answer) - 1] || templateById(answer);
      if (!selected)
        output.write("Choose a number from 1 to 8 or an exact template ID.\n");
    }
    const site = siteDefaults(selected.id),
      brand = await ask("Brand name", opts.brand || site.brand),
      headline = await ask("Headline", opts.headline || site.headline);
    const email =
      selected.id === "portfolio"
        ? await ask("Contact email", opts.email || site.contactEmail)
        : opts.email;
    let payment;
    while (!["none", "demo", "stripe_test"].includes(payment)) {
      payment = await ask(
        "Payments: none / demo / stripe_test",
        opts.payment || selected.payment,
      );
      if (!["none", "demo", "stripe_test"].includes(payment))
        output.write("Choose none, demo or stripe_test.\n");
    }
    return {
      ...opts,
      template: selected.id,
      brand,
      headline,
      payment,
      ...(email ? { email } : {}),
    };
  } finally {
    rl.close();
  }
}
