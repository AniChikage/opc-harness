import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  create,
  configure,
  inspect,
  preferences,
  plan,
  paymentTest,
  exportSite,
} from "../src/workflows.mjs";
import { RECIPES, STACKS } from "../src/modules.mjs";
import { galleryEntries } from "../src/gallery.mjs";
import {
  staticBuild,
  staticDev,
  staticVerify,
  vercelDeploy,
} from "../src/static.mjs";
import { selectionOptions } from "../src/selection.mjs";
async function fixture(t) {
  const root = await fs.mkdtemp(
    path.join(await fs.realpath(os.tmpdir()), "opc-modules-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
for (const recipe of RECIPES)
  test(`recipe ${recipe.id} generates a compatible complete project`, async (t) => {
    const root = await fixture(t);
    await create(root, { name: "recipe-test", recipe: recipe.id });
    const i = await inspect(root),
      p = await plan(root);
    assert.equal(i.config.design.template, recipe.template);
    assert.equal(i.config.deploy.provider, recipe.stack);
    assert.equal(i.config.payments.mode, recipe.payment);
    assert.equal(p.modules.frontend.template, recipe.template);
    assert.ok(
      STACKS.find((s) => s.id === recipe.stack).payments.includes(
        recipe.payment,
      ),
    );
    const files = await fs.readdir(root);
    assert.equal(files.includes("worker.mjs"), recipe.stack === "cloudflare");
    assert.equal(
      files.includes("wrangler.jsonc"),
      recipe.stack === "cloudflare",
    );
    assert.equal(files.includes("vercel.json"), recipe.stack === "vercel");
    const html = await fs.readFile(
      path.join(root, "public/index.html"),
      "utf8",
    );
    assert.match(html, /<main[\s>]/);
  });
test("incompatible modules fail before the project is written", async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    create(root, {
      name: "rejected-site",
      template: "store",
      stack: "vercel",
      payment: "stripe_test",
    }),
    { code: "INCOMPATIBLE_MODULES" },
  );
  assert.deepEqual(await fs.readdir(root), []);
});
test("a downloaded project configuration preserves its design and explicit overrides", async (t) => {
  const root = await fixture(t),
    file = path.join(root, "project.json");
  await fs.writeFile(
    file,
    JSON.stringify({
      schemaVersion: 1,
      name: "imported-site",
      design: { preset: "editorial", template: "studio" },
      site: {
        brand: "Blue Studio",
        headline: "Useful things start here.",
        accent: "#245dca",
      },
      payments: { mode: "none" },
      deploy: { provider: "static", tier: "preview" },
    }),
  );
  const site = path.join(root, "site");
  await create(site, {
    "project-config": file,
    brand: "A second name",
    host: "both",
  });
  const i = await inspect(site);
  assert.equal(i.config.name, "imported-site");
  assert.equal(i.config.site.brand, "A second name");
  assert.equal(i.config.site.headline, "Useful things start here.");
  assert.equal(i.config.design.template, "studio");
  assert.equal(i.config.deploy.provider, "static");
  assert.equal(
    await fs
      .readFile(path.join(site, "public/index.html"), "utf8")
      .then((x) => x.includes("A second name")),
    true,
  );
  await assert.rejects(configure(site, { stack: "cloudflare" }), {
    code: "CONFIG_CONFLICT",
  });
});
test("new projects inherit a saved stack while explicit recipes override preferences", async (t) => {
  const root = await fixture(t),
    profile = path.join(root, "profile.json");
  await preferences(root, {
    profile,
    template: "docs",
    stack: "vercel",
    payment: "none",
  });
  const one = path.join(root, "one"),
    two = path.join(root, "two");
  await create(one, { name: "first-site", profile });
  await create(two, { name: "second-site", profile, recipe: "paid-tool" });
  assert.equal((await inspect(one)).config.deploy.provider, "vercel");
  assert.equal((await inspect(two)).config.deploy.provider, "cloudflare");
  assert.equal((await inspect(two)).config.payments.mode, "demo");
});
test("unknown recipes and secret-bearing top-level blueprint fields are rejected", async (t) => {
  await assert.rejects(selectionOptions({ recipe: "missing" }), {
    code: "INVALID_ARGUMENT",
  });
  const root = await fixture(t),
    file = path.join(root, "bad.json");
  await fs.writeFile(
    file,
    JSON.stringify({ STRIPE_SECRET_KEY: "placeholder" }),
  );
  await assert.rejects(selectionOptions({ "project-config": file }), {
    code: "INVALID_CONFIG",
  });
});
test("all gallery previews use exactly the generated source and asset paths", async () => {
  const entries = await galleryEntries(),
    catalog = JSON.parse(entries["catalog.json"]);
  assert.equal(catalog.templates.length, 11);
  for (const template of catalog.templates) {
    const prefix = "templates/" + template.id + "/";
    const html = entries[prefix + "index.html"].toString();
    assert.match(html, /<main[\s>]/);
    assert.ok(entries[prefix + "styles.css"]);
    for (const match of html.matchAll(
      /(?:href|src)="(\/templates\/[^"#]*)(?:#[^"]*)?"/g,
    )) {
      let file = match[1].slice(1);
      if (file.endsWith("/")) file += "index.html";
      assert.ok(entries[file], file);
    }
  }
});
test("static local serving exposes the current build identity and never private files", async (t) => {
  const root = await fixture(t);
  await create(root, { name: "static-test", recipe: "personal-admin" });
  const server = await staticDev(root, { port: 19968 });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const verification = await staticVerify(root, {
    url: "http://127.0.0.1:19968",
  });
  assert.equal(verification.ok, true);
  const privateResponse = await fetch(
    "http://127.0.0.1:19968/%2eopc/project.json",
  );
  assert.equal(privateResponse.status, 404);
  const b = await staticBuild(root);
  assert.equal(
    JSON.parse(b.entries["public/opc-build.json"]).buildId,
    b.buildId,
  );
  assert.equal(
    Object.keys(b.entries).some((x) => x.includes(".dev.vars")),
    false,
  );
});
const projectId = "prj_example123",
  token = "fixture-token",
  teamId = "team_example123";
async function vercelFixture(t) {
  const root = await fixture(t);
  await create(root, { name: "vercel-test", recipe: "bold-launch" });
  await fs.writeFile(
    path.join(root, ".dev.vars"),
    `VERCEL_TOKEN=${token}\nVERCEL_PROJECT_ID=${projectId}\nVERCEL_TEAM_ID=${teamId}\n`,
  );
  const requests = [];
  let uploaded,
    remoteState = "READY",
    wrongIdentity = false,
    loseUpload = false;
  const fetcher = async (url, opts = {}) => {
    const u = new URL(url);
    requests.push({ url: u.toString(), method: opts.method, body: opts.body });
    if (u.hostname === "api.vercel.com") {
      assert.equal(opts.headers.authorization, "Bearer " + token);
      assert.equal(u.searchParams.get("teamId"), teamId);
      if (u.pathname.startsWith("/v9/projects/"))
        return Response.json({ id: projectId, accountId: teamId });
      if (opts.method === "POST") {
        uploaded = JSON.parse(opts.body);
        assert.equal(uploaded.target, undefined);
        assert.equal(uploaded.project, projectId);
        assert.equal(opts.body.includes(token), false);
        assert.ok(
          uploaded.files.every(
            (x) => x.file.startsWith("public/") || x.file === "vercel.json",
          ),
        );
        if (loseUpload) throw new Error("response lost");
      }
      return Response.json({
        id: "dpl_fixture123",
        url: "vercel-test.example.vercel.app",
        projectId: wrongIdentity ? "prj_wrong" : projectId,
        meta: uploaded?.meta,
        readyState: remoteState,
      });
    }
    const name =
      u.pathname === "/" ? "public/index.html" : "public" + u.pathname;
    const file = uploaded.files.find((x) => x.file === name);
    return file
      ? new Response(Buffer.from(file.data, "base64"), {
          headers: {
            "content-type": u.pathname.endsWith(".json")
              ? "application/json"
              : "text/html",
          },
        })
      : new Response("Not found", { status: 404 });
  };
  const original = globalThis.fetch;
  globalThis.fetch = fetcher;
  t.after(() => {
    globalThis.fetch = original;
  });
  return {
    root,
    requests,
    fetcher,
    setState: (value) => (remoteState = value),
    setWrong: () => (wrongIdentity = true),
    setLost: () => (loseUpload = true),
  };
}
test("Vercel dry-run builds locally without authentication or remote requests", async (t) => {
  const root = await fixture(t);
  await create(root, { name: "vercel-test", recipe: "product-launch" });
  let called = false;
  const r = await vercelDeploy(
    root,
    { "dry-run": true },
    {
      fetcher: () => {
        called = true;
        throw Error("must not request");
      },
    },
  );
  assert.equal(r.ok, true);
  assert.equal(called, false);
});
test("Vercel uploads only static files to an explicit project and verifies actual build identity", async (t) => {
  const f = await vercelFixture(t),
    r = await vercelDeploy(f.root, {}, { fetcher: f.fetcher });
  assert.equal(r.ok, true);
  assert.equal(r.status, "remote-verified");
  await vercelDeploy(f.root, {}, { fetcher: f.fetcher });
  assert.equal(f.requests.filter((x) => x.method === "POST").length, 1);
});
test("Vercel resumes a building deployment and refuses a different returned identity", async (t) => {
  const f = await vercelFixture(t);
  f.setState("BUILDING");
  const first = await vercelDeploy(f.root, {}, { fetcher: f.fetcher });
  assert.equal(first.ok, false);
  assert.equal(first.status, "BUILDING");
  f.setState("READY");
  assert.equal(
    (await vercelDeploy(f.root, {}, { fetcher: f.fetcher })).ok,
    true,
  );
  assert.equal(f.requests.filter((x) => x.method === "POST").length, 1);
  f.setWrong();
  await assert.rejects(vercelDeploy(f.root, {}, { fetcher: f.fetcher }), {
    code: "REMOTE_CONFLICT",
  });
});
test("uncertain Vercel uploads retain their intent and never create duplicates automatically", async (t) => {
  const f = await vercelFixture(t);
  f.setLost();
  await assert.rejects(vercelDeploy(f.root, {}, { fetcher: f.fetcher }), {
    code: "REMOTE_RESPONSE",
  });
  await assert.rejects(vercelDeploy(f.root, {}, { fetcher: f.fetcher }), {
    code: "DEPLOYMENT_UNCERTAIN",
  });
  assert.equal(f.requests.filter((x) => x.method === "POST").length, 1);
});

test("disabled static payment checks still reject a different website identity", async (t) => {
  const root = await fixture(t);
  await create(root, { name: "static-identity", recipe: "personal-admin" });
  const original = globalThis.fetch;
  const methods = [];
  globalThis.fetch = async (_url, opts = {}) => {
    methods.push(opts.method || "GET");
    return Response.json({
      name: "another-project",
      mode: "none",
      provider: "static",
      buildId: "different",
    });
  };
  try {
    const result = await paymentTest(root, { url: "https://another.example" });
    assert.equal(result.ok, false);
    assert.equal(result.scope, "payments-disabled");
    assert.ok(
      result.checks.some((x) => x.name === "project-identity" && !x.pass),
    );
    assert.ok(methods.every((x) => x === "GET"));
  } finally {
    globalThis.fetch = original;
  }
});
test("portable exports carry the current source identity for later verification", async (t) => {
  const root = await fixture(t),
    site = path.join(root, "site"),
    out = path.join(root, "export");
  await create(site, { name: "portable-identity", recipe: "studio-site" });
  await exportSite(site, { out });
  const identity = JSON.parse(
    await fs.readFile(path.join(out, "opc-build.json"), "utf8"),
  );
  const build = await staticBuild(site);
  assert.equal(identity.name, "portable-identity");
  assert.equal(identity.provider, "static");
  assert.equal(identity.buildId, build.buildId);
});
