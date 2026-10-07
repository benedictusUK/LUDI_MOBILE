import type { pushTriggers } from "@workspace/db";
import { TRIGGER_CATALOG } from "./catalog";
import { canonicalAudience } from "./audiences";

type StoredTrigger = typeof pushTriggers.$inferSelect;

// Legacy rows use the type as their ID. New configurations use type:UUID so
// multiple rules can coexist without changing the live database schema.
export function triggerType(id: string) {
  return id.split(":")[0];
}

export function describeTrigger(trigger: StoredTrigger) {
  const definition = TRIGGER_CATALOG.find(t => t.id === triggerType(trigger.id));
  if (!definition) throw new Error("Unsupported stored notification type");
  return { ...definition, ...trigger, type: definition.id, audience: canonicalAudience(definition.id, trigger.audience) };
}

export function resolveTriggerSettings(stored: StoredTrigger[]) {
  return stored.map(describeTrigger);
}
