"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import StaffNavbar from "@/app/components/StaffNavbar";
import { API_BASE_URL, getAuth } from "@/lib/api";
import { printHtmlDocument } from "@/lib/printExport";
import staffStyles from "@/app/styles/staff.module.css";
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
  created_by_staff_id?: number | null;
  created_by_staff_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ClinicUnavailableDate = {
  id: number;
  closure_date: string;
  reason: string;
  note?: string | null;
  created_by_staff_id?: number | null;
  created_by_staff_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
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

const timeOptions = [
  { value: "10:00", label: "10:00 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "13:00", label: "1:00 PM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "15:00", label: "3:00 PM" },
  { value: "16:00", label: "4:00 PM" },
  { value: "17:00", label: "5:00 PM" },
  { value: "18:00", label: "6:00 PM" },
  { value: "19:00", label: "7:00 PM" },
];

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
  if (!value) return false;

  return parseDateOnly(value).getDay() === 0;
}

function isPastDate(value: string, todayValue: string) {
  if (!value) return false;

  return value < todayValue;
}

function isPastStartTime(dateValue: string, startTime: string, now = new Date()) {
  if (!dateValue || !startTime) return false;

  const selectedDateTime = new Date(`${dateValue}T${startTime}:00`);

  return selectedDateTime <= now;
}

function getAvailableStartTimeOptions(dateValue: string) {
  return timeOptions.filter((option, index) => {
    const hasValidEndTime = index < timeOptions.length - 1;

    return hasValidEndTime && !isPastStartTime(dateValue, option.value);
  });
}

function getDefaultStartTime(dateValue: string) {
  return getAvailableStartTimeOptions(dateValue)[0]?.value || "";
}

function getDefaultEndTime(startTime: string) {
  if (!startTime) return "";

  return timeOptions.find((option) => option.value > startTime)?.value || "";
}

function getLatestStartTime() {
  return timeOptions[timeOptions.length - 2]?.value || clinicStartTime;
}

function getMinimumStartTimeForDate(dateValue: string) {
  return getDefaultStartTime(dateValue) || clinicEndTime;
}

function getMinimumEndTime(startTime: string) {
  return getDefaultEndTime(startTime) || clinicEndTime;
}

function isWholeHourTime(value: string) {
  return /^\d{2}:00$/.test(value);
}

function isInsideClinicHours(startTime: string, endTime: string) {
  return startTime >= clinicStartTime && startTime < clinicEndTime && endTime > clinicStartTime && endTime <= clinicEndTime;
}

