import type { Entries, Options } from './types.mjs';
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
export async function previewEntries() {
  const ordered = FRONTENDS.flatMap((f) =>
    f.templates.map((id) => TEMPLATES.find((t) => t.id === id)!),
  );
  const catalog = {
    version: VERSION,
    createCommand: 'opc-harness',
    templates: TEMPLATES.map((t) => ({
      ...t,
      type: frontendFor(t.id)!.id,
      preview: "/templates/" + t.id + "/",
      references: REFERENCES[t.id] || [],
    })),
    frontends: FRONTENDS,
    stacks: STACKS,
    payments: PAYMENT_MODULES,
    recipes: RECIPES,
  };
  const entries: Entries = {};
  entries["catalog.json"] = JSON.stringify(catalog);
  entries["api/health"] = JSON.stringify({
    ok: true,
    mode: "preview",
    configured: false,
  });  for (const t of TEMPLATES) {
    const preview = await templateEntries({
      schemaVersion: 1,
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
  return { entries, ordered };
}


export async function studioEntries() {
  const entries: Entries = {};
  for (const file of ["index.html", "studio.css", "studio.js", "preview-apply.js"])
    entries[file] = await fs.readFile(
      path.join(PACKAGE_ROOT, "templates/studio", file),
    );
  return entries;
}

export async function galleryEntries() {
  const { entries } = await previewEntries();
  Object.assign(entries, await studioEntries());
  return entries;
}

export async function serveEntries(entries: Entries, opts: Options = {}, scope = "static-preview") {
  if (opts.out) {
    const directory = path.resolve(opts.out);
    await managedWrite(directory, entries);
    console.log(
      JSON.stringify({
        ok: true,
        directory,
        templates: TEMPLATES.length,
        scope: "static-site-export",
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
        new URL(req.url || "/", "http://localhost").pathname,
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
              ".woff2": "font/woff2",
              ".txt": "text/plain; charset=utf-8",
            }[extension] || "text/html; charset=utf-8";
    res.writeHead(200, {
      "content-type": type,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(body);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  console.log(
    JSON.stringify({
      ok: true,
      url: `http://127.0.0.1:${port}`,
      templates: TEMPLATES.length,
      scope,
    }),
  );
  return server;
}

export async function gallery(opts: Options = {}) {
  const entries = await galleryEntries();
  if (opts.out) return serveEntries(entries, opts, "static-gallery-export");
  // Run the same local runtime that rendered the preview, including unreleased
  // source builds. A static export never contains a local filesystem path.
  const catalog = JSON.parse(entries['catalog.json'].toString()) as { createCommand: string };
  const launcher = path.join(PACKAGE_ROOT, 'bin/opc.mjs');
  catalog.createCommand = 'node ' + "'" + launcher.replaceAll("'", "'\\''") + "'";
  entries['catalog.json'] = JSON.stringify(catalog);
  return serveEntries(entries, { port: opts.port || 8788 }, "module-studio");
}
