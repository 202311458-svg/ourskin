export function pretty(value?: string | null) {
  return (value || "—")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function formatPercent(value?: number | null) {
  return value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;
}

export function modeLabel(value?: string | null) {
  if (value === "RECOVERY_PROGRESS") return "Recovery / progress";
  if (value === "SERVICE_COMPATIBILITY") return "Service compatibility";
  return "Dermatology assessment";
}

export function badgeTone(value?: string | null): "success" | "warning" | "danger" | "info" | "neutral" {
  const normalized = (value || "").toUpperCase();
  if (["AGREE", "REVIEWED", "COMPLETED", "HIGH", "COMPATIBLE", "IMPROVING"].includes(normalized)) return "success";
  if (["PARTIAL", "MODERATE", "STABLE", "REVIEW_RECOMMENDED"].includes(normalized)) return "info";
  if (["PENDING_REVIEW", "LOW", "UNCERTAIN", "MIXED", "UNABLE_TO_COMPARE"].includes(normalized)) return "warning";
  if (["DISAGREE", "FAILED", "OUT_OF_SCOPE", "REQUIRES_DIRECT_REVIEW", "POSSIBLE_WORSENING"].includes(normalized)) return "danger";
  return "neutral";
}
