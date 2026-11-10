import { site } from './site.mjs';
const options: {port?:string;out?:string} = {};
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  if (!['--port','--out'].includes(flag) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Usage: npm --prefix web run dev -- [--port 8788] [--out DIR]');
  options[flag === '--port' ? 'port' : 'out'] = args[++i];
}
await site({port: options.port || 8788, ...(options.out ? {out:options.out} : {})});
