import path from 'node:path';
import { fail, redact, VERSION } from './core.mjs';
import * as workflows from './workflows.mjs';
const HELP = `opc-harness ${VERSION} — Codex + Claude Code website delivery

opc setup --global [--host both|codex|claude] [--profile FILE] [--payment demo|stripe_test]
opc setup [--profile FILE] [--payment demo|stripe_test]  Local profile only
opc init [--dir DIR] [--name SLUG] [--host both|codex|claude] [--payment MODE] [--brief TEXT] [--profile FILE]
opc inspect [--json]       Current config, host entries, credential presence, evidence freshness
opc plan [--json]          Required capabilities, dependencies, next actions
opc scaffold              Generate the paid-tool website without overwriting user edits
opc dev [--port 8787]      Install Wrangler if missing, migrate local D1, start the app
opc verify --url URL [--json]    HTTP and identity smoke checks; records scoped evidence
opc payments test --url URL [--json]  Run DEMO checkout → fulfillment → entitlement tests
opc deploy [--dry-run] [--reuse-database-from PROJECT] [--json]  Cloudflare preview

Run project commands from the generated project's root. Node >=22.13 is required.
Global setup installs user skills/instruction entries; project commands preserve global settings.
Project commands do not create accounts or make live charges.
`;
export async function run(argv) {
  const positional = []; const flags = {};
  const booleans = new Set(['json','dry-run','help','global']);
  const allowed = new Set([...booleans,'dir','name','host','payment','brief','profile','port','url','home','codex-home','claude-home','reuse-database-from']);
  for (let i=0; i<argv.length;i++) { const a=argv[i]; if (!a.startsWith('--')) { positional.push(a); continue; } const key=a.slice(2); if (!allowed.has(key)) fail(`Unknown option: ${a}`,'INVALID_ARGUMENT'); if (booleans.has(key)) flags[key]=true; else { if (!argv[i+1] || argv[i+1].startsWith('--')) fail(`Missing value: ${a}`,'INVALID_ARGUMENT'); flags[key]=argv[++i]; } }
  if (!positional.length || flags.help || positional[0]==='help') { console.log(HELP); return; }
  const [command,subcommand,...rest] = positional;
  if(flags['reuse-database-from']&&command!=='deploy') fail('--reuse-database-from applies only to deploy.','INVALID_ARGUMENT');
  if((flags.global||flags.home||flags['codex-home']||flags['claude-home'])&&!(command==='setup'&&flags.global)) fail('--global and home overrides apply only to setup --global.','INVALID_ARGUMENT');
  if (rest.length || (subcommand && !(command==='payments' && subcommand==='test'))) fail('Unexpected arguments. Run opc help.','INVALID_ARGUMENT');
  const root = path.resolve(flags.dir || process.cwd()); let result;
  if (command==='setup') result=await workflows.setup(root,flags);
  else if (command==='init') result=await workflows.init(root,flags);
  else if (command==='inspect') result=await workflows.inspect(root);
  else if (command==='plan') result=await workflows.plan(root);
  else if (command==='scaffold') result=await workflows.scaffold(root);
  else if (command==='dev') return workflows.dev(root,flags);
  else if (command==='verify') result=await workflows.verify(root,flags);
  else if (command==='payments' && subcommand==='test') result=await workflows.paymentTest(root,flags);
  else if (command==='deploy') result=await workflows.deploy(root,flags);
  else fail(`Unknown command: ${command}. Run opc help.`,'INVALID_ARGUMENT');
  console.log(redact(JSON.stringify(result,null,2)));
  if (result.ok === false) process.exitCode=2;
}
