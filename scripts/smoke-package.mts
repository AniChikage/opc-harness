import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { VERSION, redact } from '../src/core.mjs';

const source = fileURLToPath(new URL('../../', import.meta.url));
const work = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'opc-package-smoke-'));
const home = path.join(work, 'home'), cache = path.join(work, 'cache');
const userConfig = path.join(work, 'user.npmrc'), globalConfig = path.join(work, 'global.npmrc');
const env: NodeJS.ProcessEnv = { ...process.env, npm_config_registry: 'https://registry.npmjs.org/', npm_config_userconfig: userConfig, npm_config_globalconfig: globalConfig, npm_config_cache: cache };
for (const name of ['OPC_HARNESS_PROFILE', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'NODE_AUTH_TOKEN', 'NPM_TOKEN']) delete env[name];
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
async function run(command: string, args: string[], cwd = work): Promise<string> {
  return new Promise<string>((resolve, reject) => {
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
  const [packed] = JSON.parse(await run(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', work], source)) as {filename:string;files:{path:string}[]}[];
  const included = new Set(packed.files.map(file => file.path));
  for (const required of ['bin/opc.mjs', 'dist/bin/opc.mjs', 'dist/src/cli.mjs', 'dist/templates/paid-site/worker.mjs', 'dist/templates/studio/studio.js', 'dist/skills/opc-build-website/SKILL.md', 'dist/scripts/check-syntax.mjs', 'dist/npm-shrinkwrap.json']) assert.ok(included.has(required), `Missing compiled runtime file: ${required}`);
  assert.ok(!packed.files.some(file => /\.(?:mts|ts|tsx)$/.test(file.path)), 'Consumer package must contain compiled JavaScript rather than TypeScript sources.');
  assert.ok(!packed.files.some(file => /^dist\/(?:test|types)\//.test(file.path)), 'Development fixtures must not enter the consumer package.');
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
  await assert.rejects(run(process.execPath,[cli,'site','--json']), /WEB_WORKSPACE_REQUIRED/);
  const project = path.join(work, 'english-project');
  await run(process.execPath, [cli, 'init', '--dir', project, '--name', 'english-project', '--host', 'both', '--brief', 'An English project brief website with a free preview and Markdown export.', '--json']);
  await run(process.execPath, [cli, 'scaffold'], project);
  const inspection = JSON.parse(await run(process.execPath, [cli, 'inspect', '--json'], project));
  assert.deepEqual(inspection.hosts, { codex: true, claude: true }); assert.equal(inspection.version, VERSION);
  assert.equal(inspection.config.design.template,'directory');
  const catalog=JSON.parse(await run(process.execPath,[cli,'templates','--json']));
  for(const template of catalog.templates){const target=path.join(work,'template-'+template.id);await run(process.execPath,[cli,'create','--dir',target,'--name','package-'+template.id,'--template',template.id,'--host','both','--json']);await fs.access(path.join(target,'public/index.html'));}
  const modules=JSON.parse(await run(process.execPath,[cli,'modules','--json']));
  assert.equal(modules.stacks.length,3);
  const recipes=JSON.parse(await run(process.execPath,[cli,'recipes','--json']));
  for(const recipe of recipes.recipes){const target=path.join(work,'recipe-'+recipe.id);await run(process.execPath,[cli,'create','--dir',target,'--name','package-'+recipe.id,'--recipe',recipe.id,'--host','both','--json']);const c=JSON.parse(await fs.readFile(path.join(target,'.opc/project.json'),'utf8'));assert.equal(c.design.template,recipe.template);assert.equal(c.deploy.provider,recipe.stack);assert.equal(c.payments.mode,recipe.payment);}
  const showroom=path.join(work,'showroom');await run(process.execPath,[cli,'gallery','--out',showroom,'--json']);await fs.access(path.join(showroom,'templates/console/index.html'));await fs.access(path.join(showroom,'studio.js'));
  assert.ok(!packed.files.some(file => /^dist\/(?:web|src\/site\.|templates\/site\/)/.test(file.path)), 'The marketing website must stay outside the harness package.');
  // Exercise dependency bootstrap from a copied project, after removing the installer cache.
  const paidProject = path.join(work,'template-store'), portableRuntime = path.join(paidProject,'.opc/runtime');
  const packagedBuild = JSON.parse(await run(process.execPath,[path.join(portableRuntime,'bin/opc.mjs'),'deploy','--dry-run','--json'],paidProject));
  assert.equal(packagedBuild.ok,true); assert.equal(packagedBuild.scope,'local-build');
  for (const developmentPackage of ['typescript','@types/node','ts-node','tsx']) await assert.rejects(fs.access(path.join(portableRuntime,'node_modules',developmentPackage)),{code:'ENOENT'});
  assert.deepEqual(await fs.readdir(path.join(portableRuntime,'scripts')),['check-syntax.mjs']);
  await run(npm,['run','check'],portableRuntime);
  const page = await fs.readFile(path.join(project, 'public/index.html'), 'utf8'); assert.ok(page.includes('lang="en"')); assert.ok(!/\p{Script=Han}/u.test(page));
  const repeated = JSON.parse(await run(process.execPath, [cli, 'setup', '--global', '--host', 'both', '--home', home, '--json']));
  assert.equal(repeated.changedFiles, 0);
  console.log(JSON.stringify({ ok: true, version: VERSION, package: packed.filename, hosts: setup.hosts, templatesGenerated:catalog.templates.length,recipesGenerated:recipes.recipes.length,staticGalleryExport:true, marketingWebsiteExcluded:true, compiledOnly:true, typescriptRequired:false, realWranglerDryRun:true, savedTemplateDefault:true, packageDocumentationLinks: true, cacheIndependent: true, englishExample: true, repeatChanges: 0, ...(process.argv.includes('--keep') ? { work, home, project, archive } : {}) }));
} finally { if (!process.argv.includes('--keep')) await fs.rm(work, { recursive: true, force: true }); }
