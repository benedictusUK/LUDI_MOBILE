// Trusted operator command only; there is deliberately no public bootstrap API.
import pg from "pg";
const [, , action, email] = process.argv;
if (!["grant", "revoke"].includes(action) || !email) {
  throw new Error("Usage: pnpm --filter @workspace/db run superadmin -- grant|revoke account@example.com");
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const result = await pool.query("SELECT id FROM users WHERE lower(email) = lower($1)", [email]);
  if (result.rowCount !== 1) throw new Error("Exactly one existing account must match; ask the account owner to sign in first");
  const id = result.rows[0].id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (action === "grant") await client.query("INSERT INTO platform_admins (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [id]);
    else await client.query("DELETE FROM platform_admins WHERE user_id = $1", [id]);
    await client.query("INSERT INTO push_admin_audit (actor_id, action, entity_id) VALUES (NULL, $1, $2)", [`operator_superadmin_${action}`, id]);
    await client.query("COMMIT");
    process.stdout.write(`SuperAdmin access ${action === "grant" ? "granted" : "revoked"} for the specified account.\n`);
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
} finally { await pool.end(); }