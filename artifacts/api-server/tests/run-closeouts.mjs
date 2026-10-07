import { build } from "esbuild";
import Module from "node:module";
import { fileURLToPath } from "node:url";
// Match the established payment-policy test harness. Workspace exports point
// at TypeScript sources, so native Node ESM directory resolution is unsuitable.
const cwd = fileURLToPath(new URL("../", import.meta.url));
const output = await build({
  absWorkingDir: cwd, entryPoints: ["tests/closeout.test.ts"],
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
});
const compiled = new Module(`${cwd}/tests/closeout-bundle.cjs`);
compiled.filename = compiled.id;
compiled.paths = Module._nodeModulePaths(cwd);
compiled._compile(output.outputFiles[0].text, compiled.filename);
