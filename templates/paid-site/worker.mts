import type { PaymentMode } from '../../src/types.mjs';
export type SqlValue = string | number | null;
export interface DatabaseStatement {
  bind(...values: SqlValue[]): DatabaseStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface Database { prepare(sql: string): DatabaseStatement; batch(statements: DatabaseStatement[]): Promise<unknown>; }
export interface WorkerEnv {
  DB?: Database; ASSETS?: {fetch(request: Request): Promise<Response>};
  PAYMENT_MODE?: string; STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string; STRIPE_PRICE_ID?: string;
  APP_ORIGIN?: string; APP_NAME?: string; BUILD_ID?: string; DEPLOYMENT_TIER?: string; DEMO_WEBHOOK_SECRET?: string;
}
export interface Order {
  order_id: string; token_hash: string; checkout_key_hash: string; sku: string; amount: number; currency: string;
  mode: 'demo' | 'stripe_test'; session_id: string | null; checkout_url: string | null; status: 'pending' | 'paid'; created_at: string; fulfilled_at: string | null;
}
interface StripePrice { livemode: boolean; active: boolean; type: string; unit_amount: number; currency: string; }
interface StripeSession { id: string; url: string; livemode: boolean; }
function object(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
/** Native Worker: test-mode Checkout + a deliberately labelled local/demo provider. */
export const PRODUCT = Object.freeze({ sku: 'starter', amount: 1900, currency: 'usd' });
const encoder = new TextEncoder();
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' };
const SAFE_ID = /^[A-Za-z0-9_-]{1,160}$/;
const safeEqual = (a: unknown, b: unknown) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let different = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) different |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return different === 0;
};
const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
export const sha256 = async (text: string) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
export async function signPayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`)));
  return `t=${timestamp},v1=${digest}`;
}
export async function verifySignature(payload: string, signature: unknown, secret: string | undefined, now = Math.floor(Date.now() / 1000)) {
  if (!secret || typeof signature !== 'string') return false;
  const parts = signature.split(',').map(part => part.trim().split('='));
  const timestamps = parts.filter(([k]) => k === 't');
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (timestamps.length !== 1 || !/^\d+$/.test(timestamps[0][1] || '')) return false;
  const timestamp = Number(timestamps[0][1]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300) return false;
  const expected = (await signPayload(payload, secret, timestamp)).split('v1=')[1];
  return signatures.some(value => /^[a-f0-9]{64}$/.test(value || '') && safeEqual(expected, value));
}
class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: jsonHeaders });
function invalid(message = 'Invalid request.'): never { throw new HttpError(400, 'invalid_request', message); }
function paymentMode(env: WorkerEnv): PaymentMode {
  const mode = env.PAYMENT_MODE || 'demo';
  if (!['none', 'demo', 'stripe_test'].includes(mode)) throw new HttpError(503, 'invalid_payment_mode', 'Supported payment modes are none, demo and stripe_test.');
  return mode as PaymentMode;
}
function stripeConfiguration(env: WorkerEnv) {
  return {
    testKey: /^(sk|rk)_test_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY || ''),
    webhookSecret: /^whsec_\S+$/.test(env.STRIPE_WEBHOOK_SECRET || ''),
    price: /^price_[A-Za-z0-9]+$/.test(env.STRIPE_PRICE_ID || ''),
  };
}
function requireStripe(env: WorkerEnv) {
  if (!Object.values(stripeConfiguration(env)).every(Boolean)) throw new HttpError(503, 'stripe_not_configured', 'Configure a Stripe test key, webhook signing secret and matching one-time test price. Live keys are not supported by this MVP.');
}
function originFor(request: Request, env: WorkerEnv) {
  const origin = new URL(env.APP_ORIGIN || request.url);
  if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))) {
    throw new HttpError(503, 'invalid_origin', 'APP_ORIGIN must use HTTPS, or HTTP on localhost.');
  }
  return origin.origin;
}
function protectOrigin(request: Request, env: WorkerEnv) {
  const supplied = request.headers.get('origin');
  if (supplied && supplied !== new URL(request.url).origin && supplied !== originFor(request, env)) throw new HttpError(403, 'origin_mismatch', 'Request origin does not match this site.');
}
async function requestJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'json_required', 'Send application/json.');
  const text = await limitedText(request, 16_384);
  try { const value = JSON.parse(text); if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string,unknown>; } catch {}
  return invalid('Expected a JSON object.');
}
async function limitedText(request: Request, maxBytes: number) {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new HttpError(413, 'payload_too_large', 'Request body is too large.');
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = []; let bytes = 0;
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > maxBytes) { await reader.cancel(); throw new HttpError(413, 'payload_too_large', 'Request body is too large.'); }
    chunks.push(chunk.value);
  }
  const all = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(all);
}
async function getOrder(env: WorkerEnv, id: unknown) {
  if (typeof id !== 'string' || !SAFE_ID.test(id)) throw new HttpError(404, 'order_not_found', 'Order not found.');
  return env.DB!.prepare('SELECT * FROM opc_orders WHERE order_id = ?').bind(id).first<Order>();
}
function bearer(request: Request) { return request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{20,256})$/)?.[1] || new URL(request.url).searchParams.get('token'); }
async function authorizeOrder(env: WorkerEnv, id: unknown, token: unknown) {
  const order = await getOrder(env, id);
  if (!order || typeof token !== 'string' || token.length > 256 || !safeEqual(order.token_hash, await sha256(token))) throw new HttpError(404, 'order_not_found', 'Order not found.');
  return order;
}
async function publicOrder(env: WorkerEnv, order: Order, token: unknown) {
  const grant = order.status === 'paid' ? await env.DB!.prepare('SELECT product FROM opc_entitlements WHERE order_id = ?').bind(order.order_id).first<{product:string}>() : null;
  return { orderId: order.order_id, status: order.status, mode: order.mode,
    entitlement: grant ? { product: grant.product, downloadUrl: `/api/download/${encodeURIComponent(order.order_id)}?token=${encodeURIComponent(String(token))}` } : null };
}
async function stripeFetch<T>(path: string, env: WorkerEnv, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${env.STRIPE_SECRET_KEY}`);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, { ...options, headers, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new HttpError(502, 'stripe_request_failed', 'Stripe rejected the test checkout request. Check the configured test account and price.');
  return response.json() as Promise<T>;
}
async function stripeSession(env: WorkerEnv, order: Order, token: string, origin: string) {
  const price = await stripeFetch<StripePrice>(`prices/${encodeURIComponent(env.STRIPE_PRICE_ID!)}`, env);
  if (price.livemode !== false || !price.active || price.type !== 'one_time' || price.unit_amount !== PRODUCT.amount || price.currency !== PRODUCT.currency) {
    throw new HttpError(503, 'price_mismatch', 'STRIPE_PRICE_ID must match the configured one-time test product amount and currency.');
  }
  const success = `${origin}/success.html?order_id=${encodeURIComponent(order.order_id)}&token=${encodeURIComponent(String(token))}&checkout=success`;
  const fields = new URLSearchParams({ mode: 'payment', 'line_items[0][price]': env.STRIPE_PRICE_ID!, 'line_items[0][quantity]': '1',
    client_reference_id: order.order_id, 'metadata[order_id]': order.order_id, 'metadata[sku]': order.sku,
    'metadata[opc_mode]': order.mode, success_url: success, cancel_url: `${origin}/?checkout=cancelled` });
  const session = await stripeFetch<StripeSession>('checkout/sessions', env, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `opc-${order.order_id}` }, body: fields.toString() });
  if (session.livemode !== false || !/^cs_test_[A-Za-z0-9]+$/.test(session.id || '') || !session.url || new URL(session.url).origin !== 'https://checkout.stripe.com') {
    throw new HttpError(502, 'invalid_checkout_session', 'Stripe did not return a valid test Checkout session.');
  }
  return { id: session.id, url: session.url };
}
async function checkout(request: Request, env: WorkerEnv) {
  protectOrigin(request, env);
  const body = await requestJson(request);
  if (body.sku !== PRODUCT.sku) invalid('Unknown product.');
  if (body.idempotencyKey !== undefined && (typeof body.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(body.idempotencyKey))) invalid('Use a fresh random UUID as the idempotencyKey.');
  const mode = paymentMode(env); if (mode === 'stripe_test') requireStripe(env);
  const origin = originFor(request, env);
  const key = body.idempotencyKey || crypto.randomUUID();
  // Retry keys are caller-held capabilities, never predictable business identifiers.
  const token = await sha256(`opc-order-capability:${key}`);
  const keyHash = await sha256(key);
  await env.DB!.prepare('INSERT OR IGNORE INTO opc_orders (order_id, token_hash, checkout_key_hash, sku, amount, currency, mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(`ord_${crypto.randomUUID()}`, await sha256(token), keyHash, PRODUCT.sku, PRODUCT.amount, PRODUCT.currency, mode, new Date().toISOString()).run();
  const order = await env.DB!.prepare('SELECT * FROM opc_orders WHERE checkout_key_hash = ?').bind(keyHash).first<Order>();
  if (!order) throw new Error('Order was not stored.');
  if (order.mode !== mode) throw new HttpError(409, 'checkout_mode_changed', 'Use a new checkout attempt after switching payment mode.');
  if (!order.session_id) {
    const session = mode === 'demo'
      ? { id: `demo_${order.order_id}`, url: `${origin}/demo-checkout?order_id=${encodeURIComponent(order.order_id)}` }
      : await stripeSession(env, order, token, origin);
    await env.DB!.prepare('UPDATE opc_orders SET session_id = ?, checkout_url = ? WHERE order_id = ? AND session_id IS NULL').bind(session.id, session.url, order.order_id).run();
  }
  const saved = (await getOrder(env, order.order_id))!;
  return reply({ orderId: order.order_id, token, mode, url: mode === 'demo' ? `${saved.checkout_url}&token=${encodeURIComponent(String(token))}` : saved.checkout_url });
}
/** Shared durable fulfillment. Called only after signature validation. */
export async function fulfillEvent(env: WorkerEnv, input: unknown, payload: string) {
  const mode = paymentMode(env);
  const event = object(input);
  if (!event || typeof event.id !== 'string' || !SAFE_ID.test(event.id) || event.livemode !== false) invalid('Expected a test-mode event.');
  if (typeof event.type !== 'string' || !['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return { received: true, ignored: true };
  const session = object(object(event.data)?.object);
  if (!session || session.object !== 'checkout.session' || session.mode !== 'payment' || session.livemode !== false) invalid('Invalid Checkout session.');
  if (session.payment_status !== 'paid') return { received: true, ignored: true, reason: 'unpaid' };
  const metadata = object(session.metadata);
  const orderId = metadata?.order_id;
  const order = await getOrder(env, orderId);
  if (!order || typeof session.id !== 'string' || order.mode !== mode || metadata?.opc_mode !== mode || metadata?.sku !== order.sku ||
    session.client_reference_id !== order.order_id || session.id !== order.session_id || session.amount_total !== order.amount || session.currency !== order.currency ||
    (mode === 'stripe_test' ? !/^cs_test_/.test(session.id || '') : !/^demo_/.test(session.id || ''))) invalid('Checkout does not match the recorded order.');
  const digest = await sha256(payload);
  const previous = await env.DB!.prepare('SELECT payload_sha256, order_id FROM opc_events WHERE event_id = ?').bind(event.id).first<{payload_sha256:string;order_id:string}>();
  if (previous && (previous.payload_sha256 !== digest || previous.order_id !== order.order_id)) invalid('Event identity mismatch.');
  const now = new Date().toISOString();
  // D1 batch is an atomic transaction. Both event and order uniqueness protect retries/concurrent delivery.
  await env.DB!.batch([
    env.DB!.prepare('INSERT OR IGNORE INTO opc_events (event_id, order_id, payload_sha256, received_at) VALUES (?, ?, ?, ?)').bind(event.id, order.order_id, digest, now),
    env.DB!.prepare("UPDATE opc_orders SET status = 'paid', fulfilled_at = ? WHERE order_id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM opc_events WHERE event_id = ? AND order_id = ? AND payload_sha256 = ?)").bind(now, order.order_id, event.id, order.order_id, digest),
    env.DB!.prepare("INSERT OR IGNORE INTO opc_entitlements (order_id, product, created_at) SELECT order_id, sku, fulfilled_at FROM opc_orders WHERE order_id = ? AND status = 'paid'").bind(order.order_id),
  ]);
  return { received: true, duplicate: Boolean(previous) };
}
async function webhook(request: Request, env: WorkerEnv) {
  if (paymentMode(env) !== 'stripe_test') throw new HttpError(404, 'not_found', 'Not found.');
  requireStripe(env);
  const payload = await limitedText(request, 262_144);
  if (!await verifySignature(payload, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET)) throw new HttpError(400, 'invalid_signature', 'Webhook signature verification failed.');
  let event; try { event = JSON.parse(payload); } catch { invalid('Invalid event JSON.'); }
  return reply(await fulfillEvent(env, event, payload));
}
async function demoComplete(request: Request, env: WorkerEnv) {
  if (paymentMode(env) !== 'demo') throw new HttpError(404, 'not_found', 'Not found.');
  protectOrigin(request, env);
  const body = await requestJson(request);
  const order = await authorizeOrder(env, body.orderId, body.token);
  if (order.mode !== 'demo' || !order.session_id) invalid('Expected a demo checkout.');
  const event = { id: `evt_demo_${order.order_id}`, livemode: false, type: 'checkout.session.completed', data: { object: {
    id: order.session_id, object: 'checkout.session', mode: 'payment', payment_status: 'paid', livemode: false,
    amount_total: order.amount, currency: order.currency, client_reference_id: order.order_id,
    metadata: { order_id: order.order_id, sku: order.sku, opc_mode: 'demo' },
  } } };
  const payload = JSON.stringify(event);
  // A simulation exercises the same signature verifier and fulfillment without claiming a Stripe payment.
  const simulationSecret = env.DEMO_WEBHOOK_SECRET || crypto.randomUUID();
  const signature = await signPayload(payload, simulationSecret);
  if (!await verifySignature(payload, signature, simulationSecret)) throw new Error('Simulation verification failed');
  await fulfillEvent(env, event, payload);
  return reply(await publicOrder(env, (await getOrder(env, order.order_id))!, body.token));
}
async function health(env: WorkerEnv) {
  let database = false;
  try { await env.DB!.prepare('SELECT order_id FROM opc_orders LIMIT 1').first(); database = true; } catch {}
  let mode; try { mode = paymentMode(env); } catch { mode = 'invalid'; }
  const checks = { ...(mode === 'none' ? {} : {database}), ...(mode === 'stripe_test' ? stripeConfiguration(env) : {}) };
  const configured = mode !== 'invalid' && Object.values(checks).every(Boolean);
  return reply({ ok: configured, app: 'opc-paid-site', name: env.APP_NAME || 'unconfigured', version: '0.1.0', mode, configured, checks, buildId: env.BUILD_ID || 'development', deploymentTier: env.DEPLOYMENT_TIER || 'local' }, configured ? 200 : 503);
}
export async function handleRequest(request: Request, env: WorkerEnv) {
  try {
    const url = new URL(request.url);
    if (url.pathname === '/api/health' && request.method === 'GET') return health(env);
    if (url.pathname.startsWith('/api/') && paymentMode(env)==='none') throw new HttpError(404,'not_found','Payments are disabled for this website.');
    if (url.pathname === '/api/checkout' && request.method === 'POST') return await checkout(request, env);
    if (url.pathname === '/api/webhooks/stripe' && request.method === 'POST') return await webhook(request, env);
    if (url.pathname === '/api/demo/complete' && request.method === 'POST') return await demoComplete(request, env);
    const orderPath = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
    if (orderPath && request.method === 'GET') {
      const token = bearer(request); const order = await authorizeOrder(env, decodeURIComponent(orderPath[1]), token);
      return reply(await publicOrder(env, order, token));
    }
    const downloadPath = url.pathname.match(/^\/api\/download\/([^/]+)$/);
    if (downloadPath && request.method === 'GET') {
      const token = bearer(request); const order = await authorizeOrder(env, decodeURIComponent(downloadPath[1]), token);
      const result = await publicOrder(env, order, token);
      if (!result.entitlement) throw new HttpError(403, 'payment_required', 'Complete payment before downloading.');
      const content = `# Paperplane — Starter kit\n\nPayment environment: ${order.mode === 'demo' ? 'DEMONSTRATION — no real money moved' : 'Stripe TEST — no real money moved'}\nOrder: ${order.order_id}\n\n## Your next project brief\n\n- Who is this for?\n- What task will they complete?\n- What is the smallest useful result?\n- How will you verify delivery?\n\n## Launch checklist\n\n- [ ] Core task completes on desktop and mobile\n- [ ] Payment confirmation grants the expected entitlement\n- [ ] Failed payments never grant access\n- [ ] Secrets stay on the server\n- [ ] Deployment environment is clearly identified\n\nThis sample artifact demonstrates server-verified delivery. Adapt it to your product.\n`;
      return new Response(content, { headers: { ...jsonHeaders, 'content-type': 'text/markdown; charset=utf-8', 'content-disposition': 'attachment; filename="paperplane-starter.md"' } });
    }
    if (url.pathname.startsWith('/api/')) throw new HttpError(404, 'not_found', 'Not found.');
    if (url.pathname === '/demo-checkout') {
      if (paymentMode(env) !== 'demo') throw new HttpError(404, 'not_found', 'Not found.');
      const target = new URL(request.url); target.pathname = '/demo.html';
      const response = await env.ASSETS!.fetch(new Request(target, request));
      const headers = new Headers(response.headers); headers.set('referrer-policy', 'no-referrer'); headers.set('cache-control', 'no-store');
      return new Response(response.body, { status: response.status, headers });
    }
    if (!env.ASSETS) throw new HttpError(404, 'not_found', 'Not found.');
    const response = await env.ASSETS!.fetch(request);
    const headers = new Headers(response.headers); headers.set('referrer-policy', 'no-referrer'); headers.set('x-content-type-options', 'nosniff');
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    if (error instanceof HttpError) return reply({ error: error.code, message: error.message }, error.status);
    // Never echo upstream responses, SQL details, credentials or capability tokens.
    return reply({ error: 'internal_error', message: 'The request could not be completed. Check server configuration and try again.' }, 500);
  }
}
export default { fetch: handleRequest };
