import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseProfilePictureBody, registerProfilePictures } from "./profilePictures";
import { TeamPictureError } from "./teamPictures";

const path = "/objects/uploads/12345678-1234-1234-1234-123456789abc";
test("optional photos accept an uploaded path or explicit removal", () => {
  assert.equal(parseProfilePictureBody({ objectPath: path }), path);
  assert.equal(parseProfilePictureBody({ objectPath: null }), null);
});
test("profile photos reject omitted paths, external URLs, data URIs and extra identity fields", () => {
  for (const body of [{}, { objectPath: undefined }, { objectPath: "" }, { objectPath: "https://example.com/photo.png" },
    { objectPath: "data:image/png;base64,abc" }, { objectPath: path, userId: "another-user" }]) {
    assert.throws(() => parseProfilePictureBody(body), TeamPictureError);
  }
});

async function request(body: unknown, options: { authenticated?: boolean; rejectStorage?: boolean } = {}) {
  let handler: any;
  const writes: unknown[] = [];
  const app = { put(route: string, _auth: any, handle: any) {
    assert.equal(route, "/api/users/profile-picture");
    handler = handle;
  }};
  registerProfilePictures(app as any, (() => {}) as any, {
    validate: async value => {
      if (options.rejectStorage) throw new TeamPictureError("Storage unavailable", 503);
      return value as string | null;
    },
    update: async (id, picture) => {
      writes.push({ id, picture });
      return { profileImageUrl: picture };
    },
  });
  const response = {
    statusCode: 200, body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
  };
  await handler({ body, userId: options.authenticated === false ? undefined : "authenticated-user" }, response);
  return { response, writes };
}
test("photo save edits only the authenticated account and returns the persisted field", async () => {
  const result = await request({ objectPath: path });
  assert.deepEqual(result.writes, [{ id: "authenticated-user", picture: path }]);
  assert.deepEqual(result.response.body, { profileImageUrl: path });
});
test("removal persists null, not an empty URL", async () => {
  const result = await request({ objectPath: null });
  assert.deepEqual(result.writes, [{ id: "authenticated-user", picture: null }]);
  assert.deepEqual(result.response.body, { profileImageUrl: null });
});
test("unauthenticated requests and failed verification never change a profile", async () => {
  const unauthenticated = await request({ objectPath: path }, { authenticated: false });
  assert.equal(unauthenticated.response.statusCode, 401);
  assert.deepEqual(unauthenticated.writes, []);
  const failed = await request({ objectPath: path }, { rejectStorage: true });
  assert.equal(failed.response.statusCode, 503);
  assert.deepEqual(failed.writes, []);
});
test("existing-account sign-ins do not overwrite saved or removed photos", () => {
  const source = readFileSync(new URL("../storage.ts", import.meta.url), "utf8");
  const auth = source.slice(source.indexOf("async upsertAuthUser("), source.indexOf("async getUserById("));
  assert.ok(!auth.includes("profileImageUrl: userData.profileImageUrl"));
  const legacy = source.slice(source.indexOf("async upsertUser("), source.indexOf("async upsertAuthUser("));
  assert.ok(legacy.includes("delete repeatSignInData.profileImageUrl"));
  assert.ok(legacy.includes("...userData")); // New accounts still receive provider defaults.
  assert.ok(legacy.includes("...repeatSignInData")); // Existing choices stay untouched.
});
