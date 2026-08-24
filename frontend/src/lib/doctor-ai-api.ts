import { API_BASE_URL, apiFetch, getAuthHeaders } from "./api";
import { validateAiImageFile, type Appointment, type DiagnosisReport } from "./doctor-api";

export type EvidenceStrength = "HIGH" | "MODERATE" | "LOW";
export type AIAnalysisStatus =
  | "COMPLETED"
  | "UNCERTAIN"
  | "INSUFFICIENT_IMAGE"
  | "OUT_OF_SCOPE"
  | "REQUIRES_DIRECT_REVIEW"
  | "FAILED";
export type ServiceCompatibilityStatus =
  | "COMPATIBLE"
  | "REVIEW_RECOMMENDED"
  | "LIKELY_DIFFERENT_CONCERN"
  | "UNABLE_TO_ASSESS"
  | "DIRECT_REVIEW_REQUIRED";
export type PregnancyStatus =
  | "UNKNOWN"
  | "NOT_APPLICABLE"
  | "NOT_PREGNANT"
  | "PREGNANT"
  | "BREASTFEEDING";

export type VisualFinding = {
  finding: string;
  location?: string | null;
  description?: string | null;
};

export type DifferentialCandidate = {
  condition_code: string;
  display_name: string;
  evidence_strength: EvidenceStrength;
  reason: string;
};

export type ServiceRecommendation = {
  service_id?: number | null;
  service_name: string;
  relationship_type: "PRIMARY" | "SECONDARY" | "REVIEW_ONLY";
  reason?: string | null;
};

export type MedicationSuggestion = {
  name_or_class: string;
  role: string;
  considerations: string[];
  requires_more_context: boolean;
};

export type ClinicalAIAnalysis = {
  kind: "clinical_run" | "legacy";
  id: number;
  appointment_id: number;
  legacy_skin_analysis_id?: number | null;
  image_asset_id?: number | null;
  image_path?: string | null;
  image_url?: string | null;
  analysis_mode?: string | null;
  status?: AIAnalysisStatus | null;
  condition?: string | null;
  primary_condition_code?: string | null;
  primary_condition_display?: string | null;
  evidence_strength?: EvidenceStrength | null;
  image_quality?: {
    usable?: boolean;
    issues?: string[];
    note?: string | null;
  } | null;
  visual_findings?: VisualFinding[];
  differentials?: DifferentialCandidate[];
  severity?: string | null;
  severity_assessment?: {
    assessable: boolean;
    level?: string | null;
    reason?: string | null;
  } | null;
  clinical_context?: Record<string, unknown> | null;
  booked_service_id?: number | null;
  booked_service_name?: string | null;
  service_compatibility?: ServiceCompatibilityStatus | null;
  compatibility_reason?: string | null;
  service_recommendations?: ServiceRecommendation[];
  medication_suggestions?: MedicationSuggestion[];
  medication_knowledge_version?: string | null;
  medication_guidance?: string | null;
  red_flags?: string[] | string | null;
  limitations?: string[];
  review_status?: string | null;
  reviewed_at?: string | null;
  model_provider?: string | null;
  model_id?: string | null;
  model_version?: string | null;
  pipeline_version?: string | null;
  taxonomy_version?: string | null;
  latency_ms?: number | null;
  created_at?: string | null;
  completed_at?: string | null;
  // Legacy-only fields retained for historical records.
  confidence?: number | null;
  recommendation?: string | null;
  possible_conditions?: string | null;
  key_findings?: string | null;
  treatment_suggestions?: string | null;
  prescription_suggestions?: string | null;
  follow_up_suggestions?: string | null;
};

export type ClinicalAnalysisInput = {
  bodySite?: string;
  duration?: string;
  symptoms?: string;
  progression?: string;
  doctorObservation?: string;
  knownAllergies?: string;
  currentMedications?: string;
  pregnancyStatus?: PregnancyStatus;
  medicationContextReviewed?: boolean;
};

export type M4Appointment = Appointment & {
  service_id?: number | null;
  concern?: string | null;
  patient_age?: number | null;
  patient_age_label?: string | null;
  appointment_type?: string | null;
  consultation_mode?: string | null;
  is_initial_evaluation_request?: boolean;
};

export type M4DiagnosisReport = DiagnosisReport & {
  ai_analysis_run_id?: number | null;
};

export type M4DiagnosisReportResponse = {
  appointment: M4Appointment;
  report: M4DiagnosisReport;
  linked_analysis?: ClinicalAIAnalysis | null;
};

export async function analyzeClinicalAppointment(
  appointmentId: number,
  file: File,
  input: ClinicalAnalysisInput
) {
  validateAiImageFile(file);
  const formData = new FormData();
  formData.append("file", file);

  const entries: Array<[string, string | undefined]> = [
    ["body_site", input.bodySite],
    ["duration", input.duration],
    ["symptoms", input.symptoms],
    ["progression", input.progression],
    ["doctor_observation", input.doctorObservation],
    ["known_allergies", input.knownAllergies],
    ["current_medications", input.currentMedications],
    ["pregnancy_status", input.pregnancyStatus || "UNKNOWN"],
  ];

  entries.forEach(([key, value]) => {
    if (value && value.trim()) formData.append(key, value.trim());
  });
  formData.append(
    "medication_context_reviewed",
    input.medicationContextReviewed ? "true" : "false"
  );

  const response = await fetch(`${API_BASE_URL}/ai/analyze/${appointmentId}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    let message = "Failed to analyze skin image.";
    try {
      const payload = await response.json();
      message = payload.detail || payload.message || message;
    } catch {
      // Use safe fallback.
    }
    throw new Error(typeof message === "string" ? message : "Failed to analyze skin image.");
  }

  return response.json() as Promise<{
    status: string;
    message: string;
    analysis: ClinicalAIAnalysis;
  }>;
}

export async function getClinicalAppointmentAnalyses(appointmentId: number) {
  return apiFetch<ClinicalAIAnalysis[]>(`/ai/appointment/${appointmentId}`);
}

export async function getClinicalDiagnosisReport(appointmentId: number) {
  return apiFetch<M4DiagnosisReportResponse>(
    `/doctor/appointments/${appointmentId}/diagnosis-report`
  );
}

export async function completeClinicalDoctorAssessment(
  appointmentId: number,
  payload: {
    ai_analysis_run_id?: number | null;
    skin_analysis_id?: number | null;
    doctor_final_diagnosis: string;
    doctor_prescription?: string;
    after_appointment_notes?: string;
    follow_up_plan?: string;
    next_visit_date?: string | null;
  }
) {
  return apiFetch<{
    message: string;
    appointment: M4Appointment;
    report: M4DiagnosisReport;
    linked_analysis?: ClinicalAIAnalysis | null;
  }>(`/doctor/appointments/${appointmentId}/complete-with-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
