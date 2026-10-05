// Isolated synthetic development fixtures; never run against production.
import { createRequire } from "node:module";
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";

if (process.env.NODE_ENV === "production") throw new Error("Development-only regression suite");
const cwd = fileURLToPath(new URL("..", import.meta.url));
const output = `${cwd}/tests/.team-management-bundle.cjs`;
await build({
  entryPoints: [`${cwd}/src/teams/management.integration.test.ts`],
  outfile: output, platform: "node", format: "cjs", bundle: true,
  packages: "external", logLevel: "silent",
  plugins: [{
    name: "workspace-source",
    setup(build) {
      build.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: fileURLToPath(new URL("../../../lib/db/src/schema/index.ts", import.meta.url)) }));
      build.onResolve({ filter: /^drizzle-zod$/ }, args => ({
        path: createRequire(new URL("../../../lib/db/package.json", import.meta.url)).resolve(args.path), external: true,
      }));
    },
  }],
});
try {
  const result = spawnSync(process.execPath, ["--test", output], { cwd, stdio: "inherit", env: { ...process.env, NODE_ENV: "development" } });
  process.exitCode = result.status ?? 1;
} finally { await unlink(output); }
