// A reserve placement still represents a Yes vote; promotion does not change it.
export const YES_VOTE_STATUSES = ["attending", "promoted", "reserve"] as const;

export function canonicalAudience(type: string, audience: string) {
  if (audience !== "existing") return audience;
  if (type === "event_reminder") return audience; // never supported this legacy option
  if (type === "flare_gun") return "flare_recipients";
  if (type.startsWith("payment")) return "payment_recipient";
  return "team_members";
}

export function audienceVoteStatuses(audience: string): readonly string[] | undefined {
  if (audience === "attendees") return YES_VOTE_STATUSES;
  if (audience === "maybe_voters") return ["maybe"];
  return undefined;
}

export function voteMatchesAudience(audience: string, status: string | null | undefined) {
  const statuses = audienceVoteStatuses(audience);
  return !statuses || !!status && statuses.includes(status);
}
