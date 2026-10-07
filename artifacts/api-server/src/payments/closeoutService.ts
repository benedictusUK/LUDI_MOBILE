import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { eventCloseouts, eventCloseoutLinks, eventCloseoutRefunds, eventPayments, paymentRefunds, events, users, eventEndAt,
  paymentWindow, type FinalPlayer, type CloseTransfer } from "@workspace/db";
import { db } from "../db";
import { stripe } from "./stripeClient";
import { PaymentPolicyError, reconcileThresholdEvent } from "./policyService";
import { closeoutAmounts } from "./closeoutMath";
import { freezeOriginalIntents } from "./closeoutIntents";
import { closeoutSources, getCloseoutState, priceForLatePlayer, syncLinks, type CloseEvent } from "./closeoutState";

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Payment operation needs retrying";
export async function saveCloseout(event: CloseEvent, venueCostMinor: number, players: FinalPlayer[]) {
  return db.transaction(async tx => {
    await tx.select().from(events).where(eq(events.id, event.id)).for("update");
    const [row] = await tx.select().from(eventCloseouts).where(eq(eventCloseouts.eventId, event.id)).for("update");
    if (!row || ["closing", "closed"].includes(row.status)) throw new PaymentPolicyError(409, "The event is closing or already closed");
    if (new Set(players.map(p => p.userId)).size !== players.length) throw new PaymentPolicyError(400, "A final player can only appear once");
    const state = await getCloseoutState(event, tx);
    const candidates = new Set(state.candidates.map(p => p.userId));
    if (players.some(p => !candidates.has(p.userId))) throw new PaymentPolicyError(403, "Select a player associated with this event or team");
    players = players.map(p => {
      const previous = row.players.find(old => old.userId === p.userId);
      if (p.userId === state.organiserId) return { ...p, method: "online", cashAmountMinor: 0 };
      return { ...p, cashReceivedAt: p.method === "cash" && p.cashAmountMinor > 0
        ? previous?.method === "cash" && previous.cashAmountMinor === p.cashAmountMinor ? previous.cashReceivedAt : new Date().toISOString()
        : undefined };
    });
    try { closeoutAmounts(venueCostMinor, players, state.organiserId, 0); }
    catch (error) { throw new PaymentPolicyError(400, errorMessage(error)); }
    if (row.status !== "draft") {
      if (venueCostMinor !== row.venueCostMinor || players.length !== row.players.length ||
        players.some(p => !row.players.some(old => old.userId === p.userId))) throw new PaymentPolicyError(409, "The final cost and player list are frozen; only cash receipts can now be amended");
      if (players.some(p => row.players.find(old => old.userId === p.userId)?.method === "cash" && p.method !== "cash")) {
        throw new PaymentPolicyError(409, "A refunded cash player cannot be switched back to an online payer");
      }
    }
    for (const player of players.filter(p => p.method === "cash")) {
      // Retire an unpaid invoice before accepting cash; already-paid invoices
      // are picked up by reconciliation and receive a venue-only refund.
      await syncLinks(event, tx, true, player.userId);
    }
    await tx.update(eventCloseouts).set({ venueCostMinor, players, status: row.status === "draft" ? "draft" : "reconciling",
      updatedAt: new Date(), lastError: null }).where(eq(eventCloseouts.eventId, event.id));
    return getCloseoutState(event, tx);
  });
}

