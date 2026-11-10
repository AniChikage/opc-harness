import type { FrontendModule, StackModule, PaymentModule, Recipe, ProjectConfig } from './types.mjs';
// Shared by the CLI, the visual studio, configuration validation and agents.
export const FRONTENDS: FrontendModule[] = [
  {
    id: "landing",
    name: "Landing pages",
    description: "Product stories, walkthroughs and clear calls to action.",
    templates: ["saas", "pulse", "studio"],
  },
  {
    id: "admin",
    name: "Dashboards & admin",
    description: "Useful workspaces with real local data controls.",
    templates: ["dashboard", "console"],
  },
  {
    id: "content",
    name: "Content & resources",
    description: "Documentation and searchable collections.",
    templates: ["docs", "directory"],
  },
  {
    id: "portfolio",
    name: "Portfolios",
    description: "Selected work, project details and direct contact.",
    templates: ["portfolio"],
  },
  {
    id: "commerce",
    name: "Tools & commerce",
    description: "Working editors, checkout and protected exports.",
    templates: ["paperplane", "store"],
  },
  {
    id: "event",
    name: "Events",
    description: "An agenda, session details and calendar download.",
    templates: ["event"],
  },
];
export const STACKS: StackModule[] = [
  {
    id: "cloudflare",
    name: "Cloudflare Workers",
    runtime: "HTML / CSS / JavaScript + Worker",
    payments: ["none", "demo", "stripe_test"],
    data: "Browser storage; D1 for orders when payments are enabled.",
    deploy: "Verified Workers preview",
    account:
      "Cloudflare account. Stripe test account only for Stripe checkout.",
    docs: "https://developers.cloudflare.com/workers/static-assets/get-started/",
  },
  {
    id: "vercel",
    name: "Vercel Static",
    runtime: "HTML / CSS / JavaScript",
    payments: ["none"],
    data: "Browser storage and configured content. No shared server database.",
    deploy: "Static preview deployment through the Vercel REST API",
    account:
      "VERCEL_TOKEN and VERCEL_PROJECT_ID for a project you select; VERCEL_TEAM_ID for a team-scoped project.",
    docs: "https://vercel.com/docs/rest-api/deployments/create-a-new-deployment",
  },
  {
    id: "static",
    name: "Portable static site",
    runtime: "HTML / CSS / JavaScript",
    payments: ["none"],
    data: "Browser storage and configured content. No server required.",
    deploy: "Export a folder to any static host",
    account: "No account for local preview or export.",
    docs: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Your_first_website/Publishing_your_website",
  },
];
export const PAYMENT_MODULES: PaymentModule[] = [
  {
    id: "none",
    name: "Free",
    description: "No checkout. Markdown export is free.",
    stacks: ["cloudflare", "vercel", "static"],
  },
  {
    id: "demo",
    name: "Demo checkout",
    description:
      "Local simulation of checkout, entitlement and export. No real payment.",
    stacks: ["cloudflare"],
  },
  {
    id: "stripe_test",
    name: "Stripe test checkout",
    description:
      "Hosted checkout, signed webhook, D1 orders and protected export. Test mode only.",
    stacks: ["cloudflare"],
  },
];
export const RECIPES: Recipe[] = [
  {
    id: "product-launch",
    name: "Launch a product",
    description: "A light SaaS homepage with a working brief workspace.",
    template: "saas",
    stack: "vercel",
    payment: "none",
  },
  {
    id: "bold-launch",
    name: "Launch with a bold visual",
    description: "A violet product story with an interactive product preview.",
    template: "pulse",
    stack: "vercel",
    payment: "none",
  },
  {
    id: "studio-site",
    name: "Open a design studio",
    description: "A complete service landing page and inquiry path.",
    template: "studio",
    stack: "static",
    payment: "none",
  },
  {
    id: "personal-admin",
    name: "Manage a small pipeline",
    description:
      "Contacts, stages, notes and CSV export, stored in your browser.",
    template: "console",
    stack: "static",
    payment: "none",
  },
  {
    id: "task-board",
    name: "Organize your work",
    description: "A task workspace with filters, status changes and export.",
    template: "dashboard",
    stack: "cloudflare",
    payment: "none",
  },
  {
    id: "paid-tool",
    name: "Preview free, export after checkout",
    description:
      "The full brief editor and demo checkout, ready for Stripe test configuration.",
    template: "paperplane",
    stack: "cloudflare",
    payment: "demo",
  },
  {
    id: "stripe-store",
    name: "Test a digital product sale",
    description:
      "A brief-kit storefront with Stripe test checkout and protected export.",
    template: "store",
    stack: "cloudflare",
    payment: "stripe_test",
  },
  {
    id: "knowledge-base",
    name: "Publish documentation",
    description: "Searchable guides and copyable outlines.",
    template: "docs",
    stack: "vercel",
    payment: "none",
  },
  {
    id: "resource-library",
    name: "Curate useful resources",
    description: "A directory with search, categories and browser favorites.",
    template: "directory",
    stack: "static",
    payment: "none",
  },
  {
    id: "creative-portfolio",
    name: "Show selected work",
    description: "Visual project filters, detail dialogs and email contact.",
    template: "portfolio",
    stack: "vercel",
    payment: "none",
  },
  {
    id: "event-page",
    name: "Share an event",
    description:
      "Agenda filters and a calendar invite; no registration backend.",
    template: "event",
    stack: "static",
    payment: "none",
  },
];
export const stackById = (id: string | undefined) => STACKS.find((x) => x.id === id);
export const recipeById = (id: string | undefined) => RECIPES.find((x) => x.id === id);
export const frontendFor = (id: string | undefined) =>
  FRONTENDS.find((x) => x.templates.includes(id || ""));
export function selectedModules(c: ProjectConfig) {
  const template = c.design.template || "paperplane",
    stack = stackById(c.deploy.provider)!;
  return {
    frontend: { type: frontendFor(template)?.id, template },
    stack,
    content: {
      id: "configuration",
      description:
        "Brand and content come from site configuration; layout and interactions stay intact.",
    },
    data: {
      id: c.payments.mode === "none" ? "browser" : "browser-and-orders",
      description: stack.data,
    },
    payments: PAYMENT_MODULES.find((x) => x.id === c.payments.mode)!,
    deployment: {
      provider: stack.id,
      tier: c.deploy.tier,
      description: stack.deploy,
    },
    boundaries: [
      "No account authentication or multi-user authorization is included.",
      "Browser data is local to one browser; D1 stores payment orders only.",
    ],
  };
}
