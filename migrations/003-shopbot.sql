CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS payment_ledger (
 provider TEXT NOT NULL, transaction_id TEXT NOT NULL, order_code TEXT NOT NULL UNIQUE,
 amount INTEGER NOT NULL CHECK(amount > 0), accepted_at TEXT NOT NULL,
 PRIMARY KEY(provider, transaction_id)
);
CREATE TABLE IF NOT EXISTS delivery_jobs (
 order_id INTEGER NOT NULL, item_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity > 0), state TEXT NOT NULL DEFAULT 'ready',
 message_id INTEGER, updated_at TEXT NOT NULL, PRIMARY KEY(order_id,item_id)
);
CREATE TABLE IF NOT EXISTS audit_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL,
 target TEXT NOT NULL, outcome TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_credentials_stock ON credentials(product_id,is_sold);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status,created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
INSERT OR IGNORE INTO schema_migrations(version) VALUES (3);
CREATE TABLE IF NOT EXISTS order_payment_accounts (order_code TEXT PRIMARY KEY, account_no TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS support_tickets (
 id INTEGER PRIMARY KEY AUTOINCREMENT, order_code TEXT NOT NULL, user_id INTEGER NOT NULL,
 message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT DEFAULT (datetime('now'))
);
