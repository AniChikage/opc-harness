import path from 'node:path';
import { fail, redact, VERSION, configAt, readJSON } from './core.mjs';
import {defaultProfile,globalPaths} from './global.mjs';
import * as workflows from './workflows.mjs';
import {TEMPLATES,templateById} from './catalog.mjs';
import {chooseOptions} from './interactive.mjs';
import {gallery} from './gallery.mjs';
const HELP = `opc-harness ${VERSION} — Codex + Claude Code website delivery

opc setup --global [--host both|codex|claude] [--profile FILE] [--payment demo|stripe_test]
opc templates [--template ID] [--json]   List complete templates and included interactions
opc gallery [--port 8788]               Browse exact local template previews
opc create [--interactive] [--template ID] [--dir DIR] [--brand TEXT] [--payment none|demo|stripe_test]
opc configure [--interactive] [--template ID] [--brand TEXT] [--headline TEXT] [--site-config FILE]
opc preferences [--interactive] [--template ID] [--profile FILE]   Set defaults for future projects
opc doctor [--json]                    Report all local prerequisites together
opc export --out DIR                   Export a free website for static hosting
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
  const booleans = new Set(['json','dry-run','help','global','interactive']);
  const allowed = new Set([...booleans,'template','brand','headline','description','accent','email','site-config','amount','currency','out','dir','name','host','payment','brief','profile','port','url','home','codex-home','claude-home','reuse-database-from']);
  for (let i=0; i<argv.length;i++) { const a=argv[i]; if (!a.startsWith('--')) { positional.push(a); continue; } const key=a.slice(2); if (!allowed.has(key)) fail(`Unknown option: ${a}`,'INVALID_ARGUMENT'); if (booleans.has(key)) flags[key]=true; else { if (!argv[i+1] || argv[i+1].startsWith('--')) fail(`Missing value: ${a}`,'INVALID_ARGUMENT'); flags[key]=argv[++i]; } }
  if (!positional.length || flags.help || positional[0]==='help') { console.log(HELP); return; }
  const [command,subcommand,...rest] = positional;
  for(const key of ['template','brand','headline','description','accent','email','site-config'])if(flags[key]!==undefined&&!['setup','init','create','configure','preferences',...(key==='template'?['templates']:[])].includes(command))fail(`--${key} does not apply to ${command}.`,'INVALID_ARGUMENT');
  if((flags.amount||flags.currency)&&!['init','create','configure'].includes(command))fail('--amount and --currency apply to init, create or configure.','INVALID_ARGUMENT');
  if(flags.out&&command!=='export')fail('--out applies only to export.','INVALID_ARGUMENT');
  if(flags['dry-run']&&!['setup','configure','preferences','deploy'].includes(command))fail('--dry-run applies to setup, configure, preferences or deploy.','INVALID_ARGUMENT');
  if(flags['reuse-database-from']&&command!=='deploy') fail('--reuse-database-from applies only to deploy.','INVALID_ARGUMENT');
  if((flags.global||flags.home||flags['codex-home']||flags['claude-home'])&&!(command==='setup'&&flags.global)) fail('--global and home overrides apply only to setup --global.','INVALID_ARGUMENT');
  if (rest.length || (subcommand && !(command==='payments' && subcommand==='test'))) fail('Unexpected arguments. Run opc help.','INVALID_ARGUMENT');
  if(command==='create'&&!flags.dir)flags.dir=path.join(process.cwd(),flags.name||'my-website');
  const root = path.resolve(flags.dir || process.cwd()); let result;
  if(flags.interactive && !['create','configure','setup','init','preferences'].includes(command))fail('--interactive applies to create, configure, setup, preferences or init.','INVALID_ARGUMENT');
  if(flags.interactive && flags.json)fail('Use either --interactive or --json.','INVALID_ARGUMENT');
  if(flags.interactive || (command==='create'&&!flags.template&&process.stdin.isTTY)){let defaults={};if(command==='configure'){const c=await configAt(root);defaults={...c.site,email:c.site?.contactEmail,template:c.design.template||'paperplane',payment:c.payments.mode};}else if(command==='preferences'||command==='setup'){const file=await defaultProfile(flags)||globalPaths(flags).profile,c=await readJSON(file,{});defaults={...c.site,email:c.site?.contactEmail,template:c.design?.template||'paperplane',payment:c.payments?.mode};}Object.assign(flags,await chooseOptions({...defaults,...flags}));}
  if (command==='setup') result=await workflows.setup(root,flags);
  else if (command==='init') result=await workflows.init(root,flags);
  else if (command==='create') result=await workflows.create(root,flags);
  else if (command==='configure') result=await workflows.configure(root,flags);
  else if (command==='preferences') result=await workflows.preferences(root,flags);
  else if (command==='templates') {const selected=flags.template?templateById(flags.template):null;if(flags.template&&!selected)fail('Unknown template ID. Run opc templates.','INVALID_ARGUMENT');result={ok:true,templates:selected?[selected]:TEMPLATES};}
  else if (command==='gallery') return gallery(flags);
  else if (command==='doctor') result=await workflows.doctor(root);
  else if (command==='export') result=await workflows.exportSite(root,flags);
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
