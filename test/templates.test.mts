import type { TestContext } from 'node:test';
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { TEMPLATES } from "../src/catalog.mjs";
import {
  create,
  configure,
  inspect,
  preferences,
  exportSite,
  init,
  scaffold,
} from "../src/workflows.mjs";
import { handleRequest } from "../templates/paid-site/worker.mjs";
async function fixture(t: TestContext) {
  const p = await fs.mkdtemp(
    path.join(await fs.realpath(os.tmpdir()), "opc-templates-"),
  );
  t.after(() => fs.rm(p, { recursive: true, force: true }));
  return p;
}
for (const template of TEMPLATES)
  test(`complete ${template.id} template generates repeatably with both agent entries`, async (t) => {
    const root = await fixture(t);
    await create(root, {
      name: "template-test",
      template: template.id,
      brand: "North Star",
    });
    const first = await fs.readFile(
      path.join(root, "public/index.html"),
      "utf8",
    );
    assert.match(first, /<main[\s>]/);
    assert.ok(first.includes("North Star"));
    assert.ok(!/\p{Script=Han}/u.test(first));
    const info = await inspect(root);
    assert.deepEqual(info.hosts, { codex: true, claude: true });
    assert.equal(info.config.design.template, template.id);
    assert.equal(info.config.payments.mode, template.payment);
    const w = JSON.parse(
      await fs.readFile(path.join(root, "wrangler.jsonc"), "utf8"),
    );
    assert.equal(!!w.d1_databases, template.payment !== "none");
    await scaffold(root);
    assert.equal(
      await fs.readFile(path.join(root, "public/index.html"), "utf8"),
      first,
    );
    const copied = spawnSync(
      process.execPath,
      [
        path.join(root, ".opc/runtime/bin/opc.mjs"),
        "templates",
        "--template",
        template.id,
        "--json",
      ],
      { encoding: "utf8" },
    );
    assert.equal(copied.status, 0, copied.stderr);
    assert.equal(JSON.parse(copied.stdout).templates[0].id, template.id);
    for (const match of first.matchAll(
      /(?:href|src)="(\/[^"#]*)(?:#[^"]*)?"/g,
    )) {
      if (match[1] === "/") continue;
      await fs.access(path.join(root, "public", match[1].slice(1)));
    }
  });
