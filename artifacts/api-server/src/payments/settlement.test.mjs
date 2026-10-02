import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const result = await build({
  entryPoints: [new URL("./settlement.ts", import.meta.url).pathname],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const source = result.outputFiles[0].text;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const { allocateEvenlyMinor, needsLegacyTransfer } = await import(moduleUrl);

test("allocateEvenlyMinor preserves the total and assigns the remainder deterministically", () => {
  const allocation = allocateEvenlyMinor(10_00, [
    "payment-c",
    "payment-a",
    "payment-b",
  ]);
  assert.deepEqual(
    [...allocation],
    [
      ["payment-a", 334],
      ["payment-b", 333],
      ["payment-c", 333],
    ],
  );
  assert.equal(
    [...allocation.values()].reduce((sum, amount) => sum + amount, 0),
    10_00,
  );
});

test("destination charges never receive an additional legacy transfer", () => {
  assert.equal(
    needsLegacyTransfer({ destination: "acct_123" }, "succeeded"),
    false,
  );
  assert.equal(needsLegacyTransfer(null, "succeeded"), true);
  assert.equal(needsLegacyTransfer(null, "requires_capture"), false);
});

test("allocateEvenlyMinor rejects invalid settlement inputs", () => {
  assert.throws(() => allocateEvenlyMinor(100, []));
  assert.throws(() => allocateEvenlyMinor(100, ["same", "same"]));
  assert.throws(() => allocateEvenlyMinor(10.5, ["payment"]));
});
