import type { TestContext } from 'node:test';
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  create,
  configure,
  design,
  doctor,
  scaffold,
  verify,
} from "../src/workflows.mjs";
import { designStatus } from "../src/design.mjs";
import { fingerprint } from "../src/core.mjs";

async function fixture(t: TestContext) {
  const root = await fs.mkdtemp(
    path.join(await fs.realpath(os.tmpdir()), "opc-design-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

async function read(root: string, relative: string) {
  return fs.readFile(path.join(root, relative), "utf8");
}

async function write(root: string, relative: string, content: string) {
  await fs.mkdir(path.dirname(path.join(root, relative)), { recursive: true });
  await fs.writeFile(path.join(root, relative), content);
}

test("scaffolding locks the selected design and ignores configuration files", async (t) => {
  const root = await fixture(t);
  await create(root, {
    name: "design-lock",
    template: "portfolio",
    stack: "static",
    payment: "none",
  });
  const lock = JSON.parse(await read(root, ".opc/design-lock.json"));
  assert.equal(lock.schemaVersion, 1);
  assert.equal(lock.template, "portfolio");
  assert.ok(Object.keys(lock.files).includes("public/index.html"));
  assert.ok(Object.keys(lock.files).includes("public/styles.css"));
  assert.ok(!Object.keys(lock.files).some((file) => file.endsWith("site-config.js")));
  const status = await design(root);
  assert.equal(status.locked, true);
  assert.equal(status.ok, true);
  assert.deepEqual(status.drifted, []);
});

test("content, brand, accent and site-config edits are not design drift", async (t) => {
  const root = await fixture(t);
  await create(root, {
    name: "design-content",
    template: "paperplane",
    stack: "static",
    payment: "none",
  });
  await configure(root, { brand: "North Star", headline: "Small sites." });
  const html = await read(root, "public/index.html");
  await write(root, "public/index.html", html.replace("Small sites.", "Different words."));
  const css = await read(root, "public/styles.css");
  const accent = /:root\{--accent:#[0-9a-f]{6};--accent-hover:#[0-9a-f]{6}\}/i;
  assert.ok(accent.test(css), "generated styles carry the configured accent");
  await write(
    root,
    "public/styles.css",
    css.replace(accent, ":root{--accent:#123456;--accent-hover:#123456}"),
  );
  await write(root, "public/site-config.js", "export const siteConfig = { brand: 'Changed' };\n");
  const status = await designStatus(root);
  assert.equal(status.ok, true, JSON.stringify(status.drifted));
});

test("layout, style and behavior changes are reported as design drift", async (t) => {
  const root = await fixture(t);
  await create(root, {
    name: "design-drift",
    template: "portfolio",
    stack: "static",
    payment: "none",
  });
  const html = await read(root, "public/index.html");
  await write(
    root,
    "public/index.html",
    html.replace("</main>", '<section class="unexpected"><h2>Extra</h2></section></main>'),
  );
  const status = await design(root);
  assert.equal(status.ok, false);
  assert.deepEqual(status.drifted, [
    { file: "public/index.html", reason: "modified" },
  ]);
  await write(root, "public/extra.css", "body { background: #000; }\n");
  const added = await designStatus(root);
  assert.equal(added.ok, false);
  assert.ok(
    added.drifted.some(
      (item) => item.file === "public/extra.css" && item.reason === "added",
    ),
  );
  const accepted = await design(root, { accept: true });
  assert.equal(accepted.ok, true);
  assert.equal((await designStatus(root)).ok, true);
});

test("switching templates refreshes the lock intentionally", async (t) => {
  const root = await fixture(t);
  await create(root, {
    name: "design-switch",
    template: "portfolio",
    stack: "static",
    payment: "none",
  });
  await configure(root, { template: "docs" });
  const lock = JSON.parse(await read(root, ".opc/design-lock.json"));
  assert.equal(lock.template, "docs");
  assert.equal((await designStatus(root)).ok, true);
});

test("re-scaffolding an unchanged project keeps the design lock valid", async (t) => {
  const root = await fixture(t);
  await create(root, {
    name: "design-rescaffold",
    template: "docs",
    stack: "static",
    payment: "none",
  });
  await scaffold(root);
  const status = await designStatus(root);
  assert.equal(status.ok, true);
  assert.equal(status.template, "docs");
});

test("doctor reports a preserved design and a drifted design together", async (t) => {
  const root = await fixture(t);
  await create(root, {
    name: "design-doctor",
    template: "studio",
    stack: "static",
    payment: "none",
  });
  const healthy = await doctor(root);
  assert.equal(healthy.checks.find((item) => item.name === "design-preserved")!.pass, true);
  await write(root, "public/extra.js", "export const changed = true;\n");
  const drifted = await doctor(root);
  assert.equal(drifted.ok, false);
  const check = drifted.checks.find((item) => item.name === "design-preserved");
  assert.equal(check!.pass, false);
  assert.ok(check!.drifted!.some((item) => item.file === "public/extra.js"));
});

test("static verification fails when the chosen design was replaced", async (t) => {
  const root = await fixture(t);
  await create(root, {
    name: "design-verify",
    template: "docs",
    stack: "static",
    payment: "none",
  });
  const html = await read(root, "public/index.html");
  await write(root, "public/index.html", html.replace("<main", '<main class="replaced"'));
  const buildId = await fingerprint(root);
  const original = globalThis.fetch;
  globalThis.fetch = async (target) => {
    const url = String(target);
    if (url.endsWith("/opc-build.json"))
      return Response.json({
        name: "design-verify",
        mode: "none",
        provider: "static",
        buildId,
      });
    if (url.endsWith("/styles.css")) return new Response("a".repeat(200));
    return new Response("<title>Design</title><main>Content</main>");
  };
  try {
    const result = await verify(root, { url: "https://design-verify.example" });
    assert.equal(result.ok, false);
    const check = result.checks.find((item) => item.name === "design-preserved");
    assert.equal(check!.pass, false);
    assert.equal(check!.drifted![0].file, "public/index.html");
  } finally {
    globalThis.fetch = original;
  }
});

test("commands outside a project explain how to start one", async (t) => {
  const root = await fixture(t);
  await assert.rejects(design(root), { code: "PROJECT_NOT_FOUND" });
});
