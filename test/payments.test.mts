import type { Database, DatabaseStatement, SqlValue, WorkerEnv, Order } from '../templates/paid-site/worker.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { sha256, signPayload, verifySignature, PRODUCT } from '../templates/paid-site/worker.mjs';

// Execute the actual migration and queries against SQLite rather than pattern-matching SQL.
function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(readFileSync(new URL('../templates/paid-site/migrations/0001_orders.sql', import.meta.url), 'utf8'));
  const db: Database = {
    prepare(sql: string) {
      let values: SqlValue[] = [];
      const statement: DatabaseStatement = {
        bind(...args: SqlValue[]) { values = args; return statement; },
        async first<T>() { return (sqlite.prepare(sql).get(...values) as T | undefined) || null; },
        async run() { const result = sqlite.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
      };
      return statement;
    },
    async batch(statements: DatabaseStatement[]) {
      sqlite.exec('BEGIN');
      try { const result = []; for (const statement of statements) result.push(await statement.run()); sqlite.exec('COMMIT'); return result; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { db, sqlite };
}
function fixture(mode = 'demo') {
  const { db, sqlite } = database();
  return { sqlite, env: { DB: db, PAYMENT_MODE: mode, STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_fixture', STRIPE_PRICE_ID: 'price_fixture', BUILD_ID: 'test-build', DEPLOYMENT_TIER: 'local' } as WorkerEnv & {DB:Database} };
}
function request(path: string, body?: unknown, headers: Record<string,string> = {}) {
  return new Request(`http://localhost${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function demoOrder(env: WorkerEnv, idempotencyKey: string = crypto.randomUUID()) {
  const response = await worker.fetch(request('/api/checkout', { sku: PRODUCT.sku, idempotencyKey }), env);
  assert.equal(response.status, 200);
  return response.json();
}
async function stripeOrder(env: WorkerEnv) {
  const id = `ord_${crypto.randomUUID()}`; const token = crypto.randomUUID();
  await env.DB!.prepare('INSERT INTO opc_orders (order_id, token_hash, checkout_key_hash, sku, amount, currency, mode, session_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, await sha256(token), crypto.randomUUID(), PRODUCT.sku, PRODUCT.amount, PRODUCT.currency, 'stripe_test', 'cs_test_fixture', 'pending', new Date().toISOString()).run();
  return { orderId: id, token, sessionId: 'cs_test_fixture' };
}
function eventFor(order: {orderId:string;sessionId:string}, changes: Record<string,unknown> = {}) {
  return { id: `evt_${crypto.randomUUID()}`, livemode: false, type: 'checkout.session.completed', data: { object: {
    id: order.sessionId, object: 'checkout.session', mode: 'payment', payment_status: 'paid', livemode: false,
    amount_total: PRODUCT.amount, currency: PRODUCT.currency, client_reference_id: order.orderId,
    metadata: { order_id: order.orderId, sku: PRODUCT.sku, opc_mode: 'stripe_test' }, ...changes,
  } } };
}
async function postEvent(env: WorkerEnv, event: unknown, signature?: string) {
  const payload = JSON.stringify(event);
  const header = signature ?? await signPayload(payload, env.STRIPE_WEBHOOK_SECRET!);
  return worker.fetch(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': header, 'content-type': 'application/json' }, body: payload }), env);
}
const readOrder = (env: WorkerEnv, order: {orderId:string;token:string}) => worker.fetch(request(`/api/orders/${order.orderId}?token=${order.token}`), env);

test('demo checkout, verified fulfillment and gated download form a complete durable path', async () => {
  const { env, sqlite } = fixture(); const order = await demoOrder(env);
  assert.equal(order.mode, 'demo');
  assert.match(order.url, /^http:\/\/localhost\/demo-checkout\?/);
  assert.equal((await (await readOrder(env, order)).json()).entitlement, null);
  assert.equal((await worker.fetch(request(`/api/download/${order.orderId}?token=${order.token}`), env)).status, 403);
  assert.equal((await worker.fetch(request(`/api/orders/${order.orderId}?token=wrong`), env)).status, 404);
  const complete = await worker.fetch(request('/api/demo/complete', { orderId: order.orderId, token: order.token }), env);
  assert.equal(complete.status, 200);
  const paid = await complete.json(); assert.equal(paid.status, 'paid'); assert.equal(paid.entitlement.product, 'starter');
  const download = await worker.fetch(request(paid.entitlement.downloadUrl), env);
  assert.equal(download.status, 200); assert.match(await download.text(), /DEMONSTRATION — no real money moved/);
  const second = await worker.fetch(request('/api/demo/complete', { orderId: order.orderId, token: order.token }), env);
  assert.equal(second.status, 200);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM opc_events').get()!.n, 1);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM opc_entitlements').get()!.n, 1);
  // Raw order capability is not retained in the database.
  const stored = sqlite.prepare('SELECT * FROM opc_orders').get();
  assert.notEqual(stored!.token_hash, order.token); assert.ok(!String(stored!.checkout_url).includes(order.token));
  sqlite.close();
});

test('caller retry key reuses order and capability without duplicating checkout', async () => {
  const { env, sqlite } = fixture(); const key = crypto.randomUUID();
  const a = await demoOrder(env, key); const b = await demoOrder(env, key);
  assert.deepEqual(a, b); assert.equal(sqlite.prepare('SELECT count(*) AS n FROM opc_orders').get()!.n, 1);
  sqlite.close();
});

test('successful redirect URL alone never grants entitlement', async () => {
  const { env, sqlite } = fixture(); const order = await demoOrder(env);
  env.ASSETS = { fetch: async () => new Response('success screen') };
  await worker.fetch(request(`/success.html?checkout=success&order_id=${order.orderId}&token=${order.token}`), env);
  assert.equal((await (await readOrder(env, order)).json()).status, 'pending');
  sqlite.close();
});

test('signature verification rejects mutation, expiry and duplicate timestamps; supports rotated secrets', async () => {
  const secret = 'whsec_fixture'; const payload = '{"id":"test"}'; const now = 2_000_000_000;
  const valid = await signPayload(payload, secret, now);
  assert.equal(await verifySignature(payload, valid, secret, now), true);
  assert.equal(await verifySignature(`${payload} `, valid, secret, now), false);
  assert.equal(await verifySignature(payload, valid, secret, now + 301), false);
  assert.equal(await verifySignature(payload, valid, secret, now - 301), false);
  assert.equal(await verifySignature(payload, `t=${now},${valid}`, secret, now), false);
  assert.equal(await verifySignature(payload, `${valid},v1=${'0'.repeat(64)}`, secret, now), true);
});

test('Stripe signed paid event grants exactly one entitlement across retries and distinct events', async () => {
  const { env, sqlite } = fixture('stripe_test'); const order = await stripeOrder(env); const event = eventFor(order);
  assert.equal((await postEvent(env, event)).status, 200);
  const paidAt = sqlite.prepare('SELECT fulfilled_at FROM opc_orders').get()!.fulfilled_at;
  assert.equal((await (await postEvent(env, event)).json()).duplicate, true);
  assert.equal((await postEvent(env, { ...event, id: 'evt_second' })).status, 200);
  assert.equal((await (await readOrder(env, order)).json()).status, 'paid');
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM opc_entitlements').get()!.n, 1);
  assert.equal(sqlite.prepare('SELECT fulfilled_at FROM opc_orders').get()!.fulfilled_at, paidAt);
  sqlite.close();
});

test('unpaid completed event remains pending until signed async payment success', async () => {
  const { env, sqlite } = fixture('stripe_test'); const order = await stripeOrder(env);
  const unpaid = await postEvent(env, eventFor(order, { payment_status: 'unpaid' }));
  assert.equal(unpaid.status, 200); assert.equal((await unpaid.json()).ignored, true);
  assert.equal((await (await readOrder(env, order)).json()).entitlement, null);
  const asyncEvent = { ...eventFor(order), type: 'checkout.session.async_payment_succeeded' };
  assert.equal((await postEvent(env, asyncEvent)).status, 200);
  assert.equal((await (await readOrder(env, order)).json()).status, 'paid');
  sqlite.close();
});

test('invalid webhook signatures never change durable state', async () => {
  const { env, sqlite } = fixture('stripe_test'); const order = await stripeOrder(env);
  assert.equal((await postEvent(env, eventFor(order), 't=1,v1=invalid')).status, 400);
  assert.equal((await (await readOrder(env, order)).json()).status, 'pending');
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM opc_events').get()!.n, 0);
  sqlite.close();
});

const mismatches: [string, Record<string,unknown>][] = [
  ['amount', { amount_total: 1 }], ['currency', { currency: 'eur' }], ['session', { id: 'cs_test_other' }],
  ['reference', { client_reference_id: 'other' }], ['live session', { livemode: true }],
  ['metadata', { metadata: { order_id: 'other', sku: 'starter', opc_mode: 'stripe_test' } }],
];
for (const [name, change] of mismatches) {
  test(`signed webhook rejects mismatched ${name}`, async () => {
    const { env, sqlite } = fixture('stripe_test'); const order = await stripeOrder(env);
    assert.equal((await postEvent(env, eventFor(order, change))).status, 400);
    assert.equal((await (await readOrder(env, order)).json()).status, 'pending');
    sqlite.close();
  });
}

test('live-mode events, invalid JSON and unrelated events cannot grant access', async () => {
  const { env, sqlite } = fixture('stripe_test'); const order = await stripeOrder(env);
  assert.equal((await postEvent(env, { ...eventFor(order), livemode: true })).status, 400);
  const ignored = await postEvent(env, { ...eventFor(order), type: 'payment_intent.succeeded' });
  assert.equal((await ignored.json()).ignored, true);
  const payload = 'invalid';
  const malformed = new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body: payload, headers: { 'stripe-signature': await signPayload(payload, env.STRIPE_WEBHOOK_SECRET!) } });
  assert.equal((await worker.fetch(malformed, env)).status, 400);
  assert.equal((await (await readOrder(env, order)).json()).status, 'pending');
  sqlite.close();
});

test('demo completion is unavailable in Stripe mode and webhook is unavailable in demo mode', async () => {
  const demo = fixture(); const stripe = fixture('stripe_test');
  assert.equal((await worker.fetch(request('/api/demo/complete', {}), stripe.env)).status, 404);
  assert.equal((await worker.fetch(request('/api/webhooks/stripe', {}), demo.env)).status, 404);
  demo.sqlite.close(); stripe.sqlite.close();
});

test('health truthfully identifies build, deployment tier, mode and missing configuration', async () => {
  const { env, sqlite } = fixture('stripe_test');
  const ready = await (await worker.fetch(request('/api/health'), env)).json();
  assert.equal(ready.configured, true); assert.equal(ready.buildId, 'test-build'); assert.equal(ready.deploymentTier, 'local');
  delete env.STRIPE_SECRET_KEY;
  const blocked = await worker.fetch(request('/api/health'), env); assert.equal(blocked.status, 503);
  const body = await blocked.json(); assert.equal(body.configured, false); assert.equal(body.checks.testKey, false);
  assert.ok(!JSON.stringify(body).includes('whsec_fixture'));
  sqlite.close();
});

test('live Stripe credentials fail closed before creating an order or making network requests', async () => {
  const { env, sqlite } = fixture('stripe_test'); env.STRIPE_SECRET_KEY = 'sk_live_notallowed';
  const response = await worker.fetch(request('/api/checkout', { sku: 'starter' }), env);
  assert.equal(response.status, 503); assert.equal(sqlite.prepare('SELECT count(*) AS n FROM opc_orders').get()!.n, 0);
  sqlite.close();
});

test('Stripe checkout validates test price and reuses provider idempotency key', async () => {
  const { env, sqlite } = fixture('stripe_test'); const originalFetch = globalThis.fetch; const calls: {url:string;init:RequestInit|undefined}[] = [];
  globalThis.fetch = async (url, options) => {
    calls.push({url:String(url),init:options});
    return Response.json(String(url).includes('/prices/') ? { livemode: false, active: true, type: 'one_time', unit_amount: 1900, currency: 'usd' }
      : { id: 'cs_test_session', livemode: false, url: 'https://checkout.stripe.com/c/pay/cs_test_session' });
  };
  try {
    const key = crypto.randomUUID(); const a = await demoOrder(env, key); const b = await demoOrder(env, key);
    assert.equal(a.orderId, b.orderId); assert.equal(calls.length, 2);
    assert.equal(new Headers(calls[1].init?.headers).get('Idempotency-Key'), `opc-${a.orderId}`);
    assert.match(String(calls[1].init?.body), /success_url=.*success.html/);
  } finally { globalThis.fetch = originalFetch; sqlite.close(); }
});

test('Stripe rejects a misconfigured price without a checkout session', async () => {
  const { env, sqlite } = fixture('stripe_test'); const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ livemode: false, active: true, type: 'one_time', unit_amount: 1, currency: 'usd' });
  try {
    const response = await worker.fetch(request('/api/checkout', { sku: 'starter' }), env);
    assert.equal(response.status, 503);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM opc_orders WHERE session_id IS NOT NULL').get()!.n, 0);
  } finally { globalThis.fetch = originalFetch; sqlite.close(); }
});

test('cross-origin checkout and weak retry keys are rejected', async () => {
  const { env, sqlite } = fixture();
  const crossOrigin = await worker.fetch(request('/api/checkout', { sku: 'starter' }, { origin: 'https://attacker.invalid' }), env);
  assert.equal(crossOrigin.status, 403);
  assert.equal((await worker.fetch(request('/api/checkout', { sku: 'starter', idempotencyKey: 'guessable' }), env)).status, 400);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM opc_orders').get()!.n, 0);
  sqlite.close();
});

test('fulfillment transaction rolls back the event when delivery fails, permitting safe retry', async () => {
  const { env, sqlite } = fixture('stripe_test'); const order = await stripeOrder(env); const event = eventFor(order);
  sqlite.exec("CREATE TRIGGER fail_delivery BEFORE INSERT ON opc_entitlements BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;");
  assert.equal((await postEvent(env, event)).status, 500);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM opc_events').get()!.n, 0);
  assert.equal((await (await readOrder(env, order)).json()).status, 'pending');
  sqlite.exec('DROP TRIGGER fail_delivery;');
  assert.equal((await postEvent(env, event)).status, 200);
  assert.equal((await (await readOrder(env, order)).json()).status, 'paid');
  sqlite.close();
});

test('a signed event ID cannot be reused with different contents', async () => {
  const { env, sqlite } = fixture('stripe_test'); const order = await stripeOrder(env); const event = eventFor(order);
  assert.equal((await postEvent(env, event)).status, 200);
  const changed = { ...event, created: 123 };
  assert.equal((await postEvent(env, changed)).status, 400);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM opc_entitlements').get()!.n, 1);
  sqlite.close();
});