function formatReadableDate(value: string) {
  if (!value) return "Select a date";

  const date = parseDateOnly(value);

  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(value: string) {
  if (!value) return "";

  const [hour, minute] = value.split(":");
  const date = new Date();

  date.setHours(Number(hour), Number(minute), 0, 0);

  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getInitials(name: string) {
  const cleaned = name.replace(/^dr\.?\s+/i, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length === 0) return "DR";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function getShortDoctorName(name: string) {
  if (!name) return "Doctor";

  const cleanedName = name.trim();

  if (!cleanedName) return "Doctor";
  if (/^dr\.?\s/i.test(cleanedName)) return cleanedName;

  return `Dr. ${cleanedName}`;
}

function getNextValidEndTime(startTime: string, currentEndTime: string) {
  const validEndTimes = timeOptions.filter((option) => option.value > startTime);

  if (currentEndTime && currentEndTime > startTime) return currentEndTime;

  return validEndTimes[0]?.value || "";
}

function getScheduleMode(schedule: DoctorSchedule) {
  return schedule.consultation_mode || "In-Person";
}

function splitServices(value: string) {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
  const daysFromMonday = day === 0 ? -6 : 1 - day;

  const weekStart = new Date(selected);
  weekStart.setDate(selected.getDate() + daysFromMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 5);

  return {
    weekStart: toDateInputValue(weekStart),
    weekEnd: toDateInputValue(weekEnd),
  };
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function serviceAllowedByDoctor(serviceName: string, doctorName: string) {
  const service = normalizeText(serviceName);
  const doctor = normalizeText(doctorName);

  if (service === "surgical") {
    return doctor.includes("raisa") && doctor.includes("rosete");
  }

  if (service === "cosmetic surgery") {
    return doctor.includes("reinier") || doctor.includes("konrad");
  }

  return true;
}

export default function StaffSchedulesPage() {
  const today = useMemo(() => new Date(), []);
  const todayValue = useMemo(() => toDateInputValue(today), [today]);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [clinicUnavailableDates, setClinicUnavailableDates] = useState<
    ClinicUnavailableDate[]
  >([]);

  const [calendarMonth, setCalendarMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const [selectedDate, setSelectedDate] = useState(todayValue);
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

  const [clinicClosureForm, setClinicClosureForm] =
    useState<ClinicClosureForm>({
      ...initialClinicClosureForm,
      closure_date: todayValue,
    });

  const [editingDoctorScheduleId, setEditingDoctorScheduleId] = useState<
    number | null
  >(null);

  const [editingClinicClosureId, setEditingClinicClosureId] = useState<
    number | null
  >(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [serviceWarning, setServiceWarning] = useState("");

  const wizardRef = useRef<HTMLDivElement | null>(null);

  const getHeaders = useCallback(() => {
    const { token } = getAuth();

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const fetchDoctors = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/staff/doctors`, {
      headers: getHeaders(),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(getApiErrorMessage(data, "Unable to load doctors."));
    }

    setDoctors(extractArray<Doctor>(data, ["doctors", "users", "data", "items"]));
  }, [getHeaders]);

  const fetchServices = useCallback(async () => {
    const endpoints = [
      `${API_BASE_URL}/staff/services`,
      `${API_BASE_URL}/services`,
      `${API_BASE_URL}/admin/services`,
    ];

    let lastMessage = "Unable to load services.";

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          headers: getHeaders(),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          lastMessage = getApiErrorMessage(data, lastMessage);
          continue;
        }

        const serviceList = extractArray<Partial<Service>>(data, [
          "services",
          "data",
          "items",
          "results",
        ])
          .map((service, index) => normaliseService(service, index))
          .filter((service): service is Service => Boolean(service));

        setServices(serviceList.filter((service) => service.is_active));
        setServiceWarning("");
        return;
      } catch (err) {
        lastMessage = err instanceof Error ? err.message : lastMessage;
      }
    }

    setServices([]);
    setServiceWarning(
      `${lastMessage} The page will use services found from existing schedules for now.`
    );
  }, [getHeaders]);

  const fetchSchedules = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/staff/doctor-schedules`, {
      headers: getHeaders(),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(getApiErrorMessage(data, "Unable to load doctor schedules."));
    }

    setSchedules(
      extractArray<DoctorSchedule>(data, ["schedules", "data", "items", "results"])
    );
  }, [getHeaders]);

  const fetchClinicUnavailableDates = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/staff/clinic-unavailable-dates`, {
      headers: getHeaders(),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(
        getApiErrorMessage(data, "Unable to load clinic unavailable dates.")
      );
    }

    setClinicUnavailableDates(
      extractArray<ClinicUnavailableDate>(data, [
        "clinic_unavailable_dates",
        "unavailable_dates",
        "data",
        "items",
        "results",
      ])
    );
  }, [getHeaders]);

  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const results = await Promise.allSettled([
      fetchDoctors(),
      fetchServices(),
      fetchSchedules(),
      fetchClinicUnavailableDates(),
    ]);

    const criticalErrors = results
      .filter((result, index) => index !== 1 && result.status === "rejected")
      .map((result) =>
        result.status === "rejected" && result.reason instanceof Error
          ? result.reason.message
          : "Something went wrong."
      );

    if (criticalErrors.length > 0) {
      setError(criticalErrors.join(" "));
    }

    setIsLoading(false);
  }, [fetchDoctors, fetchServices, fetchSchedules, fetchClinicUnavailableDates]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const activeDoctors = useMemo(() => {
    return doctors.filter((doctor) => {
      const name = doctor.name || "";
      const status = (doctor.status || "Active").toLowerCase();

      return (
        status === "active" &&
        !name.toLowerCase().includes("placeholder") &&
        name.trim().length > 0
      );
    });
  }, [doctors]);

  const selectedDoctor = useMemo(() => {
    return activeDoctors.find((doctor) => doctor.id === Number(form.doctor_id)) || null;
  }, [activeDoctors, form.doctor_id]);

  const closureDateSet = useMemo(() => {
    return new Set(clinicUnavailableDates.map((item) => item.closure_date));
  }, [clinicUnavailableDates]);

  const selectedClinicClosure = useMemo(() => {
    return (
      clinicUnavailableDates.find((item) => item.closure_date === selectedDate) || null
    );
  }, [clinicUnavailableDates, selectedDate]);

  const formDateClinicClosure = useMemo(() => {
    return (
      clinicUnavailableDates.find((item) => item.closure_date === form.schedule_date) || null
    );
  }, [clinicUnavailableDates, form.schedule_date]);

  const selectedDateIsSunday = isSunday(selectedDate);
  const selectedDateIsPast = isPastDate(selectedDate, todayValue);
  const selectedDateIsClinicClosed = Boolean(selectedClinicClosure);
  const selectedDateHasFutureStartTimes = getAvailableStartTimeOptions(selectedDate).length > 0;
  const selectedDateTimeLocked = !selectedDateIsPast && !selectedDateHasFutureStartTimes;
  const selectedDateBlocked =
    selectedDateIsSunday || selectedDateIsPast || selectedDateIsClinicClosed || selectedDateTimeLocked;

  const filteredSchedules = useMemo(() => {
    if (filterDoctor === "all") return schedules;

    return schedules.filter((schedule) => schedule.doctor_id === Number(filterDoctor));
  }, [schedules, filterDoctor]);

  const selectedDateSchedules = useMemo(() => {
    return filteredSchedules
      .filter((schedule) => schedule.schedule_date === selectedDate)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [filteredSchedules, selectedDate]);

  const allSelectedDateSchedules = useMemo(() => {
    return schedules
      .filter((schedule) => schedule.schedule_date === selectedDate)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules, selectedDate]);

  const existingScheduleForSelectedDate = allSelectedDateSchedules[0] || null;

  const existingScheduleForFormDate = useMemo(() => {
    return (
      schedules.find(
        (schedule) =>
          schedule.schedule_date === form.schedule_date &&
          schedule.id !== editingDoctorScheduleId
      ) || null
    );
  }, [schedules, form.schedule_date, editingDoctorScheduleId]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const blankDays = firstDay.getDay();

    const days: Array<{
      dateValue: string;
      dayNumber: number;
      isBlank: boolean;
      schedules: DoctorSchedule[];
    }> = [];

    for (let i = 0; i < blankDays; i += 1) {
      days.push({
        dateValue: "",
        dayNumber: 0,
        isBlank: true,
        schedules: [],
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const dateValue = toDateInputValue(date);
      const daySchedules = filteredSchedules.filter(
        (schedule) => schedule.schedule_date === dateValue
      );

      days.push({
        dateValue,
        dayNumber: day,
        isBlank: false,
        schedules: daySchedules,
      });
    }

    return days;
  }, [calendarMonth, filteredSchedules]);

  const derivedServices = useMemo(() => {
    const serviceNames = new Set<string>();

    schedules.forEach((schedule) => {
      splitServices(schedule.services).forEach((serviceName) => {
        serviceNames.add(serviceName);
      });
    });

    return Array.from(serviceNames)
      .sort((a, b) => a.localeCompare(b))
      .map((name, index) => ({
        id: -(index + 1),
        name,
        description: null,
        requires_initial_evaluation: /surgical|cosmetic/i.test(name),
        is_active: true,
      }));
  }, [schedules]);

  const serviceOptions = services.length > 0 ? services : derivedServices;

  const availableServiceOptions = useMemo(() => {
    if (!selectedDoctor) return serviceOptions;

    return serviceOptions.map((service) => ({
      ...service,
      isDoctorAllowed: serviceAllowedByDoctor(service.name, selectedDoctor.name),
    }));
  }, [serviceOptions, selectedDoctor]);

  const scheduledDoctorDays = new Set(
    schedules.map((schedule) => schedule.schedule_date)
  ).size;

  const totalDoctorSchedules = schedules.length;
  const clinicClosureCount = clinicUnavailableDates.length;

  function scrollToWizard() {
    window.setTimeout(() => {
      wizardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  function moveCalendarToDate(dateValue: string) {
    if (!dateValue) return;

    const date = parseDateOnly(dateValue);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function syncSelectedDate(dateValue: string, shouldScroll = false) {
    setSelectedDate(dateValue);
    moveCalendarToDate(dateValue);
    setWizardStep("doctor");
    setEditingDoctorScheduleId(null);
    setEditingClinicClosureId(null);

    const defaultStart = getDefaultStartTime(dateValue);

    setForm((current) => ({
      ...initialDoctorForm,
      schedule_date: dateValue,
      start_time: defaultStart,
      end_time: getDefaultEndTime(defaultStart),
      doctor_id: current.doctor_id,
      consultation_mode: current.consultation_mode || "In-Person",
    }));

    setClinicClosureForm((current) => ({
      ...current,
      closure_date: dateValue,
    }));

    setMessage("");

    if (isSunday(dateValue)) {
      setError("Sundays are unavailable for scheduling.");
    } else if (isPastDate(dateValue, todayValue)) {
      setError("Past dates cannot be scheduled. You can still review existing schedules for this date.");
    } else if (closureDateSet.has(dateValue)) {
      setError("This date is marked unavailable for the clinic. Remove the closure before adding a doctor schedule.");
    } else if (getAvailableStartTimeOptions(dateValue).length === 0) {
      setError("No future bookable time slots are left for this date.");
    } else {
      setError("");
    }

    if (shouldScroll) scrollToWizard();
  }

  function resetDoctorForm(step: WizardStep = "doctor") {
    setEditingDoctorScheduleId(null);
    setEditingClinicClosureId(null);
    setWizardStep(step);
    const defaultStart = getDefaultStartTime(selectedDate);

    setForm({
      ...initialDoctorForm,
      schedule_date: selectedDate,
      start_time: defaultStart,
      end_time: getDefaultEndTime(defaultStart),
    });
    setClinicClosureForm({
      ...initialClinicClosureForm,
      closure_date: selectedDate,
    });
    setMessage("");
  }

  function goToPreviousMonth() {
    setCalendarMonth((current) => {
      return new Date(current.getFullYear(), current.getMonth() - 1, 1);
    });
  }

  function goToNextMonth() {
    setCalendarMonth((current) => {
      return new Date(current.getFullYear(), current.getMonth() + 1, 1);
    });
  }

  function handleSelectDate(dateValue: string) {
    syncSelectedDate(dateValue, true);
  }

  function handleSelectDoctor(doctorId: string) {
    const doctor = activeDoctors.find((item) => item.id === Number(doctorId));

    setForm((current) => {
      const nextServices = doctor
        ? current.selected_services.filter((serviceName) =>
            serviceAllowedByDoctor(serviceName, doctor.name)
          )
        : [];

      return {
        ...current,
        doctor_id: doctorId,
        selected_services: nextServices,
      };
    });
  }

  function toggleService(serviceName: string) {
    if (selectedDoctor && !serviceAllowedByDoctor(serviceName, selectedDoctor.name)) {
      setError("That service is restricted to a specific doctor for initial evaluation.");
      return;
    }

    setError("");

    setForm((current) => {
      const alreadySelected = current.selected_services.includes(serviceName);

      return {
        ...current,
        selected_services: alreadySelected
          ? current.selected_services.filter((item) => item !== serviceName)
          : [...current.selected_services, serviceName],
      };
    });
  }

  function removeSelectedService(serviceName: string) {
    setForm((current) => ({
      ...current,
      selected_services: current.selected_services.filter(
        (item) => item !== serviceName
      ),
    }));
  }

  function handleEditDoctorSchedule(schedule: DoctorSchedule) {
    const date = parseDateOnly(schedule.schedule_date);

    setEditingDoctorScheduleId(schedule.id);
    setEditingClinicClosureId(null);
    setWizardStep("doctor");
    setSelectedDate(schedule.schedule_date);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));

    setForm({
      doctor_id: String(schedule.doctor_id),
      selected_services: splitServices(schedule.services),
      schedule_date: schedule.schedule_date,
      start_time: schedule.start_time || "13:00",
      end_time: schedule.end_time || "19:00",
      consultation_mode: schedule.consultation_mode || "In-Person",
      schedule_note: schedule.schedule_note || "",
    });

    setClinicClosureForm((current) => ({
      ...current,
      closure_date: schedule.schedule_date,
    }));

    setMessage("");
    setError("");
    scrollToWizard();
  }

  function handleEditClinicClosure(item: ClinicUnavailableDate) {
    const date = parseDateOnly(item.closure_date);

    setWizardStep("closure");
    setEditingClinicClosureId(item.id);
    setEditingDoctorScheduleId(null);
    setSelectedDate(item.closure_date);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));

    setClinicClosureForm({
      closure_date: item.closure_date,
      reason: item.reason || "",
      note: item.note || "",
    });

    setForm((current) => ({
      ...current,
      schedule_date: item.closure_date,
    }));

    setMessage("");
    setError("");
    scrollToWizard();
  }

  function openClinicClosureFlow() {
    setWizardStep("closure");
    setEditingDoctorScheduleId(null);
    setEditingClinicClosureId(selectedClinicClosure?.id || null);
    setClinicClosureForm({
      closure_date: selectedDate,
      reason: selectedClinicClosure?.reason || "",
      note: selectedClinicClosure?.note || "",
    });
    setMessage("");
    scrollToWizard();
  }

  function canGoToServices() {
    return Boolean(form.doctor_id) && !selectedDateBlocked && !existingScheduleForFormDate;
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
      isWholeHourTime(form.start_time) &&
      isWholeHourTime(form.end_time) &&
      isInsideClinicHours(form.start_time, form.end_time) &&
      !existingScheduleForFormDate &&
      !isPastStartTime(form.schedule_date, form.start_time)
    );
  }

  function validateDoctorScheduleForm() {
    if (isSunday(form.schedule_date)) {
      return "Sundays are unavailable for scheduling.";
    }

    if (isPastDate(form.schedule_date, todayValue)) {
      return "Past dates cannot be scheduled.";
    }

    if (formDateClinicClosure) {
      return "This date is marked unavailable for the clinic.";
    }

    if (getAvailableStartTimeOptions(form.schedule_date).length === 0) {
      return "No future bookable time slots are left for this date.";
    }

    if (existingScheduleForFormDate) {
      return `Only one doctor can be scheduled per day. ${existingScheduleForFormDate.doctor_name} is already scheduled for ${formatReadableDate(form.schedule_date)}.`;
    }

    if (!form.doctor_id) return "Please select a doctor.";

    if (form.selected_services.length === 0) {
      return "Please select at least one service.";
    }

    if (!form.start_time || !form.end_time) {
      return "Please select the bookable time range.";
    }

    if (form.end_time <= form.start_time) {
      return "End time must be later than start time.";
    }

    if (!isWholeHourTime(form.start_time) || !isWholeHourTime(form.end_time)) {
      return "Please use whole-hour schedule times only.";
    }

    if (!isInsideClinicHours(form.start_time, form.end_time)) {
      return `Schedules must stay within ${formatTime(clinicStartTime)} to ${formatTime(clinicEndTime)}.`;
    }

    if (isPastStartTime(form.schedule_date, form.start_time)) {
      return "Past time slots cannot be scheduled.";
    }

    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (wizardStep === "closure") {
      await handleSaveClinicClosure();
      return;
    }

    await handleSaveDoctorSchedule();
  }

  async function handleSaveDoctorSchedule() {
    setIsSaving(true);
    setMessage("");
    setError("");

    const validationMessage = validateDoctorScheduleForm();

    if (validationMessage) {
      setError(validationMessage);
      setIsSaving(false);
      return;
    }

    const payload = {
      doctor_id: Number(form.doctor_id),
      services: servicesToString(form.selected_services),
      schedule_date: form.schedule_date,
      start_time: form.start_time,
      end_time: form.end_time,
      is_available: true,
      consultation_mode: form.consultation_mode || "In-Person",
      unavailable_reason: null,
      schedule_note: (form.schedule_note || "").trim() || null,
    };

    try {
      const url = editingDoctorScheduleId
        ? `${API_BASE_URL}/staff/doctor-schedules/${editingDoctorScheduleId}`
        : `${API_BASE_URL}/staff/doctor-schedules`;

      const res = await fetch(url, {
        method: editingDoctorScheduleId ? "PUT" : "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Unable to save doctor schedule.");
      }

      await fetchSchedules();

      setMessage(
        editingDoctorScheduleId
          ? "Doctor schedule updated successfully."
          : "Doctor schedule saved successfully."
      );

      setEditingDoctorScheduleId(null);
      setWizardStep("doctor");
      const defaultStart = getDefaultStartTime(selectedDate);

      setForm({
        ...initialDoctorForm,
        schedule_date: selectedDate,
        start_time: defaultStart,
        end_time: getDefaultEndTime(defaultStart),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save doctor schedule."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveClinicClosure() {
    setIsSaving(true);
    setMessage("");
    setError("");

    if (!clinicClosureForm.closure_date) {
      setError("Please select a date to mark unavailable.");
      setIsSaving(false);
      return;
    }

    if (isSunday(clinicClosureForm.closure_date)) {
      setError("Sundays are already unavailable by default.");
      setIsSaving(false);
      return;
    }

    if (isPastDate(clinicClosureForm.closure_date, todayValue)) {
      setError("Past dates cannot be marked unavailable.");
      setIsSaving(false);
      return;
    }

    if (!(clinicClosureForm.reason || "").trim()) {
      setError("Please select a reason for marking this date unavailable.");
      setIsSaving(false);
      return;
    }

    const schedulesOnClosureDate = schedules.filter(
      (schedule) =>
        schedule.schedule_date === clinicClosureForm.closure_date &&
        schedule.id !== editingDoctorScheduleId
    );

    if (!editingClinicClosureId && schedulesOnClosureDate.length > 0) {
      setError("Remove the doctor schedules on this date before marking the clinic unavailable.");
      setIsSaving(false);
      return;
    }

    const payload = {
      closure_date: clinicClosureForm.closure_date,
      reason: (clinicClosureForm.reason || "").trim(),
      note: (clinicClosureForm.note || "").trim() || null,
    };

    try {
      const url = editingClinicClosureId
        ? `${API_BASE_URL}/staff/clinic-unavailable-dates/${editingClinicClosureId}`
        : `${API_BASE_URL}/staff/clinic-unavailable-dates`;

      const res = await fetch(url, {
        method: editingClinicClosureId ? "PUT" : "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Unable to save unavailable date.");
      }

      await fetchClinicUnavailableDates();

      setSelectedDate(clinicClosureForm.closure_date);
      moveCalendarToDate(clinicClosureForm.closure_date);

      setMessage(
        editingClinicClosureId
          ? "Unavailable date updated successfully."
          : "Date marked unavailable successfully."
      );

      setEditingClinicClosureId(null);
      setWizardStep("doctor");
      setClinicClosureForm({
        ...initialClinicClosureForm,
        closure_date: clinicClosureForm.closure_date,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save unavailable date."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteDoctorSchedule(scheduleId: number) {
    const confirmed = window.confirm("Delete this doctor schedule?");

    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/staff/doctor-schedules/${scheduleId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Unable to delete doctor schedule.");
      }

      await fetchSchedules();
      setMessage("Doctor schedule removed successfully.");

      if (editingDoctorScheduleId === scheduleId) {
        resetDoctorForm();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete doctor schedule."
      );
    }
  }

  async function handleDeleteClinicClosure(closureId: number) {
    const confirmed = window.confirm("Remove this unavailable date?");

    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      const res = await fetch(
        `${API_BASE_URL}/staff/clinic-unavailable-dates/${closureId}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Unable to delete unavailable date.");
      }

      await fetchClinicUnavailableDates();
      setMessage("Unavailable date removed successfully.");

      if (editingClinicClosureId === closureId) {
        resetDoctorForm();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete unavailable date."
      );
    }
  }

  function handlePrintWeeklySchedules() {
    const { weekStart, weekEnd } = getSelectedWeekRange(selectedDate);

    const weeklyScheduleRows = filteredSchedules
      .filter(
        (schedule) =>
          schedule.schedule_date >= weekStart && schedule.schedule_date <= weekEnd
      )
      .map((schedule) => ({
        sortKey: `${schedule.schedule_date}-${schedule.start_time}`,
        row: [
          formatReadableDate(schedule.schedule_date),
          schedule.is_available ? "Bookable" : "Unavailable",
          schedule.doctor_name || "Doctor unavailable",
          `${formatTime(schedule.start_time)} to ${formatTime(schedule.end_time)}`,
          getScheduleMode(schedule),
          schedule.services || schedule.unavailable_reason || "No services listed",
        ],
      }));

    const weeklyClosureRows = clinicUnavailableDates
      .filter(
        (closure) => closure.closure_date >= weekStart && closure.closure_date <= weekEnd
      )
      .map((closure) => ({
        sortKey: `${closure.closure_date}-00:00`,
        row: [
          formatReadableDate(closure.closure_date),
          "Closed",
          "Clinic Unavailable",
          "Whole day",
          "Clinic Closure",
          closure.reason || "No reason provided",
        ],
      }));

    const printableRows = [...weeklyScheduleRows, ...weeklyClosureRows]
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map((item) => item.row);

    const doctorFilterLabel =
      filterDoctor === "all"
        ? "All doctors"
        : activeDoctors.find((doctor) => doctor.id === Number(filterDoctor))?.name ||
          "Selected doctor";

    printHtmlDocument({
      title: "OurSkin Weekly Doctor Schedule",
      subtitle: `${formatReadableDate(weekStart)} to ${formatReadableDate(
        weekEnd
      )}. Filter: ${doctorFilterLabel}. Sundays are unavailable by default.`,
      headers: [
        "Date",
        "Status",
        "Doctor / Closure",
        "Time",
        "Mode",
        "Services / Reason",
      ],
      rows: printableRows,
      emptyMessage: "No doctor schedules or clinic closures found for this week.",
      orientation: "landscape",
    });
  }

  return (
    <>
      <StaffNavbar />

      <main className={`${staffStyles.staffPage} ${styles.pageShell}`}>
        <section className={styles.heroPanel}>
          <div>
            <span className={styles.eyebrow}>Staff Scheduling</span>
            <h1>Build the clinic calendar</h1>
            <p>
              Pick a day first, then assign the doctor, services, and bookable hours.
              The system checks closure rules, past dates, and doctor conflicts before saving.
            </p>
          </div>

          <div className={styles.heroActions}>
            <button type="button" className={styles.softButton} onClick={handlePrintWeeklySchedules}>
              Export Week
            </button>
            <button type="button" className={styles.primaryButton} onClick={loadPageData}>
              Refresh
            </button>
          </div>
        </section>

        <section className={styles.metricsGrid}>
          <article className={styles.metricCard}>
            <span>Scheduled Days</span>
            <strong>{scheduledDoctorDays}</strong>
            <small>Days with at least one doctor</small>
          </article>

          <article className={styles.metricCard}>
            <span>Total Schedules</span>
            <strong>{totalDoctorSchedules}</strong>
            <small>One doctor schedule per date</small>
          </article>

          <article className={styles.metricCard}>
            <span>Clinic Closures</span>
            <strong>{clinicClosureCount}</strong>
            <small>Unavailable dates blocked from booking</small>
          </article>
        </section>

        {error && <div className={styles.errorBox}>{error}</div>}
        {serviceWarning && <div className={styles.warningBox}>{serviceWarning}</div>}
        {message && <div className={styles.successBox}>{message}</div>}

        <section className={styles.calendarShell}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.stepLabel}>Step 1</span>
              <h2>Choose a schedule date</h2>
              <p>
                Staff starts with the calendar, just like the patient booking flow. Click a day to continue.
              </p>
            </div>

            <div className={styles.monthActions}>
              <button type="button" onClick={goToPreviousMonth}>
                Previous
              </button>
              <strong>
                {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
              </strong>
              <button type="button" onClick={goToNextMonth}>
                Next
              </button>
            </div>
          </div>

          <div className={styles.calendarToolbar}>
            <div>
              <label htmlFor="doctorFilter">Filter calendar by doctor</label>
              <select
                id="doctorFilter"
                value={filterDoctor}
                onChange={(event) => setFilterDoctor(event.target.value)}
              >
                <option value="all">All doctors</option>
                {activeDoctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.legendGroup}>
              <span><i className={styles.dotBookable} /> Scheduled</span>
              <span><i className={styles.dotClosed} /> Closed</span>
              <span><i className={styles.dotSelected} /> Selected</span>
            </div>
          </div>

          <div className={styles.weekdayGrid}>
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className={styles.calendarGrid}>
            {calendarDays.map((day, index) => {
              if (day.isBlank) {
                return <div key={`blank-${index}`} className={styles.blankCalendarDay} />;
              }

              const isSelected = day.dateValue === selectedDate;
              const isSundayDate = isSunday(day.dateValue);
              const isClosedDate = closureDateSet.has(day.dateValue);
              const isPast = isPastDate(day.dateValue, todayValue);
              const uniqueDoctors = Array.from(
                new Map<number, DoctorSchedule>(
                  day.schedules.map((schedule) => [schedule.doctor_id, schedule])
                ).values()
              );

              return (
                <button
                  key={day.dateValue}
                  type="button"
                  className={`${styles.calendarDay} ${isSelected ? styles.selectedDay : ""} ${
                    isSundayDate ? styles.sundayDay : ""
                  } ${isClosedDate ? styles.clinicClosedDay : ""} ${isPast ? styles.pastDay : ""}`}
                  onClick={() => handleSelectDate(day.dateValue)}
                >
                  <span className={styles.dayTopline}>
                    <strong>{day.dayNumber}</strong>
                    {uniqueDoctors.length > 0 && <em>{uniqueDoctors.length}</em>}
                  </span>

                  <span className={styles.dayBadges}>
                    {isSundayDate && <b>Sunday</b>}
                    {!isSundayDate && isClosedDate && <b>Closed</b>}
                    {!isSundayDate && !isClosedDate && isPast && <b>Past</b>}
                  </span>

                  {uniqueDoctors.length > 0 && !isClosedDate && (
                    <span className={styles.doctorAvatars}>
                      {uniqueDoctors.slice(0, 4).map((schedule) => (
                        <i key={schedule.id} title={schedule.doctor_name}>
                          {getInitials(schedule.doctor_name)}
                        </i>
                      ))}
                      {uniqueDoctors.length > 4 && <small>+{uniqueDoctors.length - 4}</small>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section ref={wizardRef} className={styles.workflowShell}>
          <div className={styles.selectedDatePanel}>
            <div>
              <span className={styles.stepLabel}>Step 2</span>
              <h2>{formatReadableDate(selectedDate)}</h2>
              <p>
                {selectedDateIsSunday
                  ? "Sunday is unavailable by default."
                  : selectedDateIsPast
                  ? "Past dates are for review only."
                  : selectedDateIsClinicClosed
                  ? "This date is currently closed for the clinic."
                  : existingScheduleForSelectedDate
                  ? `${getShortDoctorName(existingScheduleForSelectedDate.doctor_name)} is scheduled for this day.`
                  : selectedDateTimeLocked
                  ? "No future bookable time slots are left for this date."
                  : "No doctor schedule yet. Start by choosing a doctor."}
              </p>
            </div>

            <div className={styles.dateActions}>
              <button
                type="button"
                className={styles.softButton}
                disabled={selectedDateIsSunday || selectedDateIsPast || selectedDateTimeLocked || allSelectedDateSchedules.length > 0}
                onClick={openClinicClosureFlow}
              >
                Mark Clinic Closed
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={selectedDateBlocked || Boolean(existingScheduleForSelectedDate)}
                onClick={() => resetDoctorForm("doctor")}
              >
                Add Doctor Schedule
              </button>
            </div>
          </div>

          <div className={styles.selectedDayGrid}>
            <aside className={styles.dayListCard}>
              <div className={styles.cardHeadingRow}>
                <h3>Day Overview</h3>
                <span>{selectedDateSchedules.length > 0 ? "Scheduled" : "Open"}</span>
              </div>

              {isLoading ? (
                <div className={styles.emptyState}>Loading schedules...</div>
              ) : selectedClinicClosure ? (
                <article className={styles.closureCard}>
                  <div>
                    <strong>Clinic Unavailable</strong>
                    <p>{selectedClinicClosure.reason}</p>
                    {selectedClinicClosure.note && <small>{selectedClinicClosure.note}</small>}
                  </div>
                  {!selectedDateIsPast ? (
                    <div>
                      <button type="button" onClick={() => handleEditClinicClosure(selectedClinicClosure)}>
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDeleteClinicClosure(selectedClinicClosure.id)}>
                        Delete
                      </button>
                    </div>
                  ) : (
                    <span className={styles.lockedPill}>Locked</span>
                  )}
                </article>
              ) : selectedDateSchedules.length === 0 ? (
                <div className={styles.emptyState}>
                  {selectedDateIsSunday
                    ? "Sunday is unavailable."
                    : selectedDateIsPast
                    ? "No saved schedule for this past date."
                    : "No doctor has been added for this date yet."}
                </div>
              ) : (
                <div className={styles.scheduleStack}>
                  {selectedDateSchedules.map((schedule) => (
                    <article key={schedule.id} className={styles.scheduleCard}>
                      <div className={styles.avatarCircle}>{getInitials(schedule.doctor_name)}</div>
                      <div className={styles.scheduleInfo}>
                        <div className={styles.cardTopline}>
                          <h3>{getShortDoctorName(schedule.doctor_name)}</h3>
                          <span>Bookable</span>
                        </div>
                        <p>
                          {formatTime(schedule.start_time)} to {formatTime(schedule.end_time)} · {getScheduleMode(schedule)}
                        </p>
                        <small>{schedule.services}</small>
                        {schedule.schedule_note && <em>{schedule.schedule_note}</em>}
                      </div>
                      {!isPastDate(schedule.schedule_date, todayValue) ? (
                        <div className={styles.cardActions}>
                          <button type="button" onClick={() => handleEditDoctorSchedule(schedule)}>
                            Edit
                          </button>
                          <button type="button" onClick={() => handleDeleteDoctorSchedule(schedule.id)}>
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span className={styles.lockedPill}>Locked</span>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </aside>

            <form className={styles.wizardCard} onSubmit={handleSubmit}>
              <div className={styles.wizardHeader}>
                <div>
                  <h3>
                    {wizardStep === "closure"
                      ? editingClinicClosureId
                        ? "Edit clinic closure"
                        : "Mark clinic closed"
                      : editingDoctorScheduleId
                      ? "Edit doctor schedule"
                      : "Add doctor schedule"}
                  </h3>
                  <p>
                    {wizardStep === "closure"
                      ? "Use this only when the whole clinic cannot accept bookings."
                      : existingScheduleForSelectedDate && !editingDoctorScheduleId
                      ? "This date already has a doctor schedule. Edit the saved schedule to make changes."
                      : "Complete the scheduling flow one step at a time."}
                  </p>
                </div>
              </div>

              {wizardStep !== "closure" && (
                <div className={styles.stepper}>
                  {[
                    { key: "doctor", label: "Doctor" },
                    { key: "services", label: "Services" },
                    { key: "time", label: "Time" },
                    { key: "review", label: "Review" },
                  ].map((step, index) => (
                    <button
                      key={step.key}
                      type="button"
                      className={`${styles.stepButton} ${wizardStep === step.key ? styles.stepButtonActive : ""}`}
                      onClick={() => {
                        if (step.key === "services" && !canGoToServices()) return;
                        if (step.key === "time" && !canGoToTime()) return;
                        if (step.key === "review" && !canGoToReview()) return;
                        setWizardStep(step.key as WizardStep);
                      }}
                    >
                      <i>{index + 1}</i>
                      <span>{step.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {wizardStep === "doctor" && (
                <div className={styles.flowPane}>
                  <div className={styles.flowIntro}>
                    <span>Choose doctor</span>
                    <h4>Who will be available on this date?</h4>
                    <p>Only active doctor accounts appear here. Placeholder records are hidden.</p>
                  </div>

                  <div className={styles.doctorGrid}>
                    {activeDoctors.map((doctor) => {
                      const checked = form.doctor_id === String(doctor.id);
                      const doctorScheduleCount = schedules.filter(
                        (schedule) =>
                          schedule.schedule_date === selectedDate && schedule.doctor_id === doctor.id
                      ).length;

                      return (
                        <button
                          key={doctor.id}
                          type="button"
                          className={`${styles.doctorChoice} ${checked ? styles.choiceActive : ""}`}
                          disabled={selectedDateBlocked}
                          onClick={() => handleSelectDoctor(String(doctor.id))}
                        >
                          <i>{getInitials(doctor.name)}</i>
                          <span>
                            <strong>{getShortDoctorName(doctor.name)}</strong>
                            <small>{doctor.specialty || "Dermatology"}</small>
                          </span>
                          {doctorScheduleCount > 0 && <em>{doctorScheduleCount} schedule</em>}
                        </button>
                      );
                    })}
                  </div>

                  <div className={styles.wizardActions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={!canGoToServices()}
                      onClick={() => setWizardStep("services")}
                    >
                      Continue to Services
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === "services" && (
                <div className={styles.flowPane}>
                  <div className={styles.flowIntro}>
                    <span>Choose service coverage</span>
                    <h4>What can this doctor handle during this schedule?</h4>
                    <p>
                      Surgical is limited to Dr. Raisa Rosete. Cosmetic Surgery is limited to Dr. Reinier or Dr. Konrad.
                    </p>
                  </div>

                  {form.selected_services.length > 0 && (
                    <div className={styles.selectedServicePanel}>
                      <span>{form.selected_services.length} selected</span>
                      <div>
                        {form.selected_services.map((serviceName) => (
                          <button
                            key={serviceName}
                            type="button"
                            onClick={() => removeSelectedService(serviceName)}
                          >
                            {serviceName} ×
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={styles.serviceGrid}>
                    {availableServiceOptions.length === 0 ? (
                      <div className={styles.emptyState}>No active services were loaded.</div>
                    ) : (
                      availableServiceOptions.map((service) => {
                        const checked = form.selected_services.includes(service.name);
                        const isAllowed = "isDoctorAllowed" in service ? service.isDoctorAllowed : true;

                        return (
                          <button
                            key={`${service.id}-${service.name}`}
                            type="button"
                            className={`${styles.serviceChoice} ${checked ? styles.choiceActive : ""}`}
                            disabled={!isAllowed || selectedDateBlocked}
                            onClick={() => toggleService(service.name)}
                          >
                            <span className={styles.checkBox}>{checked ? "✓" : ""}</span>
                            <strong>{service.name}</strong>
                            {service.requires_initial_evaluation && <em>Initial evaluation</em>}
                            {!isAllowed && <small>Not allowed for selected doctor</small>}
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className={styles.wizardActions}>
                    <button type="button" className={styles.softButton} onClick={() => setWizardStep("doctor")}>
                      Back
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={!canGoToTime()}
                      onClick={() => setWizardStep("time")}
                    >
                      Continue to Time
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === "time" && (
                <div className={styles.flowPane}>
                  <div className={styles.flowIntro}>
                    <span>Choose bookable hours</span>
                    <h4>Set the range patients can book</h4>
                    <p>Patients will see one-hour appointment slots inside this schedule window.</p>
                  </div>

                  {existingScheduleForFormDate && (
                    <div className={styles.conflictPreview}>
                      <strong>One doctor per day rule</strong>
                      <span>
                        {existingScheduleForFormDate.doctor_name} is already scheduled from {formatTime(existingScheduleForFormDate.start_time)} to {formatTime(existingScheduleForFormDate.end_time)}.
                      </span>
                    </div>
                  )}

                  <div className={styles.timePanels}>
                    <label className={styles.timeField}>
                      <span>Start Time</span>
                      <div className={styles.timeInputShell}>
                        <span className={styles.clockIcon} aria-hidden="true">⌚</span>
                        <input
                          type="time"
                          value={form.start_time}
                          min={getMinimumStartTimeForDate(form.schedule_date)}
                          max={getLatestStartTime()}
                          step={3600}
                          disabled={selectedDateBlocked}
                          onChange={(event) => {
                            const nextStartTime = event.target.value;

                            setForm((current) => ({
                              ...current,
                              start_time: nextStartTime,
                              end_time: getNextValidEndTime(nextStartTime, current.end_time),
                            }));
                          }}
                        />
                      </div>
                      <small>Earliest schedule starts at {formatTime(clinicStartTime)}.</small>
                    </label>

                    <label className={styles.timeField}>
                      <span>End Time</span>
                      <div className={styles.timeInputShell}>
                        <span className={styles.clockIcon} aria-hidden="true">⌚</span>
                        <input
                          type="time"
                          value={form.end_time}
                          min={getMinimumEndTime(form.start_time)}
                          max={clinicEndTime}
                          step={3600}
                          disabled={selectedDateBlocked || !form.start_time}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              end_time: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <small>Latest schedule ends at {formatTime(clinicEndTime)}.</small>
                    </label>
                  </div>

                  <div className={styles.formGridTwo}>
                    <label>
                      Consultation Mode
                      <select
                        value={form.consultation_mode}
                        disabled={selectedDateBlocked}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            consultation_mode: event.target.value,
                          }))
                        }
                      >
                        <option value="In-Person">In-Person Consultation</option>
                        <option value="Online Consultation">Online Consultation</option>
                      </select>
                    </label>

                    <label>
                      Internal Note
                      <input
                        type="text"
                        placeholder="Optional staff note"
                        value={form.schedule_note}
                        disabled={selectedDateBlocked}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            schedule_note: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  {existingScheduleForFormDate && (
                    <div className={styles.errorMini}>
                      Only one doctor can be scheduled per date. Edit the existing schedule instead.
                    </div>
                  )}

                  <div className={styles.wizardActions}>
                    <button type="button" className={styles.softButton} onClick={() => setWizardStep("services")}>
                      Back
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={!canGoToReview()}
                      onClick={() => setWizardStep("review")}
                    >
                      Review Schedule
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === "review" && (
                <div className={styles.flowPane}>
                  <div className={styles.flowIntro}>
                    <span>Final review</span>
                    <h4>Confirm before saving</h4>
                    <p>This will become visible to patient booking for the selected services.</p>
                  </div>

                  <div className={styles.reviewBox}>
                    <dl>
                      <div>
                        <dt>Date</dt>
                        <dd>{formatReadableDate(form.schedule_date)}</dd>
                      </div>
                      <div>
                        <dt>Doctor</dt>
                        <dd>{selectedDoctor ? getShortDoctorName(selectedDoctor.name) : "No doctor selected"}</dd>
                      </div>
                      <div>
                        <dt>Time</dt>
                        <dd>{formatTime(form.start_time)} to {formatTime(form.end_time)}</dd>
                      </div>
                      <div>
                        <dt>Mode</dt>
                        <dd>{form.consultation_mode}</dd>
                      </div>
                      <div>
                        <dt>Services</dt>
                        <dd>{form.selected_services.join(", ")}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className={styles.wizardActions}>
                    <button type="button" className={styles.softButton} onClick={() => setWizardStep("time")}>
                      Back
                    </button>
                    <button type="submit" className={styles.primaryButton} disabled={isSaving || !canGoToReview()}>
                      {isSaving ? "Saving..." : editingDoctorScheduleId ? "Update Schedule" : "Save Doctor Schedule"}
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === "closure" && (
                <div className={styles.flowPane}>
                  <div className={styles.flowIntro}>
                    <span>Clinic closure</span>
                    <h4>Block the whole clinic date</h4>
                    <p>Use this for holidays, clinic events, maintenance, or emergency closures.</p>
                  </div>

                  <div className={styles.formGridTwo}>
                    <label>
                      Unavailable Date
                      <input
                        type="date"
                        value={clinicClosureForm.closure_date}
                        onChange={(event) => {
                          const nextDate = event.target.value;
                          syncSelectedDate(nextDate);
                          setWizardStep("closure");
                          setClinicClosureForm((current) => ({
                            ...current,
                            closure_date: nextDate,
                          }));
                        }}
                      />
                    </label>

                    <label>
                      Reason
                      <select
                        value={clinicClosureForm.reason}
                        disabled={isSunday(clinicClosureForm.closure_date)}
                        onChange={(event) =>
                          setClinicClosureForm((current) => ({
                            ...current,
                            reason: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select reason</option>
                        {clinicUnavailableReasons.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className={styles.fullField}>
                    Note
                    <input
                      type="text"
                      placeholder="Example: Public holiday or clinic maintenance"
                      value={clinicClosureForm.note}
                      disabled={isSunday(clinicClosureForm.closure_date)}
                      onChange={(event) =>
                        setClinicClosureForm((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <div className={styles.wizardActions}>
                    <button type="button" className={styles.softButton} onClick={() => resetDoctorForm("doctor")}>
                      Cancel
                    </button>
                    <button type="submit" className={styles.primaryButton} disabled={isSaving}>
                      {isSaving
                        ? "Saving..."
                        : editingClinicClosureId
                        ? "Update Closure"
                        : "Save Clinic Closure"}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