async function planVenueRefunds(event: CloseEvent) {
  if (eventEndAt(event) > new Date()) throw new PaymentPolicyError(409, "Finalise the players after the event ends. You can save cash receipts beforehand.");
  await db.transaction(async tx => {
    await tx.select().from(events).where(eq(events.id, event.id)).for("update");
    const [row] = await tx.select().from(eventCloseouts).where(eq(eventCloseouts.eventId, event.id)).for("update");
    if (!row || ["closing", "closed"].includes(row.status)) throw new PaymentPolicyError(409, "The event is closing or closed");
    if (!row.players.length && row.venueCostMinor > 0) throw new PaymentPolicyError(400, "Add final players before confirming the venue cost");
    const priorRefunds = await tx.select({ status: paymentRefunds.status, reason: paymentRefunds.reason }).from(paymentRefunds)
      .innerJoin(eventPayments, eq(eventPayments.id, paymentRefunds.eventPaymentId)).where(eq(eventPayments.eventId, event.id));
    if (priorRefunds.some(r => !["venue_only", "flexible_residual"].includes(r.reason || "") && r.status !== "succeeded")) throw new PaymentPolicyError(409, "An earlier booking refund still needs to finish. Wait for it before finalising the players.");
    await syncLinks(event, tx);
    await freezeOriginalIntents(event, tx);
    const organiserId = event.venueOrganiserId || event.createdById;
    const amounts = closeoutAmounts(row.venueCostMinor, row.players, organiserId, 0);
    const { sources } = await closeoutSources(event, tx);
    // Venue overruns must not increase an agreed charge or block a short
    // payout. Allocation below retains only the principal actually collected.
    const allocated = new Map<string, number>();
    for (const source of [...sources].sort((a, b) => a.key.localeCompare(b.key))) {
      const intent = await stripe.paymentIntents.retrieve(source.intentId);
      const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
      if (intent.status !== "succeeded" || intent.metadata.ludiEventId !== event.id ||
        intent.metadata.ludiParticipantId !== source.userId || intent.metadata.ludiPayoutFlow !== "on_close" ||
        intent.transfer_data || !chargeId) throw new PaymentPolicyError(409, "A payment does not belong to this event's Close-controlled flow");
      const charge = await stripe.charges.retrieve(chargeId);
      if (charge.disputed) throw new PaymentPolicyError(409, "Resolve the disputed payment before closing this event");
      const player = row.players.find(p => p.userId === source.userId);
      const desired = player?.method === "online" && source.userId !== organiserId ? amounts.shares.get(source.userId) || 0 : 0;
      const remaining = Math.max(0, source.baseMinor - charge.amount_refunded);
      const retained = Math.min(remaining, Math.max(0, desired - (allocated.get(source.userId) || 0)));
      allocated.set(source.userId, (allocated.get(source.userId) || 0) + retained);
      const targetRefundMinor = Math.max(0, source.baseMinor - retained);
      const amountMinor = targetRefundMinor - charge.amount_refunded;
      if (source.key.startsWith("payment:")) await tx.update(eventPayments).set({
        refundedAmountMinor: charge.amount_refunded, stripeChargeId: charge.id,
        settledBaseAmountMinor: retained, organiserAmountMinor: retained,
        finalAmount: ((retained + priceForLatePlayer(event, source.baseMinor).totalAmountMinor - source.baseMinor) / 100).toFixed(2),
        refundAmount: (targetRefundMinor / 100).toFixed(2), updatedAt: new Date(),
      }).where(eq(eventPayments.id, source.key.slice(8)));
      if (amountMinor > 0) await tx.insert(eventCloseoutRefunds).values({
        id: `close-refund:${event.id}:${source.key}:${targetRefundMinor}`, eventId: event.id,
        sourceKey: source.key, paymentIntentId: source.intentId, amountMinor, targetRefundMinor, status: "pending",
      }).onConflictDoNothing();
    }
    await tx.update(eventCloseouts).set({ status: "reconciling", updatedAt: new Date(), lastError: null }).where(eq(eventCloseouts.eventId, event.id));
    await tx.update(events).set({ finalVenueCost: (row.venueCostMinor / 100).toFixed(2), paymentCollectionInitiated: true,
      paymentCollectionInitiatedAt: new Date(), updatedAt: new Date() }).where(eq(events.id, event.id));
  });
}

