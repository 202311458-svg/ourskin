import { apiFetch } from "@/lib/api";

export type AdminStaffRecord = {
  id?: number | string;
  full_name?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  department?: string | null;
  phone?: string | null;
  contact?: string | null;
  profile_image?: string | null;
  created_at?: string;
};

export type AdminVerifiedUserOption = {
  id: number;
  name: string;
  email: string;
};

export type AdminStaffUpdatePayload = {
  full_name: string;
  name: string;
  role: string;
  department: string | null;
  phone: string | null;
  contact: string | null;
};

export type MonthlyAppointmentSummary = {
  month: string;
  total: number;
  pending: number;
  approved: number;
  completed: number;
  cancelled: number;
  declined: number;
};

export type AiConditionSummary = {
  condition: string;
  cases: number;
  average_confidence: number | null;
  common_severity: string;
};

export type UserGrowth = {
  role: string;
  total: number;
  active: number;
  inactive: number;
  verified: number;
  unverified: number;
};

export type CompletedCancelledSummary = {
  completed: number;
  cancelled: number;
  total: number;
  completion_rate: number;
  cancellation_rate: number;
};

export type DoctorActivity = {
  doctor_name: string;
  assigned_appointments: number;
  completed_appointments: number;
  pending_ai_reviews: number;
  reviewed_ai_cases: number;
};

export type AdminReportsData = {
  monthly_appointments: MonthlyAppointmentSummary[];
  ai_condition_summary: AiConditionSummary[];
  user_growth: UserGrowth[];
  completed_vs_cancelled: CompletedCancelledSummary;
  doctor_activity: DoctorActivity[];
};

export function getAdminStaff() {
  return apiFetch<AdminStaffRecord[]>("/admin/staff");
}

export function getAdminVerifiedUsers() {
  return apiFetch<AdminVerifiedUserOption[]>("/admin/verified-users");
}

export function addAdminStaffFromUser(userId: number, role = "staff") {
  return apiFetch<AdminStaffRecord>("/admin/staff/from-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, role }),
  });
}

export function updateAdminStaff(
  staffId: number,
  payload: AdminStaffUpdatePayload
) {
  return apiFetch<AdminStaffRecord>(`/admin/staff/${staffId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateAdminStaffStatus(staffId: number, status: string) {
  return apiFetch<AdminStaffRecord>(`/admin/staff/${staffId}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export function getAdminReports() {
  return apiFetch<AdminReportsData>("/admin/reports");
}
