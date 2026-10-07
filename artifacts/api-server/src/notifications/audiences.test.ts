import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalAudience, audienceVoteStatuses, voteMatchesAudience } from "./audiences";
import { TRIGGER_CATALOG, pushPreferenceAllows } from "./catalog";
import { describeTrigger } from "./triggerSettings";

test("Event attendees means Yes votes, including reserve placements and promotions", () => {
  for (const status of ["attending", "reserve", "promoted"]) assert.equal(voteMatchesAudience("attendees", status), true);
  for (const status of ["maybe", "not_attending", "pending", null]) assert.equal(voteMatchesAudience("attendees", status), false);
});
test("Maybe voters does not include non-voters or Yes/No voters", () => {
  assert.deepEqual(audienceVoteStatuses("maybe_voters"), ["maybe"]);
  assert.equal(voteMatchesAudience("maybe_voters", "maybe"), true);
  for (const status of ["attending", "reserve", "promoted", "not_attending", "pending", null]) {
    assert.equal(voteMatchesAudience("maybe_voters", status), false);
  }
});
test("all team members is independent of voting status", () => {
  assert.equal(audienceVoteStatuses("team_members"), undefined);
});
test("legacy options are described explicitly without rewriting saved rules", () => {
  for (const [type, expected] of [["event_created", "team_members"], ["event_changed", "team_members"],
    ["event_cancelled", "team_members"], ["flare_gun", "flare_recipients"], ["payment_reminder", "payment_recipient"]]) {
    assert.equal(canonicalAudience(type, "existing"), expected);
    const row = { id: `${type}:saved`, audience: "existing", enabled: true, templateId: "template", reminderMinutes: 60, updatedAt: new Date() };
    assert.equal(describeTrigger(row).audience, expected);
    assert.equal(row.audience, "existing");
  }
});
test("event types offer all three groups and flare defaults exclusively to opted-in recipients", () => {
  for (const type of ["event_created", "event_changed", "event_cancelled", "event_reminder"]) {
    const rule = TRIGGER_CATALOG.find(t => t.id === type)!;
    assert.deepEqual(new Set(rule.allowedAudiences), new Set(["attendees", "maybe_voters", "team_members"]));
  }
  assert.deepEqual(TRIGGER_CATALOG.find(t => t.id === "flare_gun")!.allowedAudiences, ["flare_recipients"]);
  assert.equal(pushPreferenceAllows("flare_gun", { pushNotificationsIOS: true, flareGunReminders: false }), false);
  assert.equal(pushPreferenceAllows("flare_gun", { pushNotificationsIOS: true, flareGunReminders: true }), true);
  for (const rule of TRIGGER_CATALOG.filter(t => t.id.startsWith("payment"))) {
    assert.deepEqual(rule.allowedAudiences, ["payment_recipient"], "Payment messages must not become team broadcasts");
  }
});
