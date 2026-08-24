import { apiFetch } from "@/lib/api";

export type PaginatedAiMonitor<T> = {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: T[];
};

export type AiMonitorRun = {
  id: number;
  appointment_id: number;
  patient_name: string;
  patient_email: string;
  doctor_name?: string | null;
  booked_service?: string | null;
  analysis_mode: string;
  status: string;
  primary_condition_code?: string | null;
  primary_condition_display?: string | null;
  evidence_strength?: string | null;
  severity_level?: string | null;
  service_compatibility?: string | null;
  progress_trend?: string | null;
  comparison_reliable?: boolean | null;
  review_status: string;
  model_provider?: string | null;
  model_id?: string | null;
  model_version?: string | null;
  pipeline_version?: string | null;
  taxonomy_version?: string | null;
  latency_ms?: number | null;
  red_flags?: string[];
  limitations?: string[];
  created_at?: string | null;
  reviewed_at?: string | null;
  diagnosis_report_id?: number | null;
  doctor_final_diagnosis?: string | null;
  diagnosis_agreement?: string | null;
  evaluation_basis?: string | null;
  matched_differential_code?: string | null;
  matched_differential_display?: string | null;
  medication_suggestions_present?: boolean | null;
  medication_suggestion_used?: boolean | null;
  medication_matches?: string[];
};

export type AiEvaluationSummary = {
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

export async function getAiMonitor(params: {
  page?: number;
  pageSize?: number;
  mode?: string;
  reviewStatus?: string;
  agreement?: string;
}) {
  const search = new URLSearchParams({
    page: String(params.page || 1),
    page_size: String(params.pageSize || 25),
  });
  if (params.mode && params.mode !== "ALL") search.set("mode", params.mode);
  if (params.reviewStatus && params.reviewStatus !== "ALL") {
    search.set("review_status", params.reviewStatus);
  }
  if (params.agreement && params.agreement !== "ALL") {
    search.set("agreement", params.agreement);
  }
  return apiFetch<PaginatedAiMonitor<AiMonitorRun>>(
    `/admin/ai-monitor?${search.toString()}`
  );
}

export async function getAiEvaluationSummary() {
  return apiFetch<AiEvaluationSummary>("/admin/ai-evaluation/summary");
}
