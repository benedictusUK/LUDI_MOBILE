import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { and, eq, inArray } from "drizzle-orm";
import { events, insertEventSchema, notifications, teamInvitations, teamMemberships, teams, users } from "@workspace/db";
import { db, pool } from "../db";
import { storage } from "../storage";
import { registerTeamManagement } from "../routes/teamManagement";
import { TeamManagementStore } from "./management";

test("real PostgreSQL team lifecycle, HTTP contracts and concurrent admissions", { timeout: 180000 }, async t => {
  const prefix = `team-regression-${randomUUID()}`;
  const ids = ["owner", "member", "outsider", "second"].map(role => `${prefix}-${role}`);
  const [owner, member, outsider, second] = ids;
  const teamIds: string[] = [];
  const store = new TeamManagementStore(db, async notice => { await db.insert(notifications).values(notice); });
  const app = express();
  app.use(express.json());
  registerTeamManagement(app, (req: any, res, next) => {
    const actor = req.header("x-regression-user");
    if (!ids.includes(actor)) { res.status(401).json({ message: "Unauthorized" }); return; }
    req.userId = actor; next();
  }, store);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = async (actor: string, path: string, method = "GET", body?: object) => {
    const response = await fetch(base + path, { method, headers: { "x-regression-user": actor, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() as any };
  };
  const makeTeam = async (tag: string, extras = {}) => {
    const team = await storage.createTeam({ name: `${prefix}-${tag}`, sports: ["football"], gender: "mixed", requiresApproval: true, ...extras }, owner);
    teamIds.push(team.id);
    const own = await db.select().from(teamMemberships).where(and(eq(teamMemberships.teamId, team.id), eq(teamMemberships.userId, owner)));
    assert.equal(own.length, 1); assert.equal(own[0].role, "admin");
    return team.id;
  };
  try {
    await db.insert(users).values(ids.map((id, index) => ({
      id, username: `teamtest-${prefix.slice(-8)}-${index}`, email: `${prefix}-${index}@example.test`,
      phoneNumber: "fixture-private", postcode: "PRIVATE", stripeCustomerId: "fixture-private-stripe-id",
    })));
    await t.test("invite aliases, duplicate prevention, direction, recipient ownership and safe profiles", async () => {
      const id = await makeTeam("invites");
      assert.equal((await request(outsider, `/api/teams/${id}/members`, "POST", { userId: outsider, role: "admin" })).status, 403);
      assert.equal((await request(outsider, `/api/teams/${id}/invites`, "POST", { userId: member })).status, 403);
      const sent = await request(owner, `/api/teams/${id}/invites`, "POST", { userId: member });
      assert.equal(sent.status, 200);
      const invitationId = sent.data.invitation.id;
      assert.equal((await request(owner, `/api/teams/${id}/invitations`, "POST", { userId: member })).status, 409);
      assert.equal((await request(outsider, `/api/invitations/${invitationId}/accept`, "POST")).status, 404);
      assert.equal((await request(member, "/api/users/invitations")).data.length, 1);
      assert.equal((await request(member, "/api/teams/my-pending-requests")).data.length, 0);
      const inbox = await request(member, "/api/notifications");
      const notification = inbox.data.find((n: any) => n.relatedId === invitationId);
      assert.equal(JSON.parse(notification.metadata).invitationId, invitationId);
      assert.equal((await request(outsider, `/api/notifications/${notification.id}/read`, "PUT")).status, 404);
      assert.equal((await request(member, `/api/notifications/${notification.id}/read`, "PUT")).status, 200);
      assert.equal(JSON.parse((await request(member, "/api/notifications")).data.find((n: any) => n.id === notification.id).metadata).resolvedStatus, undefined);
      assert.equal((await request(member, `/api/teams/invitations/${invitationId}/accept`, "POST")).status, 200);
      const resolved = (await request(member, "/api/notifications")).data.find((n: any) => n.id === notification.id);
      assert.equal(resolved.isRead, true);
      assert.equal(JSON.parse(resolved.metadata).resolvedStatus, "accepted");
      const members = await request(member, `/api/teams/${id}/members`);
      assert.equal(members.status, 200);
      assert.equal(JSON.stringify(members.data).includes("fixture-private"), false);
      assert.equal(JSON.stringify(members.data).includes("@example.test"), false);
      assert.equal((await request(outsider, `/api/teams/${id}/members`)).status, 403);
      assert.equal((await request(member, `/api/teams/${id}/members/${member}`, "DELETE")).status, 200);
      assert.equal((await request(owner, `/api/teams/${id}/leave`, "POST")).status, 409);
      assert.equal((await request(member, `/api/notifications/${notification.id}`, "DELETE")).status, 200);
    });
    await t.test("private admission requires invitations, not knowledge of an ID", async () => {
      const id = await makeTeam("private", { isPrivate: true, requiresApproval: false });
      assert.equal((await request(member, `/api/teams/${id}/request-join`, "POST")).status, 403);
      assert.equal((await request(member, `/api/teams/${id}`)).status, 403);
      const sent = await request(owner, `/api/teams/${id}/invitations`, "POST", { userId: member });
      assert.equal(sent.status, 200);
      assert.equal((await request(member, `/api/teams/${id}`)).status, 200);
      assert.equal((await request(member, `/api/invitations/${sent.data.invitation.id}/accept`, "POST")).status, 200);
      assert.equal((await request(member, `/api/teams/${id}/leave`, "POST")).status, 200);
    });
    await t.test("join requests cannot self-accept; rejection can be retried and approval requires a real request", async () => {
      const id = await makeTeam("requests");
      assert.equal((await request(member, `/api/teams/${id}/request-join`, "POST")).status, 200);
      const pending = (await request(member, "/api/teams/my-pending-requests")).data.find((r: any) => r.teamId === id);
      assert.ok(pending);
      assert.equal((await request(member, `/api/invitations/${pending.id}/accept`, "POST")).status, 409);
      assert.equal((await request(owner, `/api/teams/${id}/approve-join/${outsider}`, "POST")).status, 409);
      assert.equal((await request(member, `/api/teams/${id}/pending-requests`)).status, 403);
      assert.equal((await request(owner, `/api/teams/${id}/reject-join/${member}`, "POST")).status, 200);
      assert.equal((await request(member, `/api/teams/${id}/request-join`, "POST")).status, 200);
      assert.equal((await request(owner, `/api/teams/${id}/approve-join/${member}`, "POST")).status, 200);
      assert.equal((await request(owner, `/api/teams/${id}/approve-join/${member}`, "POST")).status, 409);
      assert.equal((await request(member, `/api/teams/${id}`, "PUT", { description: "unauthorised" })).status, 403);
      assert.equal((await request(owner, `/api/teams/${id}`, "PUT", { name: "" })).status, 400);
      assert.equal((await request(owner, `/api/teams/${id}`, "PUT", { maxPlayers: 1.5 })).status, 400);
      assert.equal((await request(owner, `/api/teams/${id}/members/${member}/role`, "PATCH", { role: "root" })).status, 400);
      assert.equal((await request(owner, `/api/teams/${id}/members/${owner}/role`, "PATCH", { role: "member" })).status, 409);
      assert.equal((await request(owner, `/api/teams/${id}/members/${member}/role`, "PATCH", { role: "admin" })).status, 200);
      assert.equal((await request(member, `/api/teams/${id}`, "PUT", { description: "Updated", ownerId: member })).status, 200);
      const [updated] = await db.select().from(teams).where(eq(teams.id, id));
      assert.equal(updated.ownerId, owner); assert.equal(updated.description, "Updated");
    });
    await t.test("blocking invalidates invitations and only administrators can unblock", async () => {
      const id = await makeTeam("block");
      const sent = await request(owner, `/api/teams/${id}/invitations`, "POST", { userId: outsider });
      assert.equal(sent.status, 200);
      assert.equal((await request(owner, `/api/teams/${id}/blocked-users`, "POST", { userId: outsider })).status, 200);
      assert.equal((await request(outsider, `/api/invitations/${sent.data.invitation.id}/accept`, "POST")).status, 409);
      assert.equal((await request(outsider, `/api/teams/${id}/blocked-users/${outsider}`, "DELETE")).status, 403);
      assert.equal((await request(outsider, `/api/teams/${id}/blocked`)).status, 403);
      const blocked = await request(owner, `/api/teams/${id}/blocked-users`);
      assert.equal(blocked.status, 200);
      assert.equal(JSON.stringify(blocked.data).includes("fixture-private"), false);
      assert.equal((await request(owner, `/api/teams/${id}/block/${outsider}`, "DELETE")).status, 200);
      assert.equal((await request(owner, `/api/teams/${id}/invitations`, "POST", { userId: outsider })).status, 200);
    });
    await t.test("simultaneous sends and accepts cannot duplicate memberships", async () => {
      const id = await makeTeam("races");
      const sent = await Promise.all(["invites", "invitations"].map(endpoint => request(owner, `/api/teams/${id}/${endpoint}`, "POST", { userId: second })));
      assert.deepEqual(sent.map(r => r.status).sort(), [200, 409]);
      const invitationId = sent.find(r => r.status === 200)!.data.invitation.id;
      const accepted = await Promise.all([request(second, `/api/invitations/${invitationId}/accept`, "POST"), request(second, `/api/teams/invitations/${invitationId}/accept`, "POST")]);
      assert.deepEqual(accepted.map(r => r.status).sort(), [200, 409]);
      const rows = await db.select().from(teamMemberships).where(and(eq(teamMemberships.teamId, id), eq(teamMemberships.userId, second)));
      assert.equal(rows.length, 1);
    });
    await t.test("concurrent admissions honour capacity", async () => {
      const id = await makeTeam("capacity", { maxPlayers: 2 });
      const invites = await Promise.all([member, second].map(userId => request(owner, `/api/teams/${id}/invitations`, "POST", { userId })));
      assert.ok(invites.every(r => r.status === 200));
      const accepted = await Promise.all(invites.map((r, index) => request([member, second][index], `/api/invitations/${r.data.invitation.id}/accept`, "POST")));
      assert.deepEqual(accepted.map(r => r.status).sort(), [200, 409]);
      assert.equal((await db.select().from(teamMemberships).where(eq(teamMemberships.teamId, id))).length, 2);
    });
    await t.test("deletion preserves team event history; empty teams can be deleted", async () => {
      const id = await makeTeam("history");
      await db.insert(events).values(insertEventSchema.parse({
        name: "Regression history", sport: "football", startDate: "2090-01-01", startTime: "19:00",
        location: "Test venue", requirements: "Synthetic regression fixture", primaryTeamId: id, createdById: owner, type: "training", gender: "mixed",
      }));
      assert.equal((await request(owner, `/api/teams/${id}`, "DELETE")).status, 409);
      assert.equal((await db.select().from(events).where(eq(events.primaryTeamId, id))).length, 1);
      const empty = await makeTeam("empty");
      assert.equal((await request(outsider, `/api/teams/${empty}`, "DELETE")).status, 403);
      assert.equal((await request(owner, `/api/teams/${empty}`, "DELETE")).status, 200);
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (teamIds.length) {
      await db.delete(notifications).where(inArray(notifications.userId, ids));
      await db.delete(events).where(inArray(events.primaryTeamId, teamIds));
      await db.delete(teams).where(inArray(teams.id, teamIds));
    }
    await db.delete(users).where(inArray(users.id, ids));
    await pool.end();
  }
});
