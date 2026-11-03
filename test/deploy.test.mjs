import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT=new URL('../',import.meta.url);
const DB_ID='11111111-1111-4111-8111-111111111111';
const ACCOUNT='a'.repeat(32), NAME='opc-deploy-fixture';
const STRIPE_NAMES=['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_ID'];
const stub=String.raw`
import fs from 'node:fs';
import path from 'node:path';
const file=path.join(process.cwd(),'.stub-wrangler.json');
const s=JSON.parse(fs.readFileSync(file,'utf8')),a=process.argv.slice(2);
s.actions.push(a);
const save=()=>fs.writeFileSync(file,JSON.stringify(s));
const ok=value=>{save();console.log(typeof value==='string'?value:JSON.stringify(value));};
const bad=message=>{save();console.error(message);process.exit(1);};
if(a[0]==='deploy'&&a.includes('--dry-run'))ok('dry-run complete');
else if(a[0]==='whoami')ok({loggedIn:true,accounts:[{id:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}]});
else if(a[0]==='versions'){
  if(s.versionsError)bad(s.versionsError);
  else if(!s.workerExists)bad('This Worker does not exist [code: 10007]');
  else ok(s.versions||[]);
}else if(a[0]==='d1'&&a[1]==='list')ok(s.databases||[]);
else if(a[0]==='d1'&&a[1]==='create'){
  s.intentAtCreate=JSON.parse(fs.readFileSync(path.join(process.cwd(),'.opc/resources.json'),'utf8'));
  if(a.includes('--json'))bad('Unknown argument: json');
  if(s.failCreate&&!s.createThenFail)bad('Network unavailable');
  s.databases=[{name:a[2],uuid:'11111111-1111-4111-8111-111111111111'}];
  if(s.createThenFail)bad('Response lost after creation');
  ok('D1 created');
}else if(a[0]==='d1'&&a[1]==='migrations'){
  s.migrations=(s.migrations||0)+1;ok('Migrations applied');
}else if(a[0]==='d1'&&a[1]==='execute'){
  ok([{success:true,results:(s.namespaceTables||[]).map(name=>({name}))}]);
}else if(a[0]==='secret'&&a[1]==='list')ok((s.secretNames||[]).map(name=>({name,type:'secret_text'})));
else if(a[0]==='deploy'){
  s.intentAtDeploy=JSON.parse(fs.readFileSync(path.join(process.cwd(),'.opc/resources.json'),'utf8'));
  const secretIndex=a.indexOf('--secrets-file');
  if(secretIndex>=0){s.secretFile=a[secretIndex+1];s.secretFileMode=fs.statSync(s.secretFile).mode&0o777;s.secretKeys=Object.keys(JSON.parse(fs.readFileSync(s.secretFile,'utf8')));}
  if(s.failDeploy&&!s.deployThenFail)bad('Upload rejected');
  const tag=a[a.indexOf('--tag')+1];
  s.workerExists=true;s.versions=[...(s.versions||[]),{id:'version-'+s.actions.length,metadata:{created_on:new Date().toISOString()},annotations:{'workers/tag':tag}}];
  if(s.deployThenFail)bad('Response lost after upload');
  ok('https://opc-deploy-fixture.example.workers.dev\nCurrent Version ID: '+s.versions.at(-1).id);
}else bad('Unexpected stub command: '+a.join(' '));
`;
async function fixture(settings={},mode='demo'){
  const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'opc-deploy-')));
  const runtime=path.join(dir,'runtime'),project=path.join(dir,'project');
  await fs.mkdir(path.join(runtime,'src'),{recursive:true});
  await fs.mkdir(path.join(runtime,'node_modules/wrangler/bin'),{recursive:true});
  await fs.mkdir(path.join(project,'.opc'),{recursive:true});
  await fs.cp(new URL('src/',ROOT),path.join(runtime,'src'),{recursive:true});
  await fs.writeFile(path.join(runtime,'package.json'),JSON.stringify({type:'module'}));
  await fs.writeFile(path.join(runtime,'node_modules/wrangler/package.json'),JSON.stringify({name:'wrangler',type:'module',exports:{'./package.json':'./package.json'}}));
  await fs.writeFile(path.join(runtime,'node_modules/wrangler/bin/wrangler.js'),stub);
  await fs.writeFile(path.join(project,'.opc/project.json'),JSON.stringify({schemaVersion:1,name:NAME,design:{preset:'editorial'},payments:{mode},deploy:{provider:'cloudflare',tier:'preview'}}));
  await fs.writeFile(path.join(project,'wrangler.jsonc'),JSON.stringify({name:NAME,main:'worker.mjs',vars:{APP_NAME:NAME,PAYMENT_MODE:mode},d1_databases:[{binding:'DB',database_name:NAME+'-orders',database_id:'00000000-0000-0000-0000-000000000000'}]}));
  await fs.writeFile(path.join(project,'worker.mjs'),'export default {};');
  await fs.writeFile(path.join(project,'.stub-wrangler.json'),JSON.stringify({actions:[],workerExists:false,databases:[],...settings}));
  const module=await import(pathToFileURL(path.join(runtime,'src/workflows.mjs')).href);
  const state=async()=>JSON.parse(await fs.readFile(path.join(project,'.stub-wrangler.json'),'utf8'));
  const resources=async()=>JSON.parse(await fs.readFile(path.join(project,'.opc/resources.json'),'utf8'));
  const update=async values=>fs.writeFile(path.join(project,'.stub-wrangler.json'),JSON.stringify({...await state(),...values}));
  return {project,module,state,resources,update,close:()=>fs.rm(dir,{recursive:true,force:true})};
}
async function withCleanEnv(fn,values={}){
  const names=[...new Set([...STRIPE_NAMES,'CLOUDFLARE_ACCOUNT_ID',...Object.keys(values)])];const before=Object.fromEntries(names.map(n=>[n,process.env[n]]));
  for(const n of names)delete process.env[n];Object.assign(process.env,values);
  try{return await fn();}finally{for(const n of names){if(before[n]===undefined)delete process.env[n];else process.env[n]=before[n];}}
}
async function runSuccessful(f,options={}){
  const original=globalThis.fetch;
  globalThis.fetch=async value=>{
    const url=String(value);
    if(url.endsWith('/api/health')){
      const s=await f.state(),args=s.actions.filter(a=>a[0]==='deploy'&&!a.includes('--dry-run')).at(-1);
      const buildId=args.find(a=>a.startsWith('BUILD_ID:')).slice('BUILD_ID:'.length);
      return Response.json({ok:true,app:'opc-paid-site',name:NAME,mode:'demo',configured:true,buildId});
    }
    return new Response(url.endsWith('/styles.css')?'body{color:#111;}\n'.repeat(20):'<title>Project</title><main>Ready</main>');
  };
  try{return await f.module.deploy(f.project,options);}finally{globalThis.fetch=original;}
}

