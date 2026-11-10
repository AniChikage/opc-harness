import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION, filesIn } from '../src/core.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(await fs.readFile(path.join(root, 'npm-shrinkwrap.json'), 'utf8')) as {version:string;packages:Record<string,{version?:string;resolved?:string}>};
if (pkg.version !== VERSION || lock.version !== VERSION || lock.packages[''].version !== VERSION) throw new Error('Package, runtime and lockfile versions must match.');
if (pkg.publishConfig?.registry !== 'https://registry.npmjs.org/' || pkg.publishConfig?.access !== 'public') throw new Error('Publication must target the public npm registry.');
for (const entry of Object.values(lock.packages)) if (entry.resolved && new URL(entry.resolved).hostname !== 'registry.npmjs.org') throw new Error('Dependency archives must use the public npm registry.');

const names = ['README.md', 'CONTRIBUTING.md'];
for (const dir of ['bin', 'src', 'skills', 'templates', 'test', 'scripts', 'docs', 'types']) names.push(...(await filesIn(path.join(root, dir))).filter(file => !file.startsWith('.build/') && !file.startsWith('dist/') && /\.(mts|ts|mjs|js|json|html|css|svg|md|example)$/.test(file)).map(file => dir + '/' + file));
for (const file of names) {
  const text = await fs.readFile(path.join(root, file), 'utf8');
  if (/\p{Script=Han}/u.test(text)) throw new Error('Release text must be English: ' + file);
  if (file.endsWith('.md')) for (const match of text.matchAll(/\]\(([^)]+)\)|(?:href|src)="([^"]+)"/g)) {
    const target = match[1] || match[2];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    await fs.access(path.resolve(root, path.dirname(file), decodeURIComponent(target.split('#')[0])));
  }
}
console.log(JSON.stringify({ ok: true, version: VERSION, englishTextFiles: names.length, publicRegistry: true, localDocumentationLinks: true }));
