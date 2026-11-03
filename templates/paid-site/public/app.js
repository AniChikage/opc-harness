import { siteConfig } from '/site-config.js';
const $ = (selector) => document.querySelector(selector);
const storage = {
  get(key) { try { return JSON.parse(localStorage.getItem(`paperplane.${key}`)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(`paperplane.${key}`, JSON.stringify(value)); } catch { /* The workspace also works without persistent storage. */ } },
  remove(key) { try { localStorage.removeItem(`paperplane.${key}`); } catch { /* No storage permission. */ } }
};
const examples = [
  { title: 'Maker workspace', idea: 'A quiet workspace for independent makers to plan, build, and share their next project.', audience: 'Independent developers, designers, and solo makers.', outcome: 'Turn ideas into actionable, scoped project plans.' },
  { title: 'Neighborhood seed library', idea: 'A simple way for neighbors to share spare seeds and find out what grows nearby.', audience: 'Home gardeners with a small outdoor space.', outcome: 'Find a local seed swap and start growing one new plant.' },
  { title: 'Reading notebook', idea: 'A small reading notebook that keeps the passages worth remembering close at hand.', audience: 'Readers who want to put useful ideas into practice.', outcome: 'Save one useful passage and decide what to try next.' }
];
let exampleIndex = 0;
let brief = null;
let access = null;
let checkoutMode = siteConfig.mode === 'none' ? 'none' : null;

function message(id, text, error = false) {
  const el = $(id); if (!el) return;
  el.textContent = text; el.classList.toggle('error', error);
}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(data?.error?.message || data?.message || (typeof data?.error === 'string' ? data.error : `The request did not complete (${response.status}). Please try again.`));
  return { data, response };
}
function orderFromLocation() {
  const params = new URLSearchParams(location.search);
  const orderId = params.get('order_id'), token = params.get('token');
  if (orderId && token) {
    const capability = { orderId, token };
    storage.set('order', capability);
    history.replaceState(null, '', location.pathname);
    return capability;
  }
  return storage.get('order');
}
async function verifyOrder(capability = storage.get('order')) {
  if (!capability?.orderId || !capability?.token) return null;
  const { data } = await api(`/api/orders/${encodeURIComponent(capability.orderId)}?token=${encodeURIComponent(capability.token)}`);
  return data?.status === 'paid' && data.entitlement?.downloadUrl ? { ...capability, ...data } : null;
}
function updateAccess(order) {
  access = order;
  $('#access-status')?.classList.toggle('unlocked', !!order);
  if ($('#access-status')) $('#access-status').textContent = order ? 'Export unlocked' : 'Preview';
  if ($('#export-caption')) $('#export-caption').textContent = order ? (order.mode === 'demo' ? 'Demo access verified' : 'Test payment verified') : 'One-time access · $19';
  if (order) document.querySelectorAll('[data-action="purchase"]').forEach((button) => { button.textContent = 'Export access unlocked'; button.disabled = true; });
}
function createBrief(values) {
  const exact = examples.find((example) => example.idea === values.idea);
  const firstSentence = values.idea.split(/[.!?\n]/)[0].trim();
  const title = exact?.title || (firstSentence.length > 58 ? `${firstSentence.slice(0, 55).trim()}…` : firstSentence) || 'My next project';
  return {
    title,
    idea: values.idea,
    audience: values.audience,
    outcome: values.outcome,
    scope: [`Help users ${values.outcome.charAt(0).toLowerCase()}${values.outcome.slice(1).replace(/[.!?]+$/, '')}.`, 'Make one complete path from the first input to a useful result.', 'Share a working version with one person and record what needs to change.']
  };
}
function renderBrief(next) {
  brief = next;
  $('#brief-title').textContent = next.title;
  $('#brief-idea').textContent = next.idea;
  $('#brief-audience').textContent = next.audience;
  $('#brief-scope').replaceChildren(...next.scope.map((item) => { const li = document.createElement('li'); li.textContent = item; return li; }));
}
function markdown(full = false) {
  const preview = `# ${brief.title}\n\n## The idea\n${brief.idea}\n\n## Who it helps\n${brief.audience}\n\n## Desired outcome\n${brief.outcome}\n\n## First useful version\n${brief.scope.map((item) => `- ${item}`).join('\n')}\n`;
  if (!full) return preview;
  return `${preview}\n## Launch checklist\n- [ ] Define what a successful result looks like.\n- [ ] Test the complete workflow with a first-time user.\n- [ ] Check mobile layout, keyboard access, and error states.\n- [ ] Verify checkout, payment confirmation, and delivery in the target environment.\n- [ ] Record the release URL, version, and remaining limitations.\n\n## Next experiment\nWhat is the smallest real-world test that could change your plan?\n\n---\nPrepared with ${siteConfig.brand}. ${access?.mode === 'demo' ? 'Demo export; no real payment was collected.' : 'Stripe test export; no live payment was collected.'}\n`;
}
function currentValues() {
  return { idea: $('#idea').value.trim(), audience: $('#audience').value.trim(), outcome: $('#outcome').value.trim() };
}
async function purchase(button) {
  if (access) { message('#export-message', 'Export access is already verified for this browser.'); return; }
  if (checkoutMode === null) { message('#export-message', 'Checkout is not available yet. Refresh the page to check again.', true); return; }
  const buttons = [...document.querySelectorAll('[data-action="purchase"], [data-action="export"]')];
  const originalHTML = button.innerHTML;
  buttons.forEach((item) => item.disabled = true);
  button.setAttribute('aria-busy', 'true'); button.textContent = 'Opening checkout…';
  try {
    let idempotencyKey = storage.get('checkoutAttempt');
    if (!idempotencyKey) { idempotencyKey = crypto.randomUUID(); storage.set('checkoutAttempt', idempotencyKey); }
    const { data } = await api('/api/checkout', { method: 'POST', body: JSON.stringify({ sku: 'starter', idempotencyKey }) });
    if (!data?.url || !data?.orderId || !data?.token) throw new Error('Checkout returned an incomplete response. Please try again.');
    storage.set('order', { orderId: data.orderId, token: data.token });
    const target = new URL(data.url, location.origin);
    if (target.origin !== location.origin && target.hostname !== 'checkout.stripe.com') throw new Error('Checkout returned an unexpected destination.');
    location.assign(target.href);
  } catch (error) {
    message('#export-message', error.message, true);
    button.innerHTML = originalHTML;
    buttons.forEach((item) => item.disabled = false);
    button.removeAttribute('aria-busy');
  }
}
async function exportBrief(button) {
  if(checkoutMode === 'none') {
    const blob=new Blob([markdown(true).replace('Stripe test export; no live payment was collected.','Free export; no payment is required.')],{type:'text/markdown;charset=utf-8'});
    const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download='project-brief.md';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);message('#export-message','Your free Markdown brief has been downloaded.');return;
  }
  if (!access) { await purchase(button); return; }
  const original = button.innerHTML;
  button.disabled = true; button.setAttribute('aria-busy', 'true');
  try {
    const order = await verifyOrder();
    if (!order) { updateAccess(null); throw new Error('Export access could not be verified. Open checkout to try again.'); }
    access = order;
    // Authoritative delivery check happens on the server; draft content stays local.
    const download = new URL(order.entitlement.downloadUrl, location.origin);
    if (download.origin !== location.origin) throw new Error('The export address could not be verified.');
    const { response } = await api(`${download.pathname}${download.search}`);
    await response.text();
    const blob = new Blob([markdown(true)], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a'); const url = URL.createObjectURL(blob);
    link.href = url; link.download = `${brief.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'project'}-brief.md`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('#export-message', 'Your Markdown brief has been downloaded.');
  } catch (error) { message('#export-message', error.message, true); }
  finally { button.innerHTML = original; button.disabled = false; button.removeAttribute('aria-busy'); }
}
async function workspace() {
  document.querySelectorAll('[data-action="purchase"]').forEach(button=>{button.textContent=siteConfig.mode==='none'?'Free Markdown export':`Get export access — ${siteConfig.price}`;if(siteConfig.mode==='none')button.hidden=true;});
  if($('#export-caption'))$('#export-caption').textContent=siteConfig.mode==='none'?'Free export':`One-time access · ${siteConfig.price}`;
  const saved = storage.get('draft');
  if (saved && typeof saved.idea === 'string' && typeof saved.audience === 'string' && typeof saved.outcome === 'string') {
    $('#idea').value = saved.idea; $('#audience').value = saved.audience; $('#outcome').value = saved.outcome;
  }
  renderBrief(createBrief(currentValues()));
  $('#brief-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = currentValues();
    if (!values.idea || !values.audience || !values.outcome) { message('#form-message', 'Fill in all three fields to create your brief.', true); return; }
    renderBrief(createBrief(values)); storage.set('draft', values); message('#form-message', 'Brief updated. Refine the inputs whenever you like.');
  });
  $('[data-action="example"]').addEventListener('click', () => {
    exampleIndex = (exampleIndex + 1) % examples.length;
    const example = examples[exampleIndex];
    $('#idea').value = example.idea; $('#audience').value = example.audience; $('#outcome').value = example.outcome;
    renderBrief(createBrief(example)); storage.set('draft', example); message('#form-message', 'Example loaded. Make it your own.');
  });
  $('[data-action="copy"]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(markdown()); message('#export-message', 'Preview copied to your clipboard.'); }
    catch { message('#export-message', 'Clipboard access is unavailable. Select and copy the preview text instead.', true); }
  });
  document.querySelectorAll('[data-action="purchase"]').forEach((button) => button.addEventListener('click', () => purchase(button)));
  $('[data-action="export"]').addEventListener('click', (event) => exportBrief(event.currentTarget));
  $('[data-action="how"]').addEventListener('click', () => $('#how-dialog').showModal());
  document.querySelectorAll('[data-action="close-how"]').forEach((button) => button.addEventListener('click', () => $('#how-dialog').close()));
  if(siteConfig.mode==='none'){ $('#mode-notice span').textContent='Free workspace. No payment is required.'; return; }
  try {
    const { data } = await api('/api/health');
    checkoutMode = data?.configured ? data.mode : null;
    const text = data.mode === 'none' ? 'Free workspace. No payment is required.' : data.mode === 'demo' ? 'Demo checkout is active. No real payment will be collected.' : data.configured ? 'Stripe test checkout is active. Use test payment details only; no live payment will be collected.' : 'Checkout is not configured yet. You can still create and copy a free brief.';
    $('#mode-notice span').textContent = text;
    document.querySelectorAll('[data-action="purchase"]').forEach((button) => button.disabled = checkoutMode === null);
  } catch { $('#mode-notice span').textContent = 'Checkout could not be reached. You can still create and copy a free brief.'; }
  if (storage.get('order')) {
    try { const order = await verifyOrder(); if (order) { storage.remove('checkoutAttempt'); updateAccess(order); } } catch { /* Keep the free workspace available if verification is temporarily offline. */ }
  }
}
async function demoCheckout() {
  const capability = orderFromLocation();
  const button = $('[data-action="complete-demo"]');
  if (!capability?.orderId || !capability?.token) { button.disabled = true; message('#transaction-message', 'This checkout link is incomplete. Return to the workspace to start again.', true); return; }
  try {
    const { data } = await api('/api/health');
    if (data.mode !== 'demo') throw new Error('Demo checkout is not enabled in this environment.');
  } catch (error) { button.disabled = true; message('#transaction-message', error.message, true); return; }
  button.addEventListener('click', async () => {
    button.disabled = true; button.textContent = 'Confirming demo payment…'; button.setAttribute('aria-busy', 'true');
    try {
      await api('/api/demo/complete', { method: 'POST', body: JSON.stringify(capability) });
      location.assign(`/success.html?order_id=${encodeURIComponent(capability.orderId)}&token=${encodeURIComponent(capability.token)}`);
    } catch (error) {
      message('#transaction-message', error.message, true); button.disabled = false; button.textContent = 'Complete demo payment'; button.removeAttribute('aria-busy');
    }
  });
}
async function paymentStatus() {
  const capability = orderFromLocation();
  const retry = $('[data-action="retry-verification"]');
  if (!capability?.orderId || !capability?.token) {
    $('#transaction-title').textContent = 'We need your checkout link.';
    message('#transaction-message', 'This page alone does not confirm a payment. Return to the workspace to start checkout.', true);
    $('#verification-symbol').replaceChildren(); retry.hidden = true; return;
  }
  let pending = false;
  async function check() {
    if (pending) return;
    pending = true; retry.disabled = true; retry.hidden = true;
    $('#transaction-title').textContent = 'Checking your export access…';
    message('#transaction-message', 'We are checking the order with the server. You can keep this page open.');
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const order = await verifyOrder(capability);
        if (order) {
          storage.remove('checkoutAttempt');
          $('#transaction-title').textContent = 'Your next step is ready.';
          $('#verification-symbol').innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>';
          $('#transaction-description').textContent = 'Your order is confirmed. Return to your brief to download the Markdown export and launch checklist.';
          message('#transaction-message', order.mode === 'demo' ? 'Demo access verified. No real payment was collected.' : 'Stripe test payment verified. No live payment was collected.');
          $('.success-next').classList.add('visible'); $('#verification-actions').hidden = true; pending = false; return;
        }
      } catch (error) {
        message('#transaction-message', error.message, true); break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    $('#transaction-title').textContent = 'Confirmation is still on its way.';
    $('#transaction-description').textContent = 'A return from checkout does not confirm payment. Export access will unlock only after the server verifies your order.';
    $('#verification-symbol').replaceChildren();
    message('#transaction-message', 'Your draft is safe in this browser. You can check again or return to the workspace.');
    retry.hidden = false; retry.disabled = false; pending = false;
  }
  retry.addEventListener('click', check); await check();
}
const page = document.body.dataset.page;
if (page === 'workspace') workspace();
if (page === 'demo-checkout') demoCheckout();
if (page === 'payment-status') paymentStatus();
