import { apiFetch } from "./api";

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
  created_at?: string | null;
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

export async function getDoctorDashboard() {
  return apiFetch<DashboardData>("/doctor/dashboard");
}

export async function getDoctorAppointments(status?: string) {
  const query = status && status !== "All" ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<Appointment[]>(`/doctor/appointments${query}`);
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
  return apiFetch<{ message: string; analysis: Analysis }>(`/ai/review/${analysisId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doctor_note, review_status }),
  });
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
  return apiFetch<{ message: string; follow_up: FollowUp }>("/doctor/follow-ups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateDoctorFollowUp(
  followUpId: number,
  payload: Partial<Pick<FollowUp, "follow_up_date" | "reason" | "notes" | "status">>
) {
  return apiFetch<{ message: string; follow_up: FollowUp }>(`/doctor/follow-ups/${followUpId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getDoctorSettings() {
  return apiFetch<DoctorSettings>("/doctor/settings");
}

export async function updateDoctorSettings(payload: Partial<DoctorSettings>) {
  return apiFetch<{ message: string; user: DoctorSettings }>("/doctor/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}