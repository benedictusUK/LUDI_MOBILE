import { eq } from "drizzle-orm";
import { calculatePlayerPrice, eventPayments, paymentWindow } from "@workspace/db";
import { stripe } from "./stripeClient";
import { PaymentPolicyError, verifyEventIntent } from "./policyService";
import { originalBase, type CloseEvent, type CloseExecutor } from "./closeoutState";

/** Retire any still-payable original checkout before issuing final-price links. */
export async function freezeOriginalIntents(event: CloseEvent, tx: CloseExecutor) {
  const rows = await tx.select().from(eventPayments).where(eq(eventPayments.eventId, event.id));
  const price = calculatePlayerPrice(originalBase(event), event.feeConfiguration!);
  for (const row of rows) {
    if (!row.paymentIntentId) continue;
    const intent = await stripe.paymentIntents.retrieve(row.paymentIntentId);
    if (intent.metadata.ludiCloseoutLinkId) continue; // Final-share links have their own consent and ledger.
    if (!row.stripeCustomerId) throw new PaymentPolicyError(409, "An original payment has incomplete ownership details");
    verifyEventIntent(intent, event, row.userId, row.stripeCustomerId, "", price.totalAmountMinor);
    if (intent.status === "processing") throw new PaymentPolicyError(409, "A card payment is still processing. Wait before confirming the final players.");
    if (intent.status !== "succeeded" && intent.status !== "canceled") {
      await stripe.paymentIntents.cancel(intent.id, {}, { idempotencyKey: `close-cancel:${event.id}:${intent.id}` });
    }
    if (intent.status !== "succeeded") {
      await tx.update(eventPayments).set({ status: "cancelled", paymentIntentStatus: "canceled", updatedAt: new Date() }).where(eq(eventPayments.id, row.id));
      continue;
    }
    const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
    if (!chargeId) throw new PaymentPolicyError(409, "A captured payment has no verified charge");
    const charge = await stripe.charges.retrieve(chargeId);
    if (charge.created * 1000 > +paymentWindow(event).deadline && charge.amount_refunded < intent.amount_received) {
      throw new PaymentPolicyError(409, "A booking payment completed after its deadline. Wait for its automatic refund, then retry.");
    }
    await tx.update(eventPayments).set({
      stripeChargeId: chargeId, capturedAmountMinor: intent.amount_received, refundedAmountMinor: charge.amount_refunded,
      status: charge.amount_refunded >= intent.amount_received ? "refunded" : "captured", paymentIntentStatus: "succeeded",
      platformFeeMinor: price.platformFeeMinor + price.processingFeeMinor,
      capturedAt: new Date(charge.created * 1000 || Date.now()), updatedAt: new Date(),
    }).where(eq(eventPayments.id, row.id));
  }
}
