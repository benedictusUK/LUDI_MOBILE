import { test } from "node:test";
import assert from "node:assert/strict";
import { UpdatePushTriggerBody } from "@workspace/api-zod";
import { resolveTriggerSettings } from "./triggerSettings";

test("missing seed rows yield complete, disabled settings for every trigger", () => {
  const settings = resolveTriggerSettings([]);
  assert.ok(settings.length > 0);
  for (const trigger of settings) {
    assert.equal(trigger.enabled, false);
    assert.equal(trigger.templateId, null);
    assert.equal(trigger.updatedAt, null);
    assert.ok(trigger.allowedAudiences.includes(trigger.audience as never));
    assert.equal(trigger.reminderMinutes, 1440);
  }
});

test("an unsaved event reminder can submit an inclusive one-week offset", () => {
  const trigger = resolveTriggerSettings([]).find(t => t.id === "event_reminder")!;
  const input = UpdatePushTriggerBody.parse({
    ...trigger, enabled: true, templateId: "chosen-template", reminderMinutes: 10080,
  });
  assert.equal(input.audience, "attendees");
  assert.equal(input.reminderMinutes, 10080);
  assert.equal(input.enabled, true);
  assert.equal(UpdatePushTriggerBody.safeParse({ ...input, reminderMinutes: 10081 }).success, false);
  assert.equal(UpdatePushTriggerBody.safeParse({ ...input, reminderMinutes: 4 }).success, false);
  assert.equal(UpdatePushTriggerBody.safeParse({ ...input, reminderMinutes: 10080.5 }).success, false);
  assert.equal(UpdatePushTriggerBody.safeParse({ ...input, templateId: null }).success, false);
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
