import type { Options, TemplateDefinition } from '../../src/types.mjs';
import fs from "node:fs/promises";
import path from "node:path";
import { TEMPLATES } from "../../src/catalog.mjs";
import { escapeHTML as e } from "../../src/pages.mjs";
import { VERSION, write } from "../../src/core.mjs";
import { galleryEntries, serveEntries } from "../../src/gallery.mjs";

const LOGO = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2" y="2" width="9" height="9" rx="2.5" fill="currentColor"/><rect x="13" y="2" width="9" height="9" rx="2.5" fill="currentColor"/><rect x="2" y="13" width="9" height="9" rx="2.5" fill="currentColor"/><rect x="13" y="13" width="9" height="9" rx="2.5" fill="currentColor"/></svg>`;
const ARROW = `<svg class="arrow-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5"/></svg>`;
const SCENE_ICONS: Record<string,string> = {
  design: `<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>`,
  payments: `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>`,
  deploy: `<path d="M7 18H6a4 4 0 0 1-.3-8A6.5 6.5 0 0 1 18 8a5 5 0 0 1 0 10h-1M12 21V11m-4 4 4-4 4 4"/>`,
};

function plate(template: TemplateDefinition) {
  return `<a class="plate" href="/studio/?template=${e(template.id)}">
        <span class="plate-window"><span class="plate-bar" aria-hidden="true"><span class="browser-dots"><i></i><i></i><i></i></span><span>${e(template.category)}</span></span><span class="plate-screen" data-screen data-ratio="0.64"><iframe src="/templates/${e(template.id)}/" title="${e(template.name)} website preview" loading="lazy" tabindex="-1" sandbox="allow-scripts allow-same-origin"></iframe></span></span>
        <span class="plate-caption"><span><b>${e(template.name)}</b><span>${e(template.category)}</span></span>${ARROW}</span>
      </a>`;
}

const COMPARISON_SCENES = [
  {
    id: 'design', label: 'Design', task: 'Make it look right.',
    request: 'Build a website for my next product.',
    messages: [
      ['Agent', 'What visual direction should I use?'],
      ['You', 'A polished SaaS page. Match this reference.'],
      ['Agent', 'Here is a first version.'],
      ['You', 'Keep the layout. Fix the type, spacing, and mobile view.'],
    ],
    loop: 'Describe. Review. Explain the design again.',
    instruction: 'Use Orbit, with my brand. Keep this design.',
    steps: ['Choose a real preview', 'Apply your brand', 'Lock the design'],
    artifact: `<div class="comparison-browser"><div class="comparison-browser-bar"><span class="browser-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Orbit / Exact template preview</span><a href="/studio/?template=pulse" aria-label="Explore the Orbit design">Explore <span aria-hidden="true">↗</span></a></div><div class="comparison-site-preview" data-screen data-ratio="0.41"><iframe src="/templates/pulse/" title="The exact Orbit website template" tabindex="-1" loading="lazy" sandbox="allow-scripts allow-same-origin"></iframe></div><div class="comparison-design-lock"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="8" width="12" height="9" rx="2"/><path d="M7 8V5a3 3 0 0 1 6 0v3M10 11v3"/></svg><span>Layout, styles &amp; behavior stay checked.</span></div></div>`,
    result: 'Choose the finished design. Keep it through the build.',
    action: 'Find your design', href: '/studio/?type=landing',
  },
  {
    id: 'payments', label: 'Payments', task: 'Connect the business logic.',
    request: 'Let visitors preview for free and pay to export.',
    messages: [
      ['You', 'Add Stripe Checkout.'],
      ['Agent', 'What price, callback, and export rules should I use?'],
      ['You', 'Use test mode. Only unlock exports after confirmed payment.'],
      ['Agent', 'We still need to connect and check the full path.'],
    ],
    loop: 'Specify each connection. Check the handoffs.',
    instruction: 'Use the Stripe test export recipe.',
    steps: ['Configure once', 'Connect the flow', 'Test the handoff'],
    artifact: `<div class="comparison-payment"><div class="artifact-heading"><span>Included payment path</span><span class="artifact-tag">Stripe test</span></div><ol class="payment-path"><li><span class="path-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg></span><div><strong>Checkout</strong><span>A hosted Stripe test session</span></div></li><li><span class="path-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7zM8 12l3 3 5-6"/></svg></span><div><strong>Signed webhook</strong><span>Validate payment before fulfillment</span></div></li><li><span class="path-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 13h6M9 17h6"/></svg></span><div><strong>Markdown export</strong><span>Unlocked for a confirmed paid order</span></div></li></ol><div class="artifact-footnote">Pending or failed payments keep export locked.</div></div>`,
    result: 'A connected recipe, with payment and access rules included.',
    action: 'Explore the export tool', href: '/studio/?template=store',
  },
  {
    id: 'deploy', label: 'Deployment', task: 'Finish the delivery.',
    request: 'Put this website online, ready to share.',
    messages: [
      ['Agent', 'Where should this run?'],
      ['You', 'Cloudflare. Set up the project and bindings.'],
      ['Agent', 'The deploy command finished.'],
      ['You', 'Now check the live URL and confirm the current build.'],
    ],
    loop: 'Choose the plumbing. Remember the final checks.',
    instruction: 'Use my Cloudflare defaults. Verify the preview.',
    steps: ['Package', 'Deploy the preview', 'Verify the build'],
    artifact: `<div class="comparison-handoff"><div class="artifact-heading"><span>Preview handoff</span><span class="artifact-tag">Cloudflare</span></div><div class="handoff-title"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 22H5a4 4 0 0 1 0-8h2a8 8 0 0 1 15-3 6 6 0 0 1 3 11h-3M16 28V15m-5 5 5-5 5 5"/></svg><strong>A release you can check.</strong></div><dl class="handoff-checks"><div><dt>Package</dt><dd>Dry run before upload</dd></div><div><dt>Deploy</dt><dd>Your chosen account &amp; stack</dd></div><div><dt>Verify</dt><dd>Live page, assets &amp; build identity</dd></div></dl><div class="artifact-footnote">Delivery evidence stays with the project.</div></div>`,
    result: 'A preview URL checked against the source you just built.',
    action: 'Choose your delivery path', href: '/studio/',
  },
];

