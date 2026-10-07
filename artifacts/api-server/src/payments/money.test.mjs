import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const result = await build({
  entryPoints: [new URL("./money.ts", import.meta.url).pathname],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const source = result.outputFiles[0].text;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const { decimalToMinorUnits, calculatePercentageFeeMinor } = await import(
  moduleUrl
);

test("decimalToMinorUnits converts decimal strings exactly", () => {
  assert.equal(decimalToMinorUnits("0"), 0);
  assert.equal(decimalToMinorUnits("7"), 700);
  assert.equal(decimalToMinorUnits("7.5"), 750);
  assert.equal(decimalToMinorUnits("7.05"), 705);
  assert.equal(decimalToMinorUnits(" 123.45 "), 12_345);
});

test("decimalToMinorUnits rejects ambiguous or unsafe values", () => {
  for (const value of [
    "",
    "-1",
    ".50",
    "1.001",
    "1e2",
    "NaN",
    "Infinity",
    "01.00",
  ]) {
    assert.throws(() => decimalToMinorUnits(value));
  }
  assert.throws(() => decimalToMinorUnits("999999999999999999999.99"));
});

test("calculatePercentageFeeMinor works only with integer minor units", () => {
  assert.equal(calculatePercentageFeeMinor(10_00, 500), 50);
  assert.equal(calculatePercentageFeeMinor(9_99, 500), 50);
  assert.throws(() => calculatePercentageFeeMinor(10.5, 500));
  assert.throws(() => calculatePercentageFeeMinor(1_000, 10_001));
});