async function sharedFixture(settings={}){
  const f=await fixture({databases:[{name:'owned-shared-orders',uuid:DB_ID}],...settings});
  const owner=path.join(path.dirname(f.project),'owner');await fs.mkdir(path.join(owner,'.opc'),{recursive:true});
  await fs.writeFile(path.join(owner,'.opc/resources.json'),JSON.stringify({schemaVersion:1,accountId:ACCOUNT,workerName:'owned-worker',databaseName:'owned-shared-orders',databaseId:DB_ID,workerCreatedByHarness:true}));
  const c=JSON.parse(await fs.readFile(path.join(f.project,'.opc/project.json'),'utf8'));
  await fs.writeFile(path.join(owner,'.opc/project.json'),JSON.stringify({...c,name:'owned-worker'}));
  c.deploy.databaseNamespace='xuqiu';await fs.writeFile(path.join(f.project,'.opc/project.json'),JSON.stringify(c));
  const w=JSON.parse(await fs.readFile(path.join(f.project,'wrangler.jsonc'),'utf8'));w.d1_databases[0].migrations_table='xuqiu_migrations';await fs.writeFile(path.join(f.project,'wrangler.jsonc'),JSON.stringify(w));
  await fs.mkdir(path.join(f.project,'migrations'));await fs.writeFile(path.join(f.project,'migrations/1001_xuqiu.sql'),'CREATE TABLE IF NOT EXISTS xuqiu_orders (id TEXT PRIMARY KEY);');
  return {...f,owner};
}
test('explicit owned-database reuse pins provenance and does not create a new database',async()=>withCleanEnv(async()=>{const f=await sharedFixture();try{const r=await runSuccessful(f,{'reuse-database-from':f.owner});assert.equal(r.ok,true);const state=await f.state(),resources=await f.resources();assert.equal(state.actions.some(a=>a[0]==='d1'&&a[1]==='create'),false);assert.equal(resources.databaseId,DB_ID);assert.equal(resources.sharedDatabase.namespace,'xuqiu');assert.equal(resources.sharedDatabase.sourceProject,f.owner);assert.equal(resources.sharedDatabase.migrationsTable,'xuqiu_migrations');}finally{await f.close();}}));
test('shared-database reuse refuses an already occupied unknown namespace',async()=>withCleanEnv(async()=>{const f=await sharedFixture({namespaceTables:['xuqiu_orders']});try{await assert.rejects(f.module.deploy(f.project,{'reuse-database-from':f.owner}),{code:'REMOTE_CONFLICT'});const s=await f.state();assert.equal(s.migrations,undefined);assert.equal(s.actions.some(a=>a[0]==='deploy'&&!a.includes('--dry-run')),false);}finally{await f.close();}}));
test('shared-database reuse refuses a different-account ownership record',async()=>withCleanEnv(async()=>{const f=await sharedFixture();try{const p=path.join(f.owner,'.opc/resources.json'),r=JSON.parse(await fs.readFile(p,'utf8'));r.accountId='b'.repeat(32);await fs.writeFile(p,JSON.stringify(r));await assert.rejects(f.module.deploy(f.project,{'reuse-database-from':f.owner}),{code:'REMOTE_CONFLICT'});assert.equal((await f.state()).migrations,undefined);}finally{await f.close();}}));
test('shared-database reuse refuses migrations that can alter old tables',async()=>withCleanEnv(async()=>{const f=await sharedFixture();try{await fs.appendFile(path.join(f.project,'migrations/1001_xuqiu.sql'),'DROP TABLE opc_orders;');await assert.rejects(f.module.deploy(f.project,{'reuse-database-from':f.owner}),{code:'UNSAFE_SHARED_MIGRATION'});assert.equal((await f.state()).migrations,undefined);}finally{await f.close();}}));
test('shared-database reuse requires a separate migration ledger',async()=>withCleanEnv(async()=>{const f=await sharedFixture();try{const p=path.join(f.project,'wrangler.jsonc'),w=JSON.parse(await fs.readFile(p,'utf8'));delete w.d1_databases[0].migrations_table;await fs.writeFile(p,JSON.stringify(w));await assert.rejects(f.module.deploy(f.project,{'reuse-database-from':f.owner}),{code:'SHARED_DATABASE_NAMESPACE_REQUIRED'});assert.equal((await f.state()).migrations,undefined);}finally{await f.close();}}));
function mutationCounts(s) {return {create:s.actions.filter(a=>a[0]==='d1'&&a[1]==='create').length,migrate:s.actions.filter(a=>a[0]==='d1'&&a[1]==='migrations').length,deploy:s.actions.filter(a=>a[0]==='deploy'&&!a.includes('--dry-run')).length};}

