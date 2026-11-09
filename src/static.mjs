import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import {
  configAt,
  fail,
  filesIn,
  safePath,
  exists,
  fingerprint,
  evidence,
  readJSON,
  writeJSON,
  managedWrite,
} from "./core.mjs";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
};
export async function staticBuild(root) {
  const c = await configAt(root);
  if (c.payments.mode !== "none")
    fail("Static output cannot include paid checkout.", "INCOMPATIBLE_MODULES");
  const buildId = await fingerprint(root),
    entries = {};
  for (const file of await filesIn(path.join(root, "public"))) {
    if (
      file.split("/").some((part) => part.startsWith(".")) ||
      /\.(?:env|pem|key|sqlite|db)$/i.test(file)
    )
      fail(
        "Private files must not be placed in public/.",
        "UNSAFE_PUBLIC_FILE",
      );
    entries["public/" + file] = await fs.readFile(
      await safePath(root, "public/" + file),
    );
  }
  if (!entries["public/index.html"])
    fail("Run scaffold first.", "MISSING_SCAFFOLD");
  entries["public/opc-build.json"] =
    JSON.stringify({
      name: c.name,
      buildId,
      mode: "none",
      provider: c.deploy.provider,
    }) + "\n";
  entries["vercel.json"] =
    JSON.stringify({
      $schema: "https://openapi.vercel.sh/vercel.json",
      framework: null,
      buildCommand: "",
      installCommand: "",
      outputDirectory: "public",
      cleanUrls: false,
    }) + "\n";
  const bytes = Object.values(entries).reduce(
    (sum, v) => sum + Buffer.byteLength(v),
    0,
  );
  if (bytes > 4_000_000)
    fail(
      "This inline static deployment adapter supports up to 4 MB. Export larger sites for direct hosting.",
      "STATIC_SIZE_LIMIT",
    );
  const directory = path.join(root, ".opc/build/vercel");
  await managedWrite(directory, entries);
  return { buildId, entries, directory, bytes };
}
export async function staticDev(root, opts = {}) {
  const c = await configAt(root),
    port = Number(opts.port || 8787);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    fail("port must be 1024–65535.", "INVALID_ARGUMENT");
  const publicRoot = path.join(root, "public");
  if (!(await exists(path.join(publicRoot, "index.html"))))
    fail("Run scaffold first.", "MISSING_SCAFFOLD");
  const server = http.createServer(async (req, res) => {
    try {
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      const url = new URL(req.url, "http://localhost");
      let body, type;
      if (url.pathname === "/opc-build.json") {
        body = JSON.stringify({
          name: c.name,
          mode: "none",
          provider: c.deploy.provider,
          buildId: await fingerprint(root),
        });
        type = types[".json"];
      } else {
        const file =
          decodeURIComponent(url.pathname) === "/"
            ? "index.html"
            : decodeURIComponent(url.pathname).slice(1);
        if (
          file.split("/").some((x) => x.startsWith(".")) ||
          file.includes("\\")
        ) {
          res.writeHead(404);
          res.end();
          return;
        }
        const full = await safePath(publicRoot, file);
        body = await fs.readFile(full);
        type = types[path.extname(full)] || "application/octet-stream";
      }
      res.writeHead(200, {
        "content-type": type,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  console.log(
    JSON.stringify({
      ok: true,
      url: `http://127.0.0.1:${port}`,
      scope: "static-local",
      provider: c.deploy.provider,
    }),
  );
  return server;
}
function origin(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    fail("Provide an HTTP(S) origin with --url.", "INVALID_ARGUMENT");
  }
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/"
  )
    fail(
      "Use an HTTP(S) origin without a path, credentials or query.",
      "INVALID_ARGUMENT",
    );
  return u.origin;
}
export async function staticVerify(root, opts = {}) {
  const c = await configAt(root),
    url = origin(opts.url),
    checks = [],
    buildId = await fingerprint(root);
  try {
    const get = async (p) =>
      fetch(url + p, { signal: AbortSignal.timeout(15000), redirect: "error" });
    const r = await get("/opc-build.json"),
      identity = await r.json();
    checks.push({
      name: "project-identity",
      pass:
        r.ok &&
        identity.name === c.name &&
        identity.mode === "none" &&
        identity.provider === c.deploy.provider,
    });
    checks.push({
      name: "deployment-build-identity",
      pass: identity.buildId === buildId,
    });
    const page = await get("/"),
      html = await page.text();
    checks.push({
      name: "page-content",
      pass:
        page.ok &&
        /<main[\s>]/.test(html) &&
        /<title>[^<]+<\/title>/.test(html),
    });
    const css = await get("/styles.css");
    checks.push({
      name: "styles",
      pass: css.ok && (await css.text()).length > 100,
    });
  } catch {
    checks.push({
      name: "reachable-with-public-access",
      pass: false,
      action:
        "Check the URL, build identity and provider deployment protection. Authentication walls do not count as verification.",
    });
  }
  return evidence(root, "http", {
    ok: checks.every((x) => x.pass),
    scope: "static-http-smoke",
    url,
    buildId,
    checks,
    limitations: ["Browser interaction and visual checks remain separate."],
  });
}
async function deploymentVars(root) {
  const file = await safePath(root, ".dev.vars");
  let local = {};
  if (await exists(file))
    local = Object.fromEntries(
      (await fs.readFile(file, "utf8")).split(/\r?\n/).flatMap((line) => {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
        return m ? [[m[1], m[2].replace(/^(['"])(.*)\1$/, "$2")]] : [];
      }),
    );
  return Object.fromEntries(
    ["VERCEL_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_TEAM_ID"].map((k) => [
      k,
      process.env[k] || local[k],
    ]),
  );
}
export async function vercelDeploy(root, opts = {}, { fetcher = fetch } = {}) {
  const c = await configAt(root),
    build = await staticBuild(root);
  if (opts["reuse-database-from"])
    fail(
      "Static Vercel projects have no payment database.",
      "INCOMPATIBLE_MODULES",
    );
  if (opts["dry-run"])
    return evidence(root, "package", {
      ok: true,
      scope: "vercel-static-build",
      directory: build.directory,
      buildId: build.buildId,
      files: Object.keys(build.entries),
      bytes: build.bytes,
      note: "Local static package only. No account request or remote deployment was made.",
    });
  const vars = await deploymentVars(root),
    {
      VERCEL_TOKEN: token,
      VERCEL_PROJECT_ID: projectId,
      VERCEL_TEAM_ID: teamId,
    } = vars;
  if (
    !token ||
    !/^prj_[a-zA-Z0-9]+$/.test(projectId || "") ||
    (teamId && !/^team_[a-zA-Z0-9]+$/.test(teamId))
  )
    fail(
      "Set VERCEL_TOKEN and VERCEL_PROJECT_ID for your chosen project. Team projects also require VERCEL_TEAM_ID. Keep them in the environment or .dev.vars.",
      "AUTH_REQUIRED",
    );
  const call = async (route, method = "GET", body) => {
    const u = new URL(route, "https://api.vercel.com");
    if (teamId) u.searchParams.set("teamId", teamId);
    let response;
    try {
      response = await fetcher(u, {
        method,
        headers: {
          authorization: "Bearer " + token,
          "content-type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30000),
        redirect: "error",
      });
    } catch {
      fail(
        "Vercel did not return a confirmed response. Inspect the saved deployment intent before retrying.",
        "REMOTE_RESPONSE",
      );
    }
    let value;
    try {
      value = await response.json();
    } catch {
      fail("Vercel returned an invalid response.", "REMOTE_RESPONSE");
    }
    if (!response.ok)
      fail(
        `Vercel request failed (${response.status}). Check account access, project scope and provider logs.`,
        "VERCEL_REQUEST_FAILED",
      );
    return value;
  };
  const lock = await safePath(root, ".opc/deploy.lock");
  let handle;
  try {
    handle = await fs.open(lock, "wx", 0o600);
  } catch (e) {
    if (e.code === "EEXIST")
      fail(
        "Another deployment may be running. Check .opc/deploy.lock.",
        "DEPLOYMENT_LOCKED",
      );
    throw e;
  }
  await handle.writeFile(
    JSON.stringify({ pid: process.pid, at: new Date().toISOString() }),
  );
  await handle.close();
  try {
    const project = await call("/v9/projects/" + encodeURIComponent(projectId));
    if (project.id !== projectId || (teamId && project.accountId !== teamId))
      fail(
        "Vercel project identity does not match the selected scope.",
        "REMOTE_CONFLICT",
      );
    const file = ".opc/vercel-deployment.json",
      prior = await readJSON(path.join(root, file), null);
    if (
      prior &&
      (prior.projectId !== projectId || prior.teamId !== (teamId || null))
    )
      fail(
        "Deployment account/project differs from this project record.",
        "REMOTE_CONFLICT",
      );
    if (prior?.status === "uploading" && !prior.deploymentId)
      fail(
        "An earlier upload has an uncertain outcome. Inspect Vercel deployments and reconcile .opc/vercel-deployment.json before creating another preview.",
        "DEPLOYMENT_UNCERTAIN",
      );
    let record = prior,
      remote;
    if (prior?.deploymentId && prior.buildId === build.buildId) {
      remote = await call(
        "/v13/deployments/" + encodeURIComponent(prior.deploymentId),
      );
    } else {
      record = {
        schemaVersion: 1,
        projectId,
        teamId: teamId || null,
        buildId: build.buildId,
        releaseId: crypto.randomUUID(),
        status: "uploading",
      };
      await writeJSON(root, file, record);
      remote = await call("/v13/deployments", "POST", {
        name: c.name,
        project: projectId,
        files: Object.entries(build.entries).map(([file, data]) => ({
          file,
          data: Buffer.from(data).toString("base64"),
          encoding: "base64",
        })),
        projectSettings: {
          framework: null,
          buildCommand: "",
          installCommand: "",
          outputDirectory: "public",
        },
        meta: { opcBuildId: build.buildId, opcReleaseId: record.releaseId },
      });
      if (!/^dpl_[a-zA-Z0-9]+$/.test(remote.id || ""))
        fail(
          "Vercel upload was not confirmed. Saved intent requires inspection.",
          "DEPLOYMENT_UNCERTAIN",
        );
      record.deploymentId = remote.id;
      record.status = "building";
      await writeJSON(root, file, record);
    }
    // One bounded observation. Re-running resumes this exact deployment instead of uploading again.
    if (remote.readyState !== "READY")
      remote = await call(
        "/v13/deployments/" + encodeURIComponent(record.deploymentId),
      );
    if (
      remote.projectId !== projectId ||
      remote.meta?.opcBuildId !== build.buildId ||
      remote.meta?.opcReleaseId !== record.releaseId
    )
      fail(
        "Vercel deployment identity differs from the saved upload.",
        "REMOTE_CONFLICT",
      );
    if (
      typeof remote.url !== "string" ||
      !/^[a-z0-9.-]+\.vercel\.app$/.test(remote.url)
    )
      fail("Vercel did not return a valid preview URL.", "REMOTE_RESPONSE");
    const url = "https://" + remote.url;
    record.status = remote.readyState;
    record.url = url;
    await writeJSON(root, file, record);
    if (remote.readyState !== "READY")
      return evidence(root, "deployment", {
        ok: false,
        status: remote.readyState,
        scope: "vercel-preview",
        url,
        buildId: build.buildId,
        action:
          "Run deploy again to resume and verify this deployment; no duplicate upload will be made.",
      });
    const verification = await staticVerify(root, { url });
    return evidence(root, "deployment", {
      ok: verification.ok,
      status: verification.ok ? "remote-verified" : "deployed-unverified",
      scope: "vercel-preview",
      url,
      buildId: build.buildId,
      verification,
    });
  } finally {
    await fs.rm(lock, { force: true });
  }
}
