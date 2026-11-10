import path from 'node:path';
import { spawn } from 'node:child_process';
import type { Options } from './types.mjs';
import { PACKAGE_ROOT, exists, fail } from './core.mjs';

/** Keep the old source-checkout command without shipping the marketing website. */
export async function runWeb(options: Options) {
  const workspace = path.resolve(PACKAGE_ROOT, '../web');
  if (!await exists(path.join(workspace, 'package.json'))) fail('The product website is a separate source workspace in web/. Use opc gallery to select templates, or clone the repository and run npm --prefix web run dev.', 'WEB_WORKSPACE_REQUIRED');
  const args = ['--prefix', workspace, 'run', options.out ? 'export' : 'dev', '--'];
  if (options.out) args.push('--out', path.resolve(options.out));
  if (options.port) args.push('--port', String(options.port));
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {stdio:'inherit'});
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error('The web workspace command failed.')));
  });
}
