export function apiErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : "";
  const body = raw.replace(/^\d{3}:\s*/, "");
  try {
    const j = JSON.parse(body);
    const parts = [j.message, j.details || j.reason].filter((x) => typeof x === "string" && x);
    if (parts.length) return Array.from(new Set(parts)).join(" - ");
  } catch {
    if (body && body.length < 300 && !body.startsWith("<")) return body;
  }
  return fallback;
}
