import assert from "node:assert/strict";
import test from "node:test";
import Module, { createRequire } from "node:module";
const require = createRequire(new URL("../../artifacts/api-server/package.json", import.meta.url));
const { build } = require("esbuild");
const { Pool, neonConfig } = require("@neondatabase/serverless");
const { drizzle } = require("drizzle-orm/neon-serverless");
const { sql } = require("drizzle-orm");
const ws = require("ws");

// Real storage and real SQL, with a shadow users table and automatic rollback.
// No real profiles, provider calls, or persistent database changes.
test("profile usernames persist without admitting server-owned fields", {
  skip: !process.env.DATABASE_URL ? "Development database required" : false,
}, async t => {
  assert.notEqual(process.env.NODE_ENV, "production");
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const key = `__profilePersistence_${Date.now()}`;
  globalThis[key] = {};
  const rollback = new Error("Rollback profile fixtures");
  try {
    const compiled = await build({
      entryPoints: ["artifacts/api-server/src/storage.ts"],
      bundle: true, platform: "node", format: "cjs", write: false,
      plugins: [{
        name: "isolated-profile-storage",
        setup(builder) {
          builder.onResolve({ filter: /^@workspace\/db$/ }, () => ({
            path: `${process.cwd()}/lib/db/src/schema/index.ts`,
          }));
          builder.onResolve({ filter: /^(?:\.\.\/|\.\/)db$/ }, () => ({
            path: "db", namespace: "profile-fixture",
          }));
          builder.onResolve({ filter: /^\.\/websocket$/ }, () => ({
            path: "websocket", namespace: "profile-fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "profile-fixture" }, ({ path }) => ({
            contents: path === "db"
              ? `export const db = new Proxy({}, { get(_, name) { const db = globalThis[${JSON.stringify(key)}].db; const value = db[name]; return typeof value === 'function' ? value.bind(db) : value; } });`
              : "export const notificationWS = {};",
            loader: "js",
          }));
        },
      }],
    });
    const filename = `${process.cwd()}/profile-storage-fixture.cjs`;
    const compiledModule = new Module(filename);
    compiledModule.filename = filename;
    compiledModule.paths = Module._nodeModulePaths(process.cwd());
    compiledModule._compile(compiled.outputFiles[0].text, filename);
    const storage = new compiledModule.exports.DatabaseStorage();
    await drizzle(pool).transaction(async tx => {
      globalThis[key].db = tx;
      await tx.execute(sql`CREATE TEMP TABLE users (LIKE public.users INCLUDING ALL) ON COMMIT DROP`);
      await tx.execute(sql`SET LOCAL search_path = pg_temp, public`);
      const namespace = await tx.execute(sql`SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=to_regclass('users')`);
      assert.match(namespace.rows[0].nspname, /^pg_temp_/);
      await tx.execute(sql`INSERT INTO users(id,email,username) VALUES
        ('profile_fixture','profile@example.invalid',NULL),
        ('other_fixture','other@example.invalid','taken_name')`);

      await t.test("new-account username survives save and reload", async () => {
        const saved = await storage.updateUserProfile("profile_fixture", { username: "ludi_member" });
        assert.equal(saved.username, "ludi_member");
        assert.equal((await storage.getUserById("profile_fixture")).username, "ludi_member");
      });
      await t.test("self-save and subsequent sign-in preserve the username", async () => {
        await storage.updateUserProfile("profile_fixture", { username: "ludi_member" });
        await storage.upsertAuthUser({ id: "profile_fixture", email: "profile@example.invalid", authProvider: "apple" });
        assert.equal((await storage.getUserById("profile_fixture")).username, "ludi_member");
      });
      await t.test("editing another field does not clear the username", async () => {
        await storage.updateUserProfile("profile_fixture", { firstName: "Member" });
        assert.equal((await storage.getUserById("profile_fixture")).username, "ludi_member");
      });
      await t.test("server-owned Stripe and authentication fields remain protected", async () => {
        await storage.updateUserProfile("profile_fixture", {
          username: "renamed_member", stripeCustomerId: "cus_forged",
          stripeAccountId: "acct_forged", authProvider: "forged",
        });
        const saved = await storage.getUserById("profile_fixture");
        assert.equal(saved.username, "renamed_member");
        assert.equal(saved.stripeCustomerId, null);
        assert.equal(saved.stripeAccountId, null);
        assert.equal(saved.authProvider, "apple");
      });
      await t.test("invalid and taken usernames reject without changing the saved value", async () => {
        for (const username of ["", "ab", "invalid name", "x".repeat(21)]) {
          await assert.rejects(storage.updateUserProfile("profile_fixture", { username }));
        }
        await assert.rejects(storage.updateUserProfile("profile_fixture", { username: "taken_name" }),
          error => error.code === "USERNAME_TAKEN");
        assert.equal((await storage.getUserById("profile_fixture")).username, "renamed_member");
      });
      await t.test("database uniqueness still handles a concurrent availability winner", async () => {
        const check = storage.checkUsernameAvailability;
        storage.checkUsernameAvailability = async () => true;
        try {
          await assert.rejects(tx.transaction(async nested => {
            globalThis[key].db = nested;
            await storage.updateUserProfile("profile_fixture", { username: "taken_name" });
          }), error => error.code === "USERNAME_TAKEN");
        } finally {
          storage.checkUsernameAvailability = check;
          globalThis[key].db = tx;
        }
        assert.equal((await storage.getUserById("profile_fixture")).username, "renamed_member");
      });
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    delete globalThis[key];
    await pool.end();
  }
});
