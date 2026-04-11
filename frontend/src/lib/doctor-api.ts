import { apiFetch, API_BASE_URL, getAuthHeaders } from "./api";

export type Appointment = {
  id: number;
  patient_id?: number | null;
  doctor_id?: number | null;
  patient_name: string;
  patient_email: string;
  doctor_name: string;
  date: string;
  time: string;
  services: string;
  status: string;
  cancel_reason?: string | null;
};

export type AppointmentLog = {
  id: number;
  appointment_id: number;
  action: string;
  performed_by_id: number | null;
  performed_by_name: string;
  performed_by_role: string;
  reason: string | null;
  created_at: string | null;
};

export type Analysis = {
  id: number;
  appointment_id: number;
  uploaded_by_id?: number | null;
  image_path: string;
  condition: string;
  confidence: number;
  severity: string;
  recommendation: string;
  doctor_note?: string | null;
  review_status: string;
  reviewed_at?: string | null;
  possible_conditions?: string | null;
  key_findings?: string | null;
  treatment_suggestions?: string | null;
  prescription_suggestions?: string | null;
  follow_up_suggestions?: string | null;
  red_flags?: string | null;
  created_at?: string | null;
};

export type DiagnosisReport = {
  id: number;
  appointment_id: number;
  patient_id?: number | null;
  doctor_id?: number | null;
  skin_analysis_id?: number | null;
  doctor_final_diagnosis: string;
  doctor_prescription?: string | null;
  after_appointment_notes?: string | null;
  follow_up_plan?: string | null;
  next_visit_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DiagnosisReportResponse = {
  appointment: Appointment;
  report: DiagnosisReport;
  linked_analysis?: Analysis | null;
};

export type PatientBasic = {
  id: number;
  name: string | null;
  email: string | null;
  contact?: string | null;
};

export type DoctorBasic = {
  id: number;
  name: string;
  email: string;
};

export type PatientHistoryItem = {
  appointment: Appointment | null;
  report: DiagnosisReport;
  linked_analysis?: Analysis | null;
  doctor?: DoctorBasic | null;
};

export type AppointmentPatientHistoryResponse = {
  current_appointment: Appointment;
  patient: PatientBasic;
  previous_reports_count: number;
  previous_reports: PatientHistoryItem[];
};

export type DoctorPatientHistoryResponse = {
  patient: PatientBasic;
  total_reports: number;
  history: PatientHistoryItem[];
};

export type DoctorPatientListItem = {
  patient: PatientBasic;
  latest_report: DiagnosisReport;
  latest_appointment: Appointment | null;
  total_reports: number;
};

export type FollowUp = {
  id: number;
  appointment_id: number;
  patient_id: number;
  doctor_id: number;
  doctor_name?: string | null;
  follow_up_date: string;
  reason: string;
  notes?: string | null;
  status: string;
  created_at?: string | null;
};

export type DoctorSettings = {
  id: number;
  name: string;
  email: string;
  contact?: string | null;
  profile_image?: string | null;
  specialty?: string | null;
  availability?: string | null;
  bio?: string | null;
};

export type DashboardData = {
  stats: {
    todays_appointments: number;
    pending_ai_reviews: number;
    follow_ups_due: number;
    completed_today: number;
  };
  todays_schedule: Appointment[];
  ai_queue: Analysis[];
  recent_records: Appointment[];
  urgent_cases: Analysis[];
};

export type PatientRecord = {
  appointment: Appointment;
  analyses: Analysis[];
};

export type CompleteDiagnosisPayload = {
  skin_analysis_id?: number | null;
  doctor_final_diagnosis: string;
  doctor_prescription?: string;
  after_appointment_notes?: string;
  follow_up_plan?: string;
  next_visit_date?: string | null;
};

export async function getDoctorDashboard() {
  return apiFetch<DashboardData>("/doctor/dashboard");
}

export async function getDoctorAppointments(status?: string) {
  const query =
    status && status !== "All" ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<Appointment[]>(`/doctor/appointments${query}`);
}

export async function getAppointmentById(appointmentId: number) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}`);
}

export async function getAppointmentLogs(appointmentId: number) {
  return apiFetch<AppointmentLog[]>(`/appointments/${appointmentId}/logs`);
}

export async function analyzeAppointmentSkin(
  appointmentId: number,
  file: File,
  doctorNote?: string
) {
  const formData = new FormData();
  formData.append("file", file);

  if (doctorNote && doctorNote.trim()) {
    formData.append("doctor_note", doctorNote.trim());
  }

  const res = await fetch(`${API_BASE_URL}/ai/analyze/${appointmentId}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!res.ok) {
    let message = "Failed to analyze skin image";
    try {
      const data = await res.json();
      message = data.detail || data.message || message;
    } catch {
      //
    }
    throw new Error(message);
  }

  return res.json();
}

