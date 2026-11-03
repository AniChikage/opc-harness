import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { VERSION, redact } from '../src/core.mjs';

const source = fileURLToPath(new URL('../', import.meta.url));
const work = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'opc-package-smoke-'));
const home = path.join(work, 'home'), cache = path.join(work, 'cache');
const userConfig = path.join(work, 'user.npmrc'), globalConfig = path.join(work, 'global.npmrc');
const env = { ...process.env, npm_config_registry: 'https://registry.npmjs.org/', npm_config_userconfig: userConfig, npm_config_globalconfig: globalConfig, npm_config_cache: cache };
for (const name of ['OPC_HARNESS_PROFILE', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'NODE_AUTH_TOKEN', 'NPM_TOKEN']) delete env[name];
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
async function run(command, args, cwd = work) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Package smoke command timed out.')); }, 180000);
    child.stdout.on('data', value => stdout += value); child.stderr.on('data', value => stderr += value);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(stdout) : reject(new Error(redact(stderr || stdout || 'Package smoke command failed.'))); });
  });
}
try {
  await fs.writeFile(userConfig, '', { mode: 0o600 }); await fs.writeFile(globalConfig, '', { mode: 0o600 });
  const [packed] = JSON.parse(await run(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', work], source));
  const included = new Set(packed.files.map(file => file.path));
  for (const file of packed.files.filter(file => file.path.endsWith('.md'))) {
    const text = await fs.readFile(path.join(source, file.path), 'utf8');
    for (const match of text.matchAll(/\]\(([^)]+)\)|(?:href|src)="([^"]+)"/g)) {
      const target = match[1] || match[2];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), decodeURIComponent(target.split('#')[0])));
      assert.ok(included.has(resolved), `Missing package documentation target: ${resolved}`);
    }
  }
  const archive = path.join(work, packed.filename);
  const setup = JSON.parse(await run(npx, ['--yes', `--package=file:${archive}`, 'opc-harness', 'setup', '--global', '--host', 'both', '--template', 'directory', '--payment', 'none', '--home', home, '--json']));
  assert.equal(setup.ok, true); assert.deepEqual(setup.hosts, ['codex', 'claude']);
  for (const file of ['.agents/skills/opc-harness/SKILL.md', '.claude/skills/opc-harness/SKILL.md', '.codex/AGENTS.md', '.claude/CLAUDE.md']) {
    const text = await fs.readFile(path.join(home, file), 'utf8'); assert.ok(text.includes('opc-harness')); assert.ok(!text.includes(cache));
  }
  await fs.rm(cache, { recursive: true, force: true });
  const cli = path.join(home, '.local/share/opc-harness/runtime/bin/opc.mjs');
  const project = path.join(work, 'english-project');
  await run(process.execPath, [cli, 'init', '--dir', project, '--name', 'english-project', '--host', 'both', '--brief', 'An English project brief website with a free preview and Markdown export.', '--json']);
  await run(process.execPath, [cli, 'scaffold'], project);
  const inspection = JSON.parse(await run(process.execPath, [cli, 'inspect', '--json'], project));
  assert.deepEqual(inspection.hosts, { codex: true, claude: true }); assert.equal(inspection.version, VERSION);
  assert.equal(inspection.config.design.template,'directory');
  const catalog=JSON.parse(await run(process.execPath,[cli,'templates','--json']));
  for(const template of catalog.templates){const target=path.join(work,'template-'+template.id);await run(process.execPath,[cli,'create','--dir',target,'--name','package-'+template.id,'--template',template.id,'--host','both','--json']);await fs.access(path.join(target,'public/index.html'));}
  const page = await fs.readFile(path.join(project, 'public/index.html'), 'utf8'); assert.ok(page.includes('lang="en"')); assert.ok(!/\p{Script=Han}/u.test(page));
  const repeated = JSON.parse(await run(process.execPath, [cli, 'setup', '--global', '--host', 'both', '--home', home, '--json']));
  assert.equal(repeated.changedFiles, 0);
  console.log(JSON.stringify({ ok: true, version: VERSION, package: packed.filename, hosts: setup.hosts, templatesGenerated:catalog.templates.length, savedTemplateDefault:true, packageDocumentationLinks: true, cacheIndependent: true, englishExample: true, repeatChanges: 0, ...(process.argv.includes('--keep') ? { work, home, project, archive } : {}) }));
} finally { if (!process.argv.includes('--keep')) await fs.rm(work, { recursive: true, force: true }); }
