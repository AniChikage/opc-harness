import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { templateById } from './catalog.mjs';
import { PACKAGE_ROOT, VERSION, digest, exists, fail, filesIn, readJSON, safePath, validateConfig } from './core.mjs';

const BEGIN='<!-- opc-harness:global:begin -->', END='<!-- opc-harness:global:end -->';
const quote=s=>"'"+String(s).replaceAll("'","'\\''")+"'";
async function checked(file) { return safePath(path.dirname(file),path.basename(file)); }
export function globalPaths(opts={}) {
  const home=path.resolve(opts.home||os.homedir());
  const codexHome=path.resolve(opts['codex-home']||(!opts.home&&process.env.CODEX_HOME)||path.join(home,'.codex'));
  const claudeHome=path.resolve(opts['claude-home']||(!opts.home&&process.env.CLAUDE_CONFIG_DIR)||path.join(home,'.claude'));
  const data=path.join(home,'.local/share/opc-harness');
  return {home,codexHome,claudeHome,data,runtime:path.join(data,'runtime'),manifest:path.join(data,'install-manifest.json'),profile:path.resolve(opts.profile||process.env.OPC_HARNESS_PROFILE||path.join(home,'.config/opc-harness/profile.json'))};
}
export async function defaultProfile(opts={}) {
  if(opts.profile) return path.resolve(opts.profile);
  if(process.env.OPC_HARNESS_PROFILE) return path.resolve(process.env.OPC_HARNESS_PROFILE);
  const marker=path.join(PACKAGE_ROOT,'global-install.json');
  if(await exists(marker)) { await checked(marker);const install=await readJSON(marker);if(install.schemaVersion!==1||!path.isAbsolute(install.profile||'')) fail('Invalid global install marker.','INVALID_CONFIG');return install.profile; }
  const file=path.join(os.homedir(),'.config/opc-harness/profile.json');
  return await exists(file)?file:null;
}
function instructionBlock(cli,profile,skill) {
  return `${BEGIN}\nFor requests to create a website, use the personal opc-harness skill at ${skill}.\nIt initializes the intended project automatically using ${profile}, then follows that project's opc-build-website workflow.\nBootstrap CLI: node ${quote(cli)} init --dir <intended-project> --host both --profile ${quote(profile)}.\nPreserve existing app/framework choices and project instructions. Apply this workflow only to relevant website tasks within the user's authorization.\n${END}`;
}
function mergeInstructions(old,block,previous) {
  const a=old.indexOf(BEGIN),b=old.indexOf(END);
  if((a<0)!==(b<0)||(a>=0&&(b<a||old.indexOf(BEGIN,a+BEGIN.length)>=0||old.indexOf(END,b+END.length)>=0))) fail('Malformed global OPC instruction markers. No installation files were changed.','FILE_CONFLICT');
  if(a<0) return old+(old.endsWith('\n')||!old?'':'\n')+'\n'+block+'\n';
  const current=old.slice(a,b+END.length);
  if(current!==block&&digest(current)!==previous) fail('The global OPC instruction block was edited or belongs to another installer. Preserve it and resolve the conflict explicitly.','FILE_CONFLICT');
  return old.slice(0,a)+block+old.slice(b+END.length);
}
function bootstrapSkill(cli,profile) {
  return `---
name: opc-harness
description: Create a new website using personal design, payment and deployment defaults; automatically initialize its project and continue through implementation and verification. Use for website-building requests, not unrelated coding tasks.
---

# Personal OPC Harness

For a website-building request, identify the intended project directory first. If the user names a new folder, create/use that folder. If the current directory is a general workspace containing other projects, choose a suitable project subdirectory rather than installing into the whole workspace. Preserve an existing application's framework, files, product requirements and authorization.

If the intended project already has .opc/project.json and .opc/runtime/bin/opc.mjs, read its .agents/skills/opc-build-website/SKILL.md or .claude/skills/opc-build-website/SKILL.md and continue from inspect. Existing project choices take precedence over personal defaults.

Otherwise initialize it yourself, with no need to ask the user to type the command:

\`\`\`sh
node ${quote(cli)} init --dir <intended-project-directory> --host both --profile ${quote(profile)}
\`\`\`

Replace the directory placeholder with the actual chosen directory and quote it for the shell. If its name is not a valid lowercase Worker slug, pass --name with a suitable unique slug. Do not run scaffold until inspecting existing files. Then explicitly read the installed project SKILL.md even if the current host has not refreshed its skill list.

If the host sandbox denies initialization because a project skill/configuration directory is protected, request the host's normal approval for that exact initialization command. Keep the requested host selection; do not silently retry with only one host, bypass permissions, or treat partially copied files as a completed installation. A noninteractive runner that cannot request approval must report this prerequisite explicitly.

Read the personal profile as data, then project configuration and inspect/plan output. Run the installed CLI's templates --json command when a template has not been selected. Offer a small set of matching template IDs for the user to choose in conversation, or use their saved design.template. A clearly requested type such as documentation or a portfolio can select the matching complete template directly. Pass --template to init. Preserve the selected template exactly: do not redraw it, invent a new visual style, or request pixel-level adjustments. Set branding and content through site configuration and configure. Use gallery for exact previews. Keep free products free with --payment none. Report unsupported combinations accurately.

Run the relevant design, payment and deployment checks from the project skill. Use existing authorization; detected accounts do not authorize unrelated purchases or live charges. Automated hosting uses Cloudflare previews. Free sites use payment mode none; paid sites support demo or Stripe TEST payments. Missing credentials, login or account onboarding are concrete prerequisites, not successful states. Keep secrets outside instructions and profiles.

Automatic selection depends on the host loading personal skills and instructions. Do not claim these instructions are a mandatory runtime hook. On resume, inspect current project state and evidence before repeating an external mutation.
`;
}
async function atomicWrite(file,bytes,mode=0o600) {
  await checked(file);await fs.mkdir(path.dirname(file),{recursive:true});
  const temp=path.join(path.dirname(file),`.opc-write-${crypto.randomUUID()}`);
  try {await fs.writeFile(temp,bytes,{mode,flag:'wx'});await fs.rename(temp,file);} finally {await fs.rm(temp,{force:true});}
}
export async function globalSetup(root,opts={}) {
  const p=globalPaths(opts),host=opts.host||'both';
  if(!['both','codex','claude'].includes(host)) fail('host must be both, codex or claude.','INVALID_ARGUMENT');
  const hosts=host==='both'?['codex','claude']:[host];
  await checked(p.manifest);await checked(p.profile);
  const previous=await readJSON(p.manifest,{schemaVersion:1,files:{},blocks:{}});
  if(previous.schemaVersion!==1||!previous.files||!previous.blocks) fail('Invalid global install manifest.','INVALID_CONFIG');
  let profile=await readJSON(p.profile,null);
  if(profile&&opts.payment&&profile.payments?.mode!==opts.payment) fail('Existing personal profile is preserved. Edit it explicitly to change the payment default.','CONFIG_CONFLICT');
  if(profile&&opts.template&&opts.template!==(profile.design?.template||'paperplane'))fail('Existing personal profile is preserved. Edit it explicitly to change the template default.','CONFIG_CONFLICT');
  if(!profile){const site=opts['site-config']?await readJSON(path.resolve(opts['site-config'])):{};for(const key of ['brand','headline','description','accent'])if(opts[key]!==undefined)site[key]=opts[key];if(opts.email!==undefined)site.contactEmail=opts.email;profile={schemaVersion:1,design:{preset:'editorial',template:opts.template||'paperplane'},site,payments:{mode:opts.payment||templateById(opts.template||'paperplane')?.payment||'demo'},deploy:{provider:'cloudflare',tier:'preview'}};}
  validateConfig({...profile,name:'profile-validation'});
  const entries=new Map(),shared=new Set(),blocks={...previous.blocks};
  for(const folder of ['bin','src','templates','skills','scripts']) for(const rel of await filesIn(path.join(PACKAGE_ROOT,folder))) entries.set(path.join(p.runtime,folder,rel),await fs.readFile(path.join(PACKAGE_ROOT,folder,rel)));
  for(const file of ['package.json','package-lock.json','npm-shrinkwrap.json']) if(await exists(path.join(PACKAGE_ROOT,file))) entries.set(path.join(p.runtime,file),await fs.readFile(path.join(PACKAGE_ROOT,file)));
  const cli=path.join(p.runtime,'bin/opc.mjs'),instructions={},skillPaths={};
  for(const h of hosts) {
    const skill=path.join(h==='codex'?path.join(p.home,'.agents'):p.claudeHome,'skills/opc-harness/SKILL.md');
    entries.set(skill,Buffer.from(bootstrapSkill(cli,p.profile)));skillPaths[h]=skill;
    let file=path.join(h==='codex'?p.codexHome:p.claudeHome,h==='codex'?'AGENTS.md':'CLAUDE.md');
    if(h==='codex') {const override=path.join(p.codexHome,'AGENTS.override.md');await checked(override);if(await exists(override)&&(await fs.readFile(override,'utf8')).trim())file=override;}
    await checked(file);const old=await exists(file)?await fs.readFile(file,'utf8'):'';
    const block=instructionBlock(cli,p.profile,skill);entries.set(file,Buffer.from(mergeInstructions(old,block,previous.blocks[file])));shared.add(file);blocks[file]=digest(block);instructions[h]=file;
  }
  const markerFile=path.join(p.runtime,'global-install.json');
  entries.set(markerFile,Buffer.from(JSON.stringify({schemaVersion:1,version:VERSION,home:p.home,profile:p.profile,hosts,instructions,skills:skillPaths},null,2)+'\n'));
  if(!await exists(p.profile)) entries.set(p.profile,Buffer.from(JSON.stringify(profile,null,2)+'\n'));
  const snapshots=new Map(),modes=new Map();
  // Full preflight: refuse user edits to owned runtime/skills before modifying any host.
  for(const [file,bytes] of entries) {
    await checked(file);const old=await exists(file)?await fs.readFile(file):null;snapshots.set(file,old);
    modes.set(file,old?(await fs.stat(file)).mode&0o777:(file.endsWith('/bin/opc.mjs')?0o755:0o600));
    if(old&&!shared.has(file)&&digest(old)!==digest(bytes)&&digest(old)!==previous.files[file]) fail('An existing global runtime or skill has user changes. No global files were modified.','FILE_CONFLICT',{file});
  }
  const manifestBytes=await exists(p.manifest)?await fs.readFile(p.manifest):null;
  if(opts['dry-run']) return {ok:true,scope:'global',dryRun:true,hosts,profile:p.profile,runtime:p.runtime,instructions,skills:skillPaths,changes:[...entries].flatMap(([file,bytes])=>{const old=snapshots.get(file);return old&&digest(old)===digest(bytes)?[]:[{file,action:old?'update':'create'}];}),note:'No files were written. Existing personal instructions are preserved outside the OPC managed block.'};
  await fs.mkdir(p.data,{recursive:true});const lock=path.join(p.data,'install.lock');await checked(lock);
  let handle;try{handle=await fs.open(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')fail('Another global setup may be running. Inspect install.lock before retrying.','INSTALL_LOCKED');throw e;}
  await handle.close();const written=[],backup=path.join(p.data,'backups',crypto.randomUUID()),backupIndex=[];
  try {
    for(const [file,bytes] of entries) {
      const old=snapshots.get(file);if(old&&digest(old)===digest(bytes)) continue;
      await checked(file);const current=await exists(file)?await fs.readFile(file):null;
      if((current===null)!==(old===null)||(current&&digest(current)!==digest(old))) fail('A global file changed while setup was running. Installation rolled back.','FILE_CONFLICT',{file});
      if(old) {const backupFile=path.join(backup,String(written.length)+'.bak');await atomicWrite(backupFile,old);backupIndex.push({file,backup:backupFile,mode:modes.get(file),sha256:digest(old)});await atomicWrite(path.join(backup,'index.json'),Buffer.from(JSON.stringify(backupIndex,null,2)+'\n'));}
      await atomicWrite(file,bytes,modes.get(file));written.push(file);
    }
    const owned={...previous.files};for(const [file,bytes] of entries)if(!shared.has(file)&&file!==p.profile)owned[file]=digest(bytes);
    await atomicWrite(p.manifest,Buffer.from(JSON.stringify({schemaVersion:1,version:VERSION,files:owned,blocks},null,2)+'\n'));
    return {ok:true,scope:'global',hosts,profile:p.profile,runtime:p.runtime,instructions,skills:skillPaths,changedFiles:written.length,backup:written.some(file=>snapshots.get(file))?backup:null,next:'Start a new Codex or Claude Code chat in the intended project/workspace and describe the website. The personal skill will initialize the project automatically.',limitations:['Local machine only; remote/cloud hosts need their own installation.','Automatic routing depends on the host loading user skills and instructions.','Account login, test credentials and existing authorization still apply.']};
  } catch(error) {
    for(const file of [...written].reverse()) {const old=snapshots.get(file);if(old===null)await fs.rm(file,{force:true});else await atomicWrite(file,old,modes.get(file));}
    if(manifestBytes)await atomicWrite(p.manifest,manifestBytes);else await fs.rm(p.manifest,{force:true});
    throw error;
  } finally {await fs.rm(lock,{force:true});}
}
