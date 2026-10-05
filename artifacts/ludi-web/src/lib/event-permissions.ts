type EventIdentity = { primaryTeamId?: string; createdById?: string };
type TeamAccess = { id: string; ownerId: string; role?: string };

// Existing-event permissions must use active AND archived teams, never just
// the active-team list used to select a team for a new event.
export function canManageExistingEvent(event: EventIdentity, userId: string | undefined, accessTeams: readonly TeamAccess[]) {
  if (!userId || !event?.primaryTeamId) return false;
  if (event.createdById === userId) return true;
  const team = accessTeams.find(team => team.id === event.primaryTeamId);
  return !!team && (team.ownerId === userId || team.role === "admin" || team.role === "captain");
}
