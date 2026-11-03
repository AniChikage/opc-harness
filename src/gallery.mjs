import http from "node:http";
import { TEMPLATES, siteDefaults, templateById } from "./catalog.mjs";
import { templateEntries } from "./render.mjs";
import { escapeHTML as e } from "./pages.mjs";
import { fail } from "./core.mjs";
const shellQuote = (s) => "'" + String(s).replaceAll("'", "'\\''") + "'";
export async function gallery(opts = {}) {
  const port = Number(opts.port || 8788);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    fail("port must be 1024–65535.", "INVALID_ARGUMENT");
  const cache = new Map();
  for (const t of TEMPLATES)
    cache.set(
      t.id,
      await templateEntries({
        name: "template-preview",
        design: { preset: "editorial", template: t.id },
        site: siteDefaults(t.id),
        payments: { mode: t.payment },
        deploy: { provider: "cloudflare", tier: "preview" },
      }),
    );
  const cards = TEMPLATES.map(
    (t) =>
      `<article data-category="${e(t.category)}"><div class="preview"><iframe loading="lazy" src="/templates/${t.id}/" title="${e(t.name)} template preview" tabindex="-1" sandbox="allow-scripts allow-same-origin allow-downloads"></iframe></div><div class="card-body"><span>${e(t.category)}</span><h2>${e(t.name)}</h2><p>${e(t.description)}</p><div class="features">${t.features.map((x) => `<span>${e(x)}</span>`).join("")}</div><div class="actions"><a href="/templates/${t.id}/" target="_blank" rel="noopener">Open preview</a><button data-select="${t.id}">Choose template</button></div></div></article>`,
  ).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>OPC Harness — Template library</title><link rel="stylesheet" href="/gallery.css"><script src="/gallery.js" defer></script></head><body><header><a href="/">OPC Harness</a><span>Template library / v0.4.0</span></header><main><section class="intro"><h1>Pick it. Make it yours. Ship it.</h1><p>Eight complete websites, ready to use as shown. Choose a layout, set your brand, and generate the whole project.</p></section><nav aria-label="Template categories"><button class="selected" data-filter="All" aria-pressed="true">All templates</button>${[...new Set(TEMPLATES.map((x) => x.category))].map((x) => `<button data-filter="${e(x)}" aria-pressed="false">${e(x)}</button>`).join("")}</nav><div class="grid">${cards}</div><p class="notice">Previews run local interface interactions. Checkout and deployment are enabled in generated projects with your chosen payment mode and account configuration.</p></main><dialog aria-labelledby="choose-title"><button id="close-dialog">Close</button><h2 id="choose-title">Make this template yours.</h2><label>Brand name<input id="brand" maxlength="100" required></label><label>Project folder<input id="project" value="my-website" pattern="[a-z][a-z0-9-]{2,45}" required></label><pre><code id="command"></code></pre><button id="copy-command">Copy command</button><p id="copy-status" role="status"></p><p>Or run <code>opc-harness create --interactive</code> to choose and generate directly in your terminal.</p></dialog></body></html>`;
  const js = `const catalog=${JSON.stringify(TEMPLATES)};const quote=${shellQuote.toString()};let selected;const dialog=document.querySelector('dialog'),brand=document.querySelector('#brand'),project=document.querySelector('#project');function command(){if(!selected)return;document.querySelector('#command').textContent='npx --yes opc-harness@0.4.0 create --dir '+quote('./'+project.value)+' --name '+quote(project.value)+' --template '+selected.id+' --brand '+quote(brand.value)+' --host both';}document.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{selected=catalog.find(t=>t.id===b.dataset.select);brand.value=selected.brand;command();dialog.showModal();});document.querySelector('#close-dialog').onclick=()=>dialog.close();brand.oninput=project.oninput=command;document.querySelector('#copy-command').onclick=async()=>{try{await navigator.clipboard.writeText(document.querySelector('#command').textContent);document.querySelector('#copy-status').textContent='Command copied.';}catch{document.querySelector('#copy-status').textContent='Select and copy the command above.';}};document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});document.querySelectorAll('article').forEach(x=>x.hidden=b.dataset.filter!=='All'&&x.dataset.category!==b.dataset.filter);});`;
  const css = `*{box-sizing:border-box}body{margin:0;background:#f7f9fc;color:#162532;font:16px/1.6 system-ui,sans-serif}header,main{width:min(1440px,calc(100% - 80px));margin:auto}header{display:flex;justify-content:space-between;align-items:center;padding:30px 0;border-bottom:1px solid #d9e1e8}header a{font-weight:750;text-decoration:none;font-size:23px;color:inherit}header span{font-size:14px;color:#617181}.intro{padding:60px 0 28px}.intro h1{font-size:clamp(35px,4.5vw,64px);letter-spacing:-2.5px;line-height:1.1;margin:0 0 22px;font-weight:650}.intro p{font-size:19px;max-width:65ch;color:#617181}nav{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 38px}button,a,input{font:inherit}button{cursor:pointer}nav button{border:1px solid #d0d9e4;border-radius:100px;padding:8px 18px;background:white;color:#526476}.selected{background:#223f72!important;color:white!important;border-color:#223f72!important}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px}article{border:1px solid #d8e1ea;background:white;border-radius:12px;overflow:hidden}.preview{height:310px;overflow:hidden;background:#ecf0f5;pointer-events:none;border-bottom:1px solid #d8e1ea}.preview iframe{width:1280px;height:800px;transform:scale(.48);transform-origin:top left;border:0}.card-body{padding:25px 28px}.card-body>span{font-size:13px;color:#617181}.card-body h2{font-size:28px;letter-spacing:-.8px;margin:5px 0 10px}.card-body p{color:#617181;min-height:50px;margin:0 0 18px}.features{display:flex;flex-wrap:wrap;gap:8px;font-size:12px;color:#617181}.features span{padding:3px 8px;border:1px solid #e0e5eb;border-radius:4px}.actions{display:flex;justify-content:space-between;align-items:center;margin-top:26px;gap:20px}.actions a{color:#294f8c;text-underline-offset:4px}.actions button,#copy-command{background:#233f70;border:0;border-radius:6px;color:white;padding:10px 18px}.notice{padding:30px 0;color:#617181;font-size:14px}dialog{max-width:650px;width:calc(100% - 40px);border:1px solid #c4d1e1;border-radius:12px;padding:32px;color:#162532}dialog::backdrop{background:#152d4b88}#close-dialog{float:right;border:1px solid #c4d1e1;background:white;border-radius:5px;padding:5px 12px}dialog h2{clear:both;padding-top:15px}label{display:grid;gap:8px;margin:20px 0}input{border:1px solid #bccbd9;border-radius:5px;padding:10px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eff3f8;padding:20px;border-radius:5px;font-size:13px}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #3165ab;outline-offset:3px}[hidden]{display:none!important}@media(max-width:750px){header,main{width:calc(100% - 32px)}header span{display:none}.grid{grid-template-columns:1fr}.intro{padding-top:40px}.preview iframe{transform:scale(.4)}.preview{height:260px}}`;
  const server = http.createServer((request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      let body,
        type = "text/html; charset=utf-8";
      if (url.pathname === "/") body = html;
      else if (url.pathname === "/gallery.js") {
        body = js;
        type = "text/javascript";
      } else if (url.pathname === "/gallery.css") {
        body = css;
        type = "text/css";
      } else if (url.pathname === "/api/health") {
        body = JSON.stringify({ mode: "preview", configured: false });
        type = "application/json";
      } else {
        const match = url.pathname.match(/^\/templates\/([a-z]+)\/(.*)$/);
        if (!match || !cache.has(match[1])) {
          response.writeHead(404);
          response.end("Not found");
          return;
        }
        const file = match[2] || "index.html";
        if (file.includes("..") || file.includes("%")) {
          response.writeHead(404);
          response.end();
          return;
        }
        body = cache.get(match[1])["public/" + file];
        if (!body) {
          response.writeHead(404);
          response.end("Not found");
          return;
        }
        if (file === "app.js")
          body = body
            .toString()
            .replace(
              "'/site-config.js'",
              "'/templates/" + match[1] + "/site-config.js'",
            );
        type = file.endsWith(".css")
          ? "text/css"
          : file.endsWith(".js")
            ? "text/javascript"
            : file.endsWith(".svg")
              ? "image/svg+xml"
              : "text/html; charset=utf-8";
        if (file.endsWith(".html"))
          body = body
            .toString()
            .replace(/(href|src)="\//g, `$1="/templates/${match[1]}/`);
      }
      response.writeHead(200, {
        "content-type": type,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      response.end(body);
    } catch {
      response.writeHead(500);
      response.end("Preview unavailable.");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  console.log(
    JSON.stringify({
      ok: true,
      url: `http://127.0.0.1:${port}`,
      templates: TEMPLATES.length,
      scope: "template-preview",
    }),
  );
  return server;
}