test('ordinary shared-database redeploy checks migrations even without a reuse flag',async()=>withCleanEnv(async()=>{
  const f=await sharedFixture();
  try {
    assert.equal((await runSuccessful(f,{'reuse-database-from':f.owner})).ok,true);
    const before=mutationCounts(await f.state());
    await fs.appendFile(path.join(f.project,'migrations/1001_xuqiu.sql'),'\nDROP TABLE opc_orders;');
    await assert.rejects(f.module.deploy(f.project),{code:'UNSAFE_SHARED_MIGRATION'});
    assert.deepEqual(mutationCounts(await f.state()),before,'unsafe ordinary redeploy must not migrate, create or upload');
  } finally {await f.close();}
}));

test('ordinary shared-database redeploy still permits unchanged isolated migrations',async()=>withCleanEnv(async()=>{
  const f=await sharedFixture();
  try {
    assert.equal((await runSuccessful(f,{'reuse-database-from':f.owner})).ok,true);
    assert.equal((await runSuccessful(f)).ok,true);
    assert.deepEqual(mutationCounts(await f.state()),{create:0,migrate:2,deploy:2});
    const r=await f.resources();assert.equal(r.sharedDatabase.namespace,'xuqiu');assert.equal(r.sharedDatabase.migrationsTable,'xuqiu_migrations');
  } finally {await f.close();}
}));

test('shared redeploy validates the configured migration directory instead of an unused default folder',async()=>withCleanEnv(async()=>{
  const f=await sharedFixture();
  try {
    assert.equal((await runSuccessful(f,{'reuse-database-from':f.owner})).ok,true);
    const before=mutationCounts(await f.state());
    await fs.mkdir(path.join(f.project,'release-migrations'));
    await fs.writeFile(path.join(f.project,'release-migrations/1002_unsafe.sql'),'CREATE TABLE IF NOT EXISTS opc_other_site (id TEXT);');
    const cfgPath=path.join(f.project,'wrangler.jsonc'),cfg=JSON.parse(await fs.readFile(cfgPath,'utf8'));cfg.d1_databases[0].migrations_dir='release-migrations';await fs.writeFile(cfgPath,JSON.stringify(cfg));
    await assert.rejects(f.module.deploy(f.project),{code:'UNSAFE_SHARED_MIGRATION'});
    assert.deepEqual(mutationCounts(await f.state()),before);
  } finally {await f.close();}
}));

