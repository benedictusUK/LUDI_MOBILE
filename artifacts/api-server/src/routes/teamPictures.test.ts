import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { parseTeamPicturePath, validateTeamPicture, matchesPictureSignature, TeamPictureError } from "./teamPictures";

const path = "/objects/uploads/12345678-1234-1234-1234-123456789abc";
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const fakeStorage = (size = 128, contentType = "image/png", bytes = png) => ({
  getObjectEntityFile: async () => ({
    getMetadata: async () => [{ size, contentType }],
    createReadStream: () => Readable.from([bytes]),
  }),
}) as any;

test("picture paths accept uploaded UUIDs and explicit removal only", () => {
  assert.equal(parseTeamPicturePath(path), path);
  assert.equal(parseTeamPicturePath(null), null);
  for (const input of [undefined, "", false, "/objects/uploads/../../secret", "https://example.com/picture.png", "/objects/uploads/" + "-".repeat(36)]) {
    assert.throws(() => parseTeamPicturePath(input), TeamPictureError);
  }
});
test("no picture remains valid and needs no storage access", async () => {
  assert.equal(await validateTeamPicture(null, {
    getObjectEntityFile: () => { throw new Error("must not run"); },
  } as any), null);
});
test("a valid uploaded picture is accepted", async () => {
  assert.equal(await validateTeamPicture(path, fakeStorage()), path);
});
test("empty, oversized and unsupported image types are rejected", async () => {
  for (const storage of [fakeStorage(0), fakeStorage(5 * 1024 * 1024 + 1), fakeStorage(128, "image/svg+xml"), fakeStorage(NaN)]) {
    await assert.rejects(validateTeamPicture(path, storage), (error: any) => error.status === 400);
  }
});
test("client MIME spoofing cannot save text as a picture", async () => {
  await assert.rejects(validateTeamPicture(path, fakeStorage(128, "image/png", Buffer.from("<script>alert(1)</script>"))),
    (error: any) => error.status === 400);
});
test("PNG, JPEG and WebP signatures are distinguished", () => {
  assert.equal(matchesPictureSignature(png, "image/png"), true);
  assert.equal(matchesPictureSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"), true);
  assert.equal(matchesPictureSignature(Buffer.from("RIFFxxxxWEBP"), "image/webp"), true);
  assert.equal(matchesPictureSignature(png, "image/jpeg"), false);
});
test("missing uploads and unavailable storage return explicit failures", async () => {
  await assert.rejects(validateTeamPicture(path, { getObjectEntityFile: async () => { throw { code: 404 }; } } as any),
    (error: any) => error.status === 400);
  await assert.rejects(validateTeamPicture(path, { getObjectEntityFile: async () => { throw new Error("offline"); } } as any),
    (error: any) => error.status === 503);
});
