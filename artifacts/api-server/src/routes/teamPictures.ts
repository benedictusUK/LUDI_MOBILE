import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage";

export class TeamPictureError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const picturePath = z.string().regex(/^\/objects\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).nullable();
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function parseTeamPicturePath(value: unknown): string | null {
  const result = picturePath.safeParse(value);
  if (!result.success) throw new TeamPictureError("Choose an uploaded JPEG, PNG or WebP picture.", 400);
  return result.data;
}

export function matchesPictureSignature(bytes: Buffer, type: string) {
  if (type === "image/jpeg") return bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  return false;
}

// Verify upload size and image signature, not just a client-supplied MIME type.
export async function validateTeamPicture(value: unknown, service = new ObjectStorageService()) {
  const path = parseTeamPicturePath(value);
  if (path === null) return null;
  try {
    const file = await service.getObjectEntityFile(path);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES || !TYPES.has(metadata.contentType || "")) {
      throw new TeamPictureError("Use a JPEG, PNG or WebP picture smaller than 5 MB.", 400);
    }
    const chunks: Buffer[] = [];
    for await (const chunk of file.createReadStream({ start: 0, end: 15 })) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (!matchesPictureSignature(Buffer.concat(chunks), metadata.contentType || "")) {
      throw new TeamPictureError("This file is not a supported picture. Choose a JPEG, PNG or WebP photo.", 400);
    }
    return path;
  } catch (error) {
    if (error instanceof TeamPictureError) throw error;
    if (error instanceof ObjectNotFoundError || (error as any)?.code === 404) {
      throw new TeamPictureError("The uploaded picture could not be found. Please choose it again.", 400);
    }
    throw new TeamPictureError("Could not verify the uploaded picture. Please retry.", 503);
  }
}
