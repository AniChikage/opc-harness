import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { templateById } from './catalog.mjs';
export const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const VERSION = '0.4.0';
export const ZERO_ID = '00000000-0000-0000-0000-000000000000';
export function fail(message, code = 'OPC_ERROR', details) { const e = new Error(message); e.code = code; e.details = details; throw e; }
export const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
export async function exists(p) { try { await fs.lstat(p); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
export async function readJSON(p, fallback) { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch (e) { if (e.code === 'ENOENT' && fallback !== undefined) return fallback; fail(`Cannot read JSON ${p}: ${e.message}`, 'INVALID_JSON'); } }
export async function safePath(root, relative) {
  const full = path.resolve(root, relative); const rel = path.relative(path.resolve(root), full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) fail(`Path escapes project: ${relative}`, 'UNSAFE_PATH');
  let current = path.resolve(root);
  // Check every ancestor, including the selected root: managed writes never follow symlinks.
  const ancestors = []; for (let p = current; ; p = path.dirname(p)) { ancestors.push(p); if (path.dirname(p) === p) break; }
  for (const p of ancestors) if (await exists(p) && (await fs.lstat(p)).isSymbolicLink()) fail(`Symlink in managed path: ${p}`, 'UNSAFE_PATH');
  for (const part of rel.split(path.sep).filter(Boolean)) { current = path.join(current, part); if (await exists(current) && (await fs.lstat(current)).isSymbolicLink()) fail(`Symlink in managed path: ${current}`, 'UNSAFE_PATH'); }
  return full;
}
export async function write(root, relative, content) { const dest = await safePath(root, relative); await fs.mkdir(path.dirname(dest), { recursive: true }); await fs.writeFile(dest, content); }
export async function writeJSON(root, relative, value) { await write(root, relative, JSON.stringify(value, null, 2) + '\n'); }
export async function filesIn(dir, prefix = '') { const out = []; if (!await exists(dir)) return out; for (const d of (await fs.readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) { if (d.isSymbolicLink()) fail(`Symlink in source: ${d.name}`, 'UNSAFE_PATH'); const rel = path.posix.join(prefix, d.name); if (d.isDirectory()) out.push(...await filesIn(path.join(dir,d.name),rel)); else if (d.isFile()) out.push(rel); } return out; }
export function validateConfig(c) {
  if (c?.schemaVersion !== 1 || !/^[a-z][a-z0-9-]{2,45}$/.test(c.name || '')) fail('Project requires schemaVersion 1 and a 3–46 character lowercase slug.', 'INVALID_CONFIG');
  if (!['none','demo','stripe_test'].includes(c.payments?.mode)) fail('payments.mode must be none, demo or stripe_test.', 'INVALID_CONFIG');
  if (c.deploy?.provider !== 'cloudflare') fail('MVP deploy provider must be cloudflare.', 'INVALID_CONFIG');
  if (c.design?.preset !== 'editorial') fail('design.preset must be editorial; select a layout with design.template.', 'INVALID_CONFIG');
  if(c.design.template && !templateById(c.design.template)) fail('Unknown design.template. Run opc templates.', 'INVALID_CONFIG');
  if(c.site){
    if(typeof c.site!=='object'||Array.isArray(c.site))fail('site must be an object.','INVALID_CONFIG');
    for(const key of ['brand','headline','description','contactEmail']) if(c.site[key]!==undefined && (typeof c.site[key]!=='string'||!c.site[key].trim()||c.site[key].length>1000||/[\u0000-\u001f]/.test(c.site[key]))) fail(`Invalid site.${key}.`,'INVALID_CONFIG');
    if(c.site.accent!==undefined&&!/^#[a-f0-9]{6}$/i.test(c.site.accent)) fail('site.accent must be a six-digit hex color.','INVALID_CONFIG');
    if(c.site.contactEmail!==undefined&&!/^[\w.+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(c.site.contactEmail)) fail('site.contactEmail must be an email address.','INVALID_CONFIG');
    if(c.site.items!==undefined&&(!Array.isArray(c.site.items)||!c.site.items.length||c.site.items.length>100||c.site.items.some(x=>!x||['name','category','description'].some(k=>typeof x[k]!=='string'||!x[k].trim()||x[k].length>5000)))) fail('site.items requires 1–100 named items with category and description.','INVALID_CONFIG');
    for(const item of c.site.items||[])if(item.url!==undefined){let url;try{url=new URL(item.url);}catch{fail('Item URLs must be absolute HTTPS addresses.','INVALID_CONFIG');}if(url.protocol!=='https:'||url.username||url.password)fail('Item URLs must be HTTPS without credentials.','INVALID_CONFIG');}
    if(c.site.event && (!Number.isFinite(Date.parse(c.site.event.startsAt))||!Number.isFinite(Date.parse(c.site.event.endsAt))||Date.parse(c.site.event.endsAt)<=Date.parse(c.site.event.startsAt)||typeof c.site.event.location!=='string'||!c.site.event.location.trim()||c.site.event.location.length>300))fail('site.event requires valid startsAt and endsAt timestamps and a location.','INVALID_CONFIG');
  }
  if(c.payments.product && ((c.payments.product.sku!==undefined&&c.payments.product.sku!=='starter')||!Number.isSafeInteger(c.payments.product.amount)||c.payments.product.amount<50||c.payments.product.amount>99999999||!['usd','eur','gbp','cny','jpy','cad','aud'].includes(c.payments.product.currency))) fail('Set a product amount in minor units (50–99999999) and a supported lowercase currency.','INVALID_CONFIG');
  if (c.deploy.tier !== 'preview') fail('MVP supports preview deployments only.', 'INVALID_CONFIG');
  return c;
}
export async function configAt(root) { await safePath(root,'.opc/project.json'); return validateConfig(await readJSON(path.join(root,'.opc/project.json'))); }
export async function managedWrite(root, entries, {expected={}}={}) {
  const manifestFile = '.opc/managed-files.json'; await safePath(root,manifestFile);
  const manifest = await readJSON(path.join(root,manifestFile), { schemaVersion: 1, files: {} });
  const conflicts = [];
  for (const [rel, content] of Object.entries(entries)) {
    const dest = await safePath(root,rel);
    if (await exists(dest)) { const current = digest(await fs.readFile(dest)); if (current !== digest(content) && current !== manifest.files[rel] && current !== expected[rel]) conflicts.push(rel); }
  }
  if (conflicts.length) fail('Existing files contain user changes; no managed files were overwritten.', 'FILE_CONFLICT', { files: conflicts });
  for (const [rel,content] of Object.entries(entries)) { await write(root,rel,content); manifest.files[rel] = digest(content); }
  await writeJSON(root,manifestFile,manifest);
}
export async function fingerprint(root) {
  const names = ['.opc/project.json','.opc/design-brief.md','wrangler.jsonc','worker.mjs', ... (await filesIn(path.join(root,'public'))).map(x=>'public/'+x), ...(await filesIn(path.join(root,'migrations'))).map(x=>'migrations/'+x), ...(await filesIn(path.join(root,'lib'))).map(x=>'lib/'+x)];
  const h = crypto.createHash('sha256');
  for (const rel of [...new Set(names)].sort()) { await safePath(root,rel); h.update(rel+'\0'); h.update(await exists(path.join(root,rel)) ? await fs.readFile(path.join(root,rel)) : '<missing>'); }
  return h.digest('hex');
}
export async function evidence(root, kind, result) {
  const record = { schemaVersion: 1, kind, harnessVersion: VERSION, nodeVersion: process.versions.node, at: new Date().toISOString(), fingerprint: await fingerprint(root), ...result };
  const id = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${kind}.json`;
  await writeJSON(root,`.opc/evidence/${id}`,record);
  const state = await readJSON(path.join(root,'.opc/state.json'),{ schemaVersion:1, capabilities:{} });
  state.capabilities[kind] = { ...record, evidence: `.opc/evidence/${id}` }; state.updatedAt = record.at;
  await writeJSON(root,'.opc/state.json',state); return record;
}
export function redact(s) {
  let value = String(s).replace(/\b(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9_]+\b/g,'[REDACTED_STRIPE_KEY]').replace(/\bwhsec_[A-Za-z0-9_]+\b/g,'[REDACTED_WEBHOOK_SECRET]');
  for (const [k,v] of Object.entries(process.env)) if (/TOKEN|SECRET|PASSWORD|API_KEY/.test(k) && v && v.length > 5) value = value.split(v).join('[REDACTED]');
  return value;
}
