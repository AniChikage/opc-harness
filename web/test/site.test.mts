import type { TestContext } from 'node:test';
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { site, siteEntries } from "../src/site.mjs";
import { TEMPLATES } from "../../src/catalog.mjs";

async function fixture(t: TestContext) {
  const root = await fs.mkdtemp(
    path.join(await fs.realpath(os.tmpdir()), "opc-site-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("product site pairs a landing page with the studio and every preview", async () => {
  const entries = await siteEntries();
  const home = entries["index.html"].toString();
  assert.match(home, /<title>OPC Harness/);
  assert.match(home, /One sentence/);
  assert.match(home, /A finished website/);
  assert.match(home, /Codex \/ Claude Code alone/);
  assert.match(home, /With OPC Harness/);
  assert.match(home, /href="\/studio\/"/);
  assert.match(home, /href="\/studio\/\?template=portfolio"/);
  assert.ok(entries["studio/index.html"]);
  assert.match(entries["studio/index.html"].toString(), /Your build/);
  assert.ok(entries["site.css"]);
  assert.ok(entries["site.js"]);
  assert.ok(entries["catalog.json"]);
  for (const template of TEMPLATES) {
    assert.ok(
      entries[`templates/${template.id}/index.html`],
      `preview for ${template.id}`,
    );
    assert.ok(
      home.includes(`/studio/?template=${template.id}`),
      `catalogue link for ${template.id}`,
    );
  }
  assert.ok(!/\p{Script=Han}/u.test(home));
});

test("static site export writes a clean deployable folder", async (t) => {
  const root = await fixture(t);
  await site({ out: root });
  const home = await fs.readFile(path.join(root, "index.html"), "utf8");
  assert.match(home, /One sentence/);
  assert.match(home, /A finished website/);
  assert.match(home, /Codex \/ Claude Code alone/);
  assert.match(home, /With OPC Harness/);
  assert.ok(await fs.readFile(path.join(root, "studio/index.html")));
  assert.ok(await fs.readFile(path.join(root, "site.css")));
  assert.ok(await fs.readFile(path.join(root, "templates/portfolio/index.html")));
  await assert.rejects(fs.access(path.join(root, ".opc/managed-files.json")));
});


test("studio project names use a valid browser pattern and reject unsafe names", async () => {
  const html = (await siteEntries())["studio/index.html"].toString();
  const pattern = html.match(/id="project"[^>]*pattern="([^"]+)"/)?.[1];
  assert.ok(pattern);
  const expression = new RegExp('^(?:' + pattern + ')$', 'v');
  for (const name of ['my-website', 'typed-studio', 'abc', 'a'.repeat(46)]) assert.equal(expression.test(name), true);
  for (const name of ['ab', 'UPPER', '../outside', 'my site', 'a'.repeat(47)]) assert.equal(expression.test(name), false);
});
