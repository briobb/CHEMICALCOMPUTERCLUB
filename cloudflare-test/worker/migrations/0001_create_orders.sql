PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orders (
  session_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  stripe_created_at INTEGER NOT NULL,
  amount_total INTEGER NOT NULL,
  currency TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  shipping_name TEXT,
  shipping_country TEXT,
  shipping_postal_code TEXT,
  shipping_state TEXT,
  shipping_city TEXT,
  shipping_line1 TEXT,
  shipping_line2 TEXT,
  fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  line_index INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_amount INTEGER,
  amount_total INTEGER NOT NULL,
  currency TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES orders(session_id) ON DELETE CASCADE,
  UNIQUE (session_id, line_index)
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_session_id ON order_items(session_id);
