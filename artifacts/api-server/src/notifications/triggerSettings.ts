import type { pushTriggers } from "@workspace/db";
import { TRIGGER_CATALOG } from "./catalog";

type StoredTrigger = typeof pushTriggers.$inferSelect;

// Production schema provisioning does not necessarily copy migration seed data.
// Unsaved triggers must still be usable, without implicitly enabling delivery.
export function resolveTriggerSettings(stored: StoredTrigger[]) {
  return TRIGGER_CATALOG.map(definition => ({
    enabled: false,
    templateId: null,
    audience: definition.allowedAudiences[0],
    reminderMinutes: 1440,
    updatedAt: null,
    ...stored.find(trigger => trigger.id === definition.id),
    ...definition,
  }));
}
