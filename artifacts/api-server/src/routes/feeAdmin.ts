import type { Express, RequestHandler } from "express";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { platformFeeSettings, platformFeeAudit } from "@workspace/db";
import { db } from "../db";
import { getFeeAdminState, getFeeSettings } from "../payments/feeSettings";
import { requireSuperAdmin, sameOriginMutation } from "./notificationAdmin";

const bodySchema = z.object({
  platformBasisPoints: z.number().int().min(0).max(10000),
  stripeBasisPoints: z.number().int().min(0).max(10000),
  stripeFixedMinor: z.number().int().min(0).max(1000000),
  revision: z.number().int().min(0),
}).strict();
export function registerFeeAdmin(app: Express, authenticate: RequestHandler) {
  app.use("/api/admin/fees", authenticate, requireSuperAdmin, sameOriginMutation);
  app.get("/api/admin/fees", async (req, res) => {
    try { res.json(await getFeeAdminState()); }
    catch { res.status(503).json({ message: "Fee settings could not be loaded" }); }
  });
  app.put("/api/admin/fees", async (req: any, res) => {
    const input = bodySchema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: "Enter valid percentages, a fixed amount, and the current revision" });
    try {
      const result = await db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('ludi-platform-fees'))`);
        const [saved] = await tx.select().from(platformFeeSettings).where(eq(platformFeeSettings.id, "default"));
        const before = saved ?? await getFeeSettings();
        if (before.revision !== input.data.revision) return null;
        const after = { ...input.data, revision: before.revision + 1 };
        await tx.insert(platformFeeSettings).values({ id: "default", ...after }).onConflictDoUpdate({
          target: platformFeeSettings.id, set: { ...after, updatedAt: new Date() },
        });
        await tx.insert(platformFeeAudit).values({ actorId: req.userId, before, after });
        return after;
      });
      if (!result) return res.status(409).json({ message: "Another administrator changed these fees. Reload before saving." });
      return res.json(await getFeeAdminState());
    } catch { return res.status(503).json({ message: "Fee settings could not be saved. Please retry." }); }
  });
  app.get("/api/fee-settings", async (_req, res) => {
    try { res.json(await getFeeSettings()); }
    catch { res.status(503).json({ message: "Fee settings are unavailable" }); }
  });
}