import type { TestContext } from 'node:test';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../bin/opc.mjs', import.meta.url));
const env = { ...process.env, STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', STRIPE_PRICE_ID: '' };

async function fixture(t: TestContext) {
  const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'opc-forward-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

function run(root: string, args: string[], installed = false) {
  const entry = installed ? path.join(root, '.opc/runtime/bin/opc.mjs') : cli;
  const result = spawnSync(process.execPath, [entry, ...args], { cwd: root, env, encoding: 'utf8' });
  assert.equal(result.error, undefined, result.error?.message);
  const output = result.status === 0 ? result.stdout : result.stderr;
  return { ...result, data: output.trim().startsWith('{') ? JSON.parse(output) : undefined };
}

test('both agent hosts can resume an existing project without losing its instructions or page', async (t) => {
  const root = await fixture(t);
  const agents = '# Existing instructions\n\nKeep the writing tool and user files.\n';
  const claude = '# Existing Claude instructions\n\nUse the same existing product.\n';
  const page = '<!doctype html><title>Existing writing tool</title><main>User content</main>\n';
  await fs.mkdir(path.join(root, 'public'));
  await fs.writeFile(path.join(root, 'AGENTS.md'), agents);
  await fs.writeFile(path.join(root, 'CLAUDE.md'), claude);
  await fs.writeFile(path.join(root, 'public/index.html'), page);
  await fs.writeFile(path.join(root, '.gitignore'), 'user-owned-cache/\n');

  const options = ['init', '--name', 'paid-writing', '--host', 'both', '--payment', 'stripe_test', '--json'];
  assert.equal(run(root, options).status, 0);
  const firstAgents = await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8');
  const firstClaude = await fs.readFile(path.join(root, 'CLAUDE.md'), 'utf8');
  const firstConfig = await fs.readFile(path.join(root, '.opc/project.json'), 'utf8');
  assert.ok(firstAgents.startsWith(agents));
  assert.ok(firstClaude.startsWith(claude));
  assert.ok((await fs.readFile(path.join(root, '.gitignore'), 'utf8')).startsWith('user-owned-cache/\n'));
  assert.equal(await fs.readFile(path.join(root, '.agents/skills/opc-build-website/SKILL.md'), 'utf8'), await fs.readFile(path.join(root, '.claude/skills/opc-build-website/SKILL.md'), 'utf8'));

  const inspection = run(root, ['inspect', '--json'], true);
  assert.equal(inspection.status, 0);
  assert.deepEqual(inspection.data.hosts, { codex: true, claude: true });
  assert.deepEqual(inspection.data.blockers.map((x:{missing:string}) => x.missing).sort(), ['STRIPE_PRICE_ID', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']);
  assert.equal(run(root, ['plan', '--json'], true).data.blockers.length, 3);

  const scaffold = run(root, ['scaffold', '--json'], true);
  assert.equal(scaffold.status, 1);
  assert.equal(scaffold.data.error, 'FILE_CONFLICT');
  assert.deepEqual(scaffold.data.details.files, ['public/index.html']);
  assert.equal(await fs.readFile(path.join(root, 'public/index.html'), 'utf8'), page);
  await assert.rejects(fs.access(path.join(root, 'worker.mjs')));
  await assert.rejects(fs.access(path.join(root, 'public/app.js')));
  await assert.rejects(fs.access(path.join(root, 'migrations')));

  assert.equal(run(root, options, true).status, 0);
  assert.equal(await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8'), firstAgents);
  assert.equal(await fs.readFile(path.join(root, 'CLAUDE.md'), 'utf8'), firstClaude);
  assert.equal(await fs.readFile(path.join(root, '.opc/project.json'), 'utf8'), firstConfig);
  assert.equal((firstAgents.match(/<!-- opc-harness:begin -->/g) || []).length, 1);
});

test('a fresh project can initialize and scaffold repeatedly, then preserves an edited design', async (t) => {
  const root = await fixture(t);
  const options = ['init', '--name', 'fresh-writing', '--host', 'both', '--json'];
  assert.equal(run(root, options).status, 0);
  assert.equal(run(root, options, true).status, 0);
  assert.equal(run(root, ['scaffold', '--json'], true).status, 0);
  const originalPage = await fs.readFile(path.join(root, 'public/index.html'), 'utf8');
  assert.equal(run(root, ['scaffold', '--json'], true).status, 0);
  assert.equal(await fs.readFile(path.join(root, 'public/index.html'), 'utf8'), originalPage);

  const customCSS = '/* A user-owned product design */\nbody { color: navy; }\n';
  await fs.writeFile(path.join(root, 'public/styles.css'), customCSS);
  const manifest = await fs.readFile(path.join(root, '.opc/managed-files.json'), 'utf8');
  const changed = run(root, ['scaffold', '--json'], true);
  assert.equal(changed.status, 1);
  assert.equal(changed.data.error, 'FILE_CONFLICT');
  assert.ok(changed.data.details.files.includes('public/styles.css'));
  assert.equal(await fs.readFile(path.join(root, 'public/styles.css'), 'utf8'), customCSS);
  assert.equal(await fs.readFile(path.join(root, '.opc/managed-files.json'), 'utf8'), manifest);
});

test('help works before initialization and invalid host creates no managed project', async (t) => {
  const root = await fixture(t);
  const help = run(root, ['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /opc init/);
  const invalid = run(root, ['init', '--name', 'invalid-host', '--host', 'unknown', '--json']);
  assert.equal(invalid.status, 1);
  assert.equal(invalid.data.error, 'INVALID_ARGUMENT');
  assert.deepEqual(await fs.readdir(root), []);
});