test('shared redeploy rejects quoted references into another namespace',async()=>withCleanEnv(async()=>{
  const f=await sharedFixture();
  try {
    assert.equal((await runSuccessful(f,{'reuse-database-from':f.owner})).ok,true);
    const before=mutationCounts(await f.state());
    await fs.writeFile(path.join(f.project,'migrations/1002_reference.sql'),'CREATE TABLE IF NOT EXISTS xuqiu_external (id TEXT REFERENCES "opc_orders"(order_id));');
    await assert.rejects(f.module.deploy(f.project),{code:'UNSAFE_SHARED_MIGRATION'});
    assert.deepEqual(mutationCounts(await f.state()),before);
  } finally {await f.close();}
}));

for(const change of ['namespace','migration ledger']) test(`ordinary shared redeploy refuses a changed ${change}`,async()=>withCleanEnv(async()=>{
  const f=await sharedFixture();
  try {
    assert.equal((await runSuccessful(f,{'reuse-database-from':f.owner})).ok,true);
    const before=mutationCounts(await f.state());
    const file=path.join(f.project,change==='namespace'?'.opc/project.json':'wrangler.jsonc'),cfg=JSON.parse(await fs.readFile(file,'utf8'));
    if(change==='namespace') cfg.deploy.databaseNamespace='other';else cfg.d1_databases[0].migrations_table='d1_migrations';
    await fs.writeFile(file,JSON.stringify(cfg));
    await assert.rejects(f.module.deploy(f.project),{code:'REMOTE_CONFLICT'});assert.deepEqual(mutationCounts(await f.state()),before);
  } finally {await f.close();}
}));
const hasRemoteMutation=s=>s.actions.some(a=>(a[0]==='deploy'&&!a.includes('--dry-run'))||(a[0]==='d1'&&['create','migrations'].includes(a[1])));

test('deploy refuses an unknown existing Worker before any remote mutation',async()=>withCleanEnv(async()=>{
  const f=await fixture({workerExists:true,versions:[{id:'unrelated',metadata:{created_on:'2026-01-01'},annotations:{}}]});
  try{await assert.rejects(f.module.deploy(f.project),{code:'REMOTE_CONFLICT'});assert.equal(hasRemoteMutation(await f.state()),false);}finally{await f.close();}
}));

test('deploy refuses an unowned same-name D1 database without adopting or migrating',async()=>withCleanEnv(async()=>{
  const f=await fixture({databases:[{name:NAME+'-orders',uuid:DB_ID}]});
  try{await assert.rejects(f.module.deploy(f.project),{code:'REMOTE_CONFLICT'});assert.equal(hasRemoteMutation(await f.state()),false);}finally{await f.close();}
}));

test('a Worker authentication/permission failure is not treated as absence',async()=>withCleanEnv(async()=>{
  const f=await fixture({versionsError:'Authentication error [code: 10000]'});
  try{await assert.rejects(f.module.deploy(f.project),{code:'COMMAND_FAILED'});assert.equal(hasRemoteMutation(await f.state()),false);}finally{await f.close();}
}));

test('successful deployment records ownership, persists intents and uses supported Wrangler flags',async()=>withCleanEnv(async()=>{
  const f=await fixture();
  try{
    const result=await runSuccessful(f);assert.equal(result.ok,true);
    const s=await f.state(),r=await f.resources();
    const create=s.actions.find(a=>a[0]==='d1'&&a[1]==='create');assert.ok(create);assert.equal(create.includes('--json'),false);
    assert.equal(s.intentAtCreate.pendingCreation.database.absenceConfirmed,true);
    assert.equal(s.intentAtCreate.pendingCreation.database.name,NAME+'-orders');
    assert.ok(s.intentAtDeploy.pendingCreation.worker.tag.startsWith('opc-'));
    const actual=s.actions.find(a=>a[0]==='deploy'&&!a.includes('--dry-run'));assert.ok(actual.includes('--strict'));
    assert.equal(r.databaseId,DB_ID);assert.equal(r.workerCreatedByHarness,true);assert.equal(r.accountId,ACCOUNT);assert.ok(r.workerVersionId);
    assert.deepEqual(r.pendingCreation,{});
    await assert.rejects(fs.stat(path.join(f.project,'.opc/deploy.lock')),{code:'ENOENT'});
  }finally{await f.close();}
}));

