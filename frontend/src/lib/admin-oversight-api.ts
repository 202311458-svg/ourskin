import { apiFetch } from "@/lib/api";
import type { AiMonitorRun } from "@/lib/admin-ai-api";

export type OversightPage<T, TSummary = never> = {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: T[];
  summary: TSummary;
};

export type OversightAuditSummary = {
  total: number;
  account: number;
  appointment: number;
  medical: number;
  system: number;
  status_changes: number;
  destructive: number;
};

export type OversightAuditLog = {
  id: number;
  action: string;
  description?: string | null;
  performed_by?: string | null;
  actor_id?: number | null;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  target_id?: number | null;
  target_name?: string | null;
  target_type?: string | null;
  target_record_id?: string | null;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  metadata_json?: Record<string, unknown> | null;
  module?: string | null;
  action_type?: string | null;
  created_at?: string | null;
};

export type MonthlyAppointmentSummary = {
  month: string;
  total: number;
  pending: number;
  approved: number;
  completed: number;
  cancelled: number;
  declined: number;
  no_show: number;
};

export type AccountDistribution = {
  role: string;
  total: number;
  active: number;
  inactive: number;
  verified: number;
  unverified: number;
};

export type AiConditionOversight = {
  condition: string;
  cases: number;
  evidence_counts: Record<string, number>;
  severity_counts: Record<string, number>;
  common_severity: string;
  average_confidence?: null;
};

export type DoctorOversight = {
  doctor_id: number;
  doctor_name: string;
  assigned_appointments: number;
  completed_appointments: number;
  versioned_ai_runs: number;
  pending_ai_reviews: number;
  reviewed_ai_cases: number;
  evaluated_ai_cases: number;
};

export type AiOversightSummary = {
  total_runs: number;
  reviewed_runs: number;
  pending_runs: number;
  dermatology_runs: number;
  progress_runs: number;
  evaluated_diagnosis_runs: number;
  agreement_counts: Record<string, number>;
  primary_agreement_rate?: number | null;
  primary_or_differential_alignment_rate?: number | null;
  medication_review_cases: number;
  medication_option_used_cases: number;
  medication_option_use_rate?: number | null;
  average_latency_ms?: number | null;
  mode_counts: Record<string, number>;
  status_counts: Record<string, number>;
  evidence_counts: Record<string, number>;
  compatibility_counts: Record<string, number>;
  progress_trend_counts: Record<string, number>;
  model_counts: Record<string, number>;
  legacy_records_retained: number;
  methodology: {
    diagnosis_agreement: string;
    medication_use: string;
    clinical_validation: string;
  };
};

export type AdminOversightReports = {
  generated_at: string;
  overview: {
    total_appointments: number;
    pending_appointments: number;
    approved_appointments: number;
    completed_appointments: number;
    cancelled_appointments: number;
    declined_appointments: number;
    no_show_appointments: number;
    total_users: number;
    active_users: number;
    inactive_users: number;
    total_ai_runs: number;
    pending_ai_reviews: number;
    reviewed_ai_runs: number;
    evaluated_diagnosis_runs: number;
  };
  monthly_appointments: MonthlyAppointmentSummary[];
  appointment_outcomes: Record<string, number>;
  completed_vs_cancelled: {
    completed: number;
    cancelled: number;
    total: number;
    completion_rate: number;
    cancellation_rate: number;
  };
  account_distribution: AccountDistribution[];
  user_growth: AccountDistribution[];
  ai_condition_summary: AiConditionOversight[];
  ai_evaluation: AiOversightSummary;
  doctor_activity: DoctorOversight[];
  legacy_ai_records_retained: number;
  reporting_notes: {
    ai_source: string;
    legacy_ai: string;
    agreement: string;
  };
};

function addOptional(params: URLSearchParams, key: string, value?: string) {
  const cleaned = value?.trim();
  if (cleaned && cleaned.toLowerCase() !== "all") params.set(key, cleaned);
}

export function queryOversightAi(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  mode?: string;
  reviewStatus?: string;
  agreement?: string;
  runStatus?: string;
  model?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const search = new URLSearchParams({
    page: String(params.page || 1),
    page_size: String(params.pageSize || 25),
  });
  addOptional(search, "search", params.search);
  addOptional(search, "mode", params.mode);
  addOptional(search, "review_status", params.reviewStatus);
  addOptional(search, "agreement", params.agreement);
  addOptional(search, "run_status", params.runStatus);
  addOptional(search, "model", params.model);
  addOptional(search, "date_from", params.dateFrom);
  addOptional(search, "date_to", params.dateTo);

  return apiFetch<{
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    items: AiMonitorRun[];
  }>(`/admin/ai-monitor/query?${search.toString()}`);
}

export function queryOversightAudit(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  module?: string;
  actionType?: string;
  actorRole?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const search = new URLSearchParams({
    page: String(params.page || 1),
    page_size: String(params.pageSize || 25),
  });
  addOptional(search, "search", params.search);
  addOptional(search, "module", params.module);
  addOptional(search, "action_type", params.actionType);
  addOptional(search, "actor_role", params.actorRole);
  addOptional(search, "date_from", params.dateFrom);
  addOptional(search, "date_to", params.dateTo);

  return apiFetch<OversightPage<OversightAuditLog, OversightAuditSummary>>(
    `/admin/audit-logs/query?${search.toString()}`
  );
}

export function getAdminOversightReports() {
  return apiFetch<AdminOversightReports>("/admin/reports");
}