function comparison() {
  return `<section class="section difference" id="difference" aria-labelledby="difference-title">
    <div class="difference-head"><h2 id="difference-title">Your idea. Fewer loose ends<span class="period">.</span></h2><p class="difference-lede">The design direction. The payment wiring. The final deployment check. Give your agent a path you can reuse.</p></div>
    <div class="comparison-tabs" role="tablist" aria-label="Compare website delivery workflows">${COMPARISON_SCENES.map((scene,i)=>`<button id="compare-tab-${scene.id}" type="button" role="tab" aria-selected="${!i}" aria-controls="compare-panel-${scene.id}" tabindex="${i?-1:0}" data-compare="${scene.id}"><svg class="comparison-tab-icon" viewBox="0 0 24 24" aria-hidden="true">${SCENE_ICONS[scene.id]}</svg><span>${e(scene.label)}</span><span class="comparison-tab-task">${e(scene.task)}</span></button>`).join('')}</div>
    ${COMPARISON_SCENES.map((scene,i)=>`<div id="compare-panel-${scene.id}" class="comparison-panel" role="tabpanel" aria-labelledby="compare-tab-${scene.id}" tabindex="0"${i?' hidden':''}><div class="comparison-request"><span class="request-label">You ask</span><p>&ldquo;${e(scene.request)}&rdquo;</p><span class="request-context">Same agent. Same idea.</span></div><div class="comparison-grid"><article class="comparison-column comparison-manual"><header class="comparison-column-head"><div><p>Codex / Claude Code alone</p><h3>You connect the pieces.</h3></div><span class="comparison-mode">Manual setup</span></header><div class="comparison-conversation" aria-label="Illustrated manual setup conversation">${scene.messages.map(([speaker,text])=>`<div class="comparison-message ${speaker==='You'?'message-user':'message-agent'}"><span class="message-avatar" aria-hidden="true">${speaker==='You'?'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3z"/></svg>':LOGO}</span><div><span class="message-speaker">${e(speaker)}</span><p>${e(text)}</p></div></div>`).join('')}</div><div class="comparison-loop"><span class="loop-icon" aria-hidden="true">↻</span><span>${e(scene.loop)}</span></div><footer class="comparison-column-foot"><span>Your role</span><strong>Direct each step.</strong></footer></article><article class="comparison-column comparison-harness"><header class="comparison-column-head"><div><p>With OPC Harness</p><h3>Your defaults connect them.</h3></div><span class="comparison-mode">Reusable setup</span></header><div class="comparison-instruction"><span class="instruction-label">Your direction</span><p>&ldquo;${e(scene.instruction)}&rdquo;</p></div><ol class="comparison-pipeline" aria-label="Harness workflow">${scene.steps.map(step=>`<li>${e(step)}</li>`).join('')}</ol>${scene.artifact}<footer class="comparison-column-foot"><div><span>Your role</span><strong>Choose the result.</strong></div><a href="${e(scene.href)}">${e(scene.action)} <span aria-hidden="true">↗</span></a></footer></article></div><p class="comparison-takeaway"><span aria-hidden="true">${LOGO}</span>${e(scene.result)}</p></div>`).join('')}
    <p class="comparison-note">Illustrated workflows, not a timing benchmark. Connect your own accounts; missing settings are reported together.</p><p class="comparison-announcement" role="status" aria-live="polite"></p>
  </section>`;
}

