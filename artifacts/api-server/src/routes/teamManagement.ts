import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { insertTeamSchema, notifications, teamInvitations } from "@workspace/db";
import { db } from "../db";
import { storage } from "../storage";
import { publicUser, TeamFlowError, TeamManagementStore } from "../teams/management";
import { TeamPictureError, validateTeamPicture } from "./teamPictures";

export function registerTeamManagement(app: Express, authenticate: RequestHandler,
  management = new TeamManagementStore(db, notice => storage.createNotificationIfAllowed(notice))) {
  const wrap = (fn: (req: any, res: any) => Promise<void>): RequestHandler => async (req: any, res) => {
    try { await fn(req, res); }
    catch (error: any) {
      if (error instanceof TeamFlowError || error instanceof TeamPictureError) return void res.status(error.status).json({ message: error.message });
      if (error instanceof z.ZodError || error?.name === "ZodError") {
        return void res.status(400).json({ message: (error.issues || error.errors)?.[0]?.message || "Invalid team details" });
      }
      if (error.code === "23505") return void res.status(409).json({ message: "These team details already exist" });
      console.error("Team management failed", error);
      res.status(500).json({ message: "Team change failed. Please try again." });
    }
  };
  const actor = (req: any) => req.userId || req.user?.claims?.sub;
  const target = (req: any) => z.string().trim().min(1, "Choose a user").max(255).parse(req.params.userId || req.body?.userId);
  app.get("/api/users/search", authenticate, wrap(async (req, res) => {
    const query = z.string().trim().min(2).max(100).parse(req.query.q);
    res.json((await storage.searchUsers(query, [actor(req)])).slice(0, 25).map(publicUser));
  }));
  app.get("/api/notifications", authenticate, wrap(async (req, res) => {
    const rows = await storage.getUserNotifications(actor(req));
    const metadata = (row: any) => {
      try { return typeof row.metadata === "string" ? JSON.parse(row.metadata) || {} : row.metadata || {}; } catch { return {}; }
    };
    const inviteIds = rows.filter(n => n.type === "team_invitation").map(n => metadata(n).invitationId || n.relatedId).filter(Boolean);
    const requestTeams = rows.filter(n => n.type === "team_join_request").map(n => metadata(n).teamId || n.relatedId).filter(Boolean);
    const invites = inviteIds.length ? await db.select().from(teamInvitations).where(inArray(teamInvitations.id, inviteIds)) : [];
    const requests = requestTeams.length ? await db.select().from(teamInvitations).where(inArray(teamInvitations.teamId, requestTeams)) : [];
    res.json(rows.map(row => {
      const meta = metadata(row);
      if (row.type === "team_invitation" && !meta.invitationId && row.relatedId) meta.invitationId = row.relatedId;
      const invitation = row.type === "team_invitation"
        ? invites.find(i => i.id === (meta.invitationId || row.relatedId) && i.userId === actor(req) && i.invitedById !== i.userId)
        : row.type === "team_join_request"
          ? requests.find(i => i.teamId === (meta.teamId || row.relatedId) && i.userId === meta.requestUserId && i.invitedById === i.userId)
          : undefined;
      if (["team_invitation", "team_join_request"].includes(row.type) && !meta.resolvedStatus && invitation?.status !== "pending") {
        meta.resolvedStatus = invitation?.status || "declined";
      }
      return { ...row, isRead: row.isRead || !!row.readAt,
        metadata: ["team_invitation", "team_join_request"].includes(row.type) ? JSON.stringify(meta) : row.metadata };
    }));
  }));
  app.get("/api/teams/:id/stats", authenticate, wrap(async (req, res) => {
    await management.canRead(req.params.id, actor(req));
    res.json(await storage.getTeamStats(req.params.id, actor(req)));
  }));
  app.get("/api/teams/my-pending-requests", authenticate, wrap(async (req, res) => { res.json(await management.listPending(actor(req), true)); }));
  app.get("/api/users/invitations", authenticate, wrap(async (req, res) => { res.json(await management.listPending(actor(req), false)); }));
  app.get("/api/teams/search", authenticate, wrap(async (req, res) => {
    const query = z.string().trim().min(2, "Search query must be at least 2 characters").max(100).parse(req.query.q);
    res.json(await storage.searchTeams(query, actor(req)));
  }));
  app.get("/api/teams/:id/pending-requests", authenticate, wrap(async (req, res) => { res.json(await management.listPending(actor(req), true, req.params.id)); }));
  app.get(["/api/teams/:id/invitations", "/api/teams/:id/invites"], authenticate, wrap(async (req, res) => { res.json(await management.listPending(actor(req), false, req.params.id)); }));
  app.post(["/api/teams/:id/invitations", "/api/teams/:id/invites", "/api/teams/:id/invite"], authenticate, wrap(async (req, res) => {
    res.json({ message: "Invitation sent successfully", ...await management.invite(req.params.id, target(req), actor(req)) });
  }));
  for (const action of ["accept", "decline"]) app.post([`/api/invitations/:invitationId/${action}`, `/api/teams/invitations/:invitationId/${action}`], authenticate, wrap(async (req, res) => {
    res.json({ message: `Invitation ${action === "accept" ? "accepted" : "declined"}`, ...await management.respond(req.params.invitationId, actor(req), action === "accept") });
  }));
  app.post("/api/teams/:id/request-join", authenticate, wrap(async (req, res) => { res.json(await management.join(req.params.id, actor(req))); }));
  for (const action of ["approve", "reject"]) app.post(`/api/teams/:id/${action}-join/:userId`, authenticate, wrap(async (req, res) => {
    res.json({ message: `Join request ${action === "approve" ? "approved" : "rejected"}`, ...await management.reviewRequest(req.params.id, target(req), actor(req), action === "approve") });
  }));
  app.post("/api/teams/:id/members", authenticate, wrap(async (req, res) => {
    const result = await management.add(req.params.id, target(req), actor(req), req.body.role || "member");
    res.json(result.membership);
  }));
  app.patch("/api/teams/:id/members/:userId/role", authenticate, wrap(async (req, res) => {
    res.json((await management.role(req.params.id, target(req), actor(req), req.body.role)).membership);
  }));
  app.delete("/api/teams/:id/members/:userId", authenticate, wrap(async (req, res) => { res.json(await management.remove(req.params.id, target(req), actor(req))); }));
  app.post("/api/teams/:id/leave", authenticate, wrap(async (req, res) => { res.json(await management.remove(req.params.id, actor(req), actor(req))); }));
  app.get(["/api/teams/:id/blocked", "/api/teams/:id/blocked-users"], authenticate, wrap(async (req, res) => {
    await management.canRead(req.params.id, actor(req), true);
    res.json((await storage.getBlockedMembers(req.params.id)).map(row => ({ ...row, user: publicUser(row.user), blockedBy: publicUser(row.blockedBy) })));
  }));
  app.post(["/api/teams/:id/block/:userId", "/api/teams/:id/blocked-users"], authenticate, wrap(async (req, res) => {
    const reason = z.string().max(1000).optional().parse(req.body?.reason);
    res.json(await management.block(req.params.id, target(req), actor(req), false, reason));
  }));
  app.delete(["/api/teams/:id/block/:userId", "/api/teams/:id/blocked-users/:userId"], authenticate, wrap(async (req, res) => {
    res.json(await management.block(req.params.id, target(req), actor(req), true));
  }));
  app.get("/api/teams/:id/members", authenticate, wrap(async (req, res) => {
    await management.canRead(req.params.id, actor(req));
    res.json((await storage.getTeamMembers(req.params.id)).map(row => ({ ...row, user: publicUser(row.user) })));
  }));
  app.get("/api/teams/:id", authenticate, wrap(async (req, res) => { res.json(await management.details(req.params.id, actor(req))); }));
  app.put("/api/teams/:id", authenticate, wrap(async (req, res) => {
    await management.canRead(req.params.id, actor(req), true);
    const parsed = insertTeamSchema.partial().parse(req.body);
    const updates: Record<string, any> = {};
    for (const key of ["name", "description", "sports", "gender", "color", "isPrivate", "requiresApproval", "maxPlayers"]) {
      if (Object.hasOwn(req.body, key)) updates[key] = (parsed as any)[key];
    }
    if (Object.hasOwn(updates, "maxPlayers")) updates.maxPlayers = z.number().int().min(1).nullable().parse(updates.maxPlayers);
    if (Object.hasOwn(updates, "name")) updates.name = z.string().trim().min(1, "Team name is required").max(255).parse(updates.name);
    if (Object.hasOwn(req.body, "teamImagePath")) {
      const team = await storage.getTeam(req.params.id);
      if (team?.ownerId !== actor(req)) throw new TeamFlowError(403, "Only the team owner can change the picture");
      updates.teamImagePath = await validateTeamPicture(req.body.teamImagePath);
    }
    res.json((await management.update(req.params.id, actor(req), updates)).team);
  }));
  app.delete("/api/teams/:id", authenticate, wrap(async (req, res) => { res.json(await management.delete(req.params.id, actor(req))); }));
  // Notification IDs must not let one user mutate another user's inbox.
  for (const [method, suffix, read] of [["put", "read", true], ["patch", "read", true], ["put", "unread", false], ["delete", "", true]] as const) {
    app[method](`/api/notifications/:id${suffix ? `/${suffix}` : ""}`, authenticate, wrap(async (req, res) => {
      const query = method === "delete" ? db.delete(notifications) : db.update(notifications).set({ isRead: read, readAt: read ? new Date() : null });
      const [row] = await query
        .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, actor(req)))).returning();
      if (!row) throw new TeamFlowError(404, "Notification not found");
      res.json({ message: method === "delete" ? "Notification deleted" : read ? "Notification marked as read" : "Notification marked as unread" });
    }));
  }
}
