import type { AdminAppointment } from "@/lib/admin-api";

export type ModalAction = "decline" | "cancel" | "no-show";
export type ManualConsultationMode = "In-Person" | "Online Consultation";
export type AppointmentBadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

export const TIME_OPTIONS = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
];

export function normalizeStatus(status?: string | null) {
  return (status || "").trim().toLowerCase();
}

export function formatStatus(status?: string | null) {
  if (!status) return "N/A";

  return status
    .replaceAll("-", " ")
    .split(" ")
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1).toLowerCase())
    .join(" ");
}

export function getStatusTone(status?: string | null): AppointmentBadgeTone {
  const value = normalizeStatus(status);
  if (value === "approved") return "success";
  if (value === "pending") return "warning";
  if (value === "completed") return "info";
  if (["declined", "cancelled", "canceled", "no-show"].includes(value)) return "danger";
  return "neutral";
}

export function formatDate(dateString?: string | null) {
  if (!dateString) return "To be scheduled";

  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatTime(timeString?: string | null) {
  if (!timeString) return "";

  const [hourText, minuteText] = timeString.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return timeString;

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatSchedule(
  date?: string | null,
  time?: string | null,
  endTime?: string | null
) {
  if (!date && !time) return "To be scheduled";

  const dateText = formatDate(date);
  const startText = formatTime(time);
  const endText = formatTime(endTime);

  if (!startText) return dateText;
  return `${dateText} • ${startText}${endText ? ` - ${endText}` : ""}`;
}

export function getTodayInputDate() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - timezoneOffset).toISOString().split("T")[0];
}

export function addDaysToInputDate(days: number) {
  const today = new Date();
  today.setDate(today.getDate() + days);
  const timezoneOffset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - timezoneOffset).toISOString().split("T")[0];
}

export function getGuardianName(appointment: AdminAppointment) {
  return [appointment.guardian_first_name, appointment.guardian_last_name]
    .filter(Boolean)
    .join(" ");
}

export function needsInitialEvaluationSchedule(appointment: AdminAppointment) {
  return (
    appointment.is_initial_evaluation_request &&
    (!appointment.doctor_id ||
      !appointment.date ||
      !appointment.time ||
      !appointment.end_time)
  );
}

export function buildDefaultApprovalInstruction(appointment: AdminAppointment) {
  const service = appointment.services || "your selected service";
  const doctor = appointment.doctor_name || "your assigned doctor";
  const date = appointment.date ? formatDate(appointment.date) : "the scheduled date";
  const start = appointment.time ? formatTime(appointment.time) : "the scheduled start time";
  const end = appointment.end_time ? formatTime(appointment.end_time) : "the scheduled end time";

  if (appointment.consultation_mode === "Online Consultation") {
    return `Your appointment for ${service} has been approved. It is scheduled on ${date} from ${start} to ${end} with ${doctor}. Please make sure you have a stable internet connection and are in a well-lit area during the consultation. The clinic will provide the consultation access details before your schedule. If you need to cancel or reschedule, please do this ahead of your appointment time through your patient portal.`;
  }

  if (
    appointment.appointment_type === "Initial Evaluation" ||
    appointment.appointment_type === "Initial Evaluation Request"
  ) {
    return `Your initial evaluation for ${service} has been approved and scheduled on ${date} from ${start} to ${end} with ${doctor}. Please arrive at least 15 minutes before your appointment. The doctor will assess your concern first before confirming the next treatment or procedure plan. Please bring a valid ID and any previous prescriptions, laboratory results, or skin-related medical records if available.`;
  }

  return `Your appointment for ${service} has been approved. It is scheduled on ${date} from ${start} to ${end} with ${doctor}. Please arrive at least 15 minutes before your scheduled time and bring a valid ID, previous prescriptions, laboratory results, or skin-related medical records if available. If you need to cancel or reschedule, please do this ahead of your appointment time through your patient portal.`;
}
