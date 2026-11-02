const db = require("../database");
const { deliverCredentials } = require("../handlers/deliveryHandler");
function startRecovery(bot) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const stmt = db
        .getDb()
        .prepare(
          "SELECT DISTINCT o.* FROM orders o LEFT JOIN delivery_jobs j ON j.order_id=o.id WHERE o.source='bot' AND (o.status='paid' OR (o.status='delivering' AND j.state='ready')) LIMIT 20",
        );
      const rows = [];
      try {
        while (stmt.step()) rows.push(stmt.getAsObject());
      } finally {
        stmt.free();
      }
      for (const order of rows) await deliverCredentials(bot, order);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(
    () => run().catch(() => console.warn("[Recovery] Failed")),
    60000,
  );
  run().catch(() => console.warn("[Recovery] Failed"));
  return () => clearInterval(timer);
}
module.exports = { startRecovery };
