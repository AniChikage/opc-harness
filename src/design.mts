import type { Entries, DesignFile, DesignLock, DesignStatus } from './types.mjs';
import fs from "node:fs/promises";
import path from "node:path";
import {
  digest,
  exists,
  fail,
  filesIn,
  readJSON,
  safePath,
  writeJSON,
} from "./core.mjs";

const LOCK_FILE = ".opc/design-lock.json";
const DESIGN_FILE = /\.(?:html|css|js|svg|woff2)$/i;
// The rendered accent is configuration, not design. Normalize the injected
// custom property before hashing so brand color changes never count as drift.
const INJECTED_ACCENT =
  /:root\{--accent:#[0-9a-f]{6};--accent-hover:#[0-9a-f]{6}\}/gi;

function attributeParts(raw: string) {
  const names = [];
  const classes = [];
  let id = "";
  const attribute = /([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
  let match;
  while ((match = attribute.exec(String(raw ?? "")))) {
    const name = match[1].toLowerCase();
    const value = match[2] ? match[2].replace(/^["']|["']$/g, "") : "";
    if (name === "class") classes.push(...value.split(/\s+/).filter(Boolean));
    else if (name === "id") id = value;
    else names.push(name);
  }
  return {
    classes: [...new Set(classes)].sort().join("."),
    id,
    names: [...new Set(names)].sort().join(","),
  };
}

// A design signature keeps structure, class names, ids and attribute names.
// Text, attribute values and script/style bodies are content, not design, so
// they are intentionally excluded: editing copy never breaks the lock.
export function structuralSignature(html: string | Buffer) {
  const source = String(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, "$1$2")
    .replace(/(<style\b[^>]*>)[\s\S]*?(<\/style>)/gi, "$1$2");
  const tokens = [];
  const tag = /<(\/?)([a-zA-Z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let match;
  while ((match = tag.exec(source))) {
    const name = match[2].toLowerCase();
    if (match[1] === "/") {
      tokens.push("/" + name);
      continue;
    }
    const attributes = attributeParts(match[3]);
    tokens.push(
      `${name}|${attributes.classes}|${attributes.id}|${attributes.names}`,
    );
  }
  return tokens.join("\n");
}

export function designSignature(relative: string, content: string | Buffer) {
  if (/\.html$/i.test(relative))
    return digest(structuralSignature(content));
  if (/\.css$/i.test(relative))
    return digest(String(content).replace(INJECTED_ACCENT, ":root{--accent}"));
  if (/\.woff2$/i.test(relative)) return digest(content);
  return digest(String(content));
}

export function designSnapshot(entries: Entries) {
  const files: Record<string, DesignFile> = {};
  for (const [relative, content] of Object.entries(entries)) {
    if (!relative.startsWith("public/")) continue;
    if (path.posix.basename(relative) === "site-config.js") continue;
    if (!DESIGN_FILE.test(relative)) continue;
    files[relative] = {
      kind: relative.endsWith(".html")
        ? "structure"
        : relative.endsWith(".css")
          ? "style"
          : relative.endsWith('.woff2') ? 'asset' : "behavior",
      hash: designSignature(relative, content),
    };
  }
  return files;
}

async function designEntries(root: string) {
  const directory = path.join(root, "public");
  if (!(await exists(directory))) return {};
  const entries: Entries = {};
  for (const relative of await filesIn(directory)) {
    if (path.posix.basename(relative) === "site-config.js") continue;
    if (!DESIGN_FILE.test(relative)) continue;
    entries["public/" + relative] = await fs.readFile(
      path.join(directory, relative),
    );
  }
  return entries;
}

export async function readDesignLock(root: string) {
  await safePath(root, LOCK_FILE);
  return readJSON<DesignLock | null>(path.join(root, LOCK_FILE), null);
}

export async function designStatus(root: string): Promise<DesignStatus> {
  const lock = await readDesignLock(root);
  if (!lock || !lock.files || !Object.keys(lock.files).length)
    return {
      locked: false,
      ok: true,
      template: null,
      checked: 0,
      drifted: [],
      action:
        "No design lock recorded yet. Run scaffold, or `design --accept` after reviewing a deliberate design change.",
    };
  const current = designSnapshot(await designEntries(root));
  const drifted = [];
  for (const [relative, previous] of Object.entries(lock.files)) {
    if (!current[relative])
      drifted.push({ file: relative, reason: "removed" });
    else if (current[relative].hash !== previous.hash)
      drifted.push({ file: relative, reason: "modified" });
  }
  for (const relative of Object.keys(current))
    if (!lock.files[relative])
      drifted.push({ file: relative, reason: "added" });
  drifted.sort((a, b) => a.file.localeCompare(b.file));
  return {
    locked: true,
    ok: drifted.length === 0,
    template: lock.template || null,
    checked: Object.keys(lock.files).length,
    drifted,
    ...(drifted.length
      ? {
          action:
            "The generated site no longer matches the selected design. Restore the drifted files, or accept a deliberate redesign with `design --accept`.",
        }
      : {}),
  };
}

export async function acceptDesign(root: string, template?: string) {
  await safePath(root, LOCK_FILE);
  if (!(await exists(path.join(root, "public/index.html"))))
    fail("Run scaffold before accepting a design.", "MISSING_SCAFFOLD");
  const files = designSnapshot(await designEntries(root));
  if (!Object.keys(files).length)
    fail("No generated design files were found to lock.", "MISSING_SCAFFOLD");
  const previous = await readDesignLock(root);
  const resolved = template || previous?.template || "paperplane";
  await writeJSON(root, LOCK_FILE, {
    schemaVersion: 1,
    template: resolved,
    acceptedAt: new Date().toISOString(),
    files,
  });
  return { accepted: true, template: resolved, checked: Object.keys(files).length };
}
