export function formatAuditAction(action?: string | null) {
  return (action || "System").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function auditTone(actionType?: string | null): "success" | "info" | "warning" | "danger" | "neutral" {
  if (actionType === "create") return "success";
  if (actionType === "update") return "info";
  if (actionType === "status") return "warning";
  if (actionType === "danger") return "danger";
  return "neutral";
}

export function formatAuditDate(value?: string | null) {
  if (!value) return "N/A";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleString();
}
