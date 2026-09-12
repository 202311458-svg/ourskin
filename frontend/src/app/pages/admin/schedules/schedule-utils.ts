import type { DoctorSchedule, DoctorSchedulePayload } from "@/lib/admin-api";
import type { AdminScheduleRecord } from "@/lib/admin-schedules-api";

export type ScheduleForm = {
  id: number | null;
  doctor_id: string;
  services: string[];
  schedule_date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  consultation_mode: "In-Person" | "Online Consultation";
  unavailable_reason: string;
  schedule_note: string;
};

export type ClosureForm = {
  id: number | null;
  closure_date: string;
  reason: string;
  note: string;
};

export const UNAVAILABLE_REASONS = [
  "Holiday",
  "Doctor Leave",
  "Clinic Event",
  "Emergency Closure",
  "Maintenance",
  "Other",
];

export const CLINIC_START_TIME = "10:00";
export const CLINIC_END_TIME = "19:00";
export const SCHEDULE_INTERVAL_MINUTES = 30;
export const CLINIC_TIME_ZONE =
  process.env.NEXT_PUBLIC_CLINIC_TIMEZONE?.trim() || "Asia/Manila";

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function generateTimeOptions(start: string, end: string, intervalMinutes: number) {
  const options: string[] = [];
  for (
    let current = timeToMinutes(start);
    current <= timeToMinutes(end);
    current += intervalMinutes
  ) {
    options.push(minutesToTime(current));
  }
  return options;
}

export const TIME_OPTIONS = generateTimeOptions(
  CLINIC_START_TIME,
  CLINIC_END_TIME,
  SCHEDULE_INTERVAL_MINUTES
);

export function getClinicNowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

export function isSunday(dateString?: string | null) {
  if (!dateString) return false;
  const date = new Date(`${dateString}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.getDay() === 0;
}

export function isPastDate(dateString?: string | null) {
  if (!dateString) return false;
  return dateString < getClinicNowParts().date;
}

export function isPastSchedule(dateString?: string | null, startTime?: string | null) {
  if (!dateString || !startTime) return false;
  const now = getClinicNowParts();
  if (dateString < now.date) return true;
  if (dateString > now.date) return false;
  return startTime <= now.time;
}

export function getAvailableStartTimes(dateString: string) {
  return TIME_OPTIONS.filter(
    (value, index) =>
      index < TIME_OPTIONS.length - 1 && !isPastSchedule(dateString, value)
  );
}

export function getAvailableEndTimes(startTime: string) {
  return TIME_OPTIONS.filter((value) => value > startTime);
}

export function getDefaultScheduleDate() {
  const now = getClinicNowParts();
  let candidate = new Date(`${now.date}T00:00:00`);
  for (let offset = 0; offset < 8; offset += 1) {
    const value = toDateInput(candidate);
    if (!isSunday(value) && getAvailableStartTimes(value).length > 0) return value;
    candidate.setDate(candidate.getDate() + 1);
  }
  return now.date;
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createEmptyScheduleForm(): ScheduleForm {
  const scheduleDate = getDefaultScheduleDate();
  const startTime = getAvailableStartTimes(scheduleDate)[0] || CLINIC_START_TIME;
  const endTime = getAvailableEndTimes(startTime)[0] || CLINIC_END_TIME;
  return {
    id: null,
    doctor_id: "",
    services: [],
    schedule_date: scheduleDate,
    start_time: startTime,
    end_time: endTime,
    is_available: true,
    consultation_mode: "In-Person",
    unavailable_reason: "",
    schedule_note: "",
  };
}

export function scheduleToForm(schedule: AdminScheduleRecord): ScheduleForm {
  return {
    id: schedule.id,
    doctor_id: String(schedule.doctor_id),
    services: schedule.services
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    schedule_date: schedule.schedule_date,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    is_available: schedule.is_available,
    consultation_mode:
      schedule.consultation_mode === "Online Consultation"
        ? "Online Consultation"
        : "In-Person",
    unavailable_reason: schedule.unavailable_reason || "",
    schedule_note: schedule.schedule_note || "",
  };
}

export function scheduleFormToPayload(form: ScheduleForm): DoctorSchedulePayload {
  return {
    doctor_id: Number(form.doctor_id),
    services: form.services.join(", "),
    schedule_date: form.schedule_date,
    start_time: form.start_time,
    end_time: form.end_time,
    is_available: form.is_available,
    consultation_mode: form.consultation_mode,
    unavailable_reason: form.is_available ? null : form.unavailable_reason,
    schedule_note: form.schedule_note.trim() || null,
  };
}

export function formatDate(value?: string | null) {
  if (!value) return "No date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(value?: string | null) {
  if (!value) return "";
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function getScheduleStatus(schedule: DoctorSchedule) {
  if (!schedule.is_available) {
    return { label: "Unavailable", tone: "warning" as const };
  }
  if (isPastSchedule(schedule.schedule_date, schedule.start_time)) {
    return { label: "Past", tone: "neutral" as const };
  }
  return { label: "Available", tone: "success" as const };
}
