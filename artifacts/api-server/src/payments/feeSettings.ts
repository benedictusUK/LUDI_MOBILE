import { desc, eq } from "drizzle-orm";
import { platformFeeSettings, platformFeeAudit, type FeeConfiguration } from "@workspace/db";
import { db } from "../db";
import { platformFeeBasisPoints } from "./stripeClient";

export async function getFeeSettings(): Promise<FeeConfiguration> {
  const [saved] = await db.select().from(platformFeeSettings).where(eq(platformFeeSettings.id, "default"));
  // An empty table explicitly uses the previous documented defaults. DB errors
  // propagate; they must never silently substitute another payment price.
  return saved ? { platformBasisPoints: saved.platformBasisPoints, stripeBasisPoints: saved.stripeBasisPoints,
    stripeFixedMinor: saved.stripeFixedMinor, revision: saved.revision }
    : { platformBasisPoints: platformFeeBasisPoints, stripeBasisPoints: 290, stripeFixedMinor: 30, revision: 0 };
}
export async function getFeeAdminState() {
  const [settings, audit] = await Promise.all([getFeeSettings(), db.select().from(platformFeeAudit).orderBy(desc(platformFeeAudit.createdAt)).limit(20)]);
  return { settings, audit, appliesTo: "new_events", processingChargeNotice: "The configured processing charge is part of the participant price. Stripe sets its actual fees independently." };
}
export async function getPublicPlatformCharges() {
  const settings = await getFeeSettings();
  const now = new Date();
  const common = { isActive: true, createdAt: now, updatedAt: now };
  return [
    { ...common, id: "platform", name: "LUDI Platform Fee", description: "Platform charge", type: "percentage", value: (settings.platformBasisPoints / 10000).toFixed(4) },
    { ...common, id: "processing-percentage", name: "stripe_processing_percentage", description: "Processing charge", type: "percentage", value: (settings.stripeBasisPoints / 10000).toFixed(4) },
    { ...common, id: "processing-fixed", name: "stripe_processing_fixed", description: "Fixed processing charge", type: "fixed", value: (settings.stripeFixedMinor / 100).toFixed(2) },
  ];
}