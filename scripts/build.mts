import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { studioPage } from '../src/studio.mjs';
import { TEMPLATES } from '../src/catalog.mjs';
import { FRONTENDS } from '../src/modules.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'dist');
async function copyAssets(source: string, destination: string): Promise<void> {
  await fs.mkdir(destination, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Build assets must not contain symlinks.');
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyAssets(from, to);
    else if (!/\.(?:mts|ts|tsx)$/.test(entry.name)) await fs.copyFile(from, to);
  }
}
await copyAssets(path.join(root, 'templates'), path.join(output, 'templates'));
await copyAssets(path.join(root, 'skills'), path.join(output, 'skills'));
const studio = path.join(output, 'templates/studio');
const ordered = FRONTENDS.flatMap(group => group.templates.map(id => TEMPLATES.find(template => template.id === id)!));
await fs.writeFile(path.join(studio, 'index.html'), studioPage(ordered));
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')) as Record<string, unknown>;
await fs.writeFile(path.join(output, 'package.json'), JSON.stringify({ ...pkg, scripts: { check: 'node scripts/check-syntax.mjs' } }, null, 2) + '\n');
await fs.copyFile(path.join(root, 'npm-shrinkwrap.json'), path.join(output, 'npm-shrinkwrap.json'));
await fs.copyFile(path.join(output, 'scripts/launcher.mjs'), path.join(root, 'bin/opc.mjs'));
await fs.chmod(path.join(root, 'bin/opc.mjs'), 0o755);
await fs.chmod(path.join(output, 'bin/opc.mjs'), 0o755);
console.log('Built TypeScript sources and the standalone JavaScript runtime.');
