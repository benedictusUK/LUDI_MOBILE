import { z } from "zod/v4";

export const paymentPolicies = ["none", "fixed_immediate", "fixed_threshold", "flexible_post_event"] as const;
export const paymentTimestampSchema = z.preprocess(
  value => value === "" ? null : value,
  z.union([z.date(), z.iso.datetime({ offset: true })]).transform(value => new Date(value)).nullable().optional(),
);
export const paymentSettingsSchema = z.object({
  paymentPolicy: z.enum(paymentPolicies),
  currency: z.literal("gbp"),
  fixedPriceMinor: z.number().int().min(50).max(99_999_999).nullable().optional(),
  minimumPaidParticipants: z.number().int().positive().nullable().optional(),
  paymentDeadlineAt: paymentTimestampSchema,
  authorizationOpensAt: paymentTimestampSchema,
  completionDueAt: paymentTimestampSchema,
});

export function eventEndAt(event: Record<string, any>): Date {
  return new Date(`${event.endDate || event.startDate}T${event.endTime || "23:59:59"}Z`);
}

export function effectivePaymentPolicy(event: Record<string, any>) {
  if (!event.paymentRequired) return "none";
  return event.paymentPolicy && event.paymentPolicy !== "none" ? event.paymentPolicy : "flexible_post_event";
}

export function normalizeEventPaymentSettings(input: Record<string, any>, existing?: Record<string, any>) {
  const merged = { ...existing, ...input };
  const policy = input.paymentRequired === false ? "none"
    : input.paymentPolicy ?? (merged.paymentRequired ? effectivePaymentPolicy({ ...merged, paymentRequired: true }) : "none");
  if (policy === "none") return {
    ...input, paymentRequired: false, paymentPolicy: "none", currency: "gbp",
    fixedPriceMinor: null, minimumPaidParticipants: null, paymentDeadlineAt: null,
    authorizationOpensAt: null, completionDueAt: null, maxPlayerPayment: null,
  };
  const start = new Date(`${merged.startDate}T${merged.startTime || "00:00"}Z`);
  const end = eventEndAt(merged);
  const settings = paymentSettingsSchema.parse({
    paymentPolicy: policy, currency: merged.currency || "gbp",
    fixedPriceMinor: policy === "flexible_post_event" ? null : merged.fixedPriceMinor,
    minimumPaidParticipants: policy === "fixed_threshold" ? merged.minimumPaidParticipants : null,
    paymentDeadlineAt: merged.paymentDeadlineAt ?? (policy === "fixed_threshold" ? undefined : policy === "flexible_post_event" ? end : start),
    authorizationOpensAt: merged.authorizationOpensAt ?? (policy === "flexible_post_event" ? new Date(+start - 48 * 3600_000) : null),
    completionDueAt: policy === "flexible_post_event" ? merged.completionDueAt ?? new Date(+end + 24 * 3600_000) : null,
  });
  const fail = (path: string, message: string): never => {
    throw new z.ZodError([{ code: "custom", path: [path], message, input: merged[path] }]);
  };
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || end < start) fail("endDate", "Event end must be on or after its start");
  if (policy !== "flexible_post_event" && !settings.fixedPriceMinor) fail("fixedPriceMinor", "A fixed price of at least £0.50 is required");
  if (policy === "fixed_threshold") {
    if (!settings.minimumPaidParticipants) fail("minimumPaidParticipants", "A minimum number of paid participants is required");
    if (merged.maxParticipants && settings.minimumPaidParticipants! > Number(merged.maxParticipants)) fail("minimumPaidParticipants", "The payment threshold cannot exceed event capacity");
    if (!settings.paymentDeadlineAt) fail("paymentDeadlineAt", "A payment deadline is required for threshold events");
  }
  if (settings.paymentDeadlineAt && settings.paymentDeadlineAt > (policy === "flexible_post_event" ? end : start)) fail("paymentDeadlineAt", "The registration deadline must not be after the event's payment cutoff");
  if (settings.authorizationOpensAt && settings.paymentDeadlineAt && settings.authorizationOpensAt >= settings.paymentDeadlineAt) fail("authorizationOpensAt", "The opening time must be before the payment deadline");
  if (policy === "flexible_post_event") {
    const amount = String(merged.maxPlayerPayment ?? "");
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount) || Number(amount) < 0.5 || Number(amount) > 999_999.99) fail("maxPlayerPayment", "An authorization cap between £0.50 and £999,999.99 is required");
    if (!settings.completionDueAt || settings.completionDueAt <= end) fail("completionDueAt", "The settlement deadline must be after the event ends");
    if (!merged.feeConfiguration && (!settings.authorizationOpensAt || +settings.completionDueAt! - +settings.authorizationOpensAt > 5 * 86400_000)) fail("completionDueAt", "The authorization-to-settlement window must not exceed five days");
  }
  return {
    ...input, ...settings, paymentRequired: true,
    maxPlayerPayment: policy === "flexible_post_event" ? String(merged.maxPlayerPayment) : (settings.fixedPriceMinor! / 100).toFixed(2),
  };
}

export function paymentWindow(event: Record<string, any>, now = new Date()) {
  const policy = effectivePaymentPolicy(event);
  const start = new Date(`${event.startDate}T${event.startTime || "00:00"}Z`);
  const open = event.authorizationOpensAt ? new Date(event.authorizationOpensAt)
    : policy === "flexible_post_event" ? new Date(+start - 48 * 3600_000) : null;
  const deadline = event.paymentDeadlineAt ? new Date(event.paymentDeadlineAt)
    : policy === "flexible_post_event" ? eventEndAt(event) : start;
  const completion = event.completionDueAt ? new Date(event.completionDueAt) : new Date(+eventEndAt(event) + 24 * 3600_000);
  const reason = policy === "none" ? "This event is free."
    : open && now < open ? `Payments open on ${open.toISOString()}.`
    : now >= deadline ? "The payment deadline has passed." : null;
  return { policy, open, deadline, completion, canPay: !reason, reason };
}

// Recurring instances retain their policy while moving absolute deadlines by
// the same calendar-day offset as the event, rather than copying stale dates.
export function recurringPaymentSettings(template: Record<string, any>, startDate: string) {
  const offset = +new Date(`${startDate}T00:00:00Z`) - +new Date(`${template.startDate}T00:00:00Z`);
  const shift = (value: any) => value ? new Date(+new Date(value) + offset) : null;
  return {
    feeConfiguration: template.feeConfiguration ?? null,
    paymentPolicy: effectivePaymentPolicy(template), currency: template.currency || "gbp",
    fixedPriceMinor: template.fixedPriceMinor ?? null,
    minimumPaidParticipants: template.minimumPaidParticipants ?? null,
    paymentDeadlineAt: shift(template.paymentDeadlineAt),
    authorizationOpensAt: shift(template.authorizationOpensAt),
    completionDueAt: shift(template.completionDueAt),
  };
}