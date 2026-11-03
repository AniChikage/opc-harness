import { siteDefaults, templateById } from "./catalog.mjs";
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (x) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        x
      ],
  );
const e = escapeHTML;
const button = (text, href = "/workspace.html") =>
  `<a class="button" href="${href}">${e(text)}</a>`;
const hero = (s, action) =>
  `<section class="hero"><h1>${e(s.headline)}</h1><p>${e(s.description)}</p>${action || ""}</section>`;
const faq = () =>
  `<section class="faq"><h2>A few useful answers.</h2><details><summary>Where is my work saved?</summary><p>Your draft is saved in this browser. Export a copy to keep or share it.</p></details><details><summary>Can I change the brief later?</summary><p>Yes. Return to the workspace, update your draft, and export the current version.</p></details><details><summary>Is a payment required?</summary><p>The workspace clearly shows whether exports are free, simulated, or use Stripe test checkout.</p></details></section>`;
const samples = [
  {
    name: "A quieter workspace",
    category: "Product",
    description:
      "A focused planning tool that puts the next useful action first.",
  },
  {
    name: "Common ground",
    category: "Identity",
    description:
      "An approachable identity system for a neighborhood seed library.",
  },
  {
    name: "The reading room",
    category: "Web",
    description: "A small digital notebook for the passages worth remembering.",
  },
  {
    name: "Small beginnings",
    category: "Product",
    description:
      "A launch checklist designed for one person and one clear goal.",
  },
];
const resources = [
  {
    name: "Scope worksheet",
    category: "Planning",
    description: "Define the smallest useful version before writing code.",
  },
  {
    name: "Launch checklist",
    category: "Delivery",
    description:
      "Check the experience from the first input to the final result.",
  },
  {
    name: "Interview guide",
    category: "Research",
    description: "Ask about real behavior, constraints, and recent decisions.",
  },
  {
    name: "Accessibility notes",
    category: "Design",
    description:
      "Check keyboard navigation, contrast, focus, labels, and errors.",
  },
  {
    name: "Release journal",
    category: "Delivery",
    description:
      "Keep a concise record of changes, checks, and remaining questions.",
  },
  {
    name: "Design brief",
    category: "Design",
    description:
      "Set the audience, task, visual direction, and first useful outcome.",
  },
];
const articles = [
  {
    name: "Getting started",
    category: "Start",
    description:
      "Choose one real task and one person who needs to complete it. Define the smallest result that would help them. Write down the constraints before choosing the implementation.",
  },
  {
    name: "Write a useful brief",
    category: "Start",
    description:
      "Describe the audience, their current workflow, and the outcome they want. Separate the first release from later ideas. Make acceptance criteria observable.",
  },
  {
    name: "Design the main path",
    category: "Build",
    description:
      "Start with the core action. Give inputs clear labels and show what happens next. Include loading, empty, error, and success states. Check mobile and keyboard use.",
  },
  {
    name: "Verify delivery",
    category: "Ship",
    description:
      "Exercise the complete flow using realistic input. Confirm the output contains the current data. Check that failed and pending payments never unlock protected delivery.",
  },
  {
    name: "Release and learn",
    category: "Ship",
    description:
      "Record the release URL and the checks you ran. Ask one person to complete the main task. Use their observed behavior to decide what to improve next.",
  },
];
const filters = (categories, extra = "") =>
  `<div class="filters" role="group" aria-label="Filter results">${["All", ...new Set(categories)].map((x, i) => `<button class="filter${i ? "" : " active"}" data-filter="${e(x)}" aria-pressed="${!i}">${e(x)}</button>`).join("")}${extra}</div>`;
const search = (placeholder = "Search") =>
  `<label class="search"><span>Search</span><input type="search" id="search" placeholder="${e(placeholder)}"></label>`;
