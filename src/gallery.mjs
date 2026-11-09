import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { TEMPLATES, REFERENCES, siteDefaults } from "./catalog.mjs";
import {
  FRONTENDS,
  STACKS,
  PAYMENT_MODULES,
  RECIPES,
  frontendFor,
} from "./modules.mjs";
import { templateEntries } from "./render.mjs";
import { escapeHTML as e } from "./pages.mjs";
import { PACKAGE_ROOT, VERSION, fail, managedWrite } from "./core.mjs";
export async function galleryEntries() {
  const ordered = FRONTENDS.flatMap((f) =>
    f.templates.map((id) => TEMPLATES.find((t) => t.id === id)),
  );
  const catalog = {
    version: VERSION,
    templates: TEMPLATES.map((t) => ({
      ...t,
      type: frontendFor(t.id).id,
      preview: "/templates/" + t.id + "/",
      references: REFERENCES[t.id] || [],
    })),
    frontends: FRONTENDS,
    stacks: STACKS,
    payments: PAYMENT_MODULES,
    recipes: RECIPES,
  };
  const entries = {};
  for (const file of ["studio.css", "studio.js"])
    entries[file] = await fs.readFile(
      path.join(PACKAGE_ROOT, "templates/studio", file),
    );
  entries["catalog.json"] = JSON.stringify(catalog);
  entries["api/health"] = JSON.stringify({
    ok: true,
    mode: "preview",
    configured: false,
  });
  for (const t of TEMPLATES) {
    const preview = await templateEntries({
      name: "template-preview",
      design: { preset: "editorial", template: t.id },
      site: siteDefaults(t.id),
      payments: { mode: t.payment },
      deploy: { provider: "cloudflare", tier: "preview" },
    });
    for (const [file, bytes] of Object.entries(preview)) {
      if (!file.startsWith("public/")) continue;
      const filename = file.slice(7);
      let body = bytes;
      if (filename.endsWith(".html"))
        body = body
          .toString()
          .replace(/(href|src)="\//g, `$1="/templates/${t.id}/`);
      if (filename === "app.js")
        body = body
          .toString()
          .replace("'/site-config.js'", `'/templates/${t.id}/site-config.js'`);
      entries[`templates/${t.id}/${filename}`] = body;
    }
  }
  entries["index.html"] =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Choose a complete website by its actual appearance. Combine frontend, stack and payments, then export a ready-to-run configuration."><title>Website Studio — OPC Harness</title><link rel="stylesheet" href="/studio.css"><script src="/studio.js" type="module"></script></head><body><a class="skip" href="#main">Skip to templates</a><header class="topbar"><a class="wordmark" href="/" aria-label="OPC Harness studio"><svg viewBox="0 0 30 30" aria-hidden="true"><path d="M4 7h9v7H4zM17 7h9v7h-9zM4 18h9v7H4zM17 18h9v7h-9z" fill="currentColor"/></svg>OPC <span>Studio</span></a><span class="header-note">A website you can see. A setup you can reuse.</span><a class="source-link" href="https://github.com/AniChikage/opc-harness" target="_blank" rel="noopener noreferrer">GitHub</a><span class="version">${e(VERSION)}</span></header><div class="studio-shell"><aside class="sidebar"><p class="side-label">Frontend library</p><nav aria-label="Website types"><button data-filter="all" aria-pressed="true" class="active">All templates <span>${TEMPLATES.length}</span></button>${FRONTENDS.map((x) => `<button data-filter="${x.id}" aria-pressed="false">${e(x.name)}<span>${x.templates.length}</span></button>`).join("")}</nav><div class="side-bottom"><p>Pick a recipe</p><label class="sr-only" for="recipe">Ready-made recipe</label><select id="recipe"><option value="">Build your combination</option>${RECIPES.map((x) => `<option value="${x.id}">${e(x.name)}</option>`).join("")}</select><p>Templates, stack and payments selected together.</p></div></aside><main id="main"><section class="intro"><span class="intro-tag">From idea to a working first version</span><h1>See it. Choose it.<br>Make it yours.</h1><p>Complete websites with real interactions. Start with the result, then choose how it runs.</p></section><div class="catalog-toolbar"><h2 id="category-title">All templates</h2><label class="catalog-search"><span class="sr-only">Search templates</span><input id="template-search" type="search" placeholder="Find a template or feature"></label></div><p id="catalog-count" class="sr-only" role="status"></p><div class="template-grid">${ordered
      .map(
        (t) =>
          `<article class="template-card" data-template="${t.id}" data-type="${frontendFor(t.id).id}"><button class="preview-button" data-preview="${t.id}" aria-label="Preview ${e(t.name)}"><div class="mini-browser" aria-hidden="true"><span></span><span></span><span></span><small>${e(t.brand.toLowerCase().replaceAll(" ", "-"))}.example</small></div><div class="preview-frame"><iframe loading="lazy" src="/templates/${t.id}/" title="${e(t.name)} website thumbnail" tabindex="-1" aria-hidden="true" sandbox="allow-scripts allow-same-origin"></iframe></div><span class="preview-label">Explore website</span></button><div class="card-content"><div class="card-title"><h3>${e(t.name)}</h3><span>${e(frontendFor(t.id).name)}</span></div><p>${e(t.description)}</p><div class="card-features">${t.features
            .slice(0, 3)
            .map((f) => `<span>${e(f)}</span>`)
            .join(
              "",
            )}</div><div class="card-actions"><button class="text-button" data-preview="${t.id}">Preview website</button><button class="choose-button" data-select="${t.id}" aria-pressed="false">Use template</button></div>${(REFERENCES[t.id] || []).map((r) => `<a class="card-reference" href="${e(r.url)}" target="_blank" rel="noopener noreferrer">Pattern reference: ${e(r.name)}</a>`).join("")}</div></article>`,
      )
      .join(
        "",
      )}</div><p id="no-templates" hidden>No templates match. Try another feature or website type.</p><footer class="catalog-footer">The examples use the same HTML, CSS and interactions as generated projects. Reference websites are independent inspiration links; their source and assets are not copied.</footer></main><aside class="configuration" aria-labelledby="configuration-title"><div class="config-heading"><span class="selection-dot"></span><h2 id="configuration-title">Your website</h2><span id="selected-type"></span></div><div class="selection-summary"><h3 id="selected-name"></h3><p id="selected-description"></p><button class="text-button" id="preview-selection">Preview selected website</button></div><form id="project-form"><label>Project folder<input id="project" value="my-website" pattern="[a-z][a-z0-9-]{2,45}" maxlength="46" required></label><label>Brand name<input id="brand" maxlength="100" required></label><label>Headline<input id="headline" maxlength="300" required></label><details class="brand-details"><summary>More brand settings</summary><label>Description<input id="description" maxlength="800" required></label><label>Contact email<input id="email" type="email" value="hello@example.com" required></label><label>Accent color<input id="accent" type="color" value="#7354d3"></label></details><label>Run & deploy<select id="stack">${STACKS.map((x) => `<option value="${x.id}">${e(x.name)}</option>`).join("")}</select></label><p class="field-note" id="stack-note"></p><label>Payment<select id="payment">${PAYMENT_MODULES.map((x) => `<option value="${x.id}">${e(x.name)}</option>`).join("")}</select></label><p class="field-note" id="payment-note"></p><div id="product-settings" hidden><label>Price in minor units<input id="amount" type="number" value="1900" min="50" max="99999999" step="1" required></label><label>Currency<select id="currency"><option value="usd">USD</option><option value="eur">EUR</option><option value="gbp">GBP</option><option value="cny">CNY</option><option value="jpy">JPY</option><option value="cad">CAD</option><option value="aud">AUD</option></select></label><p class="field-note">For Stripe, configure a test Price with the same currency and amount. JPY uses whole yen.</p></div><details class="data-module"><summary>Data & content included</summary><p id="data-note"></p><p>Brand and content are configurable. User accounts and shared team data require an additional backend.</p></details><div class="module-status" role="status" id="compatibility"></div><button class="primary-button" type="submit">Copy create command</button><button class="secondary-button" type="button" id="download-config">Download project config</button></form><p id="copy-status" role="status"></p><details class="command-details"><summary>View command & agent prompt</summary><pre><code id="command"></code></pre><pre id="agent-prompt"></pre><button class="text-button" id="copy-prompt">Copy agent prompt</button></details><details class="reference-module" open><summary>Related example websites</summary><div id="references"></div><p>References help compare patterns. The selected OPC template is the exact reusable example.</p></details><p class="local-only">Configuration stays on this device. No accounts or deployments are created by this page.</p></aside></div><a class="mobile-config" href="#configuration-title">Configure selected website</a><dialog class="preview-dialog" aria-labelledby="preview-title"><header><div><strong id="preview-title"></strong><span id="preview-info"></span></div><div class="device-switch" role="group" aria-label="Preview viewport"><button data-device="desktop" aria-pressed="true">Desktop</button><button data-device="mobile" aria-pressed="false">Mobile</button></div><a id="open-preview" target="_blank" rel="noopener">Open example</a><button id="close-preview" aria-label="Close website preview">Close</button></header><div class="live-preview"><iframe id="live-frame" title="Interactive website preview" sandbox="allow-scripts allow-same-origin allow-downloads allow-popups"></iframe></div><footer><p>Interact with the complete frontend. Checkout runs only in a generated project with its configured backend.</p><button class="primary-button" id="use-preview">Use this template</button></footer></dialog></body></html>`;
  return entries;
}
export async function gallery(opts = {}) {
  const entries = await galleryEntries();
  if (opts.out) {
    const directory = path.resolve(opts.out);
    await managedWrite(directory, entries);
    console.log(
      JSON.stringify({
        ok: true,
        directory,
        templates: TEMPLATES.length,
        scope: "static-gallery-export",
        note: "Serve this folder at an HTTP(S) origin root.",
      }),
    );
    return;
  }
  const port = Number(opts.port || 8788);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    fail("port must be 1024–65535.", "INVALID_ARGUMENT");
  const server = http.createServer((req, res) => {
    let file;
    try {
      file = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      ).slice(1);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (file.includes("..") || file.includes("\\")) {
      res.writeHead(404);
      res.end();
      return;
    }
    if (!file || file.endsWith("/")) file += "index.html";
    const body = entries[file];
    if (body === undefined) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const extension = path.extname(file),
      type =
        file === "api/health"
          ? "application/json"
          : {
              ".js": "text/javascript",
              ".json": "application/json",
              ".css": "text/css",
              ".svg": "image/svg+xml",
              ".png": "image/png",
            }[extension] || "text/html; charset=utf-8";
    res.writeHead(200, {
      "content-type": type,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(body);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  console.log(
    JSON.stringify({
      ok: true,
      url: `http://127.0.0.1:${port}`,
      templates: TEMPLATES.length,
      scope: "module-studio",
    }),
  );
  return server;
}
