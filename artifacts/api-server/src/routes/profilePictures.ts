import type { Express, RequestHandler } from "express";
import { UpdateProfilePictureBody } from "@workspace/api-zod";
import { storage } from "../storage";
import { TeamPictureError, parseTeamPicturePath, validateTeamPicture } from "./teamPictures";

export function parseProfilePictureBody(body: unknown): string | null {
  const parsed = UpdateProfilePictureBody.strict().safeParse(body);
  if (!parsed.success || !Object.hasOwn(parsed.data, "objectPath")) {
    throw new TeamPictureError("Supply an uploaded picture path, or null to remove your photo.", 400);
  }
  return parseTeamPicturePath(parsed.data.objectPath);
}

type ProfilePictureDependencies = {
  validate: (path: unknown) => Promise<string | null>;
  update: (userId: string, path: string | null) => Promise<{ profileImageUrl: string | null } | undefined>;
};

export function registerProfilePictures(
  app: Express,
  authenticate: RequestHandler,
  dependencies: ProfilePictureDependencies = {
    validate: validateTeamPicture,
    update: (id, path) => storage.updateUserPicture(id, path),
  },
) {
  app.put("/api/users/profile-picture", authenticate, async (req: any, res) => {
    try {
      if (!req.userId) return res.status(401).json({ message: "Authentication required" });
      const path = parseProfilePictureBody(req.body);
      await dependencies.validate(path);
      // The authenticated account is the only identity this endpoint can edit.
      const user = await dependencies.update(req.userId, path);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ profileImageUrl: user.profileImageUrl });
    } catch (error) {
      if (error instanceof TeamPictureError) return res.status(error.status).json({ message: error.message });
      return res.status(500).json({ message: "Could not save your profile photo. Please retry." });
    }
  });
}
