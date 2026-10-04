// Development-only synthetic identities for UI verification. No provider login
// or Stripe payment is mocked in the running app; checkout is not confirmed.
import pg from "pg";
import { createHmac, randomUUID } from "node:crypto";
import { writeFile, readFile } from "node:fs/promises";
const path = "/tmp/ludi-fee-ui-fixture.json";
if (process.env.REPLIT_DEPLOYMENT === "1") throw new Error("Never run UI fixtures in production");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  if (process.argv[2] === "publish-fixture") {
    const f = JSON.parse(await readFile(path, "utf8"));
    await client.query("UPDATE events SET is_published=true WHERE id=$1",[f.eventId]);
    console.log("Synthetic event published for checkout consent verification");
  } else if (process.argv[2] === "cleanup") {
    const f = JSON.parse(await readFile(path, "utf8"));
    await client.query("BEGIN");
    await client.query("DELETE FROM events WHERE id = $1", [f.eventId]);
    await client.query("DELETE FROM team_memberships WHERE team_id = $1", [f.teamId]);
    await client.query("DELETE FROM teams WHERE id = $1", [f.teamId]);
    await client.query("DELETE FROM sessions WHERE sid = ANY($1::text[])", [f.sessionIds]);
    const latest = await client.query("SELECT actor_id FROM platform_fee_audit ORDER BY created_at DESC LIMIT 1");
    if (latest.rows[0]?.actor_id === f.adminId) {
      if (f.originalSettings) await client.query(`UPDATE platform_fee_settings SET platform_basis_points=$1,stripe_basis_points=$2,stripe_fixed_minor=$3,revision=revision+1,updated_at=now() WHERE id='default'`,
        [f.originalSettings.platform_basis_points,f.originalSettings.stripe_basis_points,f.originalSettings.stripe_fixed_minor]);
      else await client.query("DELETE FROM platform_fee_settings WHERE id='default'");
    }
    await client.query("DELETE FROM platform_fee_audit WHERE actor_id=$1", [f.adminId]);
    await client.query("DELETE FROM platform_admins WHERE user_id=$1", [f.adminId]);
    await client.query("DELETE FROM users WHERE id=ANY($1::varchar[])", [[f.adminId,f.memberId]]);
    await client.query("COMMIT");
    console.log("Synthetic fee UI fixtures removed");
  } else {
    const suffix = randomUUID();
    const f = { adminId:`fee-test-admin-${suffix}`,memberId:`fee-test-member-${suffix}`,teamId:randomUUID(),eventId:randomUUID(),sessionIds:[],cookies:{} };
    const saved = await client.query("SELECT * FROM platform_fee_settings WHERE id='default'");
    f.originalSettings = saved.rows[0] || null;
    await client.query("BEGIN");
    for (const [id,name] of [[f.adminId,"Admin"],[f.memberId,"Member"]]) {
      await client.query("INSERT INTO users(id,email,first_name,last_name) VALUES($1,$2,$3,'Fee Test')",[id,`${id}@ludi-fixture.invalid`,name]);
      const sid=randomUUID();
      const sess={cookie:{originalMaxAge:3600000,expires:new Date(Date.now()+3600000).toISOString(),httpOnly:true,path:"/"},
        passport:{user:{claims:{sub:id},expires_at:Math.floor(Date.now()/1000)+3600}}};
      await client.query("INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3)",[sid,JSON.stringify(sess),new Date(Date.now()+3600000)]);
      f.sessionIds.push(sid);
      const signed = `${sid}.${createHmac("sha256",process.env.SESSION_SECRET).update(sid).digest("base64").replace(/=+$/,"")}`;
      f.cookies[id===f.adminId?"admin":"member"]={name:"connect.sid",value:`s:${signed}`,path:"/",httpOnly:true,secure:true,sameSite:"Lax"};
    }
    await client.query("INSERT INTO platform_admins(user_id) VALUES($1)",[f.adminId]);
    await client.query("INSERT INTO teams(id,name,sports,owner_id) VALUES($1,$2,ARRAY['Football'],$3)",[f.teamId,`Fee UI Fixture ${suffix}`,f.adminId]);
    for (const [id,role] of [[f.adminId,"admin"],[f.memberId,"member"]]) await client.query("INSERT INTO team_memberships(team_id,user_id,role) VALUES($1,$2,$3)",[f.teamId,id,role]);
    await client.query(`INSERT INTO events(id,name,sport,start_date,end_date,start_time,end_time,created_by_id,primary_team_id,payment_required,payment_policy,max_player_payment,currency,authorization_opens_at,payment_deadline_at,completion_due_at,fee_configuration)
      VALUES($1,'Upfront Fee UI Fixture','Football','2099-01-02','2099-01-03','12:00','14:00',$2,$3,true,'flexible_post_event','10.00','gbp','2019-01-01','2099-01-02 12:00Z','2099-01-04',
        '{"platformBasisPoints":500,"stripeBasisPoints":299,"stripeFixedMinor":0,"revision":1}')`,[f.eventId,f.adminId,f.teamId]);
    await client.query("COMMIT");
    await writeFile(path,JSON.stringify(f),{mode:0o600});
    console.log(`Synthetic fee UI fixture ready: ${path}`);
  }
} catch(error) { await client.query("ROLLBACK");throw error; }
finally {client.release();await pool.end();}