// Read-only provider checks. No keys, client secrets, or customer data are printed.
import assert from "node:assert/strict";
import { build } from "esbuild";
import Module from "node:module";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const output = await build({
  stdin: { contents: `export { stripe } from './src/payments/stripeClient';`, resolveDir: cwd },
  platform: "node", format: "cjs", bundle: true, write: false, logLevel: "silent",
});
const compiled = new Module(`${cwd}/tests/stripe-preflight-bundle.cjs`);
compiled.filename = compiled.id;
compiled.paths = Module._nodeModulePaths(cwd);
compiled._compile(output.outputFiles[0].text, compiled.filename);
const { stripe } = compiled.exports;
try {
  assert.notEqual(process.env.REPLIT_DEPLOYMENT, "1", "Run sandbox checks from development only");
  const balance = await stripe.balance.retrieve();
  assert.equal(balance.livemode, false, "Refusing tests against live Stripe");
  console.log("Stripe sandbox confirmed");
  const [accounts, endpoints] = await Promise.all([
    stripe.accounts.list({ limit: 100 }), stripe.webhookEndpoints.list({ limit: 100 }),
  ]);
  console.log(JSON.stringify({
    connectedAccounts: accounts.data.map(a => ({
      id: a.id, country: a.country, chargesEnabled: a.charges_enabled,
      payoutsEnabled: a.payouts_enabled, capabilities: a.capabilities,
      outstandingRequirements: a.requirements?.currently_due,
    })),
    webhooks: endpoints.data.map(w => ({
      url: w.url.split("?")[0], status: w.status, livemode: w.livemode,
      enabledEvents: w.enabled_events,
    })),
  }, null, 2));
} catch (error) {
  console.error("Preflight failed", { type: error.type || error.name, code: error.code, param: error.param });
  process.exitCode = 1;
}