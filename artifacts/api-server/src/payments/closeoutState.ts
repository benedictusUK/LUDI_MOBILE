import { and, eq, inArray } from "drizzle-orm";
import { calculatePlayerPrice, effectivePaymentPolicy, eventEndAt, eventCloseouts, eventCloseoutLinks,
  eventCloseoutRefunds, eventAttendance, eventPayments, payments, eventTeams, teamMemberships, users, type FinalPlayer, type events } from "@workspace/db";
import { db } from "../db";
import { stripe } from "./stripeClient";
import { PaymentPolicyError } from "./policyService";
import { closeoutAmounts, closeoutRevision, usesClosePayout } from "./closeoutMath";
import { decimalToMinorUnits } from "./money";

export type CloseEvent = typeof events.$inferSelect;
export type CloseExecutor = Pick<typeof db, "select" | "update" | "insert">;
export type VenueSource = { key: string; userId: string; intentId: string; chargeId: string | null; baseMinor: number; refundedMinor: number };
export function originalBase(event: CloseEvent) {
  return effectivePaymentPolicy(event) === "flexible_post_event"
    ? decimalToMinorUnits(event.maxPlayerPayment || "0") : event.fixedPriceMinor || 0;
}
export async function syncLinks(event: CloseEvent, tx: CloseExecutor = db, expire = false, onlyUserId?: string) {
  const links = await tx.select().from(eventCloseoutLinks).where(and(eq(eventCloseoutLinks.eventId, event.id),
    onlyUserId ? eq(eventCloseoutLinks.userId, onlyUserId) : undefined));
  for (const link of links) {
    if (!link.checkoutSessionId) continue;
    let session = await stripe.checkout.sessions.retrieve(link.checkoutSessionId);
    if (expire && session.status === "open") {
      try { session = await stripe.checkout.sessions.expire(session.id); }
      catch { session = await stripe.checkout.sessions.retrieve(session.id); if (session.status === "open") throw new PaymentPolicyError(409, "A payment link could not be expired. Retry before closing."); }
    }
    if (session.status === "complete") {
      if (session.payment_status !== "paid") throw new PaymentPolicyError(409, "A final-player payment is still processing. Wait before closing.");
      const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (!intentId) throw new PaymentPolicyError(409, "The completed payment link has no verified payment");
      const intent = await stripe.paymentIntents.retrieve(intentId);
      if (session.metadata?.ludiCloseoutLinkId !== link.id || session.amount_total !== link.totalAmountMinor ||
        intent.status !== "succeeded" || intent.amount_received !== link.totalAmountMinor || intent.currency !== "gbp" ||
        intent.metadata.ludiCloseoutLinkId !== link.id || intent.metadata.ludiPayoutFlow !== "on_close" || intent.transfer_data) {
        throw new PaymentPolicyError(409, "The payment link could not be verified");
      }
      const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
      const charge = chargeId ? await stripe.charges.retrieve(chargeId) : null;
      await tx.update(eventCloseoutLinks).set({ status: "paid", paymentIntentId: intent.id, chargeId: chargeId || null,
        refundedAmountMinor: charge?.amount_refunded || 0 }).where(eq(eventCloseoutLinks.id, link.id));
      const customer = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
      const netVenue = Math.max(0, link.baseAmountMinor - (charge?.amount_refunded || 0));
      const values = { eventId: event.id, userId: link.userId, paymentIntentId: intent.id, stripeCustomerId: customer || null,
        stripeChargeId: chargeId || null, status: "captured" as const, paymentIntentStatus: "succeeded" as const,
        agreedAmountMinor: link.totalAmountMinor, capturedAmountMinor: link.totalAmountMinor,
        refundedAmountMinor: charge?.amount_refunded || 0, settledBaseAmountMinor: link.baseAmountMinor,
        platformFeeMinor: link.totalAmountMinor - link.baseAmountMinor, organiserAmountMinor: netVenue,
        currency: "gbp", finalAmount: ((link.totalAmountMinor - (charge?.amount_refunded || 0)) / 100).toFixed(2),
        capturedAt: new Date((charge?.created || session.created || 0) * 1000), updatedAt: new Date() };
      await tx.insert(eventPayments).values(values).onConflictDoUpdate({ target: [eventPayments.eventId, eventPayments.userId], set: values });
      // A deterministic receipt ID makes simultaneous organiser/player refreshes
      // idempotent without treating a final Checkout payment as another charge.
      await tx.insert(payments).values({ id: link.id, userId: link.userId, eventId: event.id,
        amount: (link.totalAmountMinor / 100).toFixed(2), type: "event_fee", status: "captured",
        stripePaymentIntentId: intent.id }).onConflictDoNothing();
    } else if (session.status === "expired") {
      await tx.update(eventCloseoutLinks).set({ status: "expired" }).where(eq(eventCloseoutLinks.id, link.id));
    }
  }
}
export async function ensureCloseout(event: CloseEvent) {
  if (!usesClosePayout(event)) throw new PaymentPolicyError(409, "This event retains its existing payment flow");
  const [row] = await db.select().from(eventCloseouts).where(eq(eventCloseouts.eventId, event.id));
  if (row) return row;
  const attendance = await db.select().from(eventAttendance).where(and(eq(eventAttendance.eventId, event.id),
    inArray(eventAttendance.status, ["attending", "promoted"])));
  const players: FinalPlayer[] = attendance.map(a => ({ userId: a.userId, method: "online", cashAmountMinor: 0 }));
  await db.insert(eventCloseouts).values({ eventId: event.id, players,
    venueCostMinor: decimalToMinorUnits(event.finalVenueCost || event.cost || "0") }).onConflictDoNothing();
  return (await db.select().from(eventCloseouts).where(eq(eventCloseouts.eventId, event.id)))[0];
}
export async function closeoutSources(event: CloseEvent, tx: CloseExecutor = db) {
  const rows = await tx.select().from(eventPayments).where(eq(eventPayments.eventId, event.id));
  const links = await tx.select().from(eventCloseoutLinks).where(eq(eventCloseoutLinks.eventId, event.id));
  const finalIntentIds = new Set(links.filter(l => l.paymentIntentId).map(l => l.paymentIntentId));
  const sources: VenueSource[] = rows.filter(r => r.status === "captured" && !!r.paymentIntentId && !finalIntentIds.has(r.paymentIntentId)).map(r => ({
    key: `payment:${r.id}`, userId: r.userId, intentId: r.paymentIntentId!, chargeId: r.stripeChargeId,
    baseMinor: originalBase(event), refundedMinor: r.refundedAmountMinor || 0,
  }));
  for (const link of links.filter(l => l.status === "paid" && !!l.paymentIntentId)) sources.push({
    key: `link:${link.id}`, userId: link.userId, intentId: link.paymentIntentId!, chargeId: link.chargeId,
    baseMinor: link.baseAmountMinor, refundedMinor: link.refundedAmountMinor,
  });
  return { sources, rows, links };
}
export async function getCloseoutState(event: CloseEvent, tx: CloseExecutor = db) {
  const [row] = await tx.select().from(eventCloseouts).where(eq(eventCloseouts.eventId, event.id));
  if (!row) throw new PaymentPolicyError(409, "Open the event payment management screen first");
  const organiserId = event.venueOrganiserId || event.createdById;
  const { sources, rows, links } = await closeoutSources(event, tx);
  const refunds = await tx.select().from(eventCloseoutRefunds).where(eq(eventCloseoutRefunds.eventId, event.id));
  const refundPending = refunds.some(r => r.status !== "succeeded");
  const amounts = closeoutAmounts(row.venueCostMinor, row.players, organiserId, 0);
  const paidByUser = new Map<string, number>();
  for (const source of sources) paidByUser.set(source.userId,
    (paidByUser.get(source.userId) || 0) + Math.max(0, source.baseMinor - source.refundedMinor));
  const onlineCollectedMinor = row.players.reduce((sum, player) =>
    sum + (player.userId !== organiserId && player.method === "online"
      ? Math.min(amounts.shares.get(player.userId) || 0, paidByUser.get(player.userId) || 0) : 0), 0);
  const quote = closeoutAmounts(row.venueCostMinor, row.players, organiserId, onlineCollectedMinor);
  const associatedTeams = await tx.select({ teamId: eventTeams.teamId }).from(eventTeams).where(eq(eventTeams.eventId, event.id));
  const teamIds = [...new Set([event.primaryTeamId, ...associatedTeams.map(t => t.teamId)])];
  const memberIds = await tx.select({ userId: teamMemberships.userId }).from(teamMemberships).where(inArray(teamMemberships.teamId, teamIds));
  const attendance = await tx.select({ userId: eventAttendance.userId }).from(eventAttendance).where(eq(eventAttendance.eventId, event.id));
  const ids = [...new Set([...memberIds, ...attendance, ...rows, ...row.players].map(r => r.userId).concat(organiserId))];
  const people = ids.length ? await tx.select().from(users).where(inArray(users.id, ids)) : [];
  const person = (id: string) => people.find(u => u.id === id);
  const name = (id: string) => { const u = person(id); return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.email || "Player"; };
  const players = row.players.map(player => {
    const shareMinor = quote.shares.get(player.userId) || 0;
    const onlinePaidMinor = paidByUser.get(player.userId) || 0;
    const link = [...links].reverse().find(l => l.userId === player.userId && ["open", "creating"].includes(l.status));
    return { ...player, name: name(player.userId), email: person(player.userId)?.email || "",
      shareMinor, onlinePaidMinor, refundPending: refunds.some(r => r.status !== "succeeded" && sources.some(s => s.userId === player.userId && s.key === r.sourceKey)),
      linkUrl: link?.checkoutUrl || undefined,
      canPayLink: row.status === "ready" && !refundPending && player.userId !== organiserId && player.method === "online" && shareMinor > 0 && onlinePaidMinor === 0 };
  });
  const revision = closeoutRevision({ row, sources, links: links.map(l => [l.id, l.status, l.refundedAmountMinor]), refunds });
  const { shares: _shares, ...quoteAmounts } = quote;
  return { supported: true, status: row.status, venueCostMinor: row.venueCostMinor, organiserId, players,
    canReconcile: eventEndAt(event) <= new Date(),
    candidates: people.map(u => ({ userId: u.id, name: name(u.id), email: u.email || "" })),
    ...quoteAmounts,
    organiserPlayed: row.players.some(p => p.userId === organiserId),
    onlineCollectedMinor, payoutMinor: row.payoutMinor ?? quote.payoutMinor, refundPending, revision,
    closedAt: row.closedAt?.toISOString(), payoutError: row.lastError || undefined };
}
export function priceForLatePlayer(event: CloseEvent, baseMinor: number) {
  if (!event.feeConfiguration) throw new PaymentPolicyError(409, "The event has no frozen payment fees");
  return calculatePlayerPrice(baseMinor, event.feeConfiguration);
}
