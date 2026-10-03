export const PLACEHOLDERS = ["eventName", "teamName", "startTime", "startDate", "location", "amount", "message"] as const;
export type TemplateContext = Record<(typeof PLACEHOLDERS)[number], string>;
export const SAMPLE_CONTEXT: TemplateContext = {
  eventName: "Monday Night Football", teamName: "LUDI Football", startTime: "19:00",
  startDate: "12 October 2026", location: "Local sports centre", amount: "£8.00",
  message: "Please review your event payment in LUDI.",
};

export const TRIGGER_CATALOG = [
  { id: "event_created", label: "New event", description: "When an event is created, for the recipients of the existing team notification.", scheduled: false, allowedAudiences: ["existing", "attendees"] },
  { id: "event_changed", label: "Event changed", description: "When event details change, excluding the person making the change.", scheduled: false, allowedAudiences: ["existing", "attendees"] },
  { id: "event_cancelled", label: "Event cancelled", description: "When an event is deleted or cancelled, for the notified team members.", scheduled: false, allowedAudiences: ["existing"] },
  { id: "flare_gun", label: "Flare sent", description: "Only eligible nearby players already selected by LUDI's flare rules.", scheduled: false, allowedAudiences: ["existing"] },
  { id: "event_reminder", label: "Before an event", description: "A scheduled reminder before event start. Cancelled events are excluded.", scheduled: true, allowedAudiences: ["attendees", "team_members"] },
  { id: "payment_reminder", label: "Before a payment deadline", description: "For attending players with an outstanding payment or authorisation; never collects money.", scheduled: true, allowedAudiences: ["existing"] },
  { id: "payment_required", label: "Payment required", description: "When LUDI creates a payment request for a player.", scheduled: false, allowedAudiences: ["existing"] },
  { id: "payment_authorization_required", label: "Authorisation required", description: "When a player needs to authorise an event payment.", scheduled: false, allowedAudiences: ["existing"] },
  { id: "payment_captured", label: "Payment collected", description: "When LUDI confirms a payment collection.", scheduled: false, allowedAudiences: ["existing"] },
  { id: "payment_failed", label: "Payment failed", description: "When a payment or authorisation needs attention.", scheduled: false, allowedAudiences: ["existing"] },
] as const;

const ALIASES: Record<string, string> = {
  new_event: "event_created", event_update: "event_changed", event_updated: "event_changed",
  event_payment_request: "payment_required", payment_request: "payment_required",
  payment_authorization: "payment_authorization_required", authorization_required: "payment_authorization_required",
  payment_success: "payment_captured", payment_collected: "payment_captured",
};
export function canonicalTrigger(type: string): string | undefined {
  const id = ALIASES[type] || type;
  return TRIGGER_CATALOG.some(t => t.id === id) ? id : undefined;
}
export function validateTemplateText(text: string) {
  const placeholders = [...text.matchAll(/\{([^{}]+)\}/g)].map(m => m[1]);
  const unknown = placeholders.filter(p => !(PLACEHOLDERS as readonly string[]).includes(p));
  if (unknown.length || /[{}]/.test(text.replace(/\{[^{}]+\}/g, ""))) {
    throw new Error(`Unsupported or malformed placeholder. Use: ${PLACEHOLDERS.map(p => `{${p}}`).join(", ")}`);
  }
}
export function renderTemplate(text: string, context: TemplateContext): string {
  validateTemplateText(text);
  // Single pass: values are never re-interpreted as template expressions.
  return text.replace(/\{([^{}]+)\}/g, (_, name: keyof TemplateContext) => context[name]);
}
export function pushPreferenceAllows(trigger: string, prefs: {
  pushNotificationsIOS?: boolean | null; newEvents?: boolean | null;
  eventChanges?: boolean | null; paymentReminders?: boolean | null; flareGunReminders?: boolean | null;
} | undefined): boolean {
  if (!prefs?.pushNotificationsIOS) return false;
  if (trigger === "flare_gun") return prefs.flareGunReminders === true;
  if (trigger.startsWith("payment")) return prefs.paymentReminders !== false;
  if (trigger === "event_changed" || trigger === "event_cancelled") return prefs.eventChanges !== false;
  if (trigger === "event_created" || trigger === "event_reminder") return prefs.newEvents !== false;
  return trigger === "test";
}