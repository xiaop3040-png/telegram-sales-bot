// Local browser-test server. Never load production configuration or call Telegram.
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "shopbot-ui-"));
process.env.DB_PATH = path.join(folder, "fixture.db");
process.env.ADMIN_API_KEY = "test-admin-key-".repeat(3);
process.env.DATA_ENCRYPTION_KEY = "d".repeat(64);
const db = require("../src/database");
(async () => {
  await db.initDatabase();
  const cat = db.addCategory("AI & Cloud", "☁");
  const pid = db.addProduct(
    "Cloud VPS · Starter",
    149000,
    "Authorized cloud service",
    "",
    cat,
    null,
    "preorder",
    0,
    24,
    30,
    100,
    7,
  );
  db.addProduct("<img src=x onerror=alert(1)>", 50000);
  db.createOrder({
    telegramUserId: 42,
    telegramUsername: "demo",
    productId: pid,
    productName: "Cloud VPS · Starter",
    quantity: 1,
    unitPrice: 149000,
    totalAmount: 149000,
    qrUrl: "",
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  });
  const express = require("express");
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    );
    next();
  });
  require("../src/handlers/adminAPI").setupAdminAPI(app, {
    sendMessage: async () => ({ message_id: 1 }),
  });
  app.use(express.static(path.join(__dirname, "../public")));
  app.listen(3107, "127.0.0.1");
})();
process.on("SIGTERM", () => {
  fs.rmSync(folder, { recursive: true, force: true });
  process.exit(0);
});
