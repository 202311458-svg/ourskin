import { apiFetch } from "@/lib/api";

export type AdminDashboardStats = {
  total_users: number;
  total_patients: number;
  total_staff: number;
  total_doctors: number;
  total_appointments: number;
  pending_appointments: number;
  approved_appointments: number;
  total_ai_logs: number;
};

export type AppointmentStatus =
  | "Pending"
  | "Approved"
  | "Declined"
  | "Cancelled"
  | "Completed"
  | "No-Show";

export type AdminAppointment = {
  id: number;

  patient_id?: number | null;
  doctor_id?: number | null;
  schedule_id?: number | null;
  service_id?: number | null;

  patient_name: string;
  patient_email: string;
  patient_contact?: string | null;
  patient_address?: string | null;
  patient_age?: number | null;
  patient_age_label?: string | null;

  is_minor?: boolean;
  guardian_first_name?: string | null;
  guardian_last_name?: string | null;
  guardian_relationship?: string | null;
  guardian_contact?: string | null;
  guardian_email?: string | null;
  guardian_consent?: boolean;

  doctor_name?: string | null;

  date?: string | null;
  time?: string | null;
  end_time?: string | null;
  services: string;

  appointment_type: string;
  consultation_mode: string;
  concern?: string | null;
  is_initial_evaluation_request: boolean;

  status: AppointmentStatus | string;
  cancel_reason?: string | null;

  patient_instruction?: string | null;
  approval_email_sent?: boolean;
  approval_email_sent_at?: string | null;
};

