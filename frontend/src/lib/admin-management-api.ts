import { apiFetch } from "@/lib/api";

export type AccountControls = {
  is_current_user?: boolean;
  can_deactivate?: boolean;
  can_reactivate?: boolean;
  can_change_role?: boolean;
  protection_reason?: string | null;
};

export type AdminStaffRecord = AccountControls & {
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
  specialty?: string | null;
  availability?: string | null;
  bio?: string | null;
  created_at?: string;
};

export type AdminVerifiedUserOption = {
  id: number;
  name: string;
  email: string;
  contact?: string | null;
  note?: string | null;
};

export type AdminStaffSummary = {
  total: number;
  active: number;
  inactive: number;
  admins: number;
  staff: number;
  doctors: number;
};

export type AdminStaffPage = {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  summary: AdminStaffSummary;
  items: AdminStaffRecord[];
};

export type AdminStaffUpdatePayload = {
  full_name: string;
  name: string;
  role: string;
  department: string | null;
  phone: string | null;
  contact: string | null;
  specialty?: string | null;
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

function addOptional(params: URLSearchParams, key: string, value?: string) {
  const clean = value?.trim();
  if (clean && clean.toLowerCase() !== "all") params.set(key, clean);
}

export function queryAdminStaff(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  status?: string;
}) {
  const query = new URLSearchParams({
    page: String(params.page || 1),
    page_size: String(params.pageSize || 25),
  });
  addOptional(query, "search", params.search);
  addOptional(query, "role", params.role);
  addOptional(query, "status", params.status);
  return apiFetch<AdminStaffPage>(`/admin/staff/query?${query.toString()}`);
}

export function queryAdminStaffCandidates(search?: string) {
  const query = new URLSearchParams({ limit: "20" });
  addOptional(query, "search", search);
  return apiFetch<AdminVerifiedUserOption[]>(`/admin/staff/candidates/query?${query.toString()}`);
}

export function addAdminStaffFromUser(userId: number, role = "staff") {
  return apiFetch<AdminStaffRecord>("/admin/staff/from-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, role }),
  });
}

export function updateAdminStaff(staffId: number, payload: AdminStaffUpdatePayload) {
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

export function updateAdminUserStatus<T = unknown>(userId: number, status: string) {
  return apiFetch<T>(`/admin/users/${userId}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export function getAdminReports() {
  return apiFetch<AdminReportsData>("/admin/reports");
}
