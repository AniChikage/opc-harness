import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from '../src/site.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const workspace = path.join(root, 'web');
async function copyAssets(source:string, destination:string):Promise<void> {
  await fs.mkdir(destination,{recursive:true});
  for (const entry of await fs.readdir(source,{withFileTypes:true})) {
    if (entry.isSymbolicLink()) throw new Error('Web assets must not contain symlinks.');
    const from = path.join(source,entry.name), to = path.join(destination,entry.name);
    if (entry.isDirectory()) await copyAssets(from,to);
    else if (!/\.(?:mts|ts|tsx)$/.test(entry.name)) await fs.copyFile(from,to);
  }
}
await fs.cp(path.join(root,'dist/templates'),path.join(workspace,'.build/templates'),{recursive:true});
await copyAssets(path.join(workspace,'assets'),path.join(workspace,'.build/web/assets'));
await site({out:path.join(workspace,'dist')});
console.log('Built the independent website in web/dist.');
