export const TEMPLATES = Object.freeze([
  {
    id: "paperplane",
    name: "Paperplane",
    category: "Tool",
    description:
      "A complete project brief editor with preview, checkout and Markdown export.",
    brand: "Paperplane",
    headline: "Give your next idea a clear direction.",
    descriptionText:
      "Turn a rough idea into a focused project brief. Write, shape, and share.",
    accent: "#a54628",
    payment: "demo",
    features: [
      "Brief editor",
      "Browser autosave",
      "Markdown export",
      "Checkout",
    ],
  },
  {
    id: "saas",
    name: "Launch",
    category: "SaaS",
    description:
      "A software homepage with product walkthrough, pricing, FAQ and a working brief workspace.",
    brand: "Launch",
    headline: "Less planning. More shipping.",
    descriptionText:
      "A clear home for your next release. Shape the idea, choose a scope, and make the first version happen.",
    accent: "#2454d6",
    payment: "none",
    features: ["Product walkthrough", "Pricing", "FAQ", "Brief workspace"],
  },
  {
    id: "portfolio",
    name: "Form Studio",
    category: "Portfolio",
    description:
      "A visual portfolio with filterable work, project details and email contact.",
    brand: "Form Studio",
    headline: "Thoughtful work. Useful things.",
    descriptionText:
      "An independent design practice for people making a difference in small, practical ways.",
    accent: "#c3462c",
    payment: "none",
    features: ["Project filters", "Project details", "Email contact"],
  },
  {
    id: "docs",
    name: "Fieldnotes",
    category: "Documentation",
    description:
      "A searchable documentation site with article navigation and code examples.",
    brand: "Fieldnotes",
    headline: "A useful place to begin.",
    descriptionText:
      "Practical guides for taking an idea from a first sketch to a working release.",
    accent: "#08785d",
    payment: "none",
    features: ["Full-text search", "Article navigation", "Code copying"],
  },
  {
    id: "directory",
    name: "Good Finds",
    category: "Directory",
    description:
      "A searchable resource directory with categories, details and saved favorites.",
    brand: "Good Finds",
    headline: "Find the right thing. Get on with it.",
    descriptionText:
      "A considered collection of useful resources for independent makers.",
    accent: "#7444bb",
    payment: "none",
    features: [
      "Search",
      "Category filters",
      "Saved favorites",
      "Resource details",
    ],
  },
  {
    id: "dashboard",
    name: "Workroom",
    category: "Dashboard",
    description:
      "A local task workspace with creation, filters, status changes and CSV export.",
    brand: "Workroom",
    headline: "Make room for the work.",
    descriptionText:
      "A small workspace for the next useful version. Tasks are saved in this browser.",
    accent: "#245c49",
    payment: "none",
    features: ["Task creation", "Status changes", "Search", "CSV export"],
  },
  {
    id: "store",
    name: "First Edition",
    category: "Digital product",
    description:
      "A digital brief-kit storefront connected to the complete editor and export flow.",
    brand: "First Edition",
    headline: "Your next project, on paper.",
    descriptionText:
      "A practical brief kit for turning scattered ideas into a plan you can actually use.",
    accent: "#b6354e",
    payment: "demo",
    features: [
      "Product preview",
      "FAQ",
      "Brief customization",
      "Checkout and export",
    ],
  },
  {
    id: "event",
    name: "Maker Day",
    category: "Event",
    description:
      "An event homepage with a filterable agenda and downloadable calendar invite.",
    brand: "Maker Day",
    headline: "One day. A new direction.",
    descriptionText:
      "A sample gathering for independent makers to share their process and start something useful.",
    accent: "#a64117",
    payment: "none",
    features: ["Agenda filters", "Session details", "Calendar download"],
  },
  {
    id: "pulse",
    name: "Orbit",
    category: "Landing",
    description:
      "A vivid product landing page with an interactive workflow preview, feature tabs and a working brief workspace.",
    brand: "Orbit",
    headline: "Your next release starts here.",
    descriptionText:
      "Bring the scattered pieces of your next idea into one focused project brief.",
    accent: "#7354d3",
    payment: "none",
    features: ["Interactive preview", "Feature tabs", "FAQ", "Brief workspace"],
  },
  {
    id: "studio",
    name: "Daybreak",
    category: "Landing",
    description:
      "A service studio landing page with selected projects, service details and prefilled email inquiries.",
    brand: "Daybreak",
    headline: "Good ideas deserve a great beginning.",
    descriptionText:
      "A small independent studio shaping identities and websites for things worth making.",
    accent: "#245dca",
    payment: "none",
    features: ["Service selection", "Project details", "Email inquiries"],
  },
  {
    id: "console",
    name: "Sidecar",
    category: "Admin",
    description:
      "A complete browser-local contact pipeline with create, edit, delete, search, stages and CSV export.",
    brand: "Sidecar",
    headline: "Keep the next conversation moving.",
    descriptionText:
      "A personal contact pipeline. Sample data and edits stay in this browser; there is no shared account backend.",
    accent: "#335bba",
    payment: "none",
    features: ["Contact CRUD", "Pipeline stages", "Search", "CSV export"],
  },
]);
export const templateById = (id) => TEMPLATES.find((t) => t.id === id);
export function siteDefaults(id = "paperplane") {
  const t = templateById(id);
  return (
    t && {
      brand: t.brand,
      headline: t.headline,
      description: t.descriptionText,
      accent: t.accent,
      contactEmail: "hello@example.com",
    }
  );
}

// References are independent examples to inspect, never a claim of copied source or affiliation.
export const REFERENCES = {
  saas: [
    {
      name: "Cal.com",
      url: "https://cal.com/",
      note: "Product walkthrough and a clear first action.",
    },
  ],
  pulse: [
    {
      name: "Linear",
      url: "https://linear.app/",
      note: "A product story built around the interface.",
    },
  ],
  studio: [
    {
      name: "Notion",
      url: "https://www.notion.com/",
      note: "Editorial rhythm and readable product storytelling.",
    },
  ],
  dashboard: [
    {
      name: "shadcn/ui dashboard",
      url: "https://ui.shadcn.com/examples/dashboard",
      note: "Dense, readable workspace navigation and tables.",
    },
  ],
  console: [
    {
      name: "shadcn/ui dashboard",
      url: "https://ui.shadcn.com/examples/dashboard",
      note: "Table hierarchy, filtering and clear primary actions.",
    },
  ],
  docs: [
    {
      name: "Astro documentation",
      url: "https://docs.astro.build/en/getting-started/",
      note: "Persistent guide navigation and content hierarchy.",
    },
  ],
  directory: [
    {
      name: "Astro integrations",
      url: "https://astro.build/integrations/",
      note: "Searchable resources organized by category.",
    },
  ],
  paperplane: [
    {
      name: "Notion",
      url: "https://www.notion.com/",
      note: "A writing-first workspace with a visible document.",
    },
  ],
  store: [
    {
      name: "Stripe",
      url: "https://stripe.com/",
      note: "Explain the product and the next action clearly.",
    },
  ],
  portfolio: [],
  event: [
    {
      name: "Config",
      url: "https://config.figma.com/",
      note: "Event information and agenda hierarchy; dates belong to the reference event.",
    },
  ],
};