export async function getAppointmentAnalyses(appointmentId: number) {
  return apiFetch<Analysis[]>(`/ai/appointment/${appointmentId}`);
}

export async function getAppointmentDiagnosisReport(appointmentId: number) {
  return apiFetch<DiagnosisReportResponse>(
    `/doctor/appointments/${appointmentId}/diagnosis-report`
  );
}

export async function getAppointmentPatientHistory(appointmentId: number) {
  return apiFetch<AppointmentPatientHistoryResponse>(
    `/doctor/appointments/${appointmentId}/patient-history`
  );
}

export async function completeDoctorAppointmentWithReport(
  appointmentId: number,
  payload: CompleteDiagnosisPayload
) {
  return apiFetch<{
    message: string;
    appointment: Appointment;
    report: DiagnosisReport;
    linked_analysis?: Analysis | null;
  }>(`/doctor/appointments/${appointmentId}/complete-with-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function cancelDoctorAppointment(
  appointmentId: number,
  cancel_reason: string
) {
  return apiFetch<{ message: string; appointment: Appointment }>(
    `/appointments/${appointmentId}/status`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "Cancelled",
        cancel_reason,
      }),
    }
  );
}

export async function updateDoctorAppointmentStatus(
  appointmentId: number,
  status: string,
  cancel_reason?: string
) {
  return apiFetch<{ message: string; appointment: Appointment }>(
    `/doctor/appointments/${appointmentId}/status`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, cancel_reason }),
    }
  );
}

export async function getDoctorPatients() {
  return apiFetch<DoctorPatientListItem[]>("/doctor/patients");
}

export async function getDoctorPatientHistory(patientId: number) {
  return apiFetch<DoctorPatientHistoryResponse>(
    `/doctor/patients/${patientId}/history`
  );
}


export async function getDoctorAiCases(reviewStatus?: string) {
  const query =
    reviewStatus && reviewStatus !== "All"
      ? `?review_status=${encodeURIComponent(reviewStatus)}`
      : "";
  return apiFetch<Analysis[]>(`/doctor/ai-cases${query}`);
}

export async function reviewAnalysis(
  analysisId: number,
  doctor_note: string,
  review_status: string
) {
  return apiFetch<{ message: string; analysis: Analysis }>(
    `/ai/review/${analysisId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctor_note, review_status }),
    }
  );
}

export async function getDoctorPatientRecords() {
  return apiFetch<PatientRecord[]>("/doctor/patient-records");
}

export async function getDoctorFollowUps() {
  return apiFetch<FollowUp[]>("/doctor/follow-ups");
}

export async function createDoctorFollowUp(payload: {
  appointment_id: number;
  follow_up_date: string;
  reason: string;
  notes?: string;
}) {
  return apiFetch<{ message: string; follow_up: FollowUp }>(
    "/doctor/follow-ups",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

export async function updateDoctorFollowUp(
  followUpId: number,
  payload: Partial<Pick<FollowUp, "follow_up_date" | "reason" | "notes" | "status">>
) {
  return apiFetch<{ message: string; follow_up: FollowUp }>(
    `/doctor/follow-ups/${followUpId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

export async function getDoctorSettings() {
  return apiFetch<DoctorSettings>("/doctor/settings");
}

export async function updateDoctorSettings(payload: Partial<DoctorSettings>) {
  return apiFetch<{ message: string; user: DoctorSettings }>(
    "/doctor/settings",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}