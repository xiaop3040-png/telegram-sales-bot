require("dotenv").config({ quiet: true });
const fs = require("node:fs");
(async () => {
  const bytes = require("../src/security/snapshot").decode(
    fs.readFileSync(process.argv[2]),
  );
  const SQL = await require("sql.js")();
  const db = new SQL.Database(bytes);
  const result = db.exec("PRAGMA integrity_check")[0].values[0][0];
  db.close();
  if (result !== "ok") throw new Error("Invalid snapshot");
  console.log("Snapshot integrity: ok");
})().catch(() => {
  console.error("Snapshot verification failed");
  process.exitCode = 1;
});