async function executeVenueRefunds(event: CloseEvent) {
  const rows = await db.select().from(eventCloseoutRefunds).where(eq(eventCloseoutRefunds.eventId, event.id));
  for (const row of rows.filter(r => r.status !== "succeeded")) {
    try {
      let refund = row.stripeRefundId ? await stripe.refunds.retrieve(row.stripeRefundId)
        : (await stripe.refunds.list({ payment_intent: row.paymentIntentId, limit: 100 })).data.find(r => r.metadata?.ludiCloseoutKey === row.id);
      if (!refund || ["failed", "canceled"].includes(refund.status || "")) {
        refund = await stripe.refunds.create({ payment_intent: row.paymentIntentId, amount: row.amountMinor,
          metadata: { ludiEventId: event.id, ludiCloseoutKey: row.id, ludiRefundReason: "venue_only" } },
        { idempotencyKey: refund ? `${row.id}:retry:${refund.id}` : row.id });
      }
      if (refund.amount !== row.amountMinor || refund.payment_intent !== row.paymentIntentId) throw new Error("Refund does not match the venue-only refund plan");
      await db.update(eventCloseoutRefunds).set({ stripeRefundId: refund.id, status: refund.status || "pending", error: null }).where(eq(eventCloseoutRefunds.id, row.id));
      if (refund.status === "succeeded") {
        const intent = await stripe.paymentIntents.retrieve(row.paymentIntentId);
        const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
        const charge = chargeId ? await stripe.charges.retrieve(chargeId) : null;
        if (!charge) throw new Error("Refunded payment has no charge");
        if (row.sourceKey.startsWith("payment:")) await db.update(eventPayments).set({
          refundedAmountMinor: charge.amount_refunded, organiserAmountMinor: Math.max(0, row.targetRefundMinor === 0 ? 0 : (await closeoutSources(event)).sources.find(s => s.key === row.sourceKey)!.baseMinor - charge.amount_refunded),
          updatedAt: new Date(),
        }).where(eq(eventPayments.id, row.sourceKey.slice(8)));
        else await db.update(eventCloseoutLinks).set({ refundedAmountMinor: charge.amount_refunded, refundPending: false }).where(eq(eventCloseoutLinks.id, row.sourceKey.slice(5)));
      }
    } catch (error) {
      await db.update(eventCloseoutRefunds).set({ status: "failed", error: errorMessage(error) }).where(eq(eventCloseoutRefunds.id, row.id));
    }
  }
}
export async function reconcileCloseout(event: CloseEvent) {
  const [existing] = await db.select().from(eventCloseouts).where(eq(eventCloseouts.eventId, event.id));
  const window = paymentWindow(event);
  if (existing?.status === "draft" && window.policy === "fixed_threshold") {
    if (!window.deadline || window.deadline > new Date()) throw new PaymentPolicyError(409, "Wait until the booking payment deadline before confirming the final players.");
    // Honour the original booking refund guarantee before venue-only settlement.
    await reconcileThresholdEvent(event);
  }
  await planVenueRefunds(event);
  await executeVenueRefunds(event);
  const pending = await db.select().from(eventCloseoutRefunds).where(eq(eventCloseoutRefunds.eventId, event.id));
  await db.update(eventCloseouts).set({ status: pending.every(r => r.status === "succeeded") ? "ready" : "reconciling",
    lastError: pending.find(r => r.error)?.error || null, updatedAt: new Date() }).where(eq(eventCloseouts.eventId, event.id));
  return getCloseoutState(event);
}

