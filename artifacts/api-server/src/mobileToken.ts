export function getNormalMobileTokenUserId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || !("userId" in payload)) {
    return undefined;
  }
  const userId = (payload as { userId?: unknown }).userId;
  return typeof userId === "string" && userId ? userId : undefined;
}