import { and, eq, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { blockedMembers, events, notifications, payments, teamInvitations, teamMemberships, teams, users, type InsertNotification, type Team } from "@workspace/db";
import { db } from "../db";

export class TeamFlowError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const TEAM_ROLES = ["member", "captain", "coach", "admin"] as const;
export const publicUser = (user: any) => user && ({
  id: user.id, username: user.username, firstName: user.firstName,
  lastName: user.lastName, profileImageUrl: user.profileImageUrl,
});
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Context = { tx: Tx; team: Team; notices: InsertNotification[] };

// Every admission and membership mutation locks the same team row. Capacity,
// blocking and pending-state checks are performed inside that transaction.
export class TeamManagementStore {
  constructor(private database = db, private notify?: (notice: InsertNotification) => Promise<unknown>) {}
  private async run<T extends object>(teamId: string, action: (ctx: Context) => Promise<T>, allowArchived = false) {
    const notices: InsertNotification[] = [];
    const result = await this.database.transaction(async tx => {
      const [team] = await tx.select().from(teams).where(eq(teams.id, teamId)).for("update");
      if (!team) throw new TeamFlowError(404, "Team not found");
      if (team.archivedAt && !allowArchived) throw new TeamFlowError(409, "This team is archived. The owner must restore it before making team changes.");
      return action({ tx, team, notices });
    });
    let notificationWarning: string | undefined;
    for (const notice of notices) {
      try { await this.notify?.(notice); }
      catch (error) {
        console.error("Team change saved but notification delivery failed", error);
        notificationWarning = "The change was saved, but a notification could not be delivered. Invitations are also available in Teams.";
      }
    }
    return { ...result, ...(notificationWarning ? { notificationWarning } : {}) };
  }
  private async membership(ctx: Context, userId: string) {
    const [row] = await ctx.tx.select().from(teamMemberships)
      .where(and(eq(teamMemberships.teamId, ctx.team.id), eq(teamMemberships.userId, userId)));
    return row;
  }
  private async admin(ctx: Context, actor: string) {
    if (ctx.team.ownerId === actor) return;
    if ((await this.membership(ctx, actor))?.role !== "admin") {
      throw new TeamFlowError(403, "Only team owners and admins can manage this team");
    }
  }
  private async eligible(ctx: Context, userId: string, capacity = true) {
    const [user] = await ctx.tx.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!user) throw new TeamFlowError(404, "User not found");
    if (ctx.team.ownerId === userId || await this.membership(ctx, userId)) throw new TeamFlowError(409, "User is already a team member");
    const [blocked] = await ctx.tx.select().from(blockedMembers)
      .where(and(eq(blockedMembers.teamId, ctx.team.id), eq(blockedMembers.userId, userId)));
    if (blocked) throw new TeamFlowError(403, "This user is blocked from joining the team");
    if (capacity && ctx.team.maxPlayers) {
      const [count] = await ctx.tx.select({ total: sql<number>`count(*)`.mapWith(Number) })
        .from(teamMemberships).where(eq(teamMemberships.teamId, ctx.team.id));
      if (count.total >= ctx.team.maxPlayers) throw new TeamFlowError(409, "Team is at maximum capacity");
    }
  }
  private async pending(ctx: Context, userId: string, request: boolean) {
    const [row] = await ctx.tx.select().from(teamInvitations)
      .where(and(eq(teamInvitations.teamId, ctx.team.id), eq(teamInvitations.userId, userId), eq(teamInvitations.status, "pending")));
    if (!row || (row.invitedById === row.userId) !== request) throw new TeamFlowError(409, request ? "No pending join request" : "No pending invitation");
    return row;
  }
  private async resolve(ctx: Context, invitationId: string, status: "accepted" | "declined") {
    await ctx.tx.update(teamInvitations).set({ status, respondedAt: new Date() })
      .where(and(eq(teamInvitations.id, invitationId), eq(teamInvitations.status, "pending")));
    // Read is not the same as resolved. Persist the outcome for both clients.
    await ctx.tx.update(notifications).set({
      isRead: true, readAt: new Date(),
      metadata: sql`(COALESCE(${notifications.metadata}, '{}')::jsonb || jsonb_build_object('resolvedStatus', ${status}::text))::text`,
    }).where(and(eq(notifications.type, "team_invitation"), eq(notifications.relatedId, invitationId)));
    const [row] = await ctx.tx.select().from(teamInvitations).where(eq(teamInvitations.id, invitationId));
    await ctx.tx.update(notifications).set({
      isRead: true, readAt: new Date(),
      metadata: sql`(COALESCE(${notifications.metadata}, '{}')::jsonb || jsonb_build_object('resolvedStatus', ${status}::text))::text`,
    }).where(and(eq(notifications.type, "team_join_request"), eq(notifications.relatedId, ctx.team.id),
      sql`${notifications.metadata}::jsonb->>'requestUserId' = ${row.userId}`));
  }
  invite(teamId: string, userId: string, actor: string) {
    return this.run(teamId, async ctx => {
      await this.admin(ctx, actor);
      await this.eligible(ctx, userId);
      const [old] = await ctx.tx.select().from(teamInvitations)
        .where(and(eq(teamInvitations.teamId, teamId), eq(teamInvitations.userId, userId)));
      if (old?.status === "pending") throw new TeamFlowError(409, old.invitedById === userId ? "This user already has a join request awaiting approval" : "An invitation is already pending for this user");
      // Keep the previous invitation ID for historical notification links.
      const [invitation] = old
        ? await ctx.tx.update(teamInvitations).set({ invitedById: actor, status: "pending", invitedAt: new Date(), respondedAt: null }).where(eq(teamInvitations.id, old.id)).returning()
        : await ctx.tx.insert(teamInvitations).values({ teamId, userId, invitedById: actor, status: "pending" }).returning();
      ctx.notices.push({ userId, title: "Team Invitation", message: `You have been invited to join "${ctx.team.name}"`,
        type: "team_invitation", relatedId: invitation.id, metadata: JSON.stringify({ invitationId: invitation.id, teamId }) });
      return { invitation };
    });
  }
  async respond(invitationId: string, actor: string, accept: boolean) {
    const [initial] = await this.database.select().from(teamInvitations).where(eq(teamInvitations.id, invitationId));
    if (!initial || initial.userId !== actor) throw new TeamFlowError(404, "Invitation not found");
    return this.run(initial.teamId, async ctx => {
      const row = await this.pending(ctx, actor, false);
      if (row.id !== invitationId) throw new TeamFlowError(409, "Invitation is no longer pending");
      let membership;
      if (accept) {
        await this.eligible(ctx, actor);
        [membership] = await ctx.tx.insert(teamMemberships).values({ teamId: ctx.team.id, userId: actor, role: "member" }).returning();
      }
      await this.resolve(ctx, row.id, accept ? "accepted" : "declined");
      ctx.notices.push({ userId: row.invitedById, title: accept ? "Invitation Accepted" : "Invitation Declined",
        message: `An invitation to "${ctx.team.name}" was ${accept ? "accepted" : "declined"}`,
        type: accept ? "team_invitation_accepted" : "team_invitation_declined", relatedId: ctx.team.id });
      return { membership };
    });
  }
  join(teamId: string, actor: string) {
    return this.run(teamId, async ctx => {
      if (ctx.team.isPrivate) throw new TeamFlowError(403, "Private teams require an invitation");
      await this.eligible(ctx, actor);
      const [old] = await ctx.tx.select().from(teamInvitations)
        .where(and(eq(teamInvitations.teamId, teamId), eq(teamInvitations.userId, actor)));
      if (old?.status === "pending") throw new TeamFlowError(409, old.invitedById === actor ? "You already have a pending join request" : "Accept your existing invitation instead");
      if (!ctx.team.requiresApproval) {
        const [membership] = await ctx.tx.insert(teamMemberships).values({ teamId, userId: actor, role: "member" }).returning();
        return { membership, message: "Successfully joined team" };
      }
      const [request] = old
        ? await ctx.tx.update(teamInvitations).set({ invitedById: actor, status: "pending", invitedAt: new Date(), respondedAt: null }).where(eq(teamInvitations.id, old.id)).returning()
        : await ctx.tx.insert(teamInvitations).values({ teamId, userId: actor, invitedById: actor, status: "pending" }).returning();
      const admins = await ctx.tx.select({ userId: teamMemberships.userId }).from(teamMemberships)
        .where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.role, "admin")));
      for (const userId of new Set([ctx.team.ownerId, ...admins.map(a => a.userId)])) {
        ctx.notices.push({ userId, title: "New Team Join Request", message: `A user wants to join "${ctx.team.name}"`,
          type: "team_join_request", relatedId: teamId, metadata: JSON.stringify({ teamId, requestUserId: actor }) });
      }
      return { request, message: "Join request sent to team admins" };
    });
  }
  reviewRequest(teamId: string, userId: string, actor: string, approve: boolean) {
    return this.run(teamId, async ctx => {
      await this.admin(ctx, actor);
      const row = await this.pending(ctx, userId, true);
      if (actor === userId) throw new TeamFlowError(403, "Cannot approve your own join request");
      let membership;
      if (approve) {
        await this.eligible(ctx, userId);
        [membership] = await ctx.tx.insert(teamMemberships).values({ teamId, userId, role: "member" }).returning();
      }
      await this.resolve(ctx, row.id, approve ? "accepted" : "declined");
      ctx.notices.push({ userId, title: approve ? "Join Request Approved" : "Join Request Declined",
        message: `Your request to join "${ctx.team.name}" was ${approve ? "approved" : "declined"}`,
        type: approve ? "team_join_approved" : "team_join_rejected", relatedId: teamId });
      return { membership };
    });
  }
  add(teamId: string, userId: string, actor: string, role: string) {
    return this.run(teamId, async ctx => {
      await this.admin(ctx, actor);
      this.checkRole(role);
      await this.eligible(ctx, userId);
      const [membership] = await ctx.tx.insert(teamMemberships).values({ teamId, userId, role }).returning();
      const [pending] = await ctx.tx.select().from(teamInvitations)
        .where(and(eq(teamInvitations.teamId, teamId), eq(teamInvitations.userId, userId), eq(teamInvitations.status, "pending")));
      if (pending) await this.resolve(ctx, pending.id, "accepted");
      return { membership };
    });
  }
  private checkRole(role: string) {
    if (!TEAM_ROLES.includes(role as any)) throw new TeamFlowError(400, "Choose a valid team role");
  }
  role(teamId: string, userId: string, actor: string, role: string) {
    return this.run(teamId, async ctx => {
      await this.admin(ctx, actor);
      this.checkRole(role);
      if (ctx.team.ownerId === userId) throw new TeamFlowError(409, "Cannot change the team owner's role");
      if (!await this.membership(ctx, userId)) throw new TeamFlowError(404, "Team member not found");
      const [membership] = await ctx.tx.update(teamMemberships).set({ role })
        .where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.userId, userId))).returning();
      return { membership };
    });
  }
  remove(teamId: string, userId: string, actor: string) {
    return this.run(teamId, async ctx => {
      if (ctx.team.ownerId === userId) throw new TeamFlowError(409, "Team owners cannot leave or be removed");
      if (actor !== userId) await this.admin(ctx, actor);
      if (!await this.membership(ctx, userId)) throw new TeamFlowError(404, "Team member not found");
      await ctx.tx.delete(teamMemberships).where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.userId, userId)));
      return { message: actor === userId ? "Successfully left the team" : "Member removed successfully" };
    });
  }
  block(teamId: string, userId: string, actor: string, unblock = false, reason?: string) {
    return this.run(teamId, async ctx => {
      await this.admin(ctx, actor);
      if (ctx.team.ownerId === userId) throw new TeamFlowError(409, "Cannot block the team owner");
      const [user] = await ctx.tx.select({ id: users.id }).from(users).where(eq(users.id, userId));
      if (!user) throw new TeamFlowError(404, "User not found");
      if (unblock) {
        await ctx.tx.delete(blockedMembers).where(and(eq(blockedMembers.teamId, teamId), eq(blockedMembers.userId, userId)));
        return { message: "Member unblocked successfully" };
      }
      await ctx.tx.delete(teamMemberships).where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.userId, userId)));
      const [pending] = await ctx.tx.select().from(teamInvitations)
        .where(and(eq(teamInvitations.teamId, teamId), eq(teamInvitations.userId, userId), eq(teamInvitations.status, "pending")));
      if (pending) await this.resolve(ctx, pending.id, "declined");
      await ctx.tx.insert(blockedMembers).values({ teamId, userId, blockedById: actor, reason })
        .onConflictDoUpdate({ target: [blockedMembers.teamId, blockedMembers.userId], set: { blockedById: actor, reason, blockedAt: new Date() } });
      return { message: "Member blocked successfully" };
    });
  }
  async canRead(teamId: string, actor: string, adminOnly = false) {
    const [team] = await this.database.select().from(teams).where(eq(teams.id, teamId));
    if (!team) throw new TeamFlowError(404, "Team not found");
    if (team.ownerId === actor) return team;
    const [member] = await this.database.select().from(teamMemberships)
      .where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.userId, actor)));
    if (!member || adminOnly && member.role !== "admin") throw new TeamFlowError(403, "Not authorized to view this team information");
    return team;
  }
  async details(teamId: string, actor: string) {
    const [team] = await this.database.select().from(teams).where(eq(teams.id, teamId));
    if (!team) throw new TeamFlowError(404, "Team not found");
    const [member] = await this.database.select().from(teamMemberships)
      .where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.userId, actor)));
    if (team.ownerId === actor || member) return team;
    if (team.archivedAt) throw new TeamFlowError(403, "Archived teams are only available to their owner and members");
    if (team.isPrivate) {
      const [invite] = await this.database.select().from(teamInvitations).where(and(eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.userId, actor), ne(teamInvitations.invitedById, actor), eq(teamInvitations.status, "pending")));
      if (!invite) throw new TeamFlowError(403, "This team is private");
    }
    return { ...team, inviteCode: null };
  }
  async listPending(actor: string, requests: boolean, teamId?: string) {
    if (teamId) await this.canRead(teamId, actor, true);
    const inviter = alias(users, "inviter");
    const rows = await this.database.select({ invitation: teamInvitations, team: teams,
      invitedBy: { id: inviter.id, username: inviter.username, firstName: inviter.firstName, lastName: inviter.lastName, profileImageUrl: inviter.profileImageUrl },
      user: { id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, profileImageUrl: users.profileImageUrl } })
      .from(teamInvitations).innerJoin(teams, eq(teams.id, teamInvitations.teamId)).innerJoin(users, eq(users.id, teamInvitations.userId))
      .innerJoin(inviter, eq(inviter.id, teamInvitations.invitedById))
      .where(and(eq(teamInvitations.status, "pending"), teamId ? eq(teamInvitations.teamId, teamId) : eq(teamInvitations.userId, actor),
        requests ? eq(teamInvitations.invitedById, teamInvitations.userId) : ne(teamInvitations.invitedById, teamInvitations.userId)));
    return rows.map(r => ({ ...r.invitation, team: r.team, user: r.user, invitedBy: r.invitedBy }));
  }
  update(teamId: string, actor: string, updates: Record<string, any>) {
    return this.run(teamId, async ctx => {
      await this.admin(ctx, actor);
      if (Object.hasOwn(updates, "teamImagePath") && ctx.team.ownerId !== actor) throw new TeamFlowError(403, "Only the team owner can change the picture");
      if (updates.maxPlayers) {
        const [count] = await ctx.tx.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(teamMemberships).where(eq(teamMemberships.teamId, teamId));
        if (updates.maxPlayers < count.total) throw new TeamFlowError(409, "Capacity cannot be smaller than current membership");
      }
      const [team] = await ctx.tx.update(teams).set({ ...updates, updatedAt: new Date() }).where(eq(teams.id, teamId)).returning();
      return { team };
    });
  }
  archive(teamId: string, actor: string, archived: boolean) {
    return this.run(teamId, async ctx => {
      if (ctx.team.ownerId !== actor) throw new TeamFlowError(403, "Only the team owner can archive or restore this team");
      if (!!ctx.team.archivedAt === archived) return { team: ctx.team };
      const [team] = await ctx.tx.update(teams).set({
        archivedAt: archived ? new Date() : null, updatedAt: new Date(),
      }).where(eq(teams.id, teamId)).returning();
      return { team };
    }, true);
  }
  delete(teamId: string, actor: string) {
    return this.run(teamId, async ctx => {
      await this.admin(ctx, actor);
      const [event] = await ctx.tx.select({ id: events.id }).from(events).where(or(eq(events.primaryTeamId, teamId),
        sql`${teamId} = ANY(${events.secondaryTeamIds})`,
        sql`EXISTS (SELECT 1 FROM event_teams et WHERE et.event_id = ${events.id} AND et.team_id = ${teamId})`)).limit(1);
      if (event) throw new TeamFlowError(409, "This team has event history and cannot be deleted. The owner can archive it to preserve attendance and payment records.");
      const [payment] = await ctx.tx.select({ id: payments.id }).from(payments).where(eq(payments.teamId, teamId)).limit(1);
      if (payment) throw new TeamFlowError(409, "This team has payment history and cannot be deleted. The owner can archive it instead.");
      await ctx.tx.delete(notifications).where(eq(notifications.relatedId, teamId));
      await ctx.tx.delete(notifications).where(sql`${notifications.type} = 'team_invitation' AND ${notifications.relatedId} IN (SELECT id FROM team_invitations WHERE team_id = ${teamId})`);
      await ctx.tx.delete(teams).where(eq(teams.id, teamId));
      return { message: "Team deleted successfully" };
    });
  }
}
