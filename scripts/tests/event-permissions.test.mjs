import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { build } = createRequire(new URL("../../artifacts/api-server/package.json", import.meta.url))("esbuild");

const result = await build({
  entryPoints: ["artifacts/ludi-web/src/lib/event-permissions.ts"],
  bundle: true, write: false, format: "esm", platform: "node",
});
const { canManageExistingEvent } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
const event = { primaryTeamId: "synthetic-team", createdById: "another-organiser" };

for (const role of ["owner", "admin", "captain"]) {
  test(`archived team's ${role} retains Audit, Collect Payment, Edit and Manage Series for another organiser's event`, () => {
    const archiveAccess = [{ id: event.primaryTeamId, ownerId: role === "owner" ? "viewer" : "different-owner",
      role: role === "owner" ? "member" : role, archivedAt: "2026-10-05T12:00:00Z" }];
    const activeDiscovery = [];
    assert.equal(canManageExistingEvent(event, "viewer", activeDiscovery), false);
    assert.equal(canManageExistingEvent(event, "viewer", [...activeDiscovery, ...archiveAccess]), true);
  });
}
test("archived ordinary members and outsiders cannot gain financial-management permissions", () => {
  assert.equal(canManageExistingEvent(event, "viewer", [{ id: event.primaryTeamId, ownerId: "owner", role: "member" }]), false);
  assert.equal(canManageExistingEvent(event, "viewer", []), false);
  assert.equal(canManageExistingEvent(event, undefined, []), false);
});
test("event creator retains existing controls independently of team discovery", () => {
  assert.equal(canManageExistingEvent(event, "another-organiser", []), true);
});