test("template switch refuses edited pages before changing config or Worker settings", async (t) => {
  const root = await fixture(t);
  await create(root, { name: "template-test", template: "saas" });
  await fs.appendFile(
    path.join(root, "public/styles.css"),
    "\n/* user change */",
  );
  const config = await fs.readFile(
      path.join(root, ".opc/project.json"),
      "utf8",
    ),
    worker = await fs.readFile(path.join(root, "wrangler.jsonc"), "utf8");
  await assert.rejects(configure(root, { template: "portfolio" }), {
    code: "FILE_CONFLICT",
  });
  assert.equal(
    await fs.readFile(path.join(root, ".opc/project.json"), "utf8"),
    config,
  );
  assert.equal(
    await fs.readFile(path.join(root, "wrangler.jsonc"), "utf8"),
    worker,
  );
});
test("configuration changes brand, layout and payment mode together on untouched templates", async (t) => {
  const root = await fixture(t);
  await create(root, { name: "template-test", template: "paperplane" });
  await configure(root, {
    template: "directory",
    payment: "none",
    brand: "Useful Things",
    accent: "#6244ab",
  });
  const info = await inspect(root);
  assert.equal(info.config.site!.brand, "Useful Things");
  assert.equal(info.config.design.template, "directory");
  const w = JSON.parse(
    await fs.readFile(path.join(root, "wrangler.jsonc"), "utf8"),
  );
  assert.equal(w.vars.PAYMENT_MODE, "none");
  assert.equal(w.d1_databases, undefined);
  assert.match(
    await fs.readFile(path.join(root, "public/index.html"), "utf8"),
    /Useful Things/,
  );
});
test("invalid colors and template IDs fail before creating a project", async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    create(root, { name: "template-test", template: "missing" }),
    { code: "INVALID_CONFIG" },
  );
  await assert.rejects(
    create(root, { name: "template-test", accent: "red;display:none" }),
    { code: "INVALID_CONFIG" },
  );
  assert.deepEqual(await fs.readdir(root), []);
});
test("configured content is escaped in markup and embedded JSON", async (t) => {
  const root = await fixture(t),
    site = path.join(root, "site.json");
  await fs.writeFile(
    site,
    JSON.stringify({
      brand: "Safe <brand>",
      items: [
        {
          name: "</script><script>alert(1)</script>",
          category: "Guide",
          description: "<img src=x onerror=alert(1)>",
        },
      ],
    }),
  );
  await create(root, {
    name: "template-test",
    template: "docs",
    "site-config": site,
  });
  const html = await fs.readFile(path.join(root, "public/index.html"), "utf8");
  assert.ok(!html.includes("<script>alert"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("Safe &lt;brand&gt;"));
});
test("saved preferences apply to future projects and never mutate existing choices", async (t) => {
  const root = await fixture(t),
    profile = path.join(root, "profile.json"),
    one = path.join(root, "one"),
    two = path.join(root, "two");
  await preferences(root, {
    profile,
    template: "portfolio",
    payment: "none",
    brand: "One Studio",
  });
  await init(one, { name: "first-site", profile });
  await preferences(root, {
    profile,
    template: "docs",
    payment: "none",
    brand: "Field Guide",
  });
  await init(one, { name: "first-site", profile });
  await init(two, { name: "second-site", profile });
  assert.equal((await inspect(one)).config.design.template, "portfolio");
  assert.equal((await inspect(two)).config.design.template, "docs");
  assert.equal((await inspect(two)).config.site!.brand, "Field Guide");
  assert.ok(await fs.stat(profile + ".bak"));
});
test("free exports contain a complete static site; paid exports fail closed", async (t) => {
  const root = await fixture(t),
    site = path.join(root, "site"),
    out = path.join(root, "output");
  await create(site, { name: "template-test", template: "directory" });
  await exportSite(site, { out });
  assert.equal(
    await fs.readFile(path.join(site, "public/index.html"), "utf8"),
    await fs.readFile(path.join(out, "index.html"), "utf8"),
  );
  await configure(site, { payment: "demo" });
  await assert.rejects(
    exportSite(site, { out: path.join(root, "paid-output") }),
    { code: "INVALID_CONFIG" },
  );
});
test("free Worker health requires no database and all payment routes are disabled", async () => {
  const env = { APP_NAME: "free-template", PAYMENT_MODE: "none" };
  const health = await handleRequest(
    new Request("https://free.example/api/health"),
    env,
  );
  assert.equal(health.status, 200);
  assert.equal((await health.json()).mode, "none");
  for (const p of [
    "/api/checkout",
    "/api/demo/complete",
    "/api/webhooks/stripe",
    "/api/orders/example",
  ])
    assert.equal(
      (
        await handleRequest(
          new Request("https://free.example" + p, { method: "POST" }),
          env,
        )
      ).status,
      404,
    );
});
test("noninteractive runners receive a concrete error instead of hanging on a wizard", async (t) => {
  const root = await fixture(t);
  const cli = new URL("../bin/opc.mjs", import.meta.url);
  const result = spawnSync(
    process.execPath,
    [cli.pathname, "create", "--interactive", "--dir", root],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr).error, "TTY_REQUIRED");
  assert.deepEqual(await fs.readdir(root), []);
});

test("configured test pricing reaches the generated Worker and browser without manual edits", async (t) => {
  const root = await fixture(t);
  await create(root, {
    name: "priced-site",
    template: "store",
    amount: "2900",
    currency: "cny",
  });
  const worker = await import("node:url").then(
    ({ pathToFileURL }) =>
      import(pathToFileURL(path.join(root, "worker.mjs")).href),
  );
  assert.equal(worker.PRODUCT.amount, 2900);
  assert.equal(worker.PRODUCT.currency, "cny");
  const browser = await fs.readFile(
    path.join(root, "public/site-config.js"),
    "utf8",
  );
  assert.ok(browser.includes("2900"));
  assert.ok(browser.includes("cny"));
});
test("event dates and unsafe resource URLs are validated before writes", async (t) => {
  const root = await fixture(t),
    site = path.join(root, "site.json");
  await fs.writeFile(
    site,
    JSON.stringify({
      event: {
        startsAt: "2027-06-01T12:00:00Z",
        endsAt: "2027-06-01T15:00:00Z",
        location: "Remote",
      },
    }),
  );
  const project = path.join(root, "event");
  await create(project, {
    name: "summer-event",
    template: "event",
    "site-config": site,
  });
  assert.match(
    await fs.readFile(path.join(project, "public/index.html"), "utf8"),
    /June 1, 2027/,
  );
  await fs.writeFile(
    site,
    JSON.stringify({
      items: [
        {
          name: "Unsafe",
          category: "Example",
          description: "Rejected URL",
          url: "javascript:alert(1)",
        },
      ],
    }),
  );
  await assert.rejects(
    create(path.join(root, "invalid"), {
      name: "unsafe-site",
      template: "directory",
      "site-config": site,
    }),
    { code: "INVALID_CONFIG" },
  );
});
