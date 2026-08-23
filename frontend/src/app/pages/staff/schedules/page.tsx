"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiRequest } from "@/lib/api";
import { printHtmlDocument } from "@/lib/printExport";
import PageShell from "@/app/components/portal/ui/PageShell";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import staffStyles from "./page.module.css";
import styles from "./schedules.module.css";

type Doctor = {
  id: number;
  name: string;
  email: string;
  specialty?: string | null;
  availability?: string | null;
  status?: string | null;
};

type Service = {
  id: number;
  name: string;
  description?: string | null;
  requires_initial_evaluation: boolean;
  is_active: boolean;
};

type DoctorSchedule = {
  id: number;
  doctor_id: number;
  doctor_name: string;
  services: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  consultation_mode?: string | null;
  unavailable_reason?: string | null;
  schedule_note?: string | null;
};

type ClinicUnavailableDate = {
  id: number;
  closure_date: string;
  reason: string;
  note?: string | null;
};

type AppointmentSummary = {
  id: number;
  date?: string | null;
  status?: string | null;
};

type ScheduleForm = {
  doctor_id: string;
  selected_services: string[];
  schedule_date: string;
  start_time: string;
  end_time: string;
  consultation_mode: string;
  schedule_note: string;
};

type ClinicClosureForm = {
  closure_date: string;
  reason: string;
  note: string;
};

type WizardStep = "doctor" | "services" | "time" | "review" | "closure";
type ScreenMode = "calendar" | "workflow";
type DataIssueKey = "doctors" | "schedules" | "closures" | "appointments";
type DataIssues = Partial<Record<DataIssueKey, string>>;

type CalendarDay = {
  dateValue: string;
  dayNumber: number;
  isBlank: boolean;
  schedules: DoctorSchedule[];
};

const initialDoctorForm: ScheduleForm = {
  doctor_id: "",
  selected_services: [],
  schedule_date: "",
  start_time: "",
  end_time: "",
  consultation_mode: "In-Person",
  schedule_note: "",
};

const initialClinicClosureForm: ClinicClosureForm = {
  closure_date: "",
  reason: "",
  note: "",
};

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const clinicUnavailableReasons = [
  "Holiday",
  "Doctor Leave",
  "Clinic Event",
  "Emergency Closure",
  "Maintenance",
  "Other",
];

const clinicStartTime = "10:00";
const clinicEndTime = "19:00";
const scheduleIntervalMinutes = 30;
const clinicTimeZone = process.env.NEXT_PUBLIC_CLINIC_TIMEZONE?.trim() || "Asia/Manila";

const wizardSteps = [
  { key: "doctor" as const, label: "Doctor" },
  { key: "services" as const, label: "Services" },
  { key: "time" as const, label: "Time" },
  { key: "review" as const, label: "Review" },
];

function getClinicNowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: clinicTimeZone,
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

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function isSunday(value: string) {
  return Boolean(value) && parseDateOnly(value).getDay() === 0;
}

function isPastDate(value: string, todayValue: string) {
  return Boolean(value) && value < todayValue;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function generateTimeOptions(startTime: string, endTime: string, intervalMinutes: number) {
  const options: string[] = [];
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  for (let current = start; current <= end; current += intervalMinutes) {
    options.push(minutesToTime(current));
  }
  return options;
}

const timeOptions = generateTimeOptions(clinicStartTime, clinicEndTime, scheduleIntervalMinutes);

function isPastStartTime(dateValue: string, startTime: string) {
  if (!dateValue || !startTime) return false;
  const clinicNow = getClinicNowParts();
  if (dateValue < clinicNow.date) return true;
  if (dateValue > clinicNow.date) return false;
  return startTime <= clinicNow.time;
}

function getAvailableStartTimeOptions(dateValue: string) {
  return timeOptions.filter(
    (option, index) => index < timeOptions.length - 1 && !isPastStartTime(dateValue, option)
  );
}

function getAvailableEndTimeOptions(startTime: string) {
  if (!startTime) return [];
  return timeOptions.filter((option) => option > startTime);
}

function getDefaultStartTime(dateValue: string) {
  return getAvailableStartTimeOptions(dateValue)[0] || "";
}

function getDefaultEndTime(startTime: string) {
  return getAvailableEndTimeOptions(startTime)[0] || "";
}

function isThirtyMinuteTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const minute = Number(value.slice(3, 5));
  return minute === 0 || minute === 30;
}

function isInsideClinicHours(startTime: string, endTime: string) {
  return startTime >= clinicStartTime && startTime < clinicEndTime && endTime > clinicStartTime && endTime <= clinicEndTime;
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && endA > startB;
}

function formatReadableDate(value: string) {
  if (!value) return "Select a date";
  return parseDateOnly(value).toLocaleDateString("en-PH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCompactDate(value: string) {
  if (!value) return "";
  return parseDateOnly(value).toLocaleDateString("en-PH", { day: "numeric", month: "short" });
}

function formatTime(value: string) {
  if (!value) return "";
  const [hour, minute] = value.split(":");
  const date = new Date();
  date.setHours(Number(hour), Number(minute), 0, 0);
  return date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
}

function stripDoctorTitle(name: string) {
  return (name || "").replace(/^dr\.?\s+/i, "").trim();
}

function getInitials(name: string) {
  const words = stripDoctorTitle(name).split(/\s+/).filter(Boolean);
  if (words.length === 0) return "DR";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function getShortDoctorName(name: string) {
  const cleanedName = (name || "").trim();
  if (!cleanedName) return "Doctor";
  return /^dr\.?\s/i.test(cleanedName) ? cleanedName : `Dr. ${cleanedName}`;
}

function getCalendarDoctorInfo(daySchedules: DoctorSchedule[]) {
  const uniqueDoctors = Array.from(
    new Map(daySchedules.map((schedule) => [schedule.doctor_id, schedule.doctor_name])).entries()
  ).map(([id, name]) => ({ id, name, cleanName: stripDoctorTitle(name) }));

  const firstNameCounts = new Map<string, number>();
  uniqueDoctors.forEach((doctor) => {
    const firstName = doctor.cleanName.split(/\s+/).filter(Boolean)[0] || "Doctor";
    const key = firstName.toLowerCase();
    firstNameCounts.set(key, (firstNameCounts.get(key) || 0) + 1);
  });

  const labels = uniqueDoctors.map((doctor) => {
    const words = doctor.cleanName.split(/\s+/).filter(Boolean);
    const firstName = words[0] || "Doctor";
    const duplicateFirstName = (firstNameCounts.get(firstName.toLowerCase()) || 0) > 1;
    const compactName = duplicateFirstName && words.length > 1
      ? `${firstName} ${words[words.length - 1][0]}.`
      : firstName;
    return `Dr. ${compactName}`;
  });

  return {
    labels,
    fullNames: uniqueDoctors.map((doctor) => getShortDoctorName(doctor.name)),
    doctorCount: uniqueDoctors.length,
  };
}

function getScheduleMode(schedule: DoctorSchedule) {
  return schedule.consultation_mode || "In-Person";
}

function splitServices(value: string) {
  return (value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function servicesToString(services: string[]) {
  return services.map((service) => service.trim()).filter(Boolean).join(", ");
}

function extractArray<T>(data: unknown, keys: string[] = []): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
  }
  return [];
}

function getApiErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    if (typeof record.message === "string") return record.message;
  }
  return fallback;
}

function normaliseService(service: Partial<Service>, index: number): Service | null {
  const name = String(service.name || "").trim();
  if (!name) return null;
  return {
    id: Number(service.id || index + 1),
    name,
    description: service.description || null,
    requires_initial_evaluation: Boolean(service.requires_initial_evaluation),
    is_active: service.is_active !== false,
  };
}

