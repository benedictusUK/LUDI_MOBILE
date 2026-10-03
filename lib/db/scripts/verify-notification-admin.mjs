// Development-only fixtures for a real signed-in browser verification.
// No application auth bypass, public bootstrap endpoint or real account change.
import pg from "pg";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import assert from "node:assert/strict";
if (process.env.REPLIT_DEPLOYMENT === "1" || !process.env.REPLIT_DEV_DOMAIN) throw new Error("Development verification only");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const directory = "/tmp/ludi-notification-verification";
const accounts = ["ludi-notification-verification-admin", "ludi-notification-verification-member"];
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const action = process.argv[2];
try {
  if (action === "setup") {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const triggerBackup = (await pool.query("SELECT * FROM push_triggers")).rows;
    const cookies = [];
    const sessions = [];
    for (const [index, id] of accounts.entries()) {
      await pool.query(`INSERT INTO users (id,email,first_name,last_name,username,date_of_birth,postcode,gender,profile_completed_at)
        VALUES ($1,$2,'Verification','Account',$3,'1990-01-01','SW1A 1AA','male',now()) ON CONFLICT (id) DO NOTHING`,
      [id, `${id}@example.invalid`, `notification_verification_${index}`]);
      const sid = randomUUID();
      const value = `s:${sid}.${createHmac("sha256", process.env.SESSION_SECRET).update(sid).digest("base64").replace(/=+$/, "")}`;
      const user = { claims: { sub: id }, expires_at: Math.floor(Date.now() / 1000) + 3600 };
      const session = { cookie: { originalMaxAge: 3600000, expires: new Date(Date.now() + 3600000).toISOString(), secure: true, httpOnly: true }, passport: { user } };
      await pool.query("INSERT INTO sessions (sid,sess,expire) VALUES ($1,$2,$3)", [sid, JSON.stringify(session), new Date(Date.now() + 3600000)]);
      sessions.push(sid);
      cookies.push({ name: "connect.sid", value: encodeURIComponent(value), domain: process.env.REPLIT_DEV_DOMAIN, path: "/", httpOnly: true, secure: true, sameSite: "Lax" });
    }
    await pool.query("INSERT INTO platform_admins (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [accounts[0]]);
    await writeFile(`${directory}/cookies.json`, JSON.stringify(cookies), { mode: 0o600 });
    await writeFile(`${directory}/state.json`, JSON.stringify({ sessions, triggerBackup }), { mode: 0o600 });
    process.stdout.write("Temporary SuperAdmin and ordinary-member browser fixtures are ready.\n");
  } else if (action === "check") {
    const cookies = JSON.parse(await readFile(`${directory}/cookies.json`, "utf8"));
    const request = (who, path, method = "GET", body, extraHeaders = {}) => fetch(`${base}${path}`, {
      method, headers: { Cookie: `${cookies[who].name}=${cookies[who].value}`, ...(body ? { "Content-Type": "application/json" } : {}), ...extraHeaders },
      body: body ? JSON.stringify(body) : undefined,
    });
    assert.equal((await fetch(`${base}/api/admin/notifications`)).status, 401);
    assert.equal((await request(1, "/api/admin/notifications")).status, 403);
    let response = await request(0, "/api/admin/notifications");
    assert.equal(response.status, 200);
    const state = await response.json();
    assert.equal(state.templates.length >= 10, true);
    assert.equal(state.triggers.length, 10);
    assert.equal(state.triggers.find(t => t.id === "event_reminder").enabled, false);
    assert.equal((await request(1, "/api/admin/notifications/templates", "POST", { name: "Forbidden", title: "No", body: "No" })).status, 403);
    assert.equal((await request(0, "/api/admin/notifications/preview", "POST", { title: "Test {notSupported}", body: "Body" })).status, 400);
    assert.equal((await request(0, "/api/admin/notifications/templates/default:event_created", "DELETE", {})).status, 409);
    assert.equal((await request(0, "/api/admin/notifications/preview", "POST", { title: "Hello", body: "World" }, { Origin: "https://malicious.example" })).status, 403);
    assert.equal((await request(1, "/api/notifications", "POST", { userId: accounts[0], title: "Spam", message: "Spam", type: "event_created" })).status, 403);
    response = await request(1, "/api/push/devices", "POST", { token: "b".repeat(64), environment: "sandbox", installationId: "notification-verification-installation" });
    assert.equal(response.status, 200);
    assert.equal((await request(1, "/api/push/devices", "POST", { token: "bad-token", environment: "sandbox", installationId: "notification-verification-installation" })).status, 400);
    response = await request(1, "/api/notification-preferences", "PUT", { pushNotificationsIOS: true, eventChanges: true });
    assert.equal(response.status, 200);
    const notificationId = randomUUID();
    await pool.query("INSERT INTO notifications (id,user_id,title,message,type) VALUES ($1,$2,'Verification update','Verification message','event_changed')", [notificationId, accounts[1]]);
    for (let tries = 0; tries < 12; tries++) {
      const result = await pool.query("SELECT status FROM push_deliveries WHERE notification_id=$1", [notificationId]);
      if (result.rowCount) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    const delivery = await pool.query("SELECT * FROM push_deliveries WHERE notification_id=$1", [notificationId]);
    assert.equal(delivery.rowCount, 1, "Database outbox must produce one durable push job");
    assert.ok(["queued", "retry", "sending"].includes(delivery.rows[0].status));
    await pool.query("INSERT INTO push_notification_outbox (notification_id) VALUES ($1) ON CONFLICT DO NOTHING", [notificationId]);
    await new Promise(r => setTimeout(r, 6000));
    assert.equal((await pool.query("SELECT id FROM push_deliveries WHERE notification_id=$1", [notificationId])).rowCount, 1, "Repeated outbox processing must not duplicate a job");
    // An account switch cannot retain another user's pending device jobs.
    assert.equal((await request(0, "/api/push/devices", "POST", { token: "b".repeat(64), environment: "sandbox", installationId: "notification-verification-installation" })).status, 200);
    assert.equal((await pool.query("SELECT user_id FROM push_devices WHERE token=$1", ["b".repeat(64)])).rows[0].user_id, accounts[0]);
    await request(0, "/api/push/devices", "DELETE", { installationId: "notification-verification-installation" });
    process.stdout.write("Backend checks passed: auth boundaries, CSRF, template safety, device registration, preferences, durable outbox and duplicate prevention.\n");
  } else if (action === "payment-check") {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const teamId = randomUUID(), eventId = randomUUID(), paymentId = randomUUID();
      await client.query("INSERT INTO teams (id,name,owner_id) VALUES ($1,$2,$3)", [teamId, `Notification verification ${teamId}`, accounts[0]]);
      await client.query(`INSERT INTO events
        (id,name,sport,start_date,start_time,primary_team_id,created_by_id,payment_required,payment_policy,fixed_price_minor,payment_deadline_at)
        VALUES ($1,'Notification verification event','football',CURRENT_DATE + 1,'19:00',$2,$3,true,'fixed_immediate',800,now()+interval '2 hours')`,
        [eventId, teamId, accounts[0]]);
      await client.query("INSERT INTO event_payments (id,event_id,user_id,agreed_amount_minor) VALUES ($1,$2,$3,800)", [paymentId, eventId, accounts[1]]);
      const types = async () => (await client.query("SELECT type FROM notifications WHERE related_id=$1 ORDER BY created_at,id", [eventId])).rows.map(r => r.type);
      assert.deepEqual(await types(), ["payment_required"]);
      await client.query("UPDATE event_payments SET payment_intent_id='pi_verification_only',payment_intent_status='requires_payment_method' WHERE id=$1", [paymentId]);
      assert.equal((await types()).length, 1, "Initial method selection must not claim that a card failed");
      await client.query("UPDATE event_payments SET payment_intent_status='requires_confirmation' WHERE id=$1", [paymentId]);
      await client.query("UPDATE event_payments SET payment_intent_status='requires_payment_method' WHERE id=$1", [paymentId]);
      await client.query("UPDATE event_payments SET payment_intent_status='requires_action' WHERE id=$1", [paymentId]);
      await client.query("UPDATE event_payments SET status='captured',captured_amount_minor=800 WHERE id=$1", [paymentId]);
      await client.query("UPDATE event_payments SET status='captured',payment_intent_status='succeeded' WHERE id=$1", [paymentId]);
      const notices = await types();
      for (const kind of ["payment_required", "payment_failed", "payment_authorization_required", "payment_captured"]) {
        assert.equal(notices.filter(t => t === kind).length, 1, `${kind} must be generated exactly once`);
      }
      const outbox = await client.query("SELECT o.notification_id FROM push_notification_outbox o JOIN notifications n ON n.id=o.notification_id WHERE n.related_id=$1", [eventId]);
      assert.equal(outbox.rowCount, 4, "All four notices must join the durable outbox atomically");
      process.stdout.write("Payment-state checks passed: real requests, bank authorisation, confirmed collection and declines; no initial-state false failure or duplicate capture. All fixture changes rolled back.\n");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  } else if (action === "cleanup") {
    const state = JSON.parse(await readFile(`${directory}/state.json`, "utf8"));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const trigger of state.triggerBackup) {
        await client.query("UPDATE push_triggers SET template_id=$2,enabled=$3,audience=$4,reminder_minutes=$5,updated_at=$6 WHERE id=$1",
          [trigger.id, trigger.template_id, trigger.enabled, trigger.audience, trigger.reminder_minutes, trigger.updated_at]);
      }
      await client.query("DELETE FROM push_admin_audit WHERE actor_id=ANY($1)", [accounts]);
      await client.query("DELETE FROM push_templates WHERE name LIKE 'Notification verification%'");
      await client.query("DELETE FROM sessions WHERE sid=ANY($1)", [state.sessions]);
      await client.query("DELETE FROM users WHERE id=ANY($1)", [accounts]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
    await rm(directory, { recursive: true });
    process.stdout.write("Temporary verification users, sessions, templates and devices removed; trigger settings restored.\n");
  } else throw new Error("Specify setup, check, payment-check or cleanup");
} finally { await pool.end(); }