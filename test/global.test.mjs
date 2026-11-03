import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const sourceCLI = fileURLToPath(new URL('../bin/opc.mjs', import.meta.url));
const baseEnv = { ...process.env };
for (const key of ['OPC_HARNESS_PROFILE', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR']) delete baseEnv[key];

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'opc-global-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
async function put(file, contents) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, contents);
}
const read = file => fs.readFile(file, 'utf8');
async function present(file) { try { await fs.access(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
function run(cwd, args, { cli = sourceCLI, env = {} } = {}) {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd, env: { ...baseEnv, ...env }, encoding: 'utf8' });
  assert.equal(r.error, undefined, r.error?.message);
  const output = r.status === 0 ? r.stdout : r.stderr;
  return { ...r, data: output.trim().startsWith('{') ? JSON.parse(output) : undefined };
}
function success(result) { assert.equal(result.status, 0, result.stderr || result.stdout); assert.equal(result.data?.ok, true); return result.data; }
const runtimeCLI = home => path.join(home, '.local/share/opc-harness/runtime/bin/opc.mjs');
const profilePath = home => path.join(home, '.config/opc-harness/profile.json');
const globalSkill = home => path.join(home, '.agents/skills/opc-harness/SKILL.md');
const modeProfile = mode => ({ schemaVersion: 1, design: { preset: 'editorial' }, payments: { mode }, deploy: { provider: 'cloudflare', tier: 'preview' } });

test('one global setup installs both host entries and preserves existing instructions on repeat', async t => {
  const home = await fixture(t);
  const codex = path.join(home, '.codex/AGENTS.md'), claude = path.join(home, '.claude/CLAUDE.md');
  const originalCodex = '# Personal Codex rules\nKeep my conventions.\n';
  const originalClaude = '# Personal Claude rules\nKeep my workflow.\n';
  await put(codex, originalCodex); await put(claude, originalClaude);
  const installation = success(run(home, ['setup', '--global', '--home', home, '--host', 'both']));
  const firstCodex = await read(codex), firstClaude = await read(claude);
  assert.ok(firstCodex.startsWith(originalCodex)); assert.ok(firstClaude.startsWith(originalClaude));
  assert.match(await read(globalSkill(home)), /name: opc-harness/);
  assert.match(await read(path.join(home, '.claude/skills/opc-harness/SKILL.md')), /name: opc-harness/);
  assert.ok(await present(runtimeCLI(home))); assert.ok(await present(profilePath(home)));
  assert.ok(installation.backup);
  const backupContents = await Promise.all((await fs.readdir(installation.backup)).map(name => read(path.join(installation.backup, name))));
  assert.ok(backupContents.includes(originalCodex)); assert.ok(backupContents.includes(originalClaude));
  const meta = JSON.parse(await read(path.join(home, '.local/share/opc-harness/runtime/global-install.json')));
  assert.equal(meta.profile, profilePath(home));
  success(run(home, ['setup', '--global', '--home', home, '--host', 'both']));
  assert.equal(await read(codex), firstCodex); assert.equal(await read(claude), firstClaude);
  assert.equal((firstCodex.match(/<!-- opc-harness:global:begin -->/g) || []).length, 1);
  await fs.appendFile(codex, '\nA later personal rule.\n');
  success(run(home, ['setup', '--global', '--home', home, '--host', 'both']));
  assert.ok((await read(codex)).endsWith('A later personal rule.\n'));
});

test('global Codex installation targets an effective nonempty override file', async t => {
  const home = await fixture(t), base = path.join(home, '.codex/AGENTS.md'), override = path.join(home, '.codex/AGENTS.override.md');
  await put(base, 'Base guidance must remain untouched.\n');
  await put(override, 'Active override guidance.\n');
  success(run(home, ['setup', '--global', '--home', home, '--host', 'codex']));
  assert.equal(await read(base), 'Base guidance must remain untouched.\n');
  assert.ok((await read(override)).startsWith('Active override guidance.\n'));
  assert.match(await read(override), /opc-harness:global:begin/);
  assert.equal(await present(path.join(home, '.claude/CLAUDE.md')), false);
});

test('explicit custom host directories receive entries without modifying default instruction files', async t => {
  const home = await fixture(t), codex = path.join(home, 'custom-codex'), claude = path.join(home, 'custom-claude');
  success(run(home, ['setup', '--global', '--home', home, '--host', 'both', '--codex-home', codex, '--claude-home', claude]));
  assert.match(await read(path.join(codex, 'AGENTS.md')), /opc-harness:global:begin/);
  assert.match(await read(path.join(claude, 'CLAUDE.md')), /opc-harness:global:begin/);
  assert.ok(await present(path.join(claude, 'skills/opc-harness/SKILL.md')));
  assert.equal(await present(path.join(home, '.codex/AGENTS.md')), false);
  assert.equal(await present(path.join(home, '.claude/CLAUDE.md')), false);
});

test('installed global runtime uses the saved profile from an unrelated project directory', async t => {
  const home = await fixture(t), workspace = await fixture(t), custom = path.join(home, 'preferences/my-profile.json');
  await put(custom, JSON.stringify(modeProfile('stripe_test')));
  success(run(home, ['setup', '--global', '--home', home, '--profile', custom]));
  const first = path.join(workspace, 'alpha'), second = path.join(workspace, 'beta');
  const cli = runtimeCLI(home);
  success(run(workspace, ['init', '--dir', first, '--name', 'site-alpha'], { cli }));
  assert.equal(JSON.parse(await read(path.join(first, '.opc/project.json'))).payments.mode, 'stripe_test');
  await put(custom, JSON.stringify(modeProfile('demo')));
  success(run(workspace, ['init', '--dir', first], { cli }));
  success(run(workspace, ['init', '--dir', second, '--name', 'site-beta'], { cli }));
  assert.equal(JSON.parse(await read(path.join(first, '.opc/project.json'))).payments.mode, 'stripe_test');
  assert.equal(JSON.parse(await read(path.join(second, '.opc/project.json'))).payments.mode, 'demo');
  success(run(second, ['inspect', '--json'], { cli: path.join(second, '.opc/runtime/bin/opc.mjs') }));
});

test('the generated bootstrap command works with spaces in installation and profile paths', async t => {
  const base = await fixture(t), home = path.join(base, 'personal home'), workspace = path.join(base, 'workspace');
  await fs.mkdir(home); await fs.mkdir(workspace);
  const profile = path.join(base, 'my preferences.json'); await put(profile, JSON.stringify(modeProfile('stripe_test')));
  success(run(workspace, ['setup', '--global', '--home', home, '--profile', profile]));
  const skill = await read(globalSkill(home));
  const command = skill.match(/```sh\n([^\n]+)\n```/)?.[1]; assert.ok(command);
  // This replacement is a fixed safe relative path; the generated command must quote its own absolute paths.
  const result = spawnSync('/bin/sh', ['-c', command.replace('<intended-project-directory>', './new-site')], { cwd: workspace, env: baseEnv, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(await read(path.join(workspace, 'new-site/.opc/project.json'))).payments.mode, 'stripe_test');
});

test('explicit profile and payment override environment and installed defaults in a new project', async t => {
  const home = await fixture(t), workspace = await fixture(t);
  success(run(home, ['setup', '--global', '--home', home, '--payment', 'stripe_test']));
  const envProfile = path.join(workspace, 'env-profile.json'), explicitProfile = path.join(workspace, 'explicit-profile.json');
  await put(envProfile, JSON.stringify(modeProfile('demo'))); await put(explicitProfile, JSON.stringify(modeProfile('stripe_test')));
  const cli = runtimeCLI(home), env = { OPC_HARNESS_PROFILE: envProfile };
  const cases = [
    ['from-env', [], 'demo'],
    ['from-explicit', ['--profile', explicitProfile], 'stripe_test'],
    ['from-payment', ['--profile', explicitProfile, '--payment', 'demo'], 'demo']
  ];
  for (const [name, flags, mode] of cases) {
    const project = path.join(workspace, name);
    success(run(workspace, ['init', '--dir', project, '--name', name, ...flags], { cli, env }));
    assert.equal(JSON.parse(await read(path.join(project, '.opc/project.json'))).payments.mode, mode);
  }
});

test('global setup refuses an unrelated same-name skill without changing existing instructions', async t => {
  const home = await fixture(t), instruction = path.join(home, '.codex/AGENTS.md'), skill = globalSkill(home);
  await put(instruction, 'Keep this personal instruction.\n'); await put(skill, '---\nname: a-different-skill\ndescription: User owned\n---\nOriginal user content.\n');
  const r = run(home, ['setup', '--global', '--home', home]);
  assert.notEqual(r.status, 0); assert.equal(await read(instruction), 'Keep this personal instruction.\n');
  assert.match(await read(skill), /Original user content/);
});

test('reinstallation preserves user modifications to the installed global skill', async t => {
  const home = await fixture(t);
  success(run(home, ['setup', '--global', '--home', home]));
  const skill = globalSkill(home); await fs.appendFile(skill, '\nCustom user bootstrap detail.\n');
  const original = await read(skill), instructions = await read(path.join(home, '.codex/AGENTS.md'));
  const r = run(home, ['setup', '--global', '--home', home]);
  assert.notEqual(r.status, 0); assert.equal(await read(skill), original);
  assert.equal(await read(path.join(home, '.codex/AGENTS.md')), instructions);
});

test('symlinked global destinations cannot redirect writes outside the selected home', async t => {
  const home = await fixture(t), outside = await fixture(t);
  await fs.symlink(outside, path.join(home, '.agents'));
  const r = run(home, ['setup', '--global', '--home', home]);
  assert.notEqual(r.status, 0); assert.deepEqual(await fs.readdir(outside), []);
  assert.equal(await present(path.join(home, '.codex/AGENTS.md')), false);
});

test('invalid global options do not install host files or preferences', async t => {
  const home = await fixture(t);
  assert.notEqual(run(home, ['setup', '--global', '--home', home, '--host', 'unknown']).status, 0);
  assert.notEqual(run(home, ['setup', '--global', '--home', home, '--payment', 'live']).status, 0);
  assert.deepEqual(await fs.readdir(home), []);
});

test('global dry-run reports concrete changes without writing any files',async t=>{
  const home=await fixture(t);const result=success(run(home,['setup','--global','--home',home,'--dry-run']));
  assert.equal(result.dryRun,true);assert.ok(result.changes.some(x=>x.file===path.join(home,'.codex/AGENTS.md')));assert.deepEqual(await fs.readdir(home),[]);
});

test('a missing saved global profile fails clearly instead of silently changing project defaults', async t => {
  const home = await fixture(t), workspace = await fixture(t);
  success(run(home, ['setup', '--global', '--home', home, '--payment', 'stripe_test']));
  const existing = path.join(workspace, 'existing-site');
  success(run(workspace, ['init', '--dir', existing, '--name', 'existing-site'], { cli: runtimeCLI(home) }));
  await fs.rm(profilePath(home));
  success(run(workspace, ['init', '--dir', existing], { cli: runtimeCLI(home) }));
  assert.equal(JSON.parse(await read(path.join(existing, '.opc/project.json'))).payments.mode, 'stripe_test');
  const target = path.join(workspace, 'new-site');
  const r = run(workspace, ['init', '--dir', target, '--name', 'new-site'], { cli: runtimeCLI(home) });
  assert.notEqual(r.status, 0);
  assert.equal(await present(path.join(target, '.opc/project.json')), false);
});
