import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { INDIE_IDS, INDIE_REFERENCES } from '../src/indie-catalog.mjs';
import { TEMPLATES, siteDefaults } from '../src/catalog.mjs';
import { templateEntries } from '../src/render.mjs';
import { galleryEntries } from '../src/gallery.mjs';
import { create, configure, design } from '../src/workflows.mjs';
import { designSignature } from '../src/design.mjs';
import { parseBriefInput, stageBrief, consumeBrief, handoffKey } from '../templates/paid-site/public/brief-handoff.js';

test('five original templates have real, identical preview and generated assets', async () => {
  const gallery = await galleryEntries();
  for (const id of INDIE_IDS) {
    const generated = await templateEntries({schemaVersion:1,name:'sample-site',design:{preset:'editorial',template:id},site:siteDefaults(id),payments:{mode:'none'},deploy:{provider:'static',tier:'preview'}});
    const prefix = `templates/${id}/`;
    const html = generated['public/index.html'].toString();
    assert.equal(gallery[prefix+'index.html'].toString(), html.replace(/(href|src)="\//g, `$1="/${prefix}`));
    for (const asset of ['styles.css',`${id}.css`,'workspace-theme.css','indie.js','brief-handoff.js','favicon.svg','fonts/InterVariable.woff2','fonts/OFL.txt']) {
      assert.ok(generated['public/'+asset], asset);
      assert.deepEqual(gallery[prefix+asset], generated['public/'+asset]);
    }
    assert.match(generated['public/styles.css'].toString(), /url\('\.\/fonts\/InterVariable.woff2'\)/);
    assert.equal(Object.keys(generated).filter(file=>INDIE_IDS.some(other=>other !== id && file.endsWith(`/${other}.css`))).length, 0);
    assert.match(html, /data-site-description/);
    assert.match(html, /workspace.html/);
    const workspace = generated['public/workspace.html'].toString();
    assert.match(workspace, new RegExp(`<body class="template-${id}"`));
    assert.match(workspace, /href="\/workspace-theme.css"/);
    assert.doesNotMatch(workspace, /M3 13 29 3 21 29/);
    assert.doesNotMatch(html, /snapok|datafast|datafa\.st|tally|buttondown|screen[ .-]?studio|https?:\/\//i);
    assert.match(INDIE_REFERENCES[id][0].url, /^https:\/\//);
    assert.equal(TEMPLATES.find(template=>template.id===id)?.payment, 'none');
  }
  // Portable catalogue output does not publish a developer's machine path or
  // point an unreleased template at an older, incompatible npm runtime.
  assert.equal(JSON.parse(gallery['catalog.json'].toString()).createCommand, 'opc-harness');
});

test('new template branding changes preserve the design lock and escape content', async t => {
  const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'opc-indie-design-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  for (const id of INDIE_IDS) {
    const dir = path.join(root, id);
    await create(dir, {name:'original-site',template:id,stack:'static',payment:'none',host:'both'});
    const mark = await fs.readFile(path.join(dir, 'public/favicon.svg'), 'utf8');
    await configure(dir, {brand:'Our own <brand>',headline:'A different idea, in our own words.',description:'Original content & a clear purpose.',accent:'#89513e',email:'hello@original.example'});
    const html = await fs.readFile(path.join(dir, 'public/index.html'), 'utf8');
    assert.match(html, /Our own &lt;brand&gt;/);
    assert.match(html, /Original content &amp; a clear purpose\./);
    assert.match(html, /mailto:hello@original.example/);
    assert.equal(await fs.readFile(path.join(dir, 'public/favicon.svg'), 'utf8'), mark);
    assert.equal((await design(dir)).ok, true);
    const fontPath = path.join(dir, 'public/fonts/InterVariable.woff2');
    const font = await fs.readFile(fontPath);
    font[20] = font[20] ^ 255;
    await fs.writeFile(fontPath, font);
    const changed = await design(dir);
    assert.equal(changed.ok, false);
    assert.ok(changed.drifted.some(file=>file.file==='public/fonts/InterVariable.woff2' && file.reason==='modified'));
  }
});

test('font design signatures hash bytes rather than lossy decoded text', () => {
  assert.notEqual(designSignature('public/example.woff2',Buffer.from([0x80])),designSignature('public/example.woff2',Buffer.from([0x81])));
});

const draft = {idea:'A useful reading notebook',audience:'Readers',outcome:'Try one idea'};
function memoryStorage() {
  const entries = new Map<string,string>();
  return { entries, getItem:(key:string)=>entries.get(key)??null, setItem:(key:string,value:string)=>{entries.set(key,value);},removeItem:(key:string)=>{entries.delete(key);} };
}
test('draft handoff is single-use, scoped to the project and preserves saved work', () => {
  const storage = memoryStorage();
  storage.setItem('paperplane.draft', JSON.stringify({idea:'Previous work'}));
  const source = 'https://example.test/templates/scribble/';
  assert.equal(stageBrief(storage,source,{...draft,privateToken:'not copied'}),true);
  assert.equal(consumeBrief(storage,'https://example.test/templates/petal/workspace.html'),null);
  assert.deepEqual(consumeBrief(storage,source+'workspace.html#workspace'),draft);
  assert.equal(consumeBrief(storage,source),null);
  assert.equal(storage.getItem('paperplane.draft'),JSON.stringify({idea:'Previous work'}));
  assert.equal(storage.entries.size,1);
  assert.equal(handoffKey('https://example.test/workspace.html'),handoffKey('https://example.test/'));
});
test('handoff rejects invalid, over-limit and corrupt inputs without losing saved work', () => {
  for (const value of [null, [], {}, {...draft,idea:''}, {...draft,idea:42}, {...draft,audience:'a'.repeat(301)}, {...draft,outcome:'a'.repeat(501)}, {...draft,idea:'a'.repeat(3001)}]) assert.equal(parseBriefInput(value),null);
  const storage = memoryStorage(), href='https://example.test/';
  storage.setItem(handoffKey(href),'{broken');
  assert.equal(consumeBrief(storage,href),null);
  assert.equal(storage.getItem(handoffKey(href)),null);
  assert.deepEqual(parseBriefInput({...draft,idea:'  A useful reading notebook  ',private:'discard'}),draft);
  const denied = {getItem(){throw new Error('Denied');},setItem(){throw new Error('Denied');},removeItem(){throw new Error('Denied');}};
  assert.equal(stageBrief(denied,href,draft),false);
  assert.equal(consumeBrief(denied,href),null);
});
