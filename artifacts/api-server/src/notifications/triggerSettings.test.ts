import { test } from "node:test";
import assert from "node:assert/strict";
import { UpdatePushTriggerBody } from "@workspace/api-zod";
import { resolveTriggerSettings, triggerType } from "./triggerSettings";
import { TRIGGER_CATALOG } from "./catalog";

test("configured list contains only saved notifications; types remain available separately", () => {
  assert.deepEqual(resolveTriggerSettings([]), []);
  assert.ok(TRIGGER_CATALOG.some(t => t.id === "event_reminder"));
});

test("an unsaved event reminder can submit an inclusive one-week offset", () => {
  const trigger = TRIGGER_CATALOG.find(t => t.id === "event_reminder")!;
  const input = UpdatePushTriggerBody.parse({
    enabled: true, audience: trigger.allowedAudiences[0],
    templateId: "chosen-template", reminderMinutes: 10080,
  });
  assert.equal(input.audience, "attendees");
  assert.equal(input.reminderMinutes, 10080);
  assert.equal(input.enabled, true);
  assert.equal(UpdatePushTriggerBody.safeParse({ ...input, reminderMinutes: 10081 }).success, false);
  assert.equal(UpdatePushTriggerBody.safeParse({ ...input, reminderMinutes: 4 }).success, false);
  assert.equal(UpdatePushTriggerBody.safeParse({ ...input, reminderMinutes: 10080.5 }).success, false);
  assert.equal(UpdatePushTriggerBody.safeParse({ ...input, templateId: null }).success, false);
});

test("multiple stored reminders retain independent identities and settings", () => {
  const common = { enabled: true, templateId: "template", audience: "attendees", updatedAt: new Date() };
  const stored = [
    { ...common, id: "event_reminder", reminderMinutes: 1440 },
    { ...common, id: "event_reminder:unique-rule", reminderMinutes: 60 },
  ];
  const result = resolveTriggerSettings(stored);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(t => t.id), stored.map(t => t.id));
  assert.deepEqual(result.map(t => t.type), ["event_reminder", "event_reminder"]);
  assert.deepEqual(result.map(t => t.reminderMinutes), [1440, 60]);
  assert.ok(result.every(t => t.scheduled));
  assert.equal(triggerType("payment_reminder:unique-rule"), "payment_reminder");
  assert.equal(triggerType("test"), "test");
});

test("stored choices are preserved instead of being reset to defaults", () => {
  const updatedAt = new Date("2026-10-05T12:00:00Z");
  const stored = {
    id: "event_reminder", enabled: true, templateId: "existing-template",
    audience: "team_members", reminderMinutes: 10080, updatedAt,
  };
  const trigger = resolveTriggerSettings([stored]).find(t => t.id === stored.id)!;
  assert.equal(trigger.enabled, true);
  assert.equal(trigger.templateId, stored.templateId);
  assert.equal(trigger.audience, stored.audience);
  assert.equal(trigger.reminderMinutes, 10080);
  assert.equal(trigger.updatedAt, updatedAt);
  assert.equal(trigger.scheduled, true);
});
