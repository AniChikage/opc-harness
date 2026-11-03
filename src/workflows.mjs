import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { globalSetup, defaultProfile } from './global.mjs';
import { PACKAGE_ROOT, VERSION, ZERO_ID, fail, exists, readJSON, write, writeJSON, filesIn, validateConfig, configAt, managedWrite, fingerprint, evidence, safePath, redact } from './core.mjs';

const BEGIN='<!-- opc-harness:begin -->', END='<!-- opc-harness:end -->';
const ENTRY=`${BEGIN}\nFor website creation or changes involving design, payment, or deployment, use the opc-build-website skill.\nRead .opc/project.json and run \`node .opc/runtime/bin/opc.mjs inspect --json\` from this project root first.\nUse the shared skill and capability references; preserve existing user requirements and authorization.\nRun scoped verification before declaring completion; distinguish local demo, Stripe test, packaging, and remote deployment.\n${END}`;
async function sourceEntries(dir,dest) { const out={}; for (const rel of await filesIn(dir)) out[path.posix.join(dest,rel)]=await fs.readFile(path.join(dir,rel)); return out; }
function mergeEntry(old) {
  const a=old.indexOf(BEGIN),b=old.indexOf(END);
  if ((a<0)!==(b<0) || (a>=0 && (b<a || old.indexOf(BEGIN,a+BEGIN.length)>=0 || old.indexOf(END,b+END.length)>=0))) fail('Malformed or duplicate opc managed instruction block. Repair it before initializing.','FILE_CONFLICT');
  return a<0 ? old+(old.endsWith('\n')||!old?'':'\n')+'\n'+ENTRY+'\n' : old.slice(0,a)+ENTRY+old.slice(b+END.length);
}
export async function setup(root,opts={}) {
  if(opts.global) return globalSetup(root,opts);
  const file=path.resolve(opts.profile||path.join(root,'.opc/profile.json'));
  if (await exists(file)) return {ok:true,profile:file,preserved:true};
  const mode=opts.payment||'demo'; if(!['demo','stripe_test'].includes(mode)) fail('Invalid payment mode.','INVALID_CONFIG');
  await writeJSON(path.dirname(file),path.basename(file),{schemaVersion:1,design:{preset:'editorial'},payments:{mode},deploy:{provider:'cloudflare',tier:'preview'}});
  return {ok:true,profile:file,note:'Local preferences only. Credentials remain in environment variables or .dev.vars.'};
}
export async function init(root,opts={}) {
  const host=opts.host||'both'; if(!['both','codex','claude'].includes(host)) fail('host must be both, codex, or claude.','INVALID_ARGUMENT');
  await safePath(root,'.opc/project.json');
  const existing=await readJSON(path.join(root,'.opc/project.json'),null);
  let profile={}; const profileFile=existing?null:await defaultProfile(opts);
  if(profileFile) { await safePath(path.dirname(profileFile),path.basename(profileFile));profile=await readJSON(profileFile); if(profile.schemaVersion!==1) fail('Unsupported profile schema.','INVALID_CONFIG'); }
  const name=opts.name || path.basename(root).toLowerCase().replace(/[^a-z0-9-]/g,'-');
  const config=validateConfig(existing || {schemaVersion:1,name,design:profile.design||{preset:'editorial'},payments:{mode:opts.payment||profile.payments?.mode||'demo'},deploy:profile.deploy||{provider:'cloudflare',tier:'preview'}});
  if(existing && ((opts.name && opts.name!==existing.name)||(opts.payment && opts.payment!==existing.payments.mode))) fail('Existing project configuration is preserved. Edit .opc/project.json explicitly to change it.','CONFIG_CONFLICT');
  const entries={};
  for(const folder of ['bin','src','templates','skills']) Object.assign(entries,await sourceEntries(path.join(PACKAGE_ROOT,folder),`.opc/runtime/${folder}`));
  entries['.opc/runtime/package.json']=await fs.readFile(path.join(PACKAGE_ROOT,'package.json'));
  if(await exists(path.join(PACKAGE_ROOT,'package-lock.json'))) entries['.opc/runtime/package-lock.json']=await fs.readFile(path.join(PACKAGE_ROOT,'package-lock.json'));
  if(await exists(path.join(PACKAGE_ROOT,'npm-shrinkwrap.json'))) entries['.opc/runtime/npm-shrinkwrap.json']=await fs.readFile(path.join(PACKAGE_ROOT,'npm-shrinkwrap.json'));
  const hosts=host==='both'?['codex','claude']:[host];
  const instructions={};
  for(const h of hosts) {
    Object.assign(entries,await sourceEntries(path.join(PACKAGE_ROOT,'skills/opc-build-website'),`${h==='codex'?'.agents':'.claude'}/skills/opc-build-website`));
    const rel=h==='codex'?'AGENTS.md':'CLAUDE.md'; const file=await safePath(root,rel);
    instructions[rel]=mergeEntry(await exists(file)?await fs.readFile(file,'utf8'):'');
  }
  await managedWrite(root,entries);
  if(!existing) await writeJSON(root,'.opc/project.json',config);
  for(const [rel,content] of Object.entries(instructions)) await write(root,rel,content);
  if(!await exists(path.join(root,'.opc/design-brief.md'))) await write(root,'.opc/design-brief.md',`# Design brief\n\n${opts.brief||'Adapt the paid-tool starter to the user’s product and audience before delivery.'}\n\nPreset: editorial. Preserve the user’s requested product, language, pricing, and references.\n`);
  const ignoreFile=await safePath(root,'.gitignore'); let ignore=await exists(ignoreFile)?await fs.readFile(ignoreFile,'utf8'):'';
  for(const line of ['node_modules/','.dev.vars*','!.dev.vars.example','.env*','.wrangler/','.opc/runtime/','.opc/state.json','.opc/evidence/','.opc/build/']) if(!ignore.split(/\r?\n/).includes(line)) ignore+=(ignore.endsWith('\n')||!ignore?'':'\n')+line+'\n';
  await write(root,'.gitignore',ignore);
  return {ok:true,project:root,name:config.name,hosts,mode:config.payments.mode,next:['node .opc/runtime/bin/opc.mjs scaffold','node .opc/runtime/bin/opc.mjs dev'],note:'Project-local install; no global agent settings modified.'};
}
export async function inspect(root) {
  const c=await configAt(root); const fp=await fingerprint(root); const state=await readJSON(path.join(root,'.opc/state.json'),{capabilities:{}});
  const credentials={}; const local=await readLocalVars(root);
  for(const name of ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_ID','CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID']) credentials[name]={present:!!(process.env[name]||local[name]),source:process.env[name]?'environment':local[name]?'.dev.vars':'missing'};
  const blockers=[];
  if(c.payments.mode==='stripe_test') for(const n of ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_ID']) if(!credentials[n].present) blockers.push({capability:'payments',missing:n,action:`Set ${n} using .dev.vars locally or Wrangler secrets remotely. Never paste secrets into agent instructions.`});
  return {ok:true,version:VERSION,project:root,config:c,hosts:{codex:await exists(path.join(root,'.agents/skills/opc-build-website/SKILL.md')),claude:await exists(path.join(root,'.claude/skills/opc-build-website/SKILL.md'))},scaffolded:await exists(path.join(root,'worker.mjs')),credentials,evidence:Object.fromEntries(Object.entries(state.capabilities||{}).map(([k,v])=>[k,{...v,stale:v.fingerprint!==fp}])),blockers,next:blockers.length?'Continue design and local application work; resume Stripe validation after credential setup.':'Run plan, scaffold if needed, then dev and scoped verification.'};
}
export async function plan(root) { const i=await inspect(root); return {ok:true,name:i.config.name,capabilities:[{id:'design',requires:[],recipe:'editorial paid-tool',action:'Read .opc/design-brief.md; adapt public/ to the product and verify responsive UI.'},{id:'payments',requires:['worker','D1'],mode:i.config.payments.mode,action:i.config.payments.mode==='demo'?'Run payments test against the local app.':'Configure Stripe TEST keys, test Price, signed webhooks; run an actual Stripe test checkout.'},{id:'deployment',requires:['design','payments','cloudflare_auth'],provider:'cloudflare',tier:'preview',action:'Dry-run package, then deploy; verify returned URL and matching build identity.'}],blockers:i.blockers}; }
export async function scaffold(root) {
  const c=await configAt(root); const entries=await sourceEntries(path.join(PACKAGE_ROOT,'templates/paid-site'),'');
  const existing=await readJSON(path.join(root,'wrangler.jsonc'),null);
  const wrangler=existing||{name:c.name,main:'worker.mjs',compatibility_date:'2026-11-01',assets:{directory:'./public',binding:'ASSETS',run_worker_first:['/api/*','/demo-checkout']},vars:{APP_NAME:c.name,PAYMENT_MODE:c.payments.mode,DEPLOYMENT_TIER:'local'},d1_databases:[{binding:'DB',database_name:`${c.name}-orders`,database_id:ZERO_ID,migrations_dir:'migrations'}],observability:{enabled:false}};
  if(existing && (existing.vars?.PAYMENT_MODE!==c.payments.mode)) fail('Payment mode differs from wrangler.jsonc. Align both configs explicitly.','CONFIG_CONFLICT');
  if(!existing) entries['wrangler.jsonc']=JSON.stringify(wrangler,null,2)+'\n';
  await managedWrite(root,entries);
  return {ok:true,project:root,files:Object.keys(entries),mode:c.payments.mode,next:'node .opc/runtime/bin/opc.mjs dev'};
}
async function readLocalVars(root) { const p=await safePath(root,'.dev.vars'); if(!await exists(p)) return {}; const text=await fs.readFile(p,'utf8'); return Object.fromEntries(text.split(/\r?\n/).flatMap(line=>{const m=line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);return m?[[m[1],m[2].replace(/^(['"])(.*)\1$/,'$2')]]:[];})); }
async function execute(command,args,{cwd,inherit=false,input}={}) {
  return new Promise((resolve,reject)=>{ const child=spawn(command,args,{cwd,env:{...process.env,WRANGLER_SEND_METRICS:'false',CI:'true'},stdio:inherit?'inherit':['pipe','pipe','pipe']}); let stdout='',stderr=''; if(!inherit){ child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.stdin.end(input); } child.on('error',reject); child.on('close',code=>{if(code===0)resolve({stdout,stderr});else{const e=new Error(redact(`${command} failed (${code}): ${stderr||stdout}`));e.code='COMMAND_FAILED';reject(e);}}); });
}
async function wrangler(root,args,{inherit=false,input}={}) {
  let bin; const require=createRequire(path.join(PACKAGE_ROOT,'package.json'));
  const resolveBin=()=>path.join(path.dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js');
  try{bin=resolveBin();}catch {
    console.error('Installing the pinned Cloudflare runtime dependency…');
    const locked=await exists(path.join(PACKAGE_ROOT,'package-lock.json'))||await exists(path.join(PACKAGE_ROOT,'npm-shrinkwrap.json'));
    await execute('npm',[locked?'ci':'install','--omit=dev','--no-audit','--no-fund'],{cwd:PACKAGE_ROOT});
    bin=resolveBin();
  }
  const r=await execute(process.execPath,[bin,...args],{cwd:root,inherit,input});
  return r;
}
export async function dev(root,opts={}) {
  await configAt(root); if(!await exists(path.join(root,'worker.mjs'))) await scaffold(root);
  const port=Number(opts.port||8787);if(!Number.isInteger(port)||port<1024||port>65535) fail('port must be 1024–65535.','INVALID_ARGUMENT');
  await wrangler(root,['d1','migrations','apply','DB','--local']);
  await wrangler(root,['dev','--ip','127.0.0.1','--port',String(port)],{inherit:true});
}
function baseURL(value) { if(!value) fail('Provide --url (local or deployed application URL).','INVALID_ARGUMENT'); let url;try{url=new URL(value);}catch{fail('Invalid --url.','INVALID_ARGUMENT');} if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname)) fail('Use an HTTP(S) origin without credentials, path, query, or fragment.','INVALID_ARGUMENT'); return url.origin; }
async function request(url,options={}) { const r=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'error',...options}); let body;try{body=await r.json();}catch{body=null;} return {status:r.status,body}; }
export async function verify(root,opts={}) {
  const c=await configAt(root),url=baseURL(opts.url); const fp=await fingerprint(root),checks=[];
  try { const h=await request(url+'/api/health'); checks.push({name:'worker-health',pass:h.status===200&&h.body?.ok===true}); checks.push({name:'project-identity',pass:h.body?.app==='opc-paid-site'&&h.body?.name===c.name}); checks.push({name:'payment-mode',pass:h.body?.mode===c.payments.mode}); checks.push({name:'payment-configured',pass:h.body?.configured===true});
    const state=await readJSON(path.join(root,'.opc/state.json'),{capabilities:{}}); const deployment=state.capabilities?.deployment;
    const expectedBuild=opts.expectedBuild || (deployment?.url===url ? deployment.buildId : null);
    if(expectedBuild) checks.push({name:'deployment-build-identity',pass:h.body?.buildId===expectedBuild && expectedBuild===fp});
    const page=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'error'});const html=await page.text();checks.push({name:'page-content',pass:page.ok&&/<title>[^<]+<\/title>/i.test(html)&&/<main[\s>]/i.test(html)});
    const css=await fetch(url+'/styles.css',{signal:AbortSignal.timeout(15000),redirect:'error'});checks.push({name:'styles',pass:css.ok&&(await css.text()).length>100});
  } catch(e) { checks.push({name:'reachable',pass:false,error:redact(e.message)}); }
  const ok=checks.every(x=>x.pass); const record=await evidence(root,'http',{ok,scope:'http-smoke',url,checks,limitations:['No visual/browser verification is implied.','No real payment or settlement is implied.']});
  if(ok && checks.some(x=>x.name==='deployment-build-identity'&&x.pass)) {
    const state=await readJSON(path.join(root,'.opc/state.json'),{capabilities:{}}); const deployed=state.capabilities?.deployment;
    if(deployed?.url===url && deployed.buildId===fp) await evidence(root,'deployment',{ok:true,status:'remote-verified',scope:'cloudflare-preview',url,buildId:fp,mode:c.payments.mode});
  }
  return {...record,ok};
}
export async function paymentTest(root,opts={}) {
  const c=await configAt(root),url=baseURL(opts.url);
  try { return await paymentTestFlow(root,{...opts,url}); }
  catch(error) { return evidence(root,'payments',{ok:false,scope:c.payments.mode==='demo'?'demo-e2e':'stripe-test-unverified',url,checks:[{name:'payment-environment',pass:false,error:redact(error.message)}]}); }
}
async function paymentTestFlow(root,opts={}) {
  await configAt(root); const url=baseURL(opts.url),checks=[]; const health=await request(url+'/api/health');
  const c=await configAt(root);
  if(health.body?.app!=='opc-paid-site'||health.body?.name!==c.name) fail('Application identity does not match this project. No payment actions were attempted.','IDENTITY_MISMATCH');
  if(health.body?.mode!==c.payments.mode) fail('Payment mode differs from this project configuration. No payment actions were attempted.','CONFIG_CONFLICT');
  if(health.body?.mode!=='demo') { const record=await evidence(root,'payments',{ok:false,status:'blocked',scope:'stripe-test-unverified',url,blockers:['Automated simulation runs only in demo mode. Use a real Stripe TEST checkout and signed Stripe webhook, then verify the resulting entitlement.'],checks});return {...record,ok:false}; }
  if(health.status!==200||health.body?.configured!==true) fail('The demo payment environment is not configured.','PAYMENTS_NOT_CONFIGURED');
  const check=(name,pass)=>checks.push({name,pass:!!pass});
  const post=(route,body)=>request(url+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const checkout=await post('/api/checkout',{sku:'starter',idempotencyKey:crypto.randomUUID()});check('checkout-created',checkout.status===200&&checkout.body?.orderId&&checkout.body?.token&&checkout.body?.url);
  if(!checks[0].pass) return evidence(root,'payments',{ok:false,scope:'demo-e2e',url,checks});
  const {orderId,token}=checkout.body; const orderPath='/api/orders/'+encodeURIComponent(orderId)+'?token='+encodeURIComponent(token);
  const before=await request(url+orderPath); check('not-granted-before-payment',before.status===200&&before.body?.status==='pending'&&!before.body?.entitlement);
  const unauthorized=await request(url+'/api/orders/'+encodeURIComponent(orderId)+'?token=wrong');check('order-token-required',[401,403,404].includes(unauthorized.status));
  const fake=await post('/api/webhooks/stripe',{type:'checkout.session.completed',data:{object:{payment_status:'paid'}}});check('stripe-webhook-unavailable-in-demo',fake.status===404);
  const completed=await post('/api/demo/complete',{orderId,token});check('demo-payment-completed',completed.status===200);
  const after=await request(url+orderPath);check('entitlement-after-confirmation',after.status===200&&after.body?.status==='paid'&&!!after.body?.entitlement);
  const duplicate=await post('/api/demo/complete',{orderId,token});check('duplicate-completion-safe',duplicate.status===200);
  const download=after.body?.entitlement?.downloadUrl;
  if(download) { const target=new URL(download,url); if(target.origin!==url) fail('Download URL escaped the application origin.','UNSAFE_RESPONSE'); const d=await fetch(target,{signal:AbortSignal.timeout(15000),redirect:'error'});check('entitlement-download',d.ok&&(await d.text()).length>0); }
  else check('entitlement-download',false);
  return evidence(root,'payments',{ok:checks.every(x=>x.pass),scope:'demo-e2e',url,checks,note:'Simulated payment only. No Stripe sandbox transaction, real charge, or settlement was verified.'});
}
function jsonOutput(text) { try{return JSON.parse(text);}catch{ const start=text.indexOf('['),end=text.lastIndexOf(']');if(start>=0&&end>=start)try{return JSON.parse(text.slice(start,end+1));}catch{} fail('Cloudflare returned an unrecognized resource response. Inspect the account before retrying resource creation.','REMOTE_RESPONSE');} }

async function workerVersions(root,name) {
  try {
    const versions=jsonOutput((await wrangler(root,['versions','list','--name',name,'--json'])).stdout);
    if(!Array.isArray(versions)) fail('Cloudflare returned invalid Worker versions.','REMOTE_RESPONSE');
    return {exists:true,versions};
  } catch(error) {
    // Only explicit provider not-found errors establish absence. Auth/network failures do not.
    if(error.code==='COMMAND_FAILED' && /\[code:\s*(?:10007|10090)\]/i.test(error.message)) return {exists:false,versions:[]};
    throw error;
  }
}
async function deploymentAccount(root,config) {
  const user=jsonOutput((await wrangler(root,['whoami','--json'])).stdout);
  if(user.loggedIn!==true || !Array.isArray(user.accounts)) fail('Cloudflare authentication is not confirmed.','AUTH_REQUIRED');
  const explicit=process.env.CLOUDFLARE_ACCOUNT_ID||config.account_id;
  if(process.env.CLOUDFLARE_ACCOUNT_ID && config.account_id && process.env.CLOUDFLARE_ACCOUNT_ID!==config.account_id) fail('Cloudflare account environment and project configuration differ.','REMOTE_CONFLICT');
  const id=explicit || (user.accounts.length===1?user.accounts[0].id:null);
  if(!id || !user.accounts.some(a=>a.id===id)) fail('Select an accessible Cloudflare account using CLOUDFLARE_ACCOUNT_ID or account_id.','AUTH_REQUIRED');
  return id;
}
async function saveResources(root,resources) {
  const target=await safePath(root,'.opc/resources.json');
  const temp=await safePath(root,`.opc/resources-${crypto.randomUUID()}.tmp`);
  try { await fs.writeFile(temp,JSON.stringify({...resources,updatedAt:new Date().toISOString()},null,2)+'\n',{mode:0o600,flag:'wx'}); await fs.rename(temp,target); }
  finally { await fs.rm(temp,{force:true}); }
}
async function deployLock(root) {
  const file=await safePath(root,'.opc/deploy.lock');
  try { const handle=await fs.open(file,'wx',0o600); await handle.writeFile(JSON.stringify({pid:process.pid,at:new Date().toISOString()}));await handle.close(); }
  catch(error) {
    if(error.code!=='EEXIST') throw error;
    fail('Another deployment may be running. Inspect .opc/deploy.lock and remove it only after confirming that process stopped.','DEPLOYMENT_LOCKED');
  }
  return ()=>fs.rm(file,{force:true});
}
function newestVersion(versions) { return [...versions].sort((a,b)=>String(a.metadata?.created_on||'').localeCompare(String(b.metadata?.created_on||''))).at(-1); }
function versionTag(version) { return version?.annotations?.['workers/tag']; }
async function stripeDeploySecrets(root,existingWorker) {
  const local=await readLocalVars(root); const names=['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_ID'];
  const supplied=Object.fromEntries(names.map(name=>[name,process.env[name]||local[name]||'']));
  if(Object.values(supplied).some(Boolean)) {
    if(!/^(sk|rk)_test_[A-Za-z0-9]+$/.test(supplied.STRIPE_SECRET_KEY) || !/^whsec_\S+$/.test(supplied.STRIPE_WEBHOOK_SECRET) || !/^price_[A-Za-z0-9]+$/.test(supplied.STRIPE_PRICE_ID)) fail('Provide all three valid Stripe TEST values in environment or .dev.vars. Live keys are not supported.','STRIPE_NOT_CONFIGURED');
    return supplied;
  }
  if(!existingWorker) fail('A new Stripe test Worker requires STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and STRIPE_PRICE_ID in environment or .dev.vars.','STRIPE_NOT_CONFIGURED');
  const remote=jsonOutput((await wrangler(root,['secret','list','--format','json'])).stdout);
  if(!Array.isArray(remote) || names.some(name=>!remote.some(secret=>secret.name===name))) fail('The owned Worker is missing required remote Stripe test secrets. Configure them before deployment.','STRIPE_NOT_CONFIGURED');
  return null;
}
async function validateSharedMigrations(root,ns,db) {
  if(!/^[a-z][a-z0-9_]{2,31}$/.test(ns||'')||db.migrations_table!==ns+'_migrations') fail('Shared D1 requires a pinned database namespace and its own matching migrations_table.','SHARED_DATABASE_NAMESPACE_REQUIRED');
  const directory=await safePath(root,db.migrations_dir||'migrations');
  for(const rel of (await filesIn(directory)).filter(x=>x.toLowerCase().endsWith('.sql'))) {
    const sql=(await fs.readFile(path.join(directory,rel),'utf8')).replace(/--[^\n]*/g,'');
    for(const statement of sql.split(';').map(x=>x.trim()).filter(Boolean)) {
      const create=statement.match(/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-z_][a-z0-9_]*)\s*\(/i);
      const refs=[...statement.matchAll(/\bREFERENCES\s+([^\s(]+)/ig)].map(x=>x[1].replace(/^["`\[]|["`\]]$/g,''));
      if(!create||![create[1],...refs].every(name=>/^[a-z_][a-z0-9_]*$/i.test(name)&&name.startsWith(ns+'_'))) fail('Shared-D1 migrations may only add namespaced tables and references.','UNSAFE_SHARED_MIGRATION',{file:rel});
    }
  }
}
async function reuseOwnedDatabase(root,c,config,resources,accountId,databases,sourceDirectory) {
  const sourceRoot=path.resolve(sourceDirectory);
  if(sourceRoot===path.resolve(root)) fail('Database reuse must name a different owned project.','REMOTE_CONFLICT');
  await safePath(sourceRoot,'.opc/resources.json');
  const source=await readJSON(path.join(sourceRoot,'.opc/resources.json'));
  const sourceConfig=await configAt(sourceRoot);
  const ns=c.deploy.databaseNamespace;
  const db=config.d1_databases.find(x=>x.binding==='DB');
  if(!/^[a-z][a-z0-9_]{2,31}$/.test(ns||'')||ns===(sourceConfig.deploy.databaseNamespace||'opc')||db.migrations_table!==ns+'_migrations') fail('Shared D1 requires a distinct databaseNamespace and its own matching migrations_table.','SHARED_DATABASE_NAMESPACE_REQUIRED');
  if(source.schemaVersion!==1||source.accountId!==accountId||!source.workerCreatedByHarness||!source.databaseId||source.workerName!==sourceConfig.name) fail('The source database has no confirmed same-account harness ownership.','REMOTE_CONFLICT');
  const remote=databases.find(x=>x.uuid===source.databaseId&&x.name===source.databaseName);
  if(!remote) fail('Source database identity is not confirmed in this account.','REMOTE_CONFLICT');
  if(resources.databaseId&&resources.databaseId!==source.databaseId) fail('The project already owns a different database; it will not be rebound.','REMOTE_CONFLICT');
  if(!resources.databaseId&&databases.some(x=>x.name===db.database_name&&x.uuid!==source.databaseId)) fail('Resolve the previous creation intent before changing database bindings.','RESOURCE_CREATION_UNCERTAIN');
  await validateSharedMigrations(root,ns,db);
  const prior=resources.sharedDatabase;
  if(!prior) {
    const rows=jsonOutput((await wrangler(root,['d1','execute',source.databaseName,'--remote','--command',`SELECT name FROM sqlite_master WHERE type='table' AND name GLOB '${ns}_*'`,'--json'])).stdout);
    if(!Array.isArray(rows)||rows.some(x=>x.success===false)||rows.some(x=>!Array.isArray(x.results))) fail('Could not verify that the database namespace is unused.','REMOTE_RESPONSE');
    if(rows.some(x=>x.results.length)) fail('The chosen namespace already exists without a project ownership record.','REMOTE_CONFLICT');
  } else if(prior.namespace!==ns||prior.sourceDatabaseId!==source.databaseId) fail('Shared database provenance differs from the recorded project.','REMOTE_CONFLICT');
  db.database_id=source.databaseId;db.database_name=source.databaseName;
  resources.databaseId=source.databaseId;resources.databaseName=source.databaseName;
  resources.sharedDatabase={sourceProject:sourceRoot,sourceWorkerName:source.workerName,sourceDatabaseId:source.databaseId,namespace:ns,migrationsTable:db.migrations_table};
  delete resources.pendingCreation.database;
  await saveResources(root,resources);
  await writeJSON(root,'wrangler.jsonc',config);
}
export async function deploy(root,opts={}) {
  const c=await configAt(root); if(!await exists(path.join(root,'worker.mjs'))) fail('Run scaffold before deployment.','MISSING_SCAFFOLD');
  const config=await readJSON(path.join(root,'wrangler.jsonc'));
  if(config.name!==c.name || config.vars?.PAYMENT_MODE!==c.payments.mode) fail('Align Worker name and PAYMENT_MODE in wrangler.jsonc and .opc/project.json.','CONFIG_CONFLICT');
  // Packaging is read-only and happens before account/resource mutations on every deployment.
  await wrangler(root,['deploy','--dry-run','--outdir','.opc/build']);
  if(opts['dry-run']) return evidence(root,'package',{ok:true,scope:'local-build',note:'Packaged successfully. No remote deployment or payment validation is implied.'});
  const release=await deployLock(root); let secretsFile;
  try {
    const accountId=await deploymentAccount(root,config);
    const db=config.d1_databases?.find(x=>x.binding==='DB');
    if(!db || !/^[A-Za-z0-9_-]{3,100}$/.test(db.database_name||'')) fail('A named D1 DB binding is required.','INVALID_CONFIG');
    await safePath(root,'.opc/resources.json');
    const resources=await readJSON(path.join(root,'.opc/resources.json'),{schemaVersion:1,accountId,workerName:config.name,databaseName:db.database_name,pendingCreation:{}});
    if(resources.schemaVersion!==1 || resources.accountId!==accountId || resources.workerName!==config.name || (resources.databaseName!==db.database_name&&!opts['reuse-database-from'])) fail('Resource ownership record does not match this project/account. No remote resources were changed.','REMOTE_CONFLICT');
    resources.pendingCreation ||= {};
    let worker=await workerVersions(root,config.name);
    const latest=newestVersion(worker.versions);
    if(worker.exists) {
      // An uncertain prior upload is recoverable only by our unique, persisted version tag.
      const pending=resources.pendingCreation.worker;
      if(pending && versionTag(latest)===pending.tag) {
        resources.workerCreatedByHarness=true; resources.workerVersionId=latest.id; resources.lastDeploymentTag=pending.tag;
        delete resources.pendingCreation.worker; await saveResources(root,resources);
      }
      if(!resources.workerCreatedByHarness || !resources.workerVersionId || latest?.id!==resources.workerVersionId) fail('An existing or externally changed Worker is not owned by this deployment record. Choose a new project name or inspect the resource before proceeding.','REMOTE_CONFLICT');
    }
    // Establish payment prerequisites before D1 creation/migrations or Worker changes.
    const secrets=c.payments.mode==='stripe_test'?await stripeDeploySecrets(root,worker.exists):null;
    config.account_id=accountId;
    const listDatabases=async()=>{
      const databases=jsonOutput((await wrangler(root,['d1','list','--json'])).stdout);
      if(!Array.isArray(databases)) fail('Cloudflare returned invalid D1 resources.','REMOTE_RESPONSE');
      return databases;
    };
    let databases=await listDatabases();
    if(opts['reuse-database-from']) await reuseOwnedDatabase(root,c,config,resources,accountId,databases,opts['reuse-database-from']);
    if(resources.sharedDatabase) {
      if(resources.sharedDatabase.namespace!==c.deploy.databaseNamespace||resources.sharedDatabase.migrationsTable!==db.migrations_table||resources.sharedDatabase.sourceDatabaseId!==resources.databaseId) fail('The shared database identity, namespace and migration ledger must remain pinned.','REMOTE_CONFLICT');
      // Ownership persists across deploys, so the SQL guard must persist too, without requiring a reuse flag.
      await validateSharedMigrations(root,resources.sharedDatabase.namespace,db);
    }
    let named=databases.filter(item=>item.name===db.database_name);
    if(named.length>1) fail('Multiple matching D1 databases; resolve explicitly.','REMOTE_CONFLICT');
    if(resources.databaseId) {
      if(named[0]?.uuid!==resources.databaseId || (db.database_id!==ZERO_ID && db.database_id!==resources.databaseId)) fail('Recorded D1 identity differs from the remote binding. No migrations were run.','REMOTE_CONFLICT');
    } else if(named.length) {
      const pending=resources.pendingCreation.database;
      if(!pending || pending.name!==db.database_name || pending.accountId!==accountId || pending.absenceConfirmed!==true) fail('A same-name D1 database already exists without a matching creation record. It will not be adopted or migrated.','REMOTE_CONFLICT');
      resources.databaseId=named[0].uuid;
      delete resources.pendingCreation.database;
      await saveResources(root,resources);
    } else {
      if(db.database_id!==ZERO_ID) fail('An unowned D1 ID is configured. No remote resources were changed.','REMOTE_CONFLICT');
      resources.pendingCreation.database={name:db.database_name,accountId,absenceConfirmed:true,at:new Date().toISOString()};
      await saveResources(root,resources);
      // d1 create has no --json flag in the pinned Wrangler. Resolve the new UUID by re-listing.
      try { await wrangler(root,['d1','create',db.database_name,'--update-config=false']); }
      catch(error) { fail('D1 creation outcome is uncertain. The intent was saved; inspect the account or re-run deploy to reconcile it before creating anything else.','RESOURCE_CREATION_UNCERTAIN',{cause:redact(error.message)}); }
      databases=await listDatabases(); named=databases.filter(item=>item.name===db.database_name);
      if(named.length!==1) fail('D1 creation returned no unique confirmed database. Creation intent was retained for reconciliation.','RESOURCE_CREATION_UNCERTAIN');
      resources.databaseId=named[0].uuid;
      delete resources.pendingCreation.database;
      await saveResources(root,resources);
    }
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(resources.databaseId||'')) fail('No confirmed D1 database UUID.','REMOTE_RESPONSE');
    db.database_id=resources.databaseId;
    await writeJSON(root,'wrangler.jsonc',config);
    await wrangler(root,['d1','migrations','apply','DB','--remote']);
    const buildId=await fingerprint(root),tag=`opc-${crypto.randomBytes(12).toString('hex')}`;
    resources.pendingCreation.worker={tag,buildId,accountId,name:config.name,at:new Date().toISOString(),previousVersionId:resources.workerVersionId||null};
    await saveResources(root,resources);
    const args=['deploy','--strict','--tag',tag,'--var',`BUILD_ID:${buildId}`,'--var','DEPLOYMENT_TIER:preview'];
    if(secrets) {
      secretsFile=await safePath(root,`.opc/runtime/stripe-secrets-${crypto.randomUUID()}.json`);
      await fs.mkdir(path.dirname(secretsFile),{recursive:true});
      await fs.writeFile(secretsFile,JSON.stringify(secrets),{mode:0o600,flag:'wx'});
      args.push('--secrets-file',secretsFile);
    }
    let deployed;
    try { deployed=await wrangler(root,args); }
    catch(error) { fail('Worker deployment outcome is uncertain. The unique deployment tag was saved; re-run deploy to reconcile it.','DEPLOYMENT_UNCERTAIN',{cause:redact(error.message)}); }
    const confirmed=await workerVersions(root,config.name);
    const version=confirmed.versions.find(item=>versionTag(item)===tag);
    if(!version) fail('Uploaded Worker version could not be confirmed. Its deployment intent was retained for reconciliation.','DEPLOYMENT_UNCERTAIN');
    resources.workerCreatedByHarness=true; resources.workerVersionId=version.id;resources.lastDeploymentTag=tag;resources.buildId=buildId;
    delete resources.pendingCreation.worker;
    const url=deployed.stdout.match(/https:\/\/[a-z0-9.-]+\.workers\.dev\b/i)?.[0];
    if(url) resources.url=url;
    await saveResources(root,resources);
    if(!url) fail('Deployment succeeded, but no workers.dev URL was returned. Inspect the owned Worker before retrying.','DEPLOYMENT_UNCERTAIN');
    await evidence(root,'deployment',{ok:true,scope:'cloudflare-preview',url,buildId,mode:c.payments.mode});
    const smoke=await verify(root,{url,expectedBuild:buildId});
    if(!smoke.ok) await evidence(root,'deployment',{ok:false,status:'deployed-unhealthy',scope:'cloudflare-preview',url,buildId,mode:c.payments.mode,checks:smoke.checks});
    return {ok:smoke.ok,url,buildId,scope:'cloudflare-preview',mode:c.payments.mode,verification:smoke,note:c.payments.mode==='demo'?'Public preview has simulated payments, visibly labelled.':'Stripe TEST mode only; complete a sandbox transaction separately.'};
  } finally {
    if(secretsFile) await fs.rm(secretsFile,{force:true});
    await release();
  }
}
