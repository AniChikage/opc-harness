import type { Options } from './types.mjs';
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { TEMPLATES, siteDefaults, templateById } from "./catalog.mjs";
import { FRONTENDS, STACKS, frontendFor } from "./modules.mjs";
import { fail } from "./core.mjs";
export async function chooseOptions(
  opts: Options,
  { input = stdin, output = stdout } = {},
) {
  if (!input.isTTY || !output.isTTY)
    fail(
      "Interactive selection needs a terminal. Use --template, --brand and --payment, or ask your agent to show the template catalog.",
      "TTY_REQUIRED",
    );
  const rl = createInterface({ input, output });
  async function ask(label: string, value: string) {
    const answer = await rl.question(`${label} [${value}]: `);
    return answer.trim() || value;
  }
  try {
    output.write(
      "\nOpen opc gallery to compare exact website previews before selecting.\n",
    );
    output.write(
      "Frontend types: " + FRONTENDS.map((x) => x.id).join(" / ") + "\n",
    );
    let family;
    while (!family) {
      const value = await ask(
        "Frontend type",
        frontendFor(opts.template || "paperplane")?.id || "landing",
      );
      family = FRONTENDS.find((x) => x.id === value);
      if (!family) output.write("Choose one of the frontend types above.\n");
    }
    const templates = TEMPLATES.filter((t) => family.templates.includes(t.id));
    output.write("\nChoose a complete website template:\n");
    templates.forEach((t, i) =>
      output.write(`${i + 1}. ${t.name} (${t.id}) — ${t.description}\n`),
    );
    let selected;
    while (!selected) {
      const answer = await ask(
        "Template number or ID",
        family.templates.includes(opts.template || "")
          ? opts.template!
          : templates[0].id,
      );
      selected =
        templates[Number(answer) - 1] || templates.find((t) => t.id === answer);
      if (!selected)
        output.write(
          `Choose a number from 1 to ${templates.length} or a matching template ID.\n`,
        );
    }
    const site = siteDefaults(selected.id)!,
      brand = await ask("Brand name", opts.brand || site.brand),
      headline = await ask("Headline", opts.headline || site.headline);
    const email =
      selected.id === "portfolio"
        ? await ask("Contact email", opts.email || site.contactEmail)
        : opts.email;
    output.write(
      "\nStacks: " +
        STACKS.map((x) => x.id + " (" + x.name + ")").join(" / ") +
        "\n",
    );
    let stack;
    while (!stack) {
      const value = await ask("Stack", opts.stack || "cloudflare");
      stack = STACKS.find((x) => x.id === value);
      if (!stack) output.write("Choose cloudflare, vercel or static.\n");
    }
    output.write(stack.data + "\n");
    let payment = "";
    while (!stack.payments.some(mode => mode === payment)) {
      payment = await ask(
        "Payments: " + stack.payments.join(" / "),
        stack.payments.includes(opts.payment as import("./types.mjs").PaymentMode)
          ? opts.payment!
          : stack.payments.includes(selected.payment)
            ? selected.payment
            : "none",
      );
      if (!stack.payments.some(mode => mode === payment))
        output.write(
          "Choose a compatible payment mode: " +
            stack.payments.join(", ") +
            ".\n",
        );
    }
    return {
      ...opts,
      template: selected.id,
      stack: stack.id,
      brand,
      headline,
      payment,
      ...(email ? { email } : {}),
    };
  } finally {
    rl.close();
  }
}
