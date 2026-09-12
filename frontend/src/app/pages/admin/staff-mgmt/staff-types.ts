import type { AdminStaffRecord } from "@/lib/admin-management-api";

export type StaffUser = {
  id: number; full_name: string; email: string; role: string; status: string;
  department: string; phone: string; specialty: string; profile_image?: string | null;
  created_at?: string; is_current_user?: boolean; can_deactivate?: boolean;
  can_reactivate?: boolean; can_change_role?: boolean; protection_reason?: string | null;
};
export type EditStaffForm = { id: number | null; full_name: string; role: string; department: string; phone: string; specialty: string };
export type ConfirmAction = { type: "deactivate" | "reactivate"; member: StaffUser } | null;

export function normalizeStaff(raw: AdminStaffRecord): StaffUser {
  return {
    id: Number(raw.id), full_name: raw.full_name || raw.name || "Unnamed User", email: raw.email || "",
    role: (raw.role || "staff").toLowerCase(), status: raw.status || "Active", department: raw.department || "",
    phone: raw.phone || raw.contact || "", specialty: raw.specialty || "", profile_image: raw.profile_image || null,
    created_at: raw.created_at, is_current_user: raw.is_current_user, can_deactivate: raw.can_deactivate,
    can_reactivate: raw.can_reactivate, can_change_role: raw.can_change_role, protection_reason: raw.protection_reason,
  };
}
export function formatDate(value?: string) {
  if (!value) return "N/A"; const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
export const capitalize = (value?: string) => value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : "N/A";
export const roleTone = (role: string) => role === "admin" ? "danger" as const : role === "doctor" ? "info" as const : "warning" as const;
