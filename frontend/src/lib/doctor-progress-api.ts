import { API_BASE_URL, apiFetch, getAuthHeaders } from "./api";
import { validateAiImageFile } from "./doctor-api";

export type CaptureView = "FRONT" | "LEFT" | "RIGHT" | "CLOSE_UP" | "OTHER" | "UNSPECIFIED";
export type ProgressTrend =
  | "IMPROVING"
  | "STABLE"
  | "POSSIBLE_WORSENING"
  | "MIXED"
  | "UNABLE_TO_COMPARE";
export type ProgressChange = "IMPROVED" | "STABLE" | "WORSENED" | "NEW" | "RESOLVED" | "UNCERTAIN";

export type ProgressFinding = {
  feature: string;
  change: ProgressChange;
  description: string;
};

export type ProgressReferenceOption = {
  run_id: number;
  appointment_id: number;
  appointment_date?: string | null;
  appointment_time?: string | null;
  service_name?: string | null;
  capture_view: CaptureView;
  body_site?: string | null;
  procedure_or_treatment?: string | null;
  image_url: string;
  analysis_mode: string;
  capture_type: string;
  created_at?: string | null;
};

export type ProgressRun = {
  id: number;
  appointment_id: number;
  analysis_mode: "RECOVERY_PROGRESS";
  status: string;
  capture_type: "BASELINE" | "COMPARISON" | string;
  current_image_url: string;
  current_capture_view: CaptureView;
  reference_run_id?: number | null;
  reference_image_url?: string | null;
  reference_capture_view?: CaptureView | null;
  reference_appointment_id?: number | null;
  reference_appointment_date?: string | null;
  appointment_date?: string | null;
  service_name?: string | null;
  clinical_context?: Record<string, unknown> | null;
  image_quality?: { usable?: boolean; issues?: string[]; note?: string | null };
  comparison_reliable?: boolean | null;
  progress_trend?: ProgressTrend | null;
  progress_summary?: string | null;
  comparison_findings?: ProgressFinding[];
  red_flags?: string[];
  limitations?: string[];
  review_status?: string | null;
  reviewed_at?: string | null;
  model_provider?: string | null;
  model_id?: string | null;
  pipeline_version?: string | null;
  latency_ms?: number | null;
  created_at?: string | null;
};

export type ProgressInput = {
  captureView: CaptureView;
  bodySite?: string;
  procedureOrTreatment: string;
  daysSinceProcedure?: number | null;
  doctorObservation?: string;
};

const appendOptional = (formData: FormData, key: string, value?: string | number | null) => {
  if (value === undefined || value === null || String(value).trim() === "") return;
  formData.append(key, String(value).trim());
};

async function progressFetch<T>(url: string, formData: FormData): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!response.ok) {
    let message = "Progress request failed.";
    try {
      const payload = await response.json();
      message = payload.detail || payload.message || message;
    } catch {
      // Keep safe fallback.
    }
    throw new Error(typeof message === "string" ? message : "Progress request failed.");
  }
  return response.json() as Promise<T>;
}

export async function saveProgressBaseline(
  appointmentId: number,
  file: File,
  input: ProgressInput
) {
  validateAiImageFile(file);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("capture_view", input.captureView);
  formData.append("procedure_or_treatment", input.procedureOrTreatment.trim());
  appendOptional(formData, "body_site", input.bodySite);
  appendOptional(formData, "doctor_observation", input.doctorObservation);
  return progressFetch<{ message: string; progress: ProgressRun }>(
    `${API_BASE_URL}/ai/progress/baseline/${appointmentId}`,
    formData
  );
}

export async function analyzeRecoveryProgress(
  appointmentId: number,
  referenceRunId: number,
  file: File,
  input: ProgressInput
) {
  validateAiImageFile(file);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("reference_run_id", String(referenceRunId));
  formData.append("capture_view", input.captureView);
  formData.append("procedure_or_treatment", input.procedureOrTreatment.trim());
  appendOptional(formData, "body_site", input.bodySite);
  appendOptional(formData, "days_since_procedure", input.daysSinceProcedure);
  appendOptional(formData, "doctor_observation", input.doctorObservation);
  return progressFetch<{ message: string; progress: ProgressRun }>(
    `${API_BASE_URL}/ai/progress/${appointmentId}`,
    formData
  );
}

export async function getProgressReferenceOptions(appointmentId: number) {
  return apiFetch<ProgressReferenceOption[]>(`/ai/progress/reference-options/${appointmentId}`);
}

export async function getProgressHistory(appointmentId: number) {
  return apiFetch<ProgressRun[]>(`/ai/progress/history/${appointmentId}`);
}

export async function reviewProgressRun(runId: number) {
  return apiFetch<{ message: string; progress: ProgressRun }>(`/ai/progress/${runId}/review`, {
    method: "PUT",
  });
}