export type AppointmentStatusPayload = {
  status: AppointmentStatus;
  cancel_reason?: string | null;
  patient_instruction?: string | null;
  send_email?: boolean;
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

export type AssignableDoctor = {
  id: number;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  specialty?: string | null;
  profile_image?: string | null;
  bio?: string | null;
  status?: string | null;
};

export type AssignableSlot = {
  id: string;
  slot_id: string;
  schedule_id: number;
  doctor_id: number;
  doctor_name: string;
  doctor_specialty?: string | null;
  service_id: number;
  service_name: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  consultation_mode: string;
  appointment_type: string;
  is_available: boolean;
  unavailable_reason?: string | null;
};

export type AssignSchedulePayload = {
  schedule_id?: number | null;
  doctor_id?: number | null;
  schedule_date?: string | null;
  start_time: string;
  end_time: string;
  consultation_mode?: "In-Person" | "Online Consultation";
};

export type AdminUser = {
  id: number;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  is_minor?: boolean;
  address?: string | null;

  email: string;
  contact?: string | null;
  role: string;
  is_verified: boolean;
  status?: string | null;
  created_at?: string | null;

  guardian_first_name?: string | null;
  guardian_last_name?: string | null;
  guardian_relationship?: string | null;
  guardian_contact?: string | null;
  guardian_email?: string | null;
  guardian_consent?: boolean;

  department?: string | null;
  profile_image?: string | null;
  specialty?: string | null;
  availability?: string | null;
  bio?: string | null;
};

export type AdminFollowUp = {
  id: number;
  appointment_id: number;
  appointment_services?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  appointment_end_time?: string | null;
  appointment_status?: string | null;

  patient_id: number;
  patient_name?: string | null;
  patient_email?: string | null;
  patient_contact?: string | null;
  patient_address?: string | null;

  doctor_id: number;
  doctor_name?: string | null;

  follow_up_date: string;
  reason: string;
  notes?: string | null;
  status: "Scheduled" | "Completed" | "Cancelled" | string;
  created_at?: string | null;
};

export type AdminAiLog = {
  id: number;
  user_id?: number | null;
  appointment_id?: number | null;
  diagnosis_report_id?: number | null;

  patient_name: string;
  patient_email: string;
  doctor_name: string;

  condition: string;
  confidence?: number | null;
  severity: string;
  recommendation?: string | null;

  possible_conditions?: string | null;
  key_findings?: string | null;
  treatment_suggestions?: string | null;
  prescription_suggestions?: string | null;
  follow_up_suggestions?: string | null;
  red_flags?: string | null;

  doctor_note?: string | null;
  review_status: string;
  reviewed_at?: string | null;

  final_diagnosis?: string | null;
  doctor_final_diagnosis?: string | null;
  doctor_prescription?: string | null;
  prescription?: string | null;
  doctor_notes?: string | null;
  after_appointment_notes?: string | null;
  follow_up_plan?: string | null;
  next_visit_date?: string | null;

  created_at?: string | null;
};

export type AuditLog = {
  id: number;
  action: string;
  description?: string | null;
  actor_id?: number | null;
  actor_name?: string | null;
  target_id?: number | null;
  target_name?: string | null;
  created_at?: string | null;
};

export async function getAdminDashboard() {
  return apiFetch<AdminDashboardStats>("/admin/dashboard");
}

export async function getAdminUsers() {
  return apiFetch<AdminUser[]>("/admin/users");
}

export async function getAdminAppointments() {
  return apiFetch<AdminAppointment[]>("/admin/appointments");
}

export async function getAppointmentById(appointmentId: number) {
  return apiFetch<AdminAppointment>(`/appointments/${appointmentId}`);
}

export async function updateAppointmentStatus(
  appointmentId: number,
  payload: AppointmentStatusPayload
) {
  return apiFetch<{
    message: string;
    email_warning?: string | null;
    appointment: AdminAppointment;
  }>(`/appointments/${appointmentId}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getAppointmentLogs(appointmentId: number) {
  return apiFetch<AppointmentLog[]>(`/appointments/${appointmentId}/logs`);
}

export async function getAssignableInitialEvaluationDoctors(
  appointmentId: number
) {
  return apiFetch<AssignableDoctor[]>(
    `/appointments/${appointmentId}/assignable-doctors`
  );
}

export async function getAssignableInitialEvaluationSlots(
  appointmentId: number,
  params?: {
    doctor_id?: number;
    week_start?: string;
  }
) {
  const search = new URLSearchParams();

  if (params?.doctor_id) search.set("doctor_id", String(params.doctor_id));
  if (params?.week_start) search.set("week_start", params.week_start);

  const query = search.toString();

  return apiFetch<AssignableSlot[]>(
    `/appointments/${appointmentId}/assignable-slots${query ? `?${query}` : ""}`
  );
}

export async function assignInitialEvaluationSchedule(
  appointmentId: number,
  payload: AssignSchedulePayload
) {
  return apiFetch<{
    message: string;
    appointment: AdminAppointment;
  }>(`/appointments/${appointmentId}/assign-schedule`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getAdminFollowUps() {
  return apiFetch<AdminFollowUp[]>("/staff/follow-ups");
}

export async function updateAdminFollowUp(
  followUpId: number,
  payload: Partial<
    Pick<AdminFollowUp, "follow_up_date" | "reason" | "notes" | "status">
  >
) {
  return apiFetch<{
    message: string;
    follow_up: AdminFollowUp;
  }>(`/staff/follow-ups/${followUpId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getAdminAiLogs() {
  return apiFetch<AdminAiLog[]>("/admin/ai-logs");
}

export async function getAdminAuditLogs() {
  return apiFetch<AuditLog[]>("/admin/audit-logs");
}

export type AdminDoctor = {
  id: number;
  name: string;
  email: string;
  specialty?: string | null;
  availability?: string | null;
  status?: string | null;
};

export type AdminService = {
  id: number;
  name: string;
  description?: string | null;
  requires_initial_evaluation: boolean;
  is_active: boolean;
};

export type DoctorSchedule = {
  id: number;
  doctor_id: number;
  doctor_name: string;
  services: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  consultation_mode: "In-Person" | "Online Consultation" | string;
  unavailable_reason?: string | null;
  schedule_note?: string | null;
  created_by_staff_id?: number | null;
  created_by_staff_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DoctorSchedulePayload = {
  doctor_id: number;
  services: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  consultation_mode: "In-Person" | "Online Consultation";
  unavailable_reason?: string | null;
  schedule_note?: string | null;
};

export type ClinicUnavailableDate = {
  id: number;
  closure_date: string;
  reason: string;
  note?: string | null;
  created_by_staff_id?: number | null;
  created_by_staff_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ClinicUnavailableDatePayload = {
  closure_date: string;
  reason: string;
  note?: string | null;
};

export async function getAdminDoctors() {
  return apiFetch<AdminDoctor[]>("/staff/doctors");
}

export async function getAdminServices() {
  return apiFetch<AdminService[]>("/staff/services");
}

export async function getAdminDoctorSchedules() {
  return apiFetch<DoctorSchedule[]>("/staff/doctor-schedules");
}

export async function createAdminDoctorSchedule(payload: DoctorSchedulePayload) {
  return apiFetch<DoctorSchedule>("/staff/doctor-schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateAdminDoctorSchedule(
  scheduleId: number,
  payload: Partial<DoctorSchedulePayload>
) {
  return apiFetch<DoctorSchedule>(`/staff/doctor-schedules/${scheduleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminDoctorSchedule(scheduleId: number) {
  return apiFetch<{ message: string }>(`/staff/doctor-schedules/${scheduleId}`, {
    method: "DELETE",
  });
}

export async function getAdminClinicUnavailableDates() {
  return apiFetch<ClinicUnavailableDate[]>("/staff/clinic-unavailable-dates");
}

export async function createAdminClinicUnavailableDate(
  payload: ClinicUnavailableDatePayload
) {
  return apiFetch<ClinicUnavailableDate>("/staff/clinic-unavailable-dates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateAdminClinicUnavailableDate(
  closureId: number,
  payload: Partial<ClinicUnavailableDatePayload>
) {
  return apiFetch<ClinicUnavailableDate>(
    `/staff/clinic-unavailable-dates/${closureId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteAdminClinicUnavailableDate(closureId: number) {
  return apiFetch<{ message: string }>(
    `/staff/clinic-unavailable-dates/${closureId}`,
    {
      method: "DELETE",
    }
  );
}