function landingPage() {
  const date = new Date().toISOString().slice(0, 10);
  const featured = ["pulse", "portfolio", "console"];
  const templates = [
    ...featured.map(id => TEMPLATES.find(template => template.id === id)!),
    ...TEMPLATES.filter(template => !featured.includes(template.id)),
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="One sentence to your coding agent. A finished website, verified and deployed. OPC Harness gives one-person companies a delivery path that skips the prompt loop.">
<meta name="theme-color" content="#ffffff">
<title>OPC Harness — One sentence. A finished website.</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232563eb'%3E%3Crect x='2' y='2' width='9' height='9' rx='2.5'/%3E%3Crect x='13' y='2' width='9' height='9' rx='2.5'/%3E%3Crect x='2' y='13' width='9' height='9' rx='2.5'/%3E%3Crect x='13' y='13' width='9' height='9' rx='2.5'/%3E%3C/svg%3E">
<link rel="preload" href="/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site.css">
<script src="/site.js" type="module"></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="site-header">
  <a class="brand" href="/" aria-label="OPC Harness home">${LOGO}<span class="brand-name">OPC Harness</span></a>
  <nav aria-label="Primary">
    <a href="#difference">Difference</a>
    <a href="#catalogue">Catalogue</a>
    <a href="/studio/">Studio</a>
    <a href="https://github.com/AniChikage/opc-harness" target="_blank" rel="noopener noreferrer">GitHub</a>
  </nav>
  <a class="header-cta" href="#install">Install</a>
</header>

<main id="main">
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <h1 id="hero-title">One sentence.<br>A finished website.</h1>
      <p class="hero-lede">Get to a working preview faster. Start with a finished design, payment recipes and saved deployment defaults.</p>
    </div>
    <div class="hero-overview" aria-labelledby="overview-title" data-workflow-demo data-demo-state="static">
      <div class="overview-heading"><span class="overview-signal" aria-hidden="true">${LOGO}</span><span id="overview-title">Less setup. Faster shipping.</span></div>
      <div class="overview-brief"><span><b aria-hidden="true">&gt;</b> Build my website.</span><span>Workflow illustration</span></div>
      <table class="overview-table">
        <caption class="overview-caption">Your website workflow, with and without saved delivery defaults</caption>
        <colgroup><col class="overview-step-col"><col><col></colgroup>
        <thead><tr><th scope="col">Step</th><th scope="col">Without a harness</th><th scope="col">With OPC Harness</th></tr></thead>
        <tbody>
          <tr data-demo-stage="design" data-demo-row-state="active"><th scope="row">Design</th><td data-manual-state="active"><span class="overview-loop" data-manual-icon aria-hidden="true">↻</span><span class="overview-manual-line">Describe the layout.</span></td><td><span class="overview-result"><span class="overview-check" aria-hidden="true">→</span> <span data-demo-result>Applying design</span></span></td></tr>
          <tr data-demo-stage="payments" data-demo-row-state="waiting"><th scope="row">Payments</th><td data-manual-state="waiting"><span class="overview-loop" data-manual-icon aria-hidden="true">·</span><span class="overview-manual-line">Waiting on design</span></td><td><span class="overview-result"><span class="overview-check" aria-hidden="true">·</span> <span data-demo-result>Stripe test recipe</span></span></td></tr>
          <tr data-demo-stage="deploy" data-demo-row-state="waiting"><th scope="row">Deployment</th><td data-manual-state="waiting"><span class="overview-loop" data-manual-icon aria-hidden="true">·</span><span class="overview-manual-line">Waiting on payments</span></td><td><span class="overview-result"><span class="overview-check" aria-hidden="true">·</span> <span data-demo-result>Deploy + verify</span></span></td></tr>
        </tbody>
      </table>
      <div class="overview-outcome"><div><div class="overview-progress-caption"><span>Without a harness</span><span data-demo-manual-percent>0%</span></div><strong data-demo-manual-outcome>Describing design</strong><div class="overview-demo-track overview-manual-track" data-manual-progress role="progressbar" aria-label="Illustrated manual workflow progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div></div><div><div class="overview-progress-caption"><span>With OPC Harness</span><span data-demo-percent>0%</span></div><strong data-demo-outcome>Applying design</strong><div class="overview-demo-track" data-harness-progress role="progressbar" aria-label="Illustrated harness workflow progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div></div></div>
      <p class="overview-demo-note">Workflow illustration, not a build-time benchmark.</p>
    </div>
    <div class="hero-actions">
      <a class="button" href="/studio/">Choose a design ${ARROW}</a>
      <a class="button ghost" href="#difference">See the workflow</a>
      <span class="hero-hosts">For Codex &amp; Claude Code. Install once. Reuse your setup.</span>
    </div>
  </section>

  ${comparison()}

  <section class="section catalogue" id="catalogue">
    <div class="section-head">
      <div><h2>Eleven finished websites.</h2><p>Choose the design you want to ship.</p></div>
      <a class="text-link" href="/studio/">Open the studio ${ARROW}</a>
    </div>
    <div class="sheet">
      ${templates.map(plate).join("\n      ")}
      <a class="sheet-more" href="/studio/">
        <span class="sheet-more-icon">${LOGO}</span><strong>Make it yours.</strong><span>Open the studio ${ARROW}</span>
      </a>
    </div>
  </section>

  <section class="section install" id="install">
    <div class="install-row">
      <div class="install-copy"><h2>Install once.</h2><p class="install-note">Then ask for a design by name. Codex and Claude Code both work.</p></div>
      <div class="install-terminal"><div class="terminal-bar"><span class="browser-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Terminal</span></div><div class="install-command">
        <code>npx --yes opc-harness@latest setup --global --host both</code>
        <button class="copy" type="button" data-copy="npx --yes opc-harness@latest setup --global --host both">Copy</button>
      </div></div>
    </div>
  </section>

  <section class="cta">
    <div class="cta-inner">
      <h2>Choose a website you can see.</h2>
      <div class="cta-actions">
        <a class="button inverse" href="/studio/">Open the catalogue ${ARROW}</a>
        <a class="button outline-dark" href="#install">Install</a>
      </div>
    </div>
  </section>
</main>

<footer class="site-footer">
  <span class="footer-brand">${LOGO}<span>OPC Harness</span></span>
  <span class="footer-links"><a href="/studio/">Studio</a><a href="https://github.com/AniChikage/opc-harness" target="_blank" rel="noopener noreferrer">GitHub</a><a href="https://github.com/AniChikage/opc-harness/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT</a></span>
  <span class="colophon">v${e(VERSION)} / ${date}</span>
</footer>
</body>
</html>`;
}

export async function siteEntries() {
  const entries = await galleryEntries();
  entries["studio/index.html"] = entries["index.html"];
  delete entries["index.html"];
  for (const file of ["site.css", "site.js"])
    entries[file] = await fs.readFile(
      new URL("../assets/site/" + file, import.meta.url),
    );
  for (const file of ["manrope-latin.woff2", "OFL-Manrope.txt"])
    entries[`fonts/${file}`] = await fs.readFile(new URL("../assets/site/fonts/" + file, import.meta.url));
  entries["index.html"] = landingPage();
  return entries;
}

export async function site(opts: Options = {}) {
  const entries = await siteEntries();
  if (opts.out) {
    const directory = path.resolve(opts.out);
    for (const [relative, body] of Object.entries(entries))
      await write(directory, relative, body);
    console.log(
      JSON.stringify({
        ok: true,
        directory,
        templates: TEMPLATES.length,
        scope: "static-site-export",
        note: "Serve this folder at an HTTP(S) origin root.",
      }),
    );
    return;
  }
  return serveEntries(entries, { port: opts.port || 8790 }, "opc-site");
}
