import type { Express, RequestHandler } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { teamMemberships, teams } from "@workspace/db";
import { db } from "../db";
import { PaymentPolicyError, requireEventAccess } from "../payments/policyService";
import { usesClosePayout } from "../payments/closeoutMath";
import { ensureCloseout, getCloseoutState, syncLinks } from "../payments/closeoutState";
import { closeEvent, createCloseoutLink, reconcileCloseout, saveCloseout } from "../payments/closeoutService";
import { sameOriginRequest } from "./notificationAdmin";

const handle = (work: (req: any, res: any) => Promise<unknown>): RequestHandler => (req, res) => {
  void work(req, res).catch(error => {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid final payment details", errors: error.issues });
    if (error instanceof PaymentPolicyError) return res.status(error.status).json({ message: error.message });
    req.log?.error({ errorType: error.name }, "Event close payment operation failed");
    return res.status(503).json({ message: "The payment operation needs retrying. No second payment or payout should be started." });
  });
};
async function managedEvent(req: any) {
  const event = await requireEventAccess(req.params.id, req.userId);
  const [manager] = await db.select().from(teamMemberships).where(and(
    eq(teamMemberships.teamId, event.primaryTeamId), eq(teamMemberships.userId, req.userId),
    inArray(teamMemberships.role, ["captain", "admin"]),
  )).limit(1);
  const [team] = await db.select().from(teams).where(eq(teams.id, event.primaryTeamId)).limit(1);
  if (event.createdById !== req.userId && event.venueOrganiserId !== req.userId && team?.ownerId !== req.userId && !manager) throw new PaymentPolicyError(403, "Only this event's organisers can manage final payments");
  if (!event.paymentRequired || !usesClosePayout(event)) throw new PaymentPolicyError(409, "This event retains its previous payment flow");
  if ((event.currency || "gbp") !== "gbp") throw new PaymentPolicyError(409, "This Close flow currently supports GBP events");
  return event;
}
const draft = z.object({
  venueCostMinor: z.number().int().min(0).max(99999999),
  players: z.array(z.object({ userId: z.string().min(1), method: z.enum(["online", "cash"]), cashAmountMinor: z.number().int().min(0).max(99999999).default(0) })).max(500),
}).strict();
export function registerEventCloseouts(app: Express, authenticate: RequestHandler) {
  // Reconciliation has no request body; keep origin protection separate
  // from notification settings' JSON-body requirement. Native bearer calls work.
  app.use("/api/events/:id/closeout", sameOriginRequest);
  app.get("/api/events/:id/closeout", authenticate, handle(async (req, res) => {
    const event = await managedEvent(req);
    await ensureCloseout(event);
    await syncLinks(event);
    res.json(await getCloseoutState(event));
  }));
  app.put("/api/events/:id/closeout", authenticate, handle(async (req, res) => {
    const input = draft.parse(req.body);
    const event = await managedEvent(req);
    await ensureCloseout(event);
    res.json(await saveCloseout(event, input.venueCostMinor, input.players));
  }));
  app.post("/api/events/:id/closeout/reconcile", authenticate, handle(async (req, res) => {
    const event = await managedEvent(req);
    await ensureCloseout(event);
    res.json(await reconcileCloseout(event));
  }));
  app.post("/api/events/:id/closeout/links", authenticate, handle(async (req, res) => {
    const { userId } = z.object({ userId: z.string().min(1) }).strict().parse(req.body);
    res.json(await createCloseoutLink(await managedEvent(req), userId));
  }));
  app.post("/api/events/:id/closeout/close", authenticate, handle(async (req, res) => {
    const input = z.object({ acknowledged: z.literal(true), expectedPayoutMinor: z.number().int().min(0), revision: z.string().length(64) }).strict().parse(req.body);
    res.json(await closeEvent(await managedEvent(req), req.userId, input.expectedPayoutMinor, input.revision));
  }));
}