function getSelectedWeekRange(dateValue: string) {
  const selected = parseDateOnly(dateValue);
  const day = selected.getDay();
  // Sunday is the clinic's closed day, so treat it as the boundary before the
  // upcoming Monday-Saturday scheduling week rather than the week that ended.
  const daysFromMonday = day === 0 ? 1 : 1 - day;
  const weekStart = new Date(selected);
  weekStart.setDate(selected.getDate() + daysFromMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 5);
  return { weekStart: toDateInputValue(weekStart), weekEnd: toDateInputValue(weekEnd) };
}

function isActiveAppointment(status?: string | null) {
  const normalized = (status || "").trim().toLowerCase();
  return !["cancelled", "canceled", "declined", "completed", "no-show", "no show"].includes(normalized);
}

export default function StaffSchedulesPage() {
  const todayValue = useMemo(() => getClinicNowParts().date, []);
  const todayDate = useMemo(() => parseDateOnly(todayValue), [todayValue]);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [clinicUnavailableDates, setClinicUnavailableDates] = useState<ClinicUnavailableDate[]>([]);
  const [confirmedAppointments, setConfirmedAppointments] = useState<AppointmentSummary[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const [calendarDateChosen, setCalendarDateChosen] = useState(false);
  const [screenMode, setScreenMode] = useState<ScreenMode>("calendar");
  const [filterDoctor, setFilterDoctor] = useState("all");
  const [wizardStep, setWizardStep] = useState<WizardStep>("doctor");
  const [form, setForm] = useState<ScheduleForm>(() => {
    const defaultStart = getDefaultStartTime(todayValue);
    return {
      ...initialDoctorForm,
      schedule_date: todayValue,
      start_time: defaultStart,
      end_time: getDefaultEndTime(defaultStart),
    };
  });
  const [clinicClosureForm, setClinicClosureForm] = useState<ClinicClosureForm>({
    ...initialClinicClosureForm,
    closure_date: todayValue,
  });
  const [editingDoctorScheduleId, setEditingDoctorScheduleId] = useState<number | null>(null);
  const [editingClinicClosureId, setEditingClinicClosureId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [serviceWarning, setServiceWarning] = useState("");
  const [dependencyNotice, setDependencyNotice] = useState("");
  const [dataIssues, setDataIssues] = useState<DataIssues>({});
  const [lastSavedSchedule, setLastSavedSchedule] = useState<{ doctor: string; date: string } | null>(null);
  const workflowRef = useRef<HTMLElement | null>(null);

  const fetchDoctors = useCallback(async () => {
    const res = await apiRequest("/staff/doctors", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(getApiErrorMessage(data, "Unable to load doctors."));
    const list = extractArray<Doctor>(data, ["doctors", "users", "data", "items"]);
    setDoctors(list);
    return list;
  }, []);

  const fetchServices = useCallback(async () => {
    const endpoints = ["/staff/services", "/services", "/admin/services"];
    let lastMessage = "Unable to load services.";
    for (const endpoint of endpoints) {
      try {
        const res = await apiRequest(endpoint, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          lastMessage = getApiErrorMessage(data, lastMessage);
          continue;
        }
        const list = extractArray<Partial<Service>>(data, ["services", "data", "items", "results"])
          .map((service, index) => normaliseService(service, index))
          .filter((service): service is Service => Boolean(service));
        setServices(list.filter((service) => service.is_active));
        setServiceWarning("");
        return;
      } catch (err) {
        lastMessage = err instanceof Error ? err.message : lastMessage;
      }
    }
    setServices([]);
    setServiceWarning(`${lastMessage} Services found in saved schedules are shown as a fallback.`);
  }, []);

  const fetchSchedules = useCallback(async () => {
    const res = await apiRequest("/staff/doctor-schedules", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(getApiErrorMessage(data, "Unable to load doctor schedules."));
    const list = extractArray<DoctorSchedule>(data, ["schedules", "data", "items", "results"]);
    setSchedules(list);
    return list;
  }, []);

  const fetchClinicUnavailableDates = useCallback(async () => {
    const res = await apiRequest("/staff/clinic-unavailable-dates", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(getApiErrorMessage(data, "Unable to load clinic unavailable dates."));
    const list = extractArray<ClinicUnavailableDate>(data, ["clinic_unavailable_dates", "unavailable_dates", "data", "items", "results"]);
    setClinicUnavailableDates(list);
    return list;
  }, []);

  const fetchConfirmedAppointments = useCallback(async () => {
    const res = await apiRequest("/appointments/confirmed", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(getApiErrorMessage(data, "Unable to verify appointments for clinic closures."));
    const list = extractArray<AppointmentSummary>(data, ["appointments", "data", "items", "results"]);
    setConfirmedAppointments(list);
    return list;
  }, []);

  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    const [doctorResult, serviceResult, scheduleResult, closureResult, appointmentResult] = await Promise.allSettled([
      fetchDoctors(),
      fetchServices(),
      fetchSchedules(),
      fetchClinicUnavailableDates(),
      fetchConfirmedAppointments(),
    ]);
    const issues: DataIssues = {};
    if (doctorResult.status === "rejected") issues.doctors = doctorResult.reason instanceof Error ? doctorResult.reason.message : "Doctor data unavailable.";
    if (scheduleResult.status === "rejected") issues.schedules = scheduleResult.reason instanceof Error ? scheduleResult.reason.message : "Schedule data unavailable.";
    if (closureResult.status === "rejected") issues.closures = closureResult.reason instanceof Error ? closureResult.reason.message : "Clinic closure data unavailable.";
    if (appointmentResult.status === "rejected") issues.appointments = appointmentResult.reason instanceof Error ? appointmentResult.reason.message : "Appointment verification unavailable.";
    if (serviceResult.status === "rejected") console.error("Service loading fallback failed:", serviceResult.reason);
    setDataIssues(issues);
    setIsLoading(false);
  }, [fetchDoctors, fetchServices, fetchSchedules, fetchClinicUnavailableDates, fetchConfirmedAppointments]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  const activeDoctors = useMemo(() => doctors.filter((doctor) => {
    const status = (doctor.status || "Active").toLowerCase();
    return status === "active" && Boolean(doctor.name?.trim()) && !doctor.name.toLowerCase().includes("placeholder");
  }), [doctors]);

  const selectedDoctor = useMemo(
    () => activeDoctors.find((doctor) => doctor.id === Number(form.doctor_id)) || null,
    [activeDoctors, form.doctor_id]
  );

  const closureDateSet = useMemo(
    () => new Set(clinicUnavailableDates.map((item) => item.closure_date)),
    [clinicUnavailableDates]
  );

  const selectedClinicClosure = useMemo(
    () => clinicUnavailableDates.find((item) => item.closure_date === selectedDate) || null,
    [clinicUnavailableDates, selectedDate]
  );

  const formDateClinicClosure = useMemo(
    () => clinicUnavailableDates.find((item) => item.closure_date === form.schedule_date) || null,
    [clinicUnavailableDates, form.schedule_date]
  );

  const filteredSchedules = useMemo(() => {
    if (filterDoctor === "all") return schedules;
    return schedules.filter((schedule) => schedule.doctor_id === Number(filterDoctor));
  }, [schedules, filterDoctor]);

  const allSelectedDateSchedules = useMemo(
    () => schedules
      .filter((schedule) => schedule.schedule_date === selectedDate)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [schedules, selectedDate]
  );

  const existingScheduleForSelectedDate = allSelectedDateSchedules[0] || null;

  const existingScheduleForFormDate = useMemo(
    () => schedules.find(
      (schedule) => schedule.schedule_date === form.schedule_date && schedule.id !== editingDoctorScheduleId
    ) || null,
    [schedules, form.schedule_date, editingDoctorScheduleId]
  );

  const activeAppointmentsOnSelectedDate = useMemo(
    () => confirmedAppointments.filter(
      (appointment) => appointment.date === selectedDate && isActiveAppointment(appointment.status)
    ),
    [confirmedAppointments, selectedDate]
  );

  const selectedDateIsSunday = isSunday(selectedDate);
  const selectedDateIsPast = isPastDate(selectedDate, todayValue);
  const selectedDateIsClinicClosed = Boolean(selectedClinicClosure);
  const selectedDateHasFutureStartTimes = getAvailableStartTimeOptions(selectedDate).length > 0;
  const selectedDateTimeLocked = !selectedDateIsPast && !selectedDateHasFutureStartTimes;
  const selectedDateBlocked = selectedDateIsSunday || selectedDateIsPast || selectedDateIsClinicClosed || selectedDateTimeLocked || Boolean(dataIssues.schedules) || Boolean(dataIssues.closures);

  const derivedServices = useMemo(() => {
    const names = new Set<string>();
    schedules.forEach((schedule) => splitServices(schedule.services).forEach((serviceName) => names.add(serviceName)));
    return Array.from(names).sort((a, b) => a.localeCompare(b)).map((name, index) => ({
      id: -(index + 1),
      name,
      description: null,
      requires_initial_evaluation: false,
      is_active: true,
    }));
  }, [schedules]);

  const serviceOptions = services.length > 0 ? services : derivedServices;

  const calendarDays = useMemo<CalendarDay[]>(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: CalendarDay[] = [];

    for (let index = 0; index < firstDay.getDay(); index += 1) {
      days.push({ dateValue: "", dayNumber: 0, isBlank: true, schedules: [] });
    }
    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const dateValue = toDateInputValue(new Date(year, month, day));
      days.push({
        dateValue,
        dayNumber: day,
        isBlank: false,
        schedules: filteredSchedules.filter((schedule) => schedule.schedule_date === dateValue),
      });
    }
    return days;
  }, [calendarMonth, filteredSchedules]);

  const doctorSchedulesForFormDate = useMemo(
    () => schedules.filter(
      (schedule) =>
        schedule.schedule_date === form.schedule_date &&
        schedule.doctor_id === Number(form.doctor_id) &&
        schedule.id !== editingDoctorScheduleId
    ),
    [schedules, form.schedule_date, form.doctor_id, editingDoctorScheduleId]
  );

  const getDoctorConflict = useCallback((startTime: string, endTime: string) => {
    if (!form.doctor_id || !startTime || !endTime) return null;
    return doctorSchedulesForFormDate.find(
      (schedule) => rangesOverlap(startTime, endTime, schedule.start_time, schedule.end_time)
    ) || null;
  }, [doctorSchedulesForFormDate, form.doctor_id]);

  const availableStartOptions = useMemo(() => {
    return getAvailableStartTimeOptions(form.schedule_date).filter((startTime) =>
      getAvailableEndTimeOptions(startTime).some((endTime) => !getDoctorConflict(startTime, endTime))
    );
  }, [form.schedule_date, getDoctorConflict]);

  const availableEndOptions = useMemo(() => {
    return getAvailableEndTimeOptions(form.start_time).filter(
      (endTime) => !getDoctorConflict(form.start_time, endTime)
    );
  }, [form.start_time, getDoctorConflict]);

  const formConflict = useMemo(
    () => getDoctorConflict(form.start_time, form.end_time),
    [form.start_time, form.end_time, getDoctorConflict]
  );

  const hasUnsavedScheduleWork = Boolean(
    !lastSavedSchedule && (
      editingDoctorScheduleId ||
      form.doctor_id ||
      form.selected_services.length > 0 ||
      form.schedule_note.trim() ||
      (wizardStep !== "doctor" && wizardStep !== "closure")
    )
  );

  const hasUnsavedClosureWork = Boolean(
    wizardStep === "closure" &&
    (editingClinicClosureId || clinicClosureForm.reason || clinicClosureForm.note.trim())
  );

  const hasUnsavedWork = hasUnsavedScheduleWork || hasUnsavedClosureWork;

  const moveCalendarToDate = useCallback((dateValue: string) => {
    const date = parseDateOnly(dateValue);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, []);

  function resetFormForDate(dateValue: string) {
    const defaultStart = getDefaultStartTime(dateValue);
    setForm({
      ...initialDoctorForm,
      schedule_date: dateValue,
      start_time: defaultStart,
      end_time: getDefaultEndTime(defaultStart),
    });
    setClinicClosureForm({ ...initialClinicClosureForm, closure_date: dateValue });
    setEditingDoctorScheduleId(null);
    setEditingClinicClosureId(null);
    setWizardStep("doctor");
    setDependencyNotice("");
    setLastSavedSchedule(null);
  }

  function confirmDateChange(nextDate: string) {
    if (nextDate === selectedDate || !hasUnsavedWork) return true;
    return window.confirm("Changing the selected date will discard the unsaved scheduling choices for the current date. Continue?");
  }

  function selectDateOnCalendar(dateValue: string) {
    if (!dateValue || !confirmDateChange(dateValue)) return false;
    if (dateValue !== selectedDate) resetFormForDate(dateValue);
    setSelectedDate(dateValue);
    moveCalendarToDate(dateValue);
    setCalendarDateChosen(true);
    setMessage("");
    setError("");
    return true;
  }

  function startWorkflowForSelectedDate() {
    setError("");
    setMessage("");
    if (selectedDateBlocked) {
      setError(getSelectedDateUnavailableReason());
      return;
    }
    if (existingScheduleForSelectedDate && !editingDoctorScheduleId) {
      setMessage(`${getShortDoctorName(existingScheduleForSelectedDate.doctor_name)} is already assigned to this date. Use Edit to make changes.`);
      return;
    }
    if (lastSavedSchedule) resetFormForDate(selectedDate);
    setScreenMode("workflow");
    window.setTimeout(() => workflowRef.current?.focus({ preventScroll: false }), 60);
  }

  function returnToCalendar() {
    setScreenMode("calendar");
    setCalendarDateChosen(true);
    setError("");
    window.setTimeout(
      () => document.querySelector<HTMLButtonElement>(`[data-calendar-date="${selectedDate}"]`)?.focus(),
      60
    );
  }

  function goToPreviousMonth() {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
    setCalendarDateChosen(false);
  }

  function goToNextMonth() {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
    setCalendarDateChosen(false);
  }

  function goToToday() {
    if (!selectDateOnCalendar(todayValue)) return;
    window.setTimeout(
      () => document.querySelector<HTMLButtonElement>(`[data-calendar-date="${todayValue}"]`)?.focus(),
      60
    );
  }

  function handleCalendarKeyDown(event: KeyboardEvent<HTMLButtonElement>, dateValue: string) {
    const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -7 : event.key === "ArrowDown" ? 7 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = parseDateOnly(dateValue);
    next.setDate(next.getDate() + delta);
    const nextValue = toDateInputValue(next);
    if (!selectDateOnCalendar(nextValue)) return;
    window.setTimeout(
      () => document.querySelector<HTMLButtonElement>(`[data-calendar-date="${nextValue}"]`)?.focus(),
      60
    );
  }

  function handleSelectDoctor(doctorId: string) {
    if (form.doctor_id && form.doctor_id !== doctorId && form.selected_services.length > 0) {
      setDependencyNotice("Service selections were cleared because the doctor changed. Reconfirm service coverage before continuing.");
    } else {
      setDependencyNotice("");
    }
    setError("");
    setForm((current) => ({
      ...current,
      doctor_id: doctorId,
      selected_services: current.doctor_id && current.doctor_id !== doctorId ? [] : current.selected_services,
    }));
  }

  function toggleService(serviceName: string) {
    setError("");
    setForm((current) => {
      const selected = current.selected_services.includes(serviceName);
      return {
        ...current,
        selected_services: selected
          ? current.selected_services.filter((item) => item !== serviceName)
          : [...current.selected_services, serviceName],
      };
    });
  }

  function handleStartTimeChange(startTime: string) {
    const validEndOptions = getAvailableEndTimeOptions(startTime).filter(
      (endTime) => !getDoctorConflict(startTime, endTime)
    );
    setForm((current) => ({
      ...current,
      start_time: startTime,
      end_time: validEndOptions.includes(current.end_time) ? current.end_time : validEndOptions[0] || "",
    }));
    setError("");
  }

  function handleEditDoctorSchedule(schedule: DoctorSchedule) {
    const date = parseDateOnly(schedule.schedule_date);
    setEditingDoctorScheduleId(schedule.id);
    setEditingClinicClosureId(null);
    setWizardStep("doctor");
    setSelectedDate(schedule.schedule_date);
    setCalendarDateChosen(true);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setForm({
      doctor_id: String(schedule.doctor_id),
      selected_services: splitServices(schedule.services),
      schedule_date: schedule.schedule_date,
      start_time: schedule.start_time || "",
      end_time: schedule.end_time || "",
      consultation_mode: schedule.consultation_mode || "In-Person",
      schedule_note: schedule.schedule_note || "",
    });
    setClinicClosureForm({ ...initialClinicClosureForm, closure_date: schedule.schedule_date });
    setMessage("");
    setError("");
    setDependencyNotice("");
    setLastSavedSchedule(null);
    setScreenMode("workflow");
    window.setTimeout(() => workflowRef.current?.focus({ preventScroll: false }), 60);
  }

  function handleEditClinicClosure(item: ClinicUnavailableDate) {
    setSelectedDate(item.closure_date);
    setCalendarDateChosen(true);
    moveCalendarToDate(item.closure_date);
    setWizardStep("closure");
    setEditingClinicClosureId(item.id);
    setEditingDoctorScheduleId(null);
    setClinicClosureForm({ closure_date: item.closure_date, reason: item.reason || "", note: item.note || "" });
    setForm((current) => ({ ...current, schedule_date: item.closure_date }));
    setMessage("");
    setError("");
    setLastSavedSchedule(null);
    setScreenMode("workflow");
    window.setTimeout(() => workflowRef.current?.focus({ preventScroll: false }), 60);
  }

  function getClosureDisabledReason() {
    if (selectedDateIsSunday) return "Sundays are already unavailable by the current clinic rule.";
    if (selectedDateIsPast) return "Past dates cannot be marked unavailable.";
    if (selectedDateTimeLocked) return "No future bookable time remains on this date.";
    if (dataIssues.schedules) return "Schedule data is unavailable, so existing schedules cannot be verified.";
    if (dataIssues.appointments) return "Appointment data is unavailable, so existing appointments cannot be verified.";
    if (allSelectedDateSchedules.length > 0) return "A doctor schedule already exists on this date.";
    if (activeAppointmentsOnSelectedDate.length > 0) return `${activeAppointmentsOnSelectedDate.length} active appointment${activeAppointmentsOnSelectedDate.length === 1 ? "" : "s"} exist on this date.`;
    return "";
  }

  function openClinicClosureFlow() {
    const disabledReason = getClosureDisabledReason();
    if (disabledReason) {
      setError(disabledReason);
      return;
    }
    setWizardStep("closure");
    setEditingDoctorScheduleId(null);
    setEditingClinicClosureId(selectedClinicClosure?.id || null);
    setClinicClosureForm({
      closure_date: selectedDate,
      reason: selectedClinicClosure?.reason || "",
      note: selectedClinicClosure?.note || "",
    });
    setMessage("");
    setError("");
    setLastSavedSchedule(null);
    setScreenMode("workflow");
    window.setTimeout(() => workflowRef.current?.focus({ preventScroll: false }), 60);
  }

  function canGoToServices() {
    return Boolean(form.doctor_id) && !selectedDateBlocked && !existingScheduleForFormDate && !dataIssues.doctors;
  }

  function canGoToTime() {
    return form.selected_services.length > 0 && canGoToServices();
  }

  function canGoToReview() {
    return (
      canGoToTime() &&
      Boolean(form.start_time) &&
      Boolean(form.end_time) &&
      form.end_time > form.start_time &&
      isThirtyMinuteTime(form.start_time) &&
      isThirtyMinuteTime(form.end_time) &&
      isInsideClinicHours(form.start_time, form.end_time) &&
      !isPastStartTime(form.schedule_date, form.start_time) &&
      !formConflict
    );
  }

  function getCurrentStepReason() {
    if (selectedDateIsSunday) return "This date is closed because Sundays are unavailable in the current scheduling rules.";
    if (selectedDateIsPast) return "Past dates are read-only.";
    if (selectedDateIsClinicClosed) return "Remove the clinic closure before adding a doctor schedule.";
    if (selectedDateTimeLocked) return "No future 30-minute start time remains for this date.";
    if (existingScheduleForFormDate) return `${getShortDoctorName(existingScheduleForFormDate.doctor_name)} is already assigned to this date.`;
    if (wizardStep === "doctor" && !form.doctor_id) return "Select an active doctor to continue.";
    if (wizardStep === "services" && form.selected_services.length === 0) return "Select at least one service to continue.";
    if (wizardStep === "time" && !form.start_time) return "Choose a valid start time.";
    if (wizardStep === "time" && (!form.end_time || form.end_time <= form.start_time)) return "End time must be later than start time.";
    if (wizardStep === "time" && formConflict) return `This overlaps ${formatTime(formConflict.start_time)}–${formatTime(formConflict.end_time)} for the selected doctor.`;
    if (wizardStep === "time" && isPastStartTime(form.schedule_date, form.start_time)) return "The selected start time has already passed in the clinic timezone.";
    return "";
  }

  function getSelectedDateUnavailableReason() {
    if (selectedDateIsSunday) return "Sunday is unavailable under the current clinic scheduling rule.";
    if (selectedDateIsPast) return "Past dates are available for review only.";
    if (selectedDateIsClinicClosed) return "This date is marked unavailable for the clinic.";
    if (selectedDateTimeLocked) return "No future 30-minute start time remains for this date.";
    if (dataIssues.schedules || dataIssues.closures) return "Scheduling status cannot be verified because required data is unavailable.";
    return "";
  }

  function validateDoctorScheduleForm() {
    if (isSunday(form.schedule_date)) return "Sundays are unavailable for scheduling.";
    if (isPastDate(form.schedule_date, todayValue)) return "Past dates cannot be scheduled.";
    if (formDateClinicClosure) return "This date is marked unavailable for the clinic.";
    if (getAvailableStartTimeOptions(form.schedule_date).length === 0) return "No future bookable time slots are left for this date.";
    if (existingScheduleForFormDate) return `Only one doctor can be scheduled per day. ${getShortDoctorName(existingScheduleForFormDate.doctor_name)} is already assigned to ${formatReadableDate(form.schedule_date)}.`;
    if (!form.doctor_id) return "Please select a doctor.";
    if (form.selected_services.length === 0) return "Please select at least one service.";
    if (!form.start_time || !form.end_time) return "Please select the bookable time range.";
    if (form.end_time <= form.start_time) return "End time must be later than start time.";
    if (!isThirtyMinuteTime(form.start_time) || !isThirtyMinuteTime(form.end_time)) return "Please use 30-minute schedule intervals.";
    if (!isInsideClinicHours(form.start_time, form.end_time)) return `Schedules must stay within ${formatTime(clinicStartTime)} to ${formatTime(clinicEndTime)}.`;
    if (isPastStartTime(form.schedule_date, form.start_time)) return "Past time slots cannot be scheduled.";
    if (formConflict) return `The selected doctor already has an overlapping schedule from ${formatTime(formConflict.start_time)} to ${formatTime(formConflict.end_time)}.`;
    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (wizardStep === "closure") {
      await handleSaveClinicClosure();
      return;
    }
    if (wizardStep !== "review") return;
    await handleSaveDoctorSchedule();
  }

  async function handleSaveDoctorSchedule() {
    const validationMessage = validateDoctorScheduleForm();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setIsSaving(true);
    setMessage("");
    setError("");
    const doctorName = selectedDoctor ? getShortDoctorName(selectedDoctor.name) : "Doctor";
    const payload = {
      doctor_id: Number(form.doctor_id),
      services: servicesToString(form.selected_services),
      schedule_date: form.schedule_date,
      start_time: form.start_time,
      end_time: form.end_time,
      is_available: true,
      consultation_mode: form.consultation_mode || "In-Person",
      unavailable_reason: null,
      schedule_note: form.schedule_note.trim() || null,
    };

    try {
      const path = editingDoctorScheduleId
        ? `/staff/doctor-schedules/${editingDoctorScheduleId}`
        : "/staff/doctor-schedules";
      const res = await apiRequest(path, {
        method: editingDoctorScheduleId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Unable to save doctor schedule."));

      await Promise.all([fetchSchedules(), fetchConfirmedAppointments()]);
      setMessage(editingDoctorScheduleId ? "Doctor schedule updated successfully." : "Doctor schedule saved successfully.");
      setLastSavedSchedule({ doctor: doctorName, date: form.schedule_date });
      setEditingDoctorScheduleId(null);
      setDependencyNotice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save doctor schedule.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveClinicClosure() {
    setMessage("");
    setError("");
    if (!clinicClosureForm.closure_date) return setError("Please select a date to mark unavailable.");
    if (isSunday(clinicClosureForm.closure_date)) return setError("Sundays are already unavailable by default.");
    if (isPastDate(clinicClosureForm.closure_date, todayValue)) return setError("Past dates cannot be marked unavailable.");
    if (!clinicClosureForm.reason.trim()) return setError("Please select a reason for marking this date unavailable.");
    if (dataIssues.appointments) return setError("Appointment verification is unavailable. The clinic date cannot be closed safely until appointment data can be checked.");

    const schedulesOnClosureDate = schedules.filter((schedule) => schedule.schedule_date === clinicClosureForm.closure_date);
    const appointmentsOnClosureDate = confirmedAppointments.filter(
      (appointment) => appointment.date === clinicClosureForm.closure_date && isActiveAppointment(appointment.status)
    );
    if (schedulesOnClosureDate.length > 0) return setError("This date already has a doctor schedule and cannot be closed.");
    if (appointmentsOnClosureDate.length > 0) return setError(`This date has ${appointmentsOnClosureDate.length} active appointment${appointmentsOnClosureDate.length === 1 ? "" : "s"}. Resolve those appointments before marking the clinic unavailable.`);
    if (!window.confirm(`Mark ${formatReadableDate(clinicClosureForm.closure_date)} as unavailable for the clinic? New bookings will be blocked for this date. This action does not cancel appointments.`)) return;

    setIsSaving(true);
    const payload = {
      closure_date: clinicClosureForm.closure_date,
      reason: clinicClosureForm.reason.trim(),
      note: clinicClosureForm.note.trim() || null,
    };
    try {
      const path = editingClinicClosureId
        ? `/staff/clinic-unavailable-dates/${editingClinicClosureId}`
        : "/staff/clinic-unavailable-dates";
      const res = await apiRequest(path, {
        method: editingClinicClosureId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Unable to save clinic closure."));
      await fetchClinicUnavailableDates();
      setMessage(editingClinicClosureId ? "Clinic closure updated successfully." : "Clinic date marked unavailable successfully.");
      setEditingClinicClosureId(null);
      setWizardStep("doctor");
      setClinicClosureForm({ ...initialClinicClosureForm, closure_date: selectedDate });
      setScreenMode("calendar");
      setCalendarDateChosen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save clinic closure.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteDoctorSchedule(scheduleId: number) {
    if (!window.confirm("Delete this doctor schedule? Existing appointments are not automatically cancelled.")) return;
    setMessage("");
    setError("");
    try {
      const res = await apiRequest(`/staff/doctor-schedules/${scheduleId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Unable to delete doctor schedule."));
      await fetchSchedules();
      setMessage("Doctor schedule removed successfully.");
      if (editingDoctorScheduleId === scheduleId) resetFormForDate(selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete doctor schedule.");
    }
  }

  async function handleDeleteClinicClosure(closureId: number) {
    if (!window.confirm("Remove this clinic closure? The date may become bookable again if a valid doctor schedule is added.")) return;
    setMessage("");
    setError("");
    try {
      const res = await apiRequest(`/staff/clinic-unavailable-dates/${closureId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Unable to remove clinic closure."));
      await fetchClinicUnavailableDates();
      setMessage("Clinic closure removed successfully.");
      if (editingClinicClosureId === closureId) resetFormForDate(selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove clinic closure.");
    }
  }

  function getExportReferenceDate() {
    if (calendarDateChosen) return selectedDate;
    const today = parseDateOnly(todayValue);
    if (today.getFullYear() === calendarMonth.getFullYear() && today.getMonth() === calendarMonth.getMonth()) {
      return todayValue;
    }
    return toDateInputValue(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1));
  }

  function handlePrintWeeklySchedules() {
    const exportReferenceDate = getExportReferenceDate();
    const { weekStart, weekEnd } = getSelectedWeekRange(exportReferenceDate);
    const weeklyScheduleRows = filteredSchedules
      .filter((schedule) => schedule.schedule_date >= weekStart && schedule.schedule_date <= weekEnd)
      .map((schedule) => ({
        sortKey: `${schedule.schedule_date}-${schedule.start_time}`,
        row: [
          formatReadableDate(schedule.schedule_date),
          getShortDoctorName(schedule.doctor_name || "Doctor unavailable"),
          `${formatTime(schedule.start_time)} to ${formatTime(schedule.end_time)}`,
          getScheduleMode(schedule),
          schedule.services || schedule.unavailable_reason || "No services listed",
        ],
      }));
    const weeklyClosureRows = clinicUnavailableDates
      .filter((closure) => closure.closure_date >= weekStart && closure.closure_date <= weekEnd)
      .map((closure) => ({
        sortKey: `${closure.closure_date}-00:00`,
        row: [
          formatReadableDate(closure.closure_date),
          "Clinic unavailable",
          "Whole day",
          "Clinic closure",
          closure.reason || "No reason provided",
        ],
      }));
    const rows = [...weeklyScheduleRows, ...weeklyClosureRows]
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map((item) => item.row);
    const doctorFilterLabel = filterDoctor === "all"
      ? "All doctors"
      : activeDoctors.find((doctor) => doctor.id === Number(filterDoctor))?.name || "Selected doctor";

    printHtmlDocument({
      title: "OurSkin Weekly Doctor Schedule",
      subtitle: `${formatReadableDate(weekStart)} to ${formatReadableDate(weekEnd)}. Filter: ${doctorFilterLabel}. Sundays are unavailable by the current clinic rule.`,
      headers: ["Date", "Doctor / Closure", "Time", "Mode", "Services / Reason"],
      rows,
      emptyMessage: "No doctor schedules or clinic closures found for this week.",
      orientation: "landscape",
    });
  }

  const currentStepIndex = wizardSteps.findIndex((step) => step.key === wizardStep);
  const exportWeek = getSelectedWeekRange(getExportReferenceDate());
  const exportLabel = `Export week ${formatCompactDate(exportWeek.weekStart)}–${formatCompactDate(exportWeek.weekEnd)}`;
  const clinicStatus = selectedDateIsSunday || selectedDateIsClinicClosed ? "Closed" : "Open";
  const selectedDateDoctorInfo = getCalendarDoctorInfo(allSelectedDateSchedules);
  const availabilityText = selectedDateIsSunday || selectedDateIsClinicClosed
    ? "Clinic closed"
    : selectedDateIsPast
      ? "Historical date"
      : selectedDateTimeLocked
        ? "No future bookable time remains"
        : existingScheduleForSelectedDate
          ? "Schedule assigned"
          : "Available for doctor scheduling";
  const closureDisabledReason = getClosureDisabledReason();

  function isStepComplete(step: Exclude<WizardStep, "closure">) {
    if (step === "doctor") return canGoToServices();
    if (step === "services") return canGoToTime();
    if (step === "time") return canGoToReview();
    return false;
  }

  function canAccessStep(step: Exclude<WizardStep, "closure">) {
    if (step === "doctor") return true;
    if (step === "services") return canGoToServices();
    if (step === "time") return canGoToTime();
    return canGoToReview();
  }

  const selectedDateActionLabel = hasUnsavedWork && form.schedule_date === selectedDate
    ? "Resume scheduling"
    : "Add doctor schedule";

  const statusBanners = (
    <>
      {error && <div className={styles.errorBox} role="alert">{error}</div>}
      {serviceWarning && <div className={styles.warningBox} role="status">{serviceWarning}</div>}
      {dependencyNotice && <div className={styles.infoBox} role="status">{dependencyNotice}</div>}
      {message && <div className={styles.successBox} role="status">{message}</div>}
      {Object.keys(dataIssues).length > 0 && !isLoading && (
        <div className={styles.dataNotice} role="status">
          Some scheduling data is unavailable. Affected controls are disabled rather than shown as valid empty states.
        </div>
      )}
    </>
  );

  return (
    <PageShell className={staffStyles.staffPage}>
      {screenMode === "calendar" ? (
        <div className={styles.calendarPage}>
          <header className={styles.pageHeader}>
            <div>
              <h1>Schedules</h1>
              <p>Select a date to manage doctor availability and clinic hours.</p>
            </div>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handlePrintWeeklySchedules}
              disabled={isLoading || Boolean(dataIssues.schedules)}
            >
              {isLoading ? "Loading schedules…" : exportLabel}
            </button>
          </header>

          {statusBanners}

          <section className={styles.calendarScreen} aria-labelledby="calendar-heading" aria-busy={isLoading}>
            <div className={styles.calendarToolbar}>
              <div className={styles.monthNav}>
                <button type="button" onClick={goToPreviousMonth} aria-label="Previous month">‹</button>
                <h2 id="calendar-heading">{monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</h2>
                <button type="button" onClick={goToNextMonth} aria-label="Next month">›</button>
                <button type="button" className={styles.todayButton} onClick={goToToday}>Today</button>
              </div>
              <label className={styles.doctorFilter}>
                <span>Filter by doctor</span>
                <select
                  value={filterDoctor}
                  onChange={(event) => setFilterDoctor(event.target.value)}
                  disabled={Boolean(dataIssues.doctors)}
                >
                  <option value="all">All doctors</option>
                  {activeDoctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {dataIssues.schedules && <div className={styles.inlineError}>Schedule data unavailable: {dataIssues.schedules}</div>}
            {dataIssues.closures && <div className={styles.inlineError}>Clinic closure data unavailable: {dataIssues.closures}</div>}

            <div className={styles.calendarSurface}>
              <div className={styles.weekdayGrid} aria-hidden="true">
                {weekDays.map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className={styles.calendarGrid} aria-label={`${monthNames[calendarMonth.getMonth()]} ${calendarMonth.getFullYear()} schedule calendar`}>
                {calendarDays.map((day, index) => {
                  if (day.isBlank) return <div key={`blank-${index}`} className={styles.blankCalendarDay} aria-hidden="true" />;

                  const isSelected = calendarDateChosen && day.dateValue === selectedDate;
                  const isToday = day.dateValue === todayValue;
                  const sunday = isSunday(day.dateValue);
                  const closed = closureDateSet.has(day.dateValue);
                  const past = isPastDate(day.dateValue, todayValue);
                  const doctorInfo = getCalendarDoctorInfo(day.schedules);
                  const hasSchedules = doctorInfo.doctorCount > 0;
                  const stateLabel = closed || sunday
                    ? "Closed"
                    : dataIssues.schedules
                      ? "Schedule unavailable"
                      : hasSchedules
                        ? "Scheduled"
                        : "No schedule";
                  const visibleDoctorLabels = doctorInfo.labels.slice(0, 2);
                  const remainingDoctors = Math.max(0, doctorInfo.labels.length - visibleDoctorLabels.length);
                  const doctorTooltip = doctorInfo.fullNames.join(", ");
                  const ariaState = [
                    formatReadableDate(day.dateValue),
                    isToday ? "Today" : "",
                    isSelected ? "Selected" : "",
                    past ? "Past date" : "",
                    stateLabel,
                    doctorInfo.fullNames.length ? `Assigned doctors: ${doctorInfo.fullNames.join(", ")}` : "",
                  ].filter(Boolean).join(", ");

                  return (
                    <button
                      key={day.dateValue}
                      data-calendar-date={day.dateValue}
                      type="button"
                      aria-label={ariaState}
                      aria-current={isToday ? "date" : undefined}
                      aria-pressed={isSelected}
                      title={doctorTooltip || undefined}
                      className={`${styles.calendarDay} ${isSelected ? styles.selectedDay : ""} ${isToday ? styles.todayDay : ""} ${hasSchedules ? styles.scheduledDay : ""} ${closed || sunday ? styles.closedDay : ""} ${past ? styles.pastDay : ""}`}
                      onClick={() => selectDateOnCalendar(day.dateValue)}
                      onKeyDown={(event) => handleCalendarKeyDown(event, day.dateValue)}
                    >
                      <span className={styles.calendarDayTop}>
                        <span className={styles.dayNumber}>{day.dayNumber}</span>
                        {isToday && <span className={styles.todayMarker}>Today</span>}
                      </span>
                      <span className={styles.dayState}>{stateLabel}</span>
                      {hasSchedules && !closed && !sunday && (
                        <span className={styles.calendarDoctorNames} aria-hidden="true">
                          {visibleDoctorLabels.map((label) => <span key={label}>{label}</span>)}
                          {remainingDoctors > 0 && <span>+{remainingDoctors} more</span>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {!calendarDateChosen ? (
              <div className={styles.calendarPrompt}>
                <strong>Choose a date to begin</strong>
                <span>The scheduling workflow opens only after a valid date is selected.</span>
              </div>
            ) : (
              <section className={styles.selectedDatePanel} aria-labelledby="selected-calendar-date">
                <div className={styles.selectedDateHeader}>
                  <div>
                    <span className={styles.eyebrow}>Selected date</span>
                    <h3 id="selected-calendar-date">{formatReadableDate(selectedDate)}</h3>
                    <div className={styles.selectedDateMeta}>
                      <StatusBadge tone={clinicStatus === "Closed" ? "danger" : "success"}>Clinic {clinicStatus.toLowerCase()}</StatusBadge>
                      <span>{availabilityText}</span>
                      <span>{dataIssues.schedules ? "Schedules unavailable" : `${selectedDateDoctorInfo.doctorCount} scheduled doctor${selectedDateDoctorInfo.doctorCount === 1 ? "" : "s"}`}</span>
                    </div>
                  </div>

                  <div className={styles.selectedDateActions}>
                    {selectedClinicClosure ? (
                      <>
                        <span className={styles.actionHint}>Closed: {selectedClinicClosure.reason}</span>
                        {!selectedDateIsPast && <button type="button" className={styles.secondaryButton} onClick={() => handleEditClinicClosure(selectedClinicClosure)}>Edit closure</button>}
                        {!selectedDateIsPast && <button type="button" className={styles.dangerButton} onClick={() => handleDeleteClinicClosure(selectedClinicClosure.id)}>Remove closure</button>}
                      </>
                    ) : selectedDateBlocked ? (
                      <span className={styles.actionHint}>{getSelectedDateUnavailableReason()}</span>
                    ) : existingScheduleForSelectedDate ? (
                      <button type="button" className={styles.secondaryButton} onClick={() => handleEditDoctorSchedule(existingScheduleForSelectedDate)}>Edit schedule</button>
                    ) : (
                      <>
                        <button type="button" className={styles.dangerButton} disabled={Boolean(closureDisabledReason)} onClick={openClinicClosureFlow}>Mark clinic closed</button>
                        <button type="button" className={styles.primaryButton} onClick={startWorkflowForSelectedDate}>{selectedDateActionLabel}</button>
                      </>
                    )}
                  </div>
                </div>

                {allSelectedDateSchedules.length > 0 && (
                  <div className={styles.selectedScheduleList} aria-label="Schedules on selected date">
                    {allSelectedDateSchedules.map((schedule) => (
                      <article className={styles.scheduleRow} key={schedule.id}>
                        <span className={styles.avatar}>{getInitials(schedule.doctor_name)}</span>
                        <div className={styles.scheduleCopy}>
                          <strong>{getShortDoctorName(schedule.doctor_name)}</strong>
                          <span>{formatTime(schedule.start_time)}–{formatTime(schedule.end_time)} · {getScheduleMode(schedule)}</span>
                          <small>{schedule.services || "Services unavailable"}</small>
                        </div>
                        {!isPastDate(schedule.schedule_date, todayValue) && (
                          <div className={styles.rowActions}>
                            <button type="button" onClick={() => handleEditDoctorSchedule(schedule)}>Edit</button>
                            <button type="button" className={styles.textDanger} onClick={() => handleDeleteDoctorSchedule(schedule.id)}>Delete</button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </section>
        </div>
      ) : (
        <main ref={workflowRef} tabIndex={-1} className={styles.workflowScreen} aria-label="Doctor scheduling workflow">
          {statusBanners}
          <form className={styles.workflowCard} onSubmit={handleSubmit}>
            <div className={styles.workflowTopbar}>
              <div>
                <span className={styles.eyebrow}>{wizardStep === "closure" ? "Clinic closure" : "Selected date"}</span>
                <h2>{formatReadableDate(selectedDate)}</h2>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={returnToCalendar}>← Back to calendar</button>
            </div>

            {wizardStep !== "closure" && (
              <>
                <section className={styles.progressSection} aria-label={`Scheduling progress: step ${Math.max(1, currentStepIndex + 1)} of 4`}>
                  <div className={styles.progressMeta}>
                    <span>Step {Math.max(1, currentStepIndex + 1)} of 4</span>
                    <strong>{wizardSteps[Math.max(0, currentStepIndex)]?.label}</strong>
                  </div>
                  <div className={styles.progressTrack} aria-hidden="true">
                    <span style={{ width: `${((Math.max(0, currentStepIndex) + 1) / 4) * 100}%` }} />
                  </div>
                  <div className={styles.progressStepper}>
                    {wizardSteps.map((step, index) => {
                      const complete = isStepComplete(step.key);
                      const current = wizardStep === step.key;
                      const accessible = canAccessStep(step.key);
                      return (
                        <button
                          key={step.key}
                          type="button"
                          className={`${styles.progressStep} ${complete ? styles.progressComplete : ""} ${current ? styles.progressCurrent : ""}`}
                          disabled={!accessible}
                          aria-current={current ? "step" : undefined}
                          onClick={() => accessible && setWizardStep(step.key)}
                        >
                          <span className={styles.progressCircle}>{complete && !current ? "✓" : index + 1}</span>
                          <span>{step.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className={styles.scheduleSummary} aria-label="Current schedule summary">
                  <div><span>Date</span><strong>{formatCompactDate(form.schedule_date)}</strong></div>
                  <div><span>Doctor</span><strong>{selectedDoctor ? stripDoctorTitle(selectedDoctor.name) : "Not selected"}</strong></div>
                  <div><span>Services</span><strong>{form.selected_services.length > 0 ? `${form.selected_services.length} selected` : "Not selected"}</strong></div>
                  <div><span>Time</span><strong>{form.start_time && form.end_time ? `${formatTime(form.start_time)}–${formatTime(form.end_time)}` : "Not selected"}</strong></div>
                </section>
              </>
            )}

            {lastSavedSchedule && wizardStep !== "closure" ? (
              <section className={styles.completionState} role="status">
                <div>
                  <span className={styles.eyebrow}>Schedule saved</span>
                  <h3>{lastSavedSchedule.doctor}</h3>
                  <p>{formatReadableDate(lastSavedSchedule.date)} · {formatTime(form.start_time)}–{formatTime(form.end_time)}</p>
                  <span>The calendar and selected-day schedule have been refreshed.</span>
                </div>
                <button type="button" className={styles.primaryButton} onClick={returnToCalendar}>Return to calendar</button>
              </section>
            ) : wizardStep === "doctor" ? (
              <section className={styles.flowPane} aria-labelledby="doctor-step-heading">
                <div className={styles.flowIntro}>
                  <span>Step 1</span>
                  <h3 id="doctor-step-heading">Choose a doctor</h3>
                  <p>Select the active doctor who will be available on this date.</p>
                </div>

                {dataIssues.doctors ? (
                  <div className={styles.inlineError}>Doctor data unavailable: {dataIssues.doctors}</div>
                ) : activeDoctors.length === 0 ? (
                  <div className={styles.compactEmpty}>No active doctors are available to select.</div>
                ) : (
                  <div className={styles.doctorGrid}>
                    {activeDoctors.map((doctor) => {
                      const selected = form.doctor_id === String(doctor.id);
                      return (
                        <button
                          key={doctor.id}
                          type="button"
                          className={`${styles.doctorChoice} ${selected ? styles.choiceActive : ""}`}
                          disabled={selectedDateBlocked || Boolean(existingScheduleForFormDate)}
                          aria-pressed={selected}
                          onClick={() => handleSelectDoctor(String(doctor.id))}
                        >
                          <span className={styles.avatar}>{getInitials(doctor.name)}</span>
                          <span className={styles.choiceCopy}>
                            <strong>{getShortDoctorName(doctor.name)}</strong>
                            <small>{doctor.specialty?.trim() || "Specialty not listed"}</small>
                          </span>
                          <span className={styles.choiceState}>{selected ? "Selected" : "Available"}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className={styles.workflowActions}>
                  <button type="button" className={styles.secondaryButton} onClick={returnToCalendar}>Back to calendar</button>
                  <span className={styles.actionHint}>{getCurrentStepReason()}</span>
                  <button type="button" className={styles.primaryButton} disabled={!canGoToServices()} onClick={() => setWizardStep("services")}>Continue to services</button>
                </div>
              </section>
            ) : wizardStep === "services" ? (
              <section className={styles.flowPane} aria-labelledby="services-step-heading">
                <div className={styles.flowIntro}>
                  <span>Step 2</span>
                  <h3 id="services-step-heading">Select services</h3>
                  <p>Choose the services this schedule should cover.</p>
                </div>

                {serviceOptions.length === 0 ? (
                  <div className={styles.inlineError}>No service data is currently available.</div>
                ) : (
                  <div className={styles.serviceGrid}>
                    {serviceOptions.map((service) => {
                      const selected = form.selected_services.includes(service.name);
                      return (
                        <button
                          key={`${service.id}-${service.name}`}
                          type="button"
                          className={`${styles.serviceChoice} ${selected ? styles.choiceActive : ""}`}
                          aria-pressed={selected}
                          onClick={() => toggleService(service.name)}
                        >
                          <span className={styles.checkMark}>{selected ? "✓" : ""}</span>
                          <span className={styles.choiceCopy}>
                            <strong>{service.name}</strong>
                            <small>{service.description || (service.requires_initial_evaluation ? "Initial evaluation required" : "Active service")}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className={styles.workflowActions}>
                  <button type="button" className={styles.secondaryButton} onClick={() => setWizardStep("doctor")}>Back</button>
                  <span className={styles.actionHint}>{getCurrentStepReason()}</span>
                  <button type="button" className={styles.primaryButton} disabled={!canGoToTime()} onClick={() => setWizardStep("time")}>Continue to time</button>
                </div>
              </section>
            ) : wizardStep === "time" ? (
              <section className={styles.flowPane} aria-labelledby="time-step-heading">
                <div className={styles.flowIntro}>
                  <span>Step 3</span>
                  <h3 id="time-step-heading">Set available time</h3>
                  <p>Choose 30-minute times within {formatTime(clinicStartTime)}–{formatTime(clinicEndTime)} ({clinicTimeZone}).</p>
                </div>

                {doctorSchedulesForFormDate.length > 0 && (
                  <div className={styles.existingTimeNotice}>
                    <strong>Existing time for this doctor</strong>
                    <span>{doctorSchedulesForFormDate.map((schedule) => `${formatTime(schedule.start_time)}–${formatTime(schedule.end_time)}`).join(", ")}</span>
                  </div>
                )}

                <div className={styles.timeGrid}>
                  <label>
                    <span>Start time</span>
                    <select
                      value={form.start_time}
                      disabled={selectedDateBlocked || availableStartOptions.length === 0}
                      onChange={(event) => handleStartTimeChange(event.target.value)}
                    >
                      <option value="">Select start time</option>
                      {availableStartOptions.map((option) => (
                        <option key={option} value={option}>{formatTime(option)}</option>
                      ))}
                    </select>
                    <small>30-minute intervals; past and conflicting starts are excluded.</small>
                  </label>
                  <label>
                    <span>End time</span>
                    <select
                      value={form.end_time}
                      disabled={selectedDateBlocked || !form.start_time || availableEndOptions.length === 0}
                      onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))}
                    >
                      <option value="">Select end time</option>
                      {availableEndOptions.map((option) => (
                        <option key={option} value={option}>{formatTime(option)}</option>
                      ))}
                    </select>
                    <small>End time updates from the selected start time.</small>
                  </label>
                  <label>
                    <span>Consultation mode</span>
                    <select
                      value={form.consultation_mode}
                      onChange={(event) => setForm((current) => ({ ...current, consultation_mode: event.target.value }))}
                    >
                      <option value="In-Person">In-person consultation</option>
                      <option value="Online Consultation">Online consultation</option>
                    </select>
                  </label>
                  <label>
                    <span>Internal note</span>
                    <input
                      type="text"
                      placeholder="Optional staff note"
                      value={form.schedule_note}
                      onChange={(event) => setForm((current) => ({ ...current, schedule_note: event.target.value }))}
                    />
                  </label>
                </div>

                {formConflict && (
                  <div className={styles.conflictNotice} role="alert">
                    This time overlaps the selected doctor&apos;s existing {formatTime(formConflict.start_time)}–{formatTime(formConflict.end_time)} schedule.
                  </div>
                )}

                <div className={styles.workflowActions}>
                  <button type="button" className={styles.secondaryButton} onClick={() => setWizardStep("services")}>Back</button>
                  <span className={styles.actionHint}>{getCurrentStepReason()}</span>
                  <button type="button" className={styles.primaryButton} disabled={!canGoToReview()} onClick={() => setWizardStep("review")}>Review schedule</button>
                </div>
              </section>
            ) : wizardStep === "review" ? (
              <section className={styles.flowPane} aria-labelledby="review-step-heading">
                <div className={styles.flowIntro}>
                  <span>Step 4</span>
                  <h3 id="review-step-heading">Review schedule</h3>
                  <p>Nothing is saved until you click the final button.</p>
                </div>

                <dl className={styles.reviewList}>
                  <div><dt>Selected date</dt><dd>{formatReadableDate(form.schedule_date)}</dd></div>
                  <div><dt>Doctor</dt><dd>{selectedDoctor ? getShortDoctorName(selectedDoctor.name) : "Not selected"}</dd></div>
                  <div><dt>Services</dt><dd>{form.selected_services.join(", ") || "Not selected"}</dd></div>
                  <div><dt>Start time</dt><dd>{formatTime(form.start_time)}</dd></div>
                  <div><dt>End time</dt><dd>{formatTime(form.end_time)}</dd></div>
                  <div><dt>Consultation mode</dt><dd>{form.consultation_mode}</dd></div>
                  {form.schedule_note && <div><dt>Internal note</dt><dd>{form.schedule_note}</dd></div>}
                  <div><dt>Validation</dt><dd>{existingScheduleForFormDate ? "Another doctor is already assigned to this date" : formConflict ? "Doctor schedule conflict detected" : "Ready to save"}</dd></div>
                </dl>

                <div className={styles.workflowActions}>
                  <button type="button" className={styles.secondaryButton} disabled={isSaving} onClick={() => setWizardStep("time")}>Back</button>
                  <span className={styles.actionHint}>{getCurrentStepReason()}</span>
                  <button type="submit" className={styles.primaryButton} disabled={isSaving || !canGoToReview()}>
                    {isSaving ? "Saving doctor schedule…" : editingDoctorScheduleId ? "Update doctor schedule" : "Save doctor schedule"}
                  </button>
                </div>
              </section>
            ) : (
              <section className={styles.flowPane} aria-labelledby="closure-step-heading">
                <div className={styles.flowIntro}>
                  <span>Clinic closure</span>
                  <h3 id="closure-step-heading">{editingClinicClosureId ? "Edit clinic closure" : "Mark clinic closed"}</h3>
                  <p>The date is checked for saved schedules and active appointments before closing.</p>
                </div>

                <div className={styles.closureWarning}>
                  <strong>{formatReadableDate(clinicClosureForm.closure_date)}</strong>
                  <span>New bookings will be blocked for the whole date. Existing appointments are not cancelled automatically.</span>
                </div>

                <div className={styles.closureFormGrid}>
                  <label>
                    <span>Date</span>
                    <input type="date" value={clinicClosureForm.closure_date} min={todayValue} readOnly />
                  </label>
                  <label>
                    <span>Reason</span>
                    <select
                      value={clinicClosureForm.reason}
                      onChange={(event) => setClinicClosureForm((current) => ({ ...current, reason: event.target.value }))}
                    >
                      <option value="">Select reason</option>
                      {clinicUnavailableReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                    </select>
                  </label>
                  <label className={styles.fullField}>
                    <span>Note</span>
                    <input
                      type="text"
                      placeholder="Optional closure note"
                      value={clinicClosureForm.note}
                      onChange={(event) => setClinicClosureForm((current) => ({ ...current, note: event.target.value }))}
                    />
                  </label>
                </div>

                <div className={styles.workflowActions}>
                  <button type="button" className={styles.secondaryButton} disabled={isSaving} onClick={returnToCalendar}>Back to calendar</button>
                  <span className={styles.actionHint}>{!clinicClosureForm.reason ? "Select a closure reason before saving." : "A confirmation appears before the closure is saved."}</span>
                  <button type="submit" className={styles.dangerSolidButton} disabled={isSaving || !clinicClosureForm.reason || Boolean(dataIssues.appointments)}>
                    {isSaving ? "Saving clinic closure…" : editingClinicClosureId ? "Update clinic closure" : "Save clinic closure"}
                  </button>
                </div>
              </section>
            )}
          </form>
        </main>
      )}
    </PageShell>
  );
}