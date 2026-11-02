// Run against a live single-writer DB: atomic rename guarantees a complete source snapshot.
require("dotenv").config({ quiet: true });
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { decode, encode } = require("../src/security/snapshot");
(async () => {
  const source = process.env.DB_PATH;
  if (!source || !process.env.DATA_ENCRYPTION_KEY)
    throw new Error("DB_PATH and DATA_ENCRYPTION_KEY are required");
  const bytes = decode(fs.readFileSync(source));
  const SQL = await require("sql.js")();
  const db = new SQL.Database(bytes);
  if (db.exec("PRAGMA integrity_check")[0].values[0][0] !== "ok")
    throw new Error("Database integrity check failed");
  db.close();
  const folder =
    process.env.BACKUP_DIR || path.join(path.dirname(source), "backups");
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  const filename = path.join(
    folder,
    `shopbot-${new Date().toISOString().replaceAll(":", "-")}-${crypto.randomBytes(4).toString("hex")}.db`,
  );
  fs.writeFileSync(filename, encode(bytes), { flag: "wx", mode: 0o600 });
  console.log("Verified encrypted backup created:", filename);
})().catch(() => {
  console.error("Backup failed; verify path, key and database integrity");
  process.exitCode = 1;
});