test('D1 creation response loss retains intent and reconciles without creating twice',async()=>withCleanEnv(async()=>{
  const f=await fixture({createThenFail:true});
  try{
    await assert.rejects(f.module.deploy(f.project),{code:'RESOURCE_CREATION_UNCERTAIN'});
    assert.equal((await f.resources()).pendingCreation.database.absenceConfirmed,true);
    await f.update({createThenFail:false});
    assert.equal((await runSuccessful(f)).ok,true);
    const creates=(await f.state()).actions.filter(a=>a[0]==='d1'&&a[1]==='create');assert.equal(creates.length,1);
  }finally{await f.close();}
}));

test('an uncertain Worker upload is recoverable only through its saved unique version tag',async()=>withCleanEnv(async()=>{
  const f=await fixture({deployThenFail:true});
  try{
    await assert.rejects(f.module.deploy(f.project),{code:'DEPLOYMENT_UNCERTAIN'});
    assert.ok((await f.resources()).pendingCreation.worker.tag);
    await f.update({deployThenFail:false});
    assert.equal((await runSuccessful(f)).ok,true);
    assert.equal((await f.resources()).workerCreatedByHarness,true);
  }finally{await f.close();}
}));

test('missing Stripe test configuration blocks before database creation',async()=>withCleanEnv(async()=>{
  const f=await fixture({},'stripe_test');
  try{await assert.rejects(f.module.deploy(f.project),{code:'STRIPE_NOT_CONFIGURED'});assert.equal(hasRemoteMutation(await f.state()),false);}finally{await f.close();}
}));

test('Stripe bootstrap writes only whitelisted values privately and removes its temporary file after failure',async()=>withCleanEnv(async()=>{
  const f=await fixture({failDeploy:true},'stripe_test');
  try{
    await assert.rejects(f.module.deploy(f.project),{code:'DEPLOYMENT_UNCERTAIN'});
    const s=await f.state();assert.deepEqual(s.secretKeys.sort(),[...STRIPE_NAMES].sort());assert.equal(s.secretFileMode,0o600);
    await assert.rejects(fs.stat(s.secretFile),{code:'ENOENT'});
    assert.ok((await f.resources()).pendingCreation.worker.tag);
  }finally{await f.close();}
},{STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_PRICE_ID:'price_fixture',UNRELATED_TOKEN:'not-uploaded'}));

test('Stripe live credentials are rejected before remote mutations',async()=>withCleanEnv(async()=>{
  const f=await fixture({},'stripe_test');
  try{await assert.rejects(f.module.deploy(f.project),{code:'STRIPE_NOT_CONFIGURED'});assert.equal(hasRemoteMutation(await f.state()),false);}finally{await f.close();}
},{STRIPE_SECRET_KEY:'sk_live_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_PRICE_ID:'price_fixture'}));

async function ownWorker(f,versionId='owned-version'){
  await fs.writeFile(path.join(f.project,'.opc/resources.json'),JSON.stringify({schemaVersion:1,accountId:ACCOUNT,workerName:NAME,databaseName:NAME+'-orders',workerCreatedByHarness:true,workerVersionId:versionId,pendingCreation:{}}));
}
test('owned Stripe Worker missing remote secret names blocks before any mutations',async()=>withCleanEnv(async()=>{
  const f=await fixture({workerExists:true,versions:[{id:'owned-version',metadata:{created_on:'2026-01-01'},annotations:{}}],secretNames:['STRIPE_SECRET_KEY']},'stripe_test');
  try{
    await ownWorker(f);
    await assert.rejects(f.module.deploy(f.project),{code:'STRIPE_NOT_CONFIGURED'});
    const s=await f.state();assert.equal(hasRemoteMutation(s),false);
    assert.ok(s.actions.some(a=>a[0]==='secret'&&a.includes('--format')&&a.includes('json')));
  }finally{await f.close();}
}));

test('a remotely changed owned Worker is refused before database migrations',async()=>withCleanEnv(async()=>{
  const f=await fixture({workerExists:true,versions:[{id:'external-version',metadata:{created_on:'2026-01-01'},annotations:{}}]});
  try{await ownWorker(f);await assert.rejects(f.module.deploy(f.project),{code:'REMOTE_CONFLICT'});assert.equal(hasRemoteMutation(await f.state()),false);}finally{await f.close();}
}));
