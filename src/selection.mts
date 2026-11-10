import type { Options, ProjectConfig } from './types.mjs';
import path from "node:path";
import { readJSON, validateConfig, fail } from "./core.mjs";
import { recipeById, stackById } from "./modules.mjs";
export async function selectionOptions(opts: Options = {}): Promise<Options> {
  const recipe = opts.recipe ? recipeById(opts.recipe) : null;
  if (opts.recipe && !recipe)
    fail("Unknown recipe. Run opc recipes.", "INVALID_ARGUMENT");
  let imported: Partial<ProjectConfig> = {};
  if (opts["project-config"]) {
    imported = await readJSON<Partial<ProjectConfig>>(path.resolve(opts["project-config"]));
    if (
      Object.keys(imported).some(
        (k) =>
          ![
            "schemaVersion",
            "name",
            "design",
            "site",
            "payments",
            "deploy",
          ].includes(k),
      )
    )
      fail(
        "Project configuration may contain only schemaVersion, name, design, site, payments and deploy. Keep secrets in environment variables.",
        "INVALID_CONFIG",
      );
    validateConfig({ ...imported, name: imported.name || "imported-project" });
  }
  const result = {
    ...(recipe
      ? {
          template: recipe.template,
          stack: recipe.stack,
          payment: recipe.payment,
        }
      : {}),
    ...(imported.design ? { template: imported.design.template } : {}),
    ...(imported.deploy ? { stack: imported.deploy.provider } : {}),
    ...(imported.payments
      ? {
          payment: imported.payments.mode,
          amount: imported.payments.product?.amount,
          currency: imported.payments.product?.currency,
        }
      : {}),
    ...(imported.name ? { name: imported.name } : {}),
    ...opts,
    site: { ...imported.site, ...opts.site },
  };
  if (result.stack && !stackById(result.stack))
    fail(
      "Unknown stack. Choose cloudflare, vercel or static.",
      "INVALID_ARGUMENT",
    );
  if (result.stack && result.stack !== "cloudflare" && !result.payment)
    result.payment = "none";
  return result;
}
