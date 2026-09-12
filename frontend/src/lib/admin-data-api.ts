import { apiFetch } from "@/lib/api";
import type { AdminAppointment, AdminUser, AuditLog } from "@/lib/admin-api";
import type { AiMonitorRun } from "@/lib/admin-ai-api";

export type AdminDataPage<T, TSummary = never> = {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: T[];
  summary: TSummary;
};

export type AdminUserSummary = {
  total: number;
  patients: number;
  internal: number;
  verified: number;
  minors: number;
};

export type AdminAppointmentSummary = {
  total: number;
  pending: number;
  initial_evaluation: number;
  approved: number;
};

export type AdminAuditSummary = {
  total: number;
  account: number;
  appointment: number;
  medical: number;
  system: number;
};

export type AdminAuditLog = AuditLog & {
  actor_role?: string | null;
  target_type?: string | null;
  target_record_id?: string | null;
  module?: string | null;
  action_type?: string | null;
};

function addOptional(search: URLSearchParams, key: string, value?: string) {
  const clean = value?.trim();
  if (clean && clean.toLowerCase() !== "all") search.set(key, clean);
}

export async function queryAdminUsers(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  verification?: string;
  patientType?: string;
}) {
  const search = new URLSearchParams({
    page: String(params.page || 1),
    page_size: String(params.pageSize || 25),
  });
  addOptional(search, "search", params.search);
  addOptional(search, "role", params.role);
  addOptional(search, "verification", params.verification);
  addOptional(search, "patient_type", params.patientType);

  return apiFetch<AdminDataPage<AdminUser, AdminUserSummary>>(
    `/admin/users/query?${search.toString()}`
  );
}

export async function queryAdminAppointments(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}) {
  const search = new URLSearchParams({
    page: String(params.page || 1),
    page_size: String(params.pageSize || 25),
  });
  addOptional(search, "search", params.search);
  addOptional(search, "status", params.status);

  return apiFetch<AdminDataPage<AdminAppointment, AdminAppointmentSummary>>(
    `/admin/appointments/query?${search.toString()}`
  );
}

export async function queryAdminAuditLogs(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  module?: string;
  actionType?: string;
}) {
  const search = new URLSearchParams({
    page: String(params.page || 1),
    page_size: String(params.pageSize || 25),
  });
  addOptional(search, "search", params.search);
  addOptional(search, "module", params.module);
  addOptional(search, "action_type", params.actionType);

  return apiFetch<AdminDataPage<AdminAuditLog, AdminAuditSummary>>(
    `/admin/audit-logs/query?${search.toString()}`
  );
}

export async function queryAiMonitor(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  mode?: string;
  reviewStatus?: string;
  agreement?: string;
}) {
  const search = new URLSearchParams({
    page: String(params.page || 1),
    page_size: String(params.pageSize || 25),
  });
  addOptional(search, "search", params.search);
  addOptional(search, "mode", params.mode);
  addOptional(search, "review_status", params.reviewStatus);
  addOptional(search, "agreement", params.agreement);

  return apiFetch<{
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    items: AiMonitorRun[];
  }>(`/admin/ai-monitor/query?${search.toString()}`);
}
