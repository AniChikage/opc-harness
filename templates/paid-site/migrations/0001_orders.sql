-- Order capabilities are hashed; no provider credentials are stored here.
CREATE TABLE IF NOT EXISTS opc_orders (
  order_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  checkout_key_hash TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('demo', 'stripe_test')),
  session_id TEXT UNIQUE,
  checkout_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TEXT NOT NULL,
  fulfilled_at TEXT
);
CREATE TABLE IF NOT EXISTS opc_events (
  event_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES opc_orders(order_id),
  payload_sha256 TEXT NOT NULL,
  received_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS opc_entitlements (
  order_id TEXT PRIMARY KEY REFERENCES opc_orders(order_id),
  product TEXT NOT NULL,
  created_at TEXT NOT NULL
);
