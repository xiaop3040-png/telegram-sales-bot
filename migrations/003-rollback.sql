-- OFFLINE ONLY. The rollback runner/operator must verify ALL v3 tables are empty first.
-- Never discard a payment ledger or credential assignment after accepting live traffic.
BEGIN IMMEDIATE;
DROP TABLE IF EXISTS support_tickets;
DROP TABLE IF EXISTS order_payment_accounts;
DROP TABLE IF EXISTS delivery_jobs;
DROP TABLE IF EXISTS payment_ledger;
DROP TABLE IF EXISTS audit_events;
DELETE FROM schema_migrations WHERE version=3;
DROP INDEX IF EXISTS idx_credentials_stock;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_order_items_order;
COMMIT;
