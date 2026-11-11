import type { ProjectConfig, Entries, ResolvedSite } from './types.mjs';
import fs from "node:fs/promises";
import path from "node:path";
import { PACKAGE_ROOT, filesIn } from "./core.mjs";
import { siteDefaults } from "./catalog.mjs";
import { renderPage, escapeHTML } from "./pages.mjs";
import { isIndieTemplate } from './indie-catalog.mjs';
import { indieFavicon, indieMark } from './indie-pages.mjs';
export async function templateEntries(config: ProjectConfig) {
  const entries: Entries = {};
  for (const file of await filesIn(
    path.join(PACKAGE_ROOT, "templates/paid-site"),
  ))
    entries[file] = await fs.readFile(
      path.join(PACKAGE_ROOT, "templates/paid-site", file),
    );
  const id = config.design.template || "paperplane",
    site = { ...siteDefaults(id), ...config.site };
  const product = {
    sku: "starter",
    amount: 1900,
    currency: "usd",
    ...config.payments.product,
  };
  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: product.currency,
  }).format(product.amount / (product.currency === "jpy" ? 1 : 100));
  for (const file of Object.keys(entries).filter((x) => x.endsWith(".html"))) {
    let html = entries[file]
      .toString()
      .replaceAll("Paperplane", escapeHTML(site.brand))
      .replaceAll("$19", escapeHTML(price));
    if (id !== "paperplane")
      html = html
        .replaceAll("/styles.css", "/workspace.css")
        .replaceAll('href="/#workspace"', 'href="/workspace.html#workspace"');
    entries[file] = html;
  }
  let workspace = entries["public/index.html"]
    .toString()
    .replace(
      /<title>.*?<\/title>/,
      "<title>" +
        escapeHTML(site.brand) +
        " — " +
        escapeHTML(id === "paperplane" ? site.headline : "Brief workspace") +
        "</title>",
    )
    .replace(
      /<h1 id="page-title">.*?<\/h1>/,
      '<h1 id="page-title">' + escapeHTML(site.headline) + "</h1>",
    )
    .replace(
      /<meta name="description" content="[^"]*">/,
      '<meta name="description" content="' +
        escapeHTML(site.description) +
        '">',
    );
  entries["public/styles.css"] =
    entries["public/styles.css"].toString() +
    `\n:root{--accent:${site.accent};--accent-hover:${site.accent}}\n`;
  if (id !== "paperplane") {
    entries["public/workspace.css"] = entries["public/styles.css"];
    entries["public/workspace.html"] = workspace;
    entries["public/index.html"] = renderPage(config);
    const assetFolder = isIndieTemplate(id) ? 'templates/indie' : 'templates/library';
    for (const file of await filesIn(
      path.join(PACKAGE_ROOT, assetFolder),
    )) {
      if (isIndieTemplate(id) && file.endsWith('.css') && !['styles.css', 'workspace-theme.css', `${id}.css`].includes(file)) continue;
      entries["public/" + file] = await fs.readFile(
        path.join(PACKAGE_ROOT, assetFolder, file),
      );
    }
    if (isIndieTemplate(id)) {
      entries['public/favicon.svg'] = indieFavicon(id);
      for (const file of Object.keys(entries).filter(file => file.endsWith('.html') && file !== 'public/index.html')) {
        entries[file] = entries[file].toString()
          .replace(/<body(?=[\s>])/, `<body class="template-${id}"`)
          .replace(/(<a class="brand"[^>]*>)<svg[\s\S]*?<\/svg>/g, '$1' + indieMark(id))
          .replace(/<link rel="icon" href="data:[^"]*">/g, '')
          .replace('<p>Turn a rough idea into a focused project brief. Write, shape, and share — without the blank-page feeling.</p>', `<p>${escapeHTML(site.description)}</p>`)
          .replace('</head>', '<link rel="stylesheet" href="/workspace-theme.css"></head>');
      }
    }
  } else {
    entries["public/index.html"] = workspace;
    entries["public/workspace.html"] = workspace;
  }
  entries["public/site-config.js"] =
    "export const siteConfig = " +
    JSON.stringify({
      ...site,
      mode: config.payments.mode,
      price,
      product,
    }).replace(/</g, "\\u003c") +
    ";\n";
  entries["worker.mjs"] = entries["worker.mjs"]
    .toString()
    .replace(
      "{ sku: 'starter', amount: 1900, currency: 'usd' }",
      JSON.stringify(product),
    );
  if (config.payments.mode === "none")
    for (const file of Object.keys(entries))
      if (file.startsWith("migrations/") || file === ".dev.vars.example")
        delete entries[file];
  if (config.deploy.provider !== "cloudflare") {
    delete entries["worker.mjs"];
    for (const file of Object.keys(entries))
      if (file.startsWith("migrations/") || file === ".dev.vars.example")
        delete entries[file];
    if (config.deploy.provider === "vercel") {
      entries["vercel.json"] =
        JSON.stringify(
          {
            $schema: "https://openapi.vercel.sh/vercel.json",
            framework: null,
            buildCommand: "",
            installCommand: "",
            outputDirectory: "public",
            cleanUrls: false,
          },
          null,
          2,
        ) + "\n";
      entries[".dev.vars.example"] =
        "VERCEL_TOKEN=\nVERCEL_PROJECT_ID=\nVERCEL_TEAM_ID=\n";
    }
  }
  return entries;
}