export async function createCloseoutLink(event: CloseEvent, userId: string) {
  const link = await db.transaction(async tx => {
    await tx.select().from(events).where(eq(events.id, event.id)).for("update");
    await syncLinks(event, tx);
    const state = await getCloseoutState(event, tx);
    const player = state.players.find(p => p.userId === userId);
    if (!player?.canPayLink) throw new PaymentPolicyError(409, "This final player is already paid, paid cash, or cannot receive a payment link");
    const all = await tx.select().from(eventCloseoutLinks).where(and(eq(eventCloseoutLinks.eventId, event.id), eq(eventCloseoutLinks.userId, userId)));
    const active = all.find(l => ["creating", "open"].includes(l.status));
    if (active) return active;
    const price = priceForLatePlayer(event, player.shareMinor);
    const [created] = await tx.insert(eventCloseoutLinks).values({ id: randomUUID(), eventId: event.id, userId,
      baseAmountMinor: price.baseAmountMinor, totalAmountMinor: price.totalAmountMinor, status: "creating" }).returning();
    return created;
  });
  if (link.checkoutUrl && link.status === "open") return { url: link.checkoutUrl, state: await getCloseoutState(event) };
  const origin = process.env.LUDI_PUBLIC_URL;
  if (!origin || !/^https:\/\//.test(origin)) throw new PaymentPolicyError(503, "The public LUDI URL must be configured before generating payment links");
  const [player] = await db.select().from(users).where(eq(users.id, userId));
  const product = await stripe.products.create({ name: "LUDI final venue contribution",
    metadata: { ludiEventId: event.id, ludiCloseoutLinkId: link.id } }, { idempotencyKey: `close-product:${link.id}` });
  const price = await stripe.prices.create({ product: product.id, unit_amount: link.totalAmountMinor, currency: "gbp" }, { idempotencyKey: `close-price:${link.id}` });
  const metadata = { ludiEventId: event.id, ludiParticipantId: userId, ludiCloseoutLinkId: link.id, ludiPayoutFlow: "on_close" };
  const session = await stripe.checkout.sessions.create({
    mode: "payment", payment_method_types: ["card"], adaptive_pricing: { enabled: false }, line_items: [{ price: price.id, quantity: 1 }],
    ...(player?.email ? { customer_email: player.email } : {}),
    success_url: `${origin}/events/${event.id}?finalPayment=success`, cancel_url: `${origin}/events/${event.id}?finalPayment=cancelled`,
    metadata, payment_intent_data: { metadata, transfer_group: `event:${event.id}` },
  }, { idempotencyKey: `close-checkout:${link.id}` });
  if (!session.url) throw new PaymentPolicyError(502, "Stripe did not return a one-time payment URL");
  const available = await db.transaction(async tx => {
    await tx.select().from(events).where(eq(events.id, event.id)).for("update");
    const current = await getCloseoutState(event, tx);
    const valid = current.status === "ready" && current.players.some(p => p.userId === userId && p.canPayLink);
    if (!valid) await stripe.checkout.sessions.expire(session.id);
    await tx.update(eventCloseoutLinks).set({ checkoutSessionId: session.id, checkoutUrl: session.url, status: valid ? "open" : "expired" }).where(eq(eventCloseoutLinks.id, link.id));
    return valid;
  });
  if (!available) throw new PaymentPolicyError(409, "The player's payment state changed. The unused checkout was cancelled.");
  return { url: session.url, state: await getCloseoutState(event) };
}

export async function closeEvent(event: CloseEvent, actorId: string, expectedPayoutMinor: number, revision: string) {
  await db.transaction(async tx => {
    await tx.select().from(events).where(eq(events.id, event.id)).for("update");
    const [row] = await tx.select().from(eventCloseouts).where(eq(eventCloseouts.eventId, event.id)).for("update");
    if (!row || !["ready", "closing", "closed"].includes(row.status)) throw new PaymentPolicyError(409, "Confirm the final cost and finish all refunds before closing");
    if (row.status === "closed") return;
    if (row.status === "closing") {
      if (expectedPayoutMinor !== row.payoutMinor) throw new PaymentPolicyError(409, "The frozen close payout does not match the confirmation");
      return;
    }
    const links = await tx.select().from(eventCloseoutLinks).where(eq(eventCloseoutLinks.eventId, event.id));
    if (links.some(l => l.status === "creating")) throw new PaymentPolicyError(409, "Finish generating or retrying the payment link before closing");
    await syncLinks(event, tx, true);
    const state = await getCloseoutState(event, tx);
    if (state.refundPending || state.payoutMinor !== expectedPayoutMinor || state.revision !== revision) throw new PaymentPolicyError(409, "Payment totals changed. Refresh and confirm the current payout before closing.");
    const [organiser] = await tx.select().from(users).where(eq(users.id, state.organiserId));
    if (!organiser) throw new PaymentPolicyError(404, "The organiser account could not be found");
    if (state.payoutMinor > 0 && (!organiser.stripeAccountId || !organiser.payoutsEnabled)) throw new PaymentPolicyError(409, "The organiser must complete Stripe Connect setup before closing");
    if (state.payoutMinor > 0) {
      const account = await stripe.accounts.retrieve(organiser.stripeAccountId!);
      if (!account.payouts_enabled || account.capabilities?.transfers !== "active") throw new PaymentPolicyError(409, "Stripe Connect is not ready to receive the payout. Complete its outstanding setup before closing.");
    }
    const { sources } = await closeoutSources(event, tx);
    let remaining = state.payoutMinor;
    const plan: CloseTransfer[] = [];
    const allocated = new Map<string, number>();
    for (const source of [...sources].sort((a, b) => a.key.localeCompare(b.key))) {
      const player = state.players.find(p => p.userId === source.userId);
      if (!remaining || !player || player.method !== "online" || source.userId === state.organiserId) continue;
      const intent = await stripe.paymentIntents.retrieve(source.intentId);
      const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
      if (intent.status !== "succeeded" || intent.transfer_data || intent.metadata.ludiPayoutFlow !== "on_close" || !chargeId) throw new PaymentPolicyError(409, "A source payment cannot fund this payout");
      const charge = await stripe.charges.retrieve(chargeId);
      if (charge.disputed) throw new PaymentPolicyError(409, "A disputed payment cannot fund this payout");
      const available = Math.max(0, source.baseMinor - charge.amount_refunded);
      const amountMinor = Math.min(remaining, available, Math.max(0, player.shareMinor - (allocated.get(source.userId) || 0)));
      if (amountMinor) plan.push({ sourceKey: source.key, chargeId, amountMinor });
      allocated.set(source.userId, (allocated.get(source.userId) || 0) + amountMinor);
      remaining -= amountMinor;
    }
    if (remaining) throw new PaymentPolicyError(409, "The collected venue funds changed. Refresh the payout quote before closing.");
    await tx.update(eventCloseouts).set({ status: "closing", transferPlan: plan, payoutMinor: state.payoutMinor,
      destinationAccountId: organiser.stripeAccountId || null, acknowledgedBy: actorId, acknowledgedAt: new Date(),
      updatedAt: new Date(), lastError: null }).where(eq(eventCloseouts.eventId, event.id));
  });
  // Each source charge has a durable, deterministic Stripe transfer key. A
  // network loss after a transfer must never pay the organiser twice.
  try {
    const [row] = await db.select().from(eventCloseouts).where(eq(eventCloseouts.eventId, event.id));
    if (row.status === "closed") return getCloseoutState(event);
    for (const item of row.transferPlan) {
      if (item.transferId) continue;
      const transfer = await stripe.transfers.create({ amount: item.amountMinor, currency: "gbp",
        destination: row.destinationAccountId!, source_transaction: item.chargeId,
        transfer_group: `event:${event.id}`, metadata: { ludiEventId: event.id, ludiCloseoutSource: item.sourceKey } },
      { idempotencyKey: `event-close:${event.id}:${item.sourceKey}` });
      await db.transaction(async tx => {
        const [current] = await tx.select().from(eventCloseouts).where(eq(eventCloseouts.eventId, event.id)).for("update");
        await tx.update(eventCloseouts).set({
          transferPlan: current.transferPlan.map(p => p.sourceKey === item.sourceKey ? { ...p, transferId: transfer.id } : p),
          updatedAt: new Date(),
        }).where(eq(eventCloseouts.eventId, event.id));
      });
    }
    await db.update(eventCloseouts).set({ status: "closed", closedAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(eventCloseouts.eventId, event.id));
  } catch (error) {
    await db.update(eventCloseouts).set({ lastError: errorMessage(error), updatedAt: new Date() }).where(eq(eventCloseouts.eventId, event.id));
  }
  return getCloseoutState(event);
}