function saas(s) {
  return `${hero(s, button("Open your workspace"))}<section class="product-tour"><div><h2>From a loose idea to a clear brief.</h2><p>Pick a step to see how it works, then try it with your own project.</p><div class="tour-tabs" role="group" aria-label="Product walkthrough">${["Capture", "Focus", "Share"].map((x, i) => `<button data-tour="${i}" aria-pressed="${!i}">${x}</button>`).join("")}</div></div><article class="tour-document"><span id="tour-step">Your starting point</span><h3 id="tour-title">One idea worth making.</h3><p id="tour-copy">Write the problem, the people it affects, and the outcome that would help them.</p><div class="document-lines" aria-hidden="true"></div></article></section><section class="pricing"><h2>A clear place to start.</h2><div><h3>Personal workspace</h3><p>Create and refine briefs. Keep your drafts in your browser.</p>${button("Try the workspace")}</div><div><h3>Markdown export</h3><p>Take your current brief and launch checklist with you. Export access is shown in the workspace.</p>${button("See export options")}</div></section>${faq()}`;
}
function portfolio(s) {
  const items = s.items || samples;
  return `${hero(s, `<a class="text-link" href="#work">Explore selected work</a>`)}<section id="work"><div class="section-heading"><h2>Selected work</h2><span>Sample projects</span></div>${filters(items.map((x) => x.category))}<div class="work-grid">${items
    .map(
      (x, i) =>
        `<button class="work-card" data-item data-category="${e(x.category)}" data-title="${e(x.name)}" data-description="${e(x.description)}"><span class="work-art art-${i % 4}" aria-hidden="true"><span>${e(
          x.name
            .split(" ")
            .map((y) => y[0])
            .join(""),
        )}</span></span><span class="work-caption"><strong>${e(x.name)}</strong><span>${e(x.category)}</span></span></button>`,
    )
    .join(
      "",
    )}</div></section><section class="contact"><h2>Have something in mind?</h2><p>Send a short note about what you are making and where you need help.</p>${button("Start a conversation", `mailto:${e(s.contactEmail)}`)}</section>`;
}
function docs(s) {
  const items = s.items || articles;
  return `<div class="docs-layout"><aside><h2>Documentation</h2>${search("Find a guide")}<nav aria-label="Guides">${items.map((x, i) => `<button class="doc-nav${i ? "" : " active"}" data-doc="${i}" aria-current="${i ? "false" : "page"}">${e(x.name)}</button>`).join("")}</nav><p id="search-status" role="status"></p></aside><section class="doc-content"><h1>${e(s.headline)}</h1><p class="lead">${e(s.description)}</p><article id="doc-article"><h2>${e(items[0].name)}</h2><p>${e(items[0].description)}</p></article><h3>Keep the result concrete</h3><p>Use this small outline to describe the next useful version.</p><div class="code-example"><code id="code-example"># Project brief / Audience / Desired outcome / First useful version</code><button data-copy-code>Copy outline</button></div><p id="copy-status" role="status"></p></section></div><script type="application/json" id="doc-data">${JSON.stringify(items).replace(/</g, "\\u003c")}</script>`;
}
function directory(s) {
  const items = s.items || resources;
  return `${hero(s)}<section class="resource-section"><div class="directory-tools">${search("Find a resource")}<button class="filter" data-saved aria-pressed="false">Saved only</button></div>${filters(items.map((x) => x.category))}<p id="result-count" role="status"></p><div class="resource-list">${items.map((x, i) => `<article data-item data-category="${e(x.category)}" data-key="resource-${i}"><span class="resource-symbol" aria-hidden="true">${e(x.name[0])}</span><div><button class="resource-title" data-title="${e(x.name)}" data-description="${e(x.description)}">${e(x.name)}</button>${x.url ? `<a class="resource-link" href="${e(x.url)}" target="_blank" rel="noopener noreferrer">Visit resource</a>` : ""}<p>${e(x.description)}</p><span class="category">${e(x.category)}</span></div><button class="save-resource" aria-label="Save ${e(x.name)}" aria-pressed="false">Save</button></article>`).join("")}</div><p id="empty-results" hidden>No matching resources. Try another search or category.</p></section>`;
}
function dashboard(s) {
  return `<div class="board-header"><div><h1>${e(s.headline)}</h1><p>${e(s.description)}</p></div><button class="button" data-export-tasks>Export CSV</button></div><section class="task-workspace"><form id="task-form"><label>New task<input name="task" placeholder="What needs to happen?" maxlength="180" required></label><button class="button">Add task</button></form><div class="task-tools">${search("Search tasks")}${filters(["Planned", "In progress", "Done"])}</div><div class="table-scroll"><table><thead><tr><th>Task</th><th>Status</th><th>Action</th></tr></thead><tbody id="tasks"></tbody></table></div><p id="task-status" role="status"></p><p class="local-note">Sample tasks and your changes are stored in this browser. Export CSV to keep a separate copy.</p></section>${s.items ? `<script type="application/json" id="task-data">${JSON.stringify(s.items.map((x, i) => ({ id: String(i), name: x.name, status: ["Planned", "In progress", "Done"].includes(x.category) ? x.category : "Planned" }))).replace(/</g, "\\u003c")}</script>` : ""}`;
}
function store(s) {
  return `<section class="store-hero"><div>${hero(s, button("Customize your brief"))}<p class="product-note">An editable brief, a launch checklist, and one next experiment.</p></div><div class="book-cover"><span>${e(s.brand)}</span><strong>The project<br>brief kit.</strong><p>From a first thought<br>to a useful version.</p><span>Digital edition / Markdown</span></div></section><section class="included"><h2>A little structure. A useful result.</h2><div><h3>The project brief</h3><p>The idea, the audience, the outcome, and the first useful scope.</p></div><div><h3>The launch checklist</h3><p>A practical sequence for checking the experience before sharing it.</p></div><div><h3>The next experiment</h3><p>One small real-world test that helps you choose what comes next.</p></div></section>${faq()}<section class="contact"><h2>Make it your own.</h2><p>Preview the brief for free. The workspace shows the current export options before checkout.</p>${button("Open the brief editor")}</section>`;
}
function event(s) {
  const event = s.event || {
    startsAt: "2027-02-12T09:00:00Z",
    endsAt: "2027-02-12T17:00:00Z",
    location: "Online",
  };
  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(event.startsAt));
  const time = (value) =>
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(new Date(value));
  const items = s.items || [
    {
      name: "Begin with the problem",
      category: "Talk",
      description:
        "09:00 — A practical opening session about finding a useful first version.",
    },
    {
      name: "Make something small",
      category: "Workshop",
      description:
        "10:30 — Bring a rough idea and turn it into a focused project brief.",
    },
    {
      name: "Show the unfinished work",
      category: "Talk",
      description:
        "13:30 — Short demonstrations and honest notes about what changed.",
    },
    {
      name: "Choose the next experiment",
      category: "Workshop",
      description: "15:00 — Leave with one concrete thing to test next.",
    },
  ];
  return `${hero(s, `<button class="button" data-calendar>Add to calendar</button>`)}<div class="event-details"><p><strong>${e(date)}</strong><br>${time(event.startsAt)}–${time(event.endsAt)} UTC</p><p><strong>${e(event.location)}</strong><br>Sample event agenda</p></div><section class="agenda" id="agenda"><h2>A day for useful beginnings.</h2>${filters(items.map((x) => x.category))}${items.map((x) => `<button class="agenda-row" data-item data-category="${e(x.category)}" data-title="${e(x.name)}" data-description="${e(x.description)}"><span>${e(x.category)}</span><strong>${e(x.name)}</strong><span>${e(x.description.split(" — ")[0])}</span></button>`).join("")}</section><p id="calendar-status" role="status"></p><script type="application/json" id="event-data">${JSON.stringify({ ...event, name: s.brand, description: s.description }).replace(/</g, "\\u003c")}</script>`;
}
const layouts = { saas, portfolio, docs, directory, dashboard, store, event };
const navigation = {
  saas: ["Workspace", "/workspace.html", "Open workspace"],
  portfolio: ["Selected work", "#work", "Get in touch"],
  docs: ["Guides", "#doc-article", "Start reading"],
  directory: ["Resources", "#search", "Browse resources"],
  dashboard: ["Tasks", "#tasks", "Add a task"],
  store: ["Brief editor", "/workspace.html", "Customize your brief"],
  event: ["Agenda", "#agenda", "See the agenda"],
};
export function renderPage(config) {
  const id = config.design.template,
    t = templateById(id),
    s = { ...siteDefaults(id), ...config.site };
  const title = s.brand + " — " + s.headline,
    navigationItem = navigation[id];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${e(s.description)}"><meta name="referrer" content="no-referrer"><meta name="theme-color" content="${e(s.accent)}"><title>${e(title)}</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/styles.css"><script src="/library.js" type="module"></script></head><body class="template-${id}" data-template="${id}" style="--accent:${e(s.accent)}"><a class="skip-link" href="#main">Skip to content</a><header class="header"><a class="brand" href="/">${e(s.brand)}</a><nav aria-label="Main navigation"><a href="#main">${e(t.category)}</a><a href="${navigationItem[1]}">${navigationItem[0]}</a></nav>${button(navigationItem[2], id === "portfolio" ? "mailto:" + e(s.contactEmail) : id === "dashboard" ? "#task-form" : navigationItem[1])}</header><main id="main">${layouts[id](s)}</main><footer class="footer"><a class="brand" href="/">${e(s.brand)}</a><span>${e(s.description)}</span><a href="mailto:${e(s.contactEmail)}">Contact</a></footer><dialog id="detail-dialog" aria-labelledby="detail-title"><button class="dialog-close" data-close aria-label="Close details">Close</button><h2 id="detail-title"></h2><p id="detail-description"></p></dialog></body></html>`;
}
