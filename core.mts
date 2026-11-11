import type { Entries, Hashes, ProjectConfig, EvidenceResult, EvidenceRecord, EvidenceState, Manifest } from './types.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { templateById } from './catalog.mjs';
import { stackById } from './modules.mjs';
export const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const VERSION = '0.6.1';
export const ZERO_ID = '00000000-0000-0000-0000-000000000000';
export class HarnessError extends Error {
  constructor(message: string, public code = 'OPC_ERROR', public details?: unknown) { super(message); }
}
export function fail(message: string, code = 'OPC_ERROR', details?: unknown): never { throw new HarnessError(message, code, details); }
export function errorInfo(error: unknown): {message: string; code?: string; details?: unknown; exitCode?: number} {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  return { message: error instanceof Error ? error.message : String(error), ...(typeof value.code === 'string' ? {code:value.code}:{}), ...(value.details === undefined ? {} : {details:value.details}), ...(typeof value.exitCode === 'number' ? {exitCode:value.exitCode}:{}) };
}
export function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export const digest = (value: string | NodeJS.ArrayBufferView) => crypto.createHash('sha256').update(value).digest('hex');
export async function exists(p: string | URL) { try { await fs.lstat(p); return true; } catch (e) { if (errorInfo(e).code === 'ENOENT') return false; throw e; } }
export async function readJSON<T = unknown>(p: string, fallback?: T): Promise<T> { try { return JSON.parse(await fs.readFile(p, 'utf8')) as T; } catch (e) { if (errorInfo(e).code === 'ENOENT' && fallback !== undefined) return fallback; fail(`Cannot read JSON ${p}: ${errorInfo(e).message}`, 'INVALID_JSON'); } }
export async function safePath(root: string, relative: string) {
  const full = path.resolve(root, relative); const rel = path.relative(path.resolve(root), full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) fail(`Path escapes project: ${relative}`, 'UNSAFE_PATH');
  let current = path.resolve(root);
  // Check every ancestor, including the selected root: managed writes never follow symlinks.
  const ancestors = []; for (let p = current; ; p = path.dirname(p)) { ancestors.push(p); if (path.dirname(p) === p) break; }
  for (const p of ancestors) if (await exists(p) && (await fs.lstat(p)).isSymbolicLink()) fail(`Symlink in managed path: ${p}. Use the resolved real path instead (for example /private/tmp on macOS).`, 'UNSAFE_PATH');
  for (const part of rel.split(path.sep).filter(Boolean)) { current = path.join(current, part); if (await exists(current) && (await fs.lstat(current)).isSymbolicLink()) fail(`Symlink in managed path: ${current}. Use the resolved real path instead.`, 'UNSAFE_PATH'); }
  return full;
}
export async function write(root: string, relative: string, content: string | Uint8Array) { const dest = await safePath(root, relative); await fs.mkdir(path.dirname(dest), { recursive: true }); await fs.writeFile(dest, content); }
export async function writeJSON(root: string, relative: string, value: unknown) { await write(root, relative, JSON.stringify(value, null, 2) + '\n'); }
export async function filesIn(dir: string, prefix = ''): Promise<string[]> { const out: string[] = []; if (!await exists(dir)) return out; for (const d of (await fs.readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) { if (d.isSymbolicLink()) fail(`Symlink in source: ${d.name}`, 'UNSAFE_PATH'); const rel = path.posix.join(prefix, d.name); if (d.isDirectory()) out.push(...await filesIn(path.join(dir,d.name),rel)); else if (d.isFile()) out.push(rel); } return out; }
export function validateConfig(value: unknown): ProjectConfig {
  if (!isRecord(value)) fail('Project configuration must be an object.', 'INVALID_CONFIG');
  if (value.schemaVersion !== 1 || typeof value.name !== 'string' || !/^[a-z][a-z0-9-]{2,45}$/.test(value.name)) fail('Project requires schemaVersion 1 and a 3–46 character lowercase slug.', 'INVALID_CONFIG');
  const {payments, deploy, design, site} = value;
  if (!isRecord(payments) || typeof payments.mode !== 'string' || !['none','demo','stripe_test'].includes(payments.mode)) fail('payments.mode must be none, demo or stripe_test.', 'INVALID_CONFIG');
  if (!isRecord(deploy) || typeof deploy.provider !== 'string') fail('deploy.provider must be cloudflare, vercel or static.', 'INVALID_CONFIG');
  const stack = stackById(deploy.provider);
  if (!stack) fail('deploy.provider must be cloudflare, vercel or static.', 'INVALID_CONFIG');
  if (!stack.payments.some(mode => mode === payments.mode)) fail('This stack supports free sites only. Choose Cloudflare for demo or Stripe test checkout.', 'INCOMPATIBLE_MODULES');
  if (!isRecord(design) || design.preset !== 'editorial') fail('design.preset must be editorial; select a layout with design.template.', 'INVALID_CONFIG');
  if (design.template !== undefined && (typeof design.template !== 'string' || !templateById(design.template))) fail('Unknown design.template. Run opc templates.', 'INVALID_CONFIG');
  if (site !== undefined) {
    if (!isRecord(site)) fail('site must be an object.', 'INVALID_CONFIG');
    if (Object.keys(site).some(k => !['brand','headline','description','contactEmail','accent','items','event'].includes(k))) fail('Unknown site field. Site content is public; keep credentials in environment variables.', 'INVALID_CONFIG');
    for (const key of ['brand','headline','description','contactEmail']) {
      const text = site[key];
      if (text !== undefined && (typeof text !== 'string' || !text.trim() || text.length > 1000 || /[\u0000-\u001f]/.test(text))) fail(`Invalid site.${key}.`, 'INVALID_CONFIG');
    }
    if (site.accent !== undefined && (typeof site.accent !== 'string' || !/^#[a-f0-9]{6}$/i.test(site.accent))) fail('site.accent must be a six-digit hex color.', 'INVALID_CONFIG');
    if (site.contactEmail !== undefined && (typeof site.contactEmail !== 'string' || !/^[\w.+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(site.contactEmail))) fail('site.contactEmail must be an email address.', 'INVALID_CONFIG');
    if (site.items !== undefined) {
      if (!Array.isArray(site.items) || !site.items.length || site.items.length > 100) fail('site.items requires 1–100 named items with category and description.', 'INVALID_CONFIG');
      for (const item of site.items as unknown[]) {
        if (!isRecord(item) || ['name','category','description'].some(key => {const text = item[key];return typeof text !== 'string' || !text.trim() || text.length > 5000;})) fail('site.items requires 1–100 named items with category and description.', 'INVALID_CONFIG');
        if (item.url !== undefined) {
          if (typeof item.url !== 'string') fail('Item URLs must be absolute HTTPS addresses.', 'INVALID_CONFIG');
          let url: URL;
          try {url = new URL(item.url);} catch {fail('Item URLs must be absolute HTTPS addresses.', 'INVALID_CONFIG');}
          if (url.protocol !== 'https:' || url.username || url.password) fail('Item URLs must be HTTPS without credentials.', 'INVALID_CONFIG');
        }
      }
    }
    if (site.event !== undefined) {
      const event = site.event;
      if (!isRecord(event) || typeof event.startsAt !== 'string' || typeof event.endsAt !== 'string' || !Number.isFinite(Date.parse(event.startsAt)) || !Number.isFinite(Date.parse(event.endsAt)) || Date.parse(event.endsAt) <= Date.parse(event.startsAt) || typeof event.location !== 'string' || !event.location.trim() || event.location.length > 300) fail('site.event requires valid startsAt and endsAt timestamps and a location.', 'INVALID_CONFIG');
    }
  }
  if (payments.product !== undefined) {
    const product = payments.product;
    if (!isRecord(product) || (product.sku !== undefined && product.sku !== 'starter') || typeof product.amount !== 'number' || !Number.isSafeInteger(product.amount) || product.amount < 50 || product.amount > 99999999 || typeof product.currency !== 'string' || !['usd','eur','gbp','cny','jpy','cad','aud'].includes(product.currency)) fail('Set a product amount in minor units (50–99999999) and a supported lowercase currency.', 'INVALID_CONFIG');
  }
  if (deploy.tier !== 'preview') fail('Automated deployment supports previews only.', 'INVALID_CONFIG');
  // Only this validated JSON boundary promotes unknown input to a project contract.
  return value as unknown as ProjectConfig;
}
export async function configAt(root: string) {
  await safePath(root,'.opc/project.json');
  const file = path.join(root,'.opc/project.json');
  if (!await exists(file)) fail(`No OPC project found at ${root}. Run "node .opc/runtime/bin/opc.mjs create" (or "init") in a new directory, or run this command from the generated project root.`,'PROJECT_NOT_FOUND');
  return validateConfig(await readJSON(file));
}
export async function managedWrite(root: string, entries: Entries, {expected={}}: {expected?: Hashes}={}) {
  const manifestFile = '.opc/managed-files.json'; await safePath(root,manifestFile);
  const manifest = await readJSON<Manifest>(path.join(root,manifestFile), { schemaVersion: 1, files: {} });
  const conflicts = [];
  for (const [rel, content] of Object.entries(entries)) {
    const dest = await safePath(root,rel);
    if (await exists(dest)) { const current = digest(await fs.readFile(dest)); if (current !== digest(content) && current !== manifest.files[rel] && current !== expected[rel]) conflicts.push(rel); }
  }
  if (conflicts.length) fail('Existing files contain user changes; no managed files were overwritten.', 'FILE_CONFLICT', { files: conflicts });
  for (const [rel,content] of Object.entries(entries)) { await write(root,rel,content); manifest.files[rel] = digest(content); }
  await writeJSON(root,manifestFile,manifest);
}
export async function fingerprint(root: string) {
  const names = ['.opc/project.json','.opc/design-brief.md','wrangler.jsonc','vercel.json','worker.mjs', ... (await filesIn(path.join(root,'public'))).map(x=>'public/'+x), ...(await filesIn(path.join(root,'migrations'))).map(x=>'migrations/'+x), ...(await filesIn(path.join(root,'lib'))).map(x=>'lib/'+x)];
  const h = crypto.createHash('sha256');
  for (const rel of [...new Set(names)].sort()) { await safePath(root,rel); h.update(rel+'\0'); h.update(await exists(path.join(root,rel)) ? await fs.readFile(path.join(root,rel)) : '<missing>'); }
  return h.digest('hex');
}
export async function evidence<T extends EvidenceResult>(root: string, kind: string, result: T): Promise<EvidenceRecord & T> {
  const record = { schemaVersion: 1, kind, harnessVersion: VERSION, nodeVersion: process.versions.node, at: new Date().toISOString(), fingerprint: await fingerprint(root), ...result };
  const id = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${kind}.json`;
  await writeJSON(root,`.opc/evidence/${id}`,record);
  const state = await readJSON<EvidenceState>(path.join(root,'.opc/state.json'),{ schemaVersion:1, capabilities:{} });
  state.capabilities[kind] = { ...record, evidence: `.opc/evidence/${id}` }; state.updatedAt = record.at;
  await writeJSON(root,'.opc/state.json',state); return record;
}
export function redact(s: unknown) {
  let value = String(s).replace(/\b(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9_]+\b/g,'[REDACTED_STRIPE_KEY]').replace(/\bwhsec_[A-Za-z0-9_]+\b/g,'[REDACTED_WEBHOOK_SECRET]');
  for (const [k,v] of Object.entries(process.env)) if (/TOKEN|SECRET|PASSWORD|API_KEY/.test(k) && v && v.length > 5) value = value.split(v).join('[REDACTED]');
  return value;
}
