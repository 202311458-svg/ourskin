"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import StaffNavbar from "@/app/components/StaffNavbar";
import { API_BASE_URL, getAuth } from "@/lib/api";
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
  is_available: boolean;
  consultation_mode: string;
  unavailable_reason: string;
  schedule_note: string;
};

type ClinicClosureForm = {
  closure_date: string;
  reason: string;
  note: string;
};

type ScheduleType = "doctor" | "clinic";

const initialDoctorForm: ScheduleForm = {
  doctor_id: "",
  selected_services: [],
  schedule_date: "",
  start_time: "13:00",
  end_time: "19:00",
  is_available: true,
  consultation_mode: "In-Person",
  unavailable_reason: "",
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
  "Clinic Event",
  "Emergency Closure",
  "Maintenance",
  "Other",
];

const timeOptions = [
  { value: "09:00", label: "9:00 AM" },
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

function formatReadableDate(value: string) {
  if (!value) return "Selected date";

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

function getShortDoctorName(name: string) {
  if (!name) return "Doctor";

  const cleanedName = name.trim();

  if (!cleanedName) return "Doctor";

  if (/^dr\.?\s/i.test(cleanedName)) {
    return cleanedName;
  }

  return `Dr. ${cleanedName}`;
}

function getNextValidEndTime(startTime: string, currentEndTime: string) {
  const validEndTimes = timeOptions.filter((option) => option.value > startTime);

  if (currentEndTime && currentEndTime > startTime) {
    return currentEndTime;
  }

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
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;

    for (const key of keys) {
      if (Array.isArray(record[key])) {
        return record[key] as T[];
      }
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
  const [scheduleType, setScheduleType] = useState<ScheduleType>("doctor");

  const [form, setForm] = useState<ScheduleForm>({
    ...initialDoctorForm,
    schedule_date: todayValue,
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
  const scheduleListRef = useRef<HTMLDivElement | null>(null);

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

  const closureDateSet = useMemo(() => {
    return new Set(clinicUnavailableDates.map((item) => item.closure_date));
  }, [clinicUnavailableDates]);

  const selectedClinicClosure = useMemo(() => {
    return (
      clinicUnavailableDates.find(
        (item) => item.closure_date === selectedDate
      ) || null
    );
  }, [clinicUnavailableDates, selectedDate]);

  const formDateClinicClosure = useMemo(() => {
    return (
      clinicUnavailableDates.find(
        (item) => item.closure_date === form.schedule_date
      ) || null
    );
  }, [clinicUnavailableDates, form.schedule_date]);

  const selectedDateIsSunday = isSunday(selectedDate);
  const selectedDateIsClinicClosed = Boolean(selectedClinicClosure);
  const formDateIsSunday = isSunday(form.schedule_date);
  const doctorFormDisabled = formDateIsSunday || Boolean(formDateClinicClosure);
  const clinicClosureFormDateIsSunday = isSunday(clinicClosureForm.closure_date);

  const filteredSchedules = useMemo(() => {
    if (filterDoctor === "all") {
      return schedules;
    }

    return schedules.filter(
      (schedule) => schedule.doctor_id === Number(filterDoctor)
    );
  }, [schedules, filterDoctor]);

  const selectedDateSchedules = useMemo(() => {
    return filteredSchedules
      .filter((schedule) => schedule.schedule_date === selectedDate)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [filteredSchedules, selectedDate]);

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

  const scheduledDoctorDays = new Set(
    filteredSchedules.map((schedule) => schedule.schedule_date)
  ).size;

  const bookableDoctorDays = new Set(
    filteredSchedules
      .filter((schedule) => schedule.is_available)
      .map((schedule) => schedule.schedule_date)
  ).size;

  const clinicClosureCount = clinicUnavailableDates.length;

  function moveCalendarToDate(dateValue: string) {
    if (!dateValue) return;

    const date = parseDateOnly(dateValue);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function syncSelectedDate(dateValue: string) {
    const sunday = isSunday(dateValue);

    setSelectedDate(dateValue);
    moveCalendarToDate(dateValue);

    setForm((current) => ({
      ...current,
      schedule_date: dateValue,
      is_available: true,
      unavailable_reason: "",
    }));

    setClinicClosureForm((current) => ({
      ...current,
      closure_date: dateValue,
    }));

    if (sunday) {
      setError("Sundays are unavailable for scheduling.");
      return;
    }

    setError("");
  }

  function resetForms() {
    setEditingDoctorScheduleId(null);
    setEditingClinicClosureId(null);
    setScheduleType("doctor");

    setForm({
      ...initialDoctorForm,
      schedule_date: selectedDate,
      is_available: true,
      unavailable_reason: "",
    });

    setClinicClosureForm({
      ...initialClinicClosureForm,
      closure_date: selectedDate,
    });

    setMessage("");
    setError(isSunday(selectedDate) ? "Sundays are unavailable for scheduling." : "");
  }

  function handleScheduleTypeChange(nextType: ScheduleType) {
    setScheduleType(nextType);
    setEditingDoctorScheduleId(null);
    setEditingClinicClosureId(null);
    setMessage("");

    if (isSunday(selectedDate)) {
      setError("Sundays are unavailable for scheduling.");
      return;
    }

    setError("");
  }

  function handleSelectDate(dateValue: string) {
    setMessage("");
    syncSelectedDate(dateValue);
  }


  function handleViewScheduleFromCalendar(dateValue: string) {
    setMessage("");
    syncSelectedDate(dateValue);

    window.setTimeout(() => {
      scheduleListRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
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

  function toggleService(serviceName: string) {
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

    setScheduleType("doctor");
    setEditingDoctorScheduleId(schedule.id);
    setEditingClinicClosureId(null);
    setSelectedDate(schedule.schedule_date);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));

    setForm({
      doctor_id: String(schedule.doctor_id),
      selected_services: splitServices(schedule.services),
      schedule_date: schedule.schedule_date,
      start_time: schedule.start_time || "",
      end_time: schedule.end_time || "",
      is_available: schedule.is_available,
      consultation_mode: schedule.consultation_mode || "In-Person",
      unavailable_reason: schedule.unavailable_reason || "",
      schedule_note: schedule.schedule_note || "",
    });

    setClinicClosureForm((current) => ({
      ...current,
      closure_date: schedule.schedule_date,
    }));

    setMessage("");
    setError(
      isSunday(schedule.schedule_date)
        ? "Sundays are unavailable for scheduling."
        : ""
    );
  }

  function handleEditClinicClosure(item: ClinicUnavailableDate) {
    const date = parseDateOnly(item.closure_date);

    setScheduleType("clinic");
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
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (scheduleType === "clinic") {
      await handleSaveClinicClosure();
      return;
    }

    await handleSaveDoctorSchedule();
  }

  async function handleSaveDoctorSchedule() {
    setIsSaving(true);
    setMessage("");
    setError("");

    if (isSunday(form.schedule_date)) {
      setError("Sundays are unavailable for scheduling.");
      setIsSaving(false);
      return;
    }

    if (formDateClinicClosure) {
      setError("This date is marked unavailable for the clinic.");
      setIsSaving(false);
      return;
    }

    if (
      !form.doctor_id ||
      form.selected_services.length === 0 ||
      !form.schedule_date ||
      !form.start_time ||
      !form.end_time
    ) {
      setError("Please complete all required doctor schedule fields.");
      setIsSaving(false);
      return;
    }

    if (form.end_time <= form.start_time) {
      setError("End time must be later than start time.");
      setIsSaving(false);
      return;
    }

    const existingScheduleForDate = schedules.find(
      (schedule) =>
        schedule.schedule_date === form.schedule_date &&
        schedule.id !== editingDoctorScheduleId
    );

    if (existingScheduleForDate) {
      setError(
        `Only one doctor schedule can be created per day. ${existingScheduleForDate.doctor_name} is already scheduled for ${formatReadableDate(form.schedule_date)}.`
      );
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
          : "Doctor assigned for the day successfully."
      );

      setEditingDoctorScheduleId(null);
      setForm({
        ...initialDoctorForm,
        schedule_date: selectedDate,
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

    if (!(clinicClosureForm.reason || "").trim()) {
      setError("Please select a reason for marking this date unavailable.");
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
    const confirmed = window.confirm("Delete this scheduled doctor for the day?");

    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      const res = await fetch(
        `${API_BASE_URL}/staff/doctor-schedules/${scheduleId}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Unable to delete doctor schedule.");
      }

      await fetchSchedules();
      setMessage("Scheduled doctor removed successfully.");

      if (editingDoctorScheduleId === scheduleId) {
        resetForms();
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
        resetForms();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete unavailable date."
      );
    }
  }

  return (
    <>
      <StaffNavbar />

      <main className={`${staffStyles.staffPage} ${styles.pageShell}`}>
        <div className={staffStyles.dashboardHeader}>
          <div>
            <h1>Doctor Schedule Calendar</h1>
            <p className={staffStyles.pageSubtext}>
              Assign one doctor per day, set bookable consultation hours, and manage
              clinic-wide unavailable dates for patient booking.
            </p>
          </div>

          <button
            type="button"
            className={staffStyles.actionBtn}
            onClick={loadPageData}
          >
            Refresh
          </button>
        </div>

        <section className={staffStyles.statsGrid}>
          <div className={staffStyles.statCard}>
            <div className={staffStyles.statLabel}>Scheduled Doctor Days</div>
            <div className={staffStyles.statValue}>{scheduledDoctorDays}</div>
            <div className={staffStyles.statMeta}>One doctor schedule per date</div>
          </div>

          <div className={staffStyles.statCard}>
            <div className={staffStyles.statLabel}>Bookable Doctor Days</div>
            <div className={staffStyles.statValue}>{bookableDoctorDays}</div>
            <div className={staffStyles.statMeta}>Visible in patient booking</div>
          </div>

          <div className={staffStyles.statCard}>
            <div className={staffStyles.statLabel}>Closed Dates</div>
            <div className={staffStyles.statValue}>{clinicClosureCount}</div>
            <div className={staffStyles.statMeta}>
              Holidays and clinic closures
            </div>
          </div>
        </section>

        {error && <div className={styles.errorBox}>{error}</div>}
        {serviceWarning && (
          <div className={styles.warningBox}>{serviceWarning}</div>
        )}
        {message && <div className={styles.successBox}>{message}</div>}

        <section className={styles.scheduleLayout}>
          <div className={`${staffStyles.listCard} ${styles.calendarCard}`}>
            <div className={staffStyles.listHeader}>
              <div>
                <h2>
                  {monthNames[calendarMonth.getMonth()]}{" "}
                  {calendarMonth.getFullYear()}
                </h2>
                <p className={staffStyles.pageSubtext}>
                  Select a date to view schedules or mark a whole date
                  unavailable. Sundays are unavailable by default.
                </p>
              </div>

              <div className={styles.monthActions}>
                <button type="button" onClick={goToPreviousMonth}>
                  Previous
                </button>
                <button type="button" onClick={goToNextMonth}>
                  Next
                </button>
              </div>
            </div>

            <div className={styles.filterBar}>
              <label htmlFor="doctorFilter">Filter doctor</label>
              <select
                id="doctorFilter"
                value={filterDoctor}
                onChange={(event) => setFilterDoctor(event.target.value)}
              >
                <option value="all">All doctors</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.weekdayGrid}>
              {weekDays.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                if (day.isBlank) {
                  return (
                    <div
                      key={`blank-${index}`}
                      className={styles.blankCalendarDay}
                    />
                  );
                }

                const isSelected = day.dateValue === selectedDate;
                const isSundayDate = isSunday(day.dateValue);
                const isClinicClosedDate = closureDateSet.has(day.dateValue);
                const schedulePreview = day.schedules[0];

                return (
                  <div
                    key={day.dateValue}
                    role="button"
                    tabIndex={0}
                    className={`${styles.calendarDay} ${
                      isSelected ? styles.selectedDay : ""
                    } ${isSundayDate ? styles.sundayDay : ""} ${
                      isClinicClosedDate ? styles.clinicClosedDay : ""
                    }`}
                    onClick={() => handleSelectDate(day.dateValue)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleSelectDate(day.dateValue);
                      }
                    }}
                  >
                    <span className={styles.dayNumber}>{day.dayNumber}</span>

                    {isSundayDate && (
                      <span className={styles.closedBadge}>Sunday</span>
                    )}

                    {!isSundayDate && isClinicClosedDate && (
                      <span className={styles.closureBadge}>Closed</span>
                    )}

                    {!isSundayDate &&
                      !isClinicClosedDate &&
                      schedulePreview && (
                        <button
                          type="button"
                          className={styles.dayDoctorButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleViewScheduleFromCalendar(day.dateValue);
                          }}
                          title={`View schedule for ${schedulePreview.doctor_name}`}
                        >
                          {getShortDoctorName(schedulePreview.doctor_name)}
                        </button>
                      )}
                  </div>
                );
              })}
            </div>
          </div>

          <aside className={`${staffStyles.listCard} ${styles.formCard}`}>
            <div className={staffStyles.listHeader}>
              <div>
                <h2>
                  {scheduleType === "clinic"
                    ? editingClinicClosureId
                      ? "Edit Unavailable Date"
                      : "Mark Date Unavailable"
                    : editingDoctorScheduleId
                    ? "Edit Scheduled Doctor"
                    : "Assign Doctor for the Day"}
                </h2>
                <p className={staffStyles.pageSubtext}>
                  {formatReadableDate(
                    scheduleType === "clinic"
                      ? clinicClosureForm.closure_date
                      : form.schedule_date
                  )}
                </p>
              </div>
            </div>

            <form className={styles.scheduleForm} onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="scheduleType">Schedule Type</label>
                <select
                  id="scheduleType"
                  value={scheduleType}
                  onChange={(event) =>
                    handleScheduleTypeChange(event.target.value as ScheduleType)
                  }
                >
                  <option value="doctor">Doctor Schedule</option>
                  <option value="clinic">Mark Date Unavailable</option>
                </select>
              </div>

              {scheduleType === "doctor" && (
                <>
                  <div className={styles.formGroup}>
                    <label htmlFor="doctor">Doctor</label>
                    <select
                      id="doctor"
                      value={form.doctor_id}
                      disabled={doctorFormDisabled}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          doctor_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select doctor</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <div className={styles.serviceHeader}>
                      <div>
                        <label>Service/s</label>
                        <p>Choose the services this doctor can handle on this scheduled day.</p>
                      </div>
                      <span className={styles.serviceCounter}>
                        {form.selected_services.length} selected
                      </span>
                    </div>

                    {form.selected_services.length > 0 && (
                      <div className={styles.selectedServicePanel}>
                        <span>Selected services</span>
                        <div className={styles.selectedServiceList}>
                          {form.selected_services.map((serviceName) => (
                            <button
                              key={serviceName}
                              type="button"
                              className={styles.selectedServiceChip}
                              disabled={doctorFormDisabled}
                              onClick={() => removeSelectedService(serviceName)}
                            >
                              {serviceName} ×
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className={styles.servicePicker}>
                      {serviceOptions.length === 0 ? (
                        <div className={styles.serviceEmpty}>
                          No services were loaded. Please check the services table
                          or the /staff/services endpoint.
                        </div>
                      ) : (
                        serviceOptions.map((service) => {
                          const checked = form.selected_services.includes(
                            service.name
                          );

                          return (
                            <label
                              key={`${service.id}-${service.name}`}
                              className={`${styles.serviceCard} ${
                                checked ? styles.serviceCardActive : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                className={styles.serviceCheckbox}
                                checked={checked}
                                disabled={doctorFormDisabled}
                                onChange={() => toggleService(service.name)}
                              />

                              <span className={styles.serviceCheckMark}>
                                {checked ? "✓" : ""}
                              </span>

                              <span className={styles.serviceCardBody}>
                                <strong>{service.name}</strong>

                                {service.description && (
                                  <small>{service.description}</small>
                                )}

                                <span className={styles.serviceBadgeRow}>
                                  {service.requires_initial_evaluation && (
                                    <em>Initial evaluation</em>
                                  )}
                                  {service.id < 0 && (
                                    <em>From existing schedule</em>
                                  )}
                                </span>
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>

                    <small>
                      Services must come from the official service list to keep
                      patient booking, staff scheduling, and doctor assignment
                      aligned.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="consultationMode">Consultation Mode</label>
                    <select
                      id="consultationMode"
                      value={form.consultation_mode}
                      disabled={doctorFormDisabled}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          consultation_mode: event.target.value,
                        }))
                      }
                    >
                      <option value="In-Person">In-Person Consultation</option>
                      <option value="Online Consultation">
                        Online Consultation
                      </option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="scheduleDate">Date</label>
                    <input
                      id="scheduleDate"
                      type="date"
                      value={form.schedule_date}
                      onChange={(event) => syncSelectedDate(event.target.value)}
                    />
                  </div>

                  <div className={styles.timeSelectorPanel}>
                    <div className={styles.timeSelectorHeader}>
                      <div>
                        <label>Bookable Hours</label>
                        <p>Choose the range patients can book from this doctor’s day schedule.</p>
                      </div>
                      <span className={styles.timeSummary}>
                        {form.start_time && form.end_time
                          ? `${formatTime(form.start_time)} to ${formatTime(form.end_time)}`
                          : "Select hours"}
                      </span>
                    </div>

                    <div className={styles.timePickerGroup}>
                      <span className={styles.timeColumnLabel}>Start Time</span>
                      <div className={styles.timeButtonGrid}>
                        {timeOptions
                          .filter((option) => !form.end_time || option.value < form.end_time)
                          .map((option) => (
                            <button
                              key={`start-${option.value}`}
                              type="button"
                              className={`${styles.timeChoice} ${
                                form.start_time === option.value
                                  ? styles.timeChoiceActive
                                  : ""
                              }`}
                              disabled={doctorFormDisabled}
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  start_time: option.value,
                                  end_time: getNextValidEndTime(
                                    option.value,
                                    current.end_time
                                  ),
                                }))
                              }
                            >
                              {option.label}
                            </button>
                          ))}
                      </div>
                    </div>

                    <div className={styles.timePickerGroup}>
                      <span className={styles.timeColumnLabel}>End Time</span>
                      <div className={styles.timeButtonGrid}>
                        {timeOptions
                          .filter((option) => option.value > form.start_time)
                          .map((option) => (
                            <button
                              key={`end-${option.value}`}
                              type="button"
                              className={`${styles.timeChoice} ${
                                form.end_time === option.value
                                  ? styles.timeChoiceActive
                                  : ""
                              }`}
                              disabled={doctorFormDisabled}
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  end_time: option.value,
                                }))
                              }
                            >
                              {option.label}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>

                  <div className={styles.scheduleRuleNotice}>
                    <strong>Bookable schedule</strong>
                    <span>
                      Doctor schedules are automatically available to the patient booking flow.
                      Use Mark Date Unavailable only when the clinic is closed for the selected date.
                    </span>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="scheduleNote">Schedule Note</label>
                    <input
                      id="scheduleNote"
                      type="text"
                      placeholder="Optional note for staff reference"
                      value={form.schedule_note || ""}
                      disabled={doctorFormDisabled}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          schedule_note: event.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              )}

              {scheduleType === "clinic" && (
                <>
                  <div className={styles.formGroup}>
                    <label htmlFor="closureDate">Unavailable Date</label>
                    <input
                      id="closureDate"
                      type="date"
                      value={clinicClosureForm.closure_date}
                      onChange={(event) => {
                        const nextDate = event.target.value;

                        syncSelectedDate(nextDate);

                        setClinicClosureForm((current) => ({
                          ...current,
                          closure_date: nextDate,
                        }));
                      }}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="closureReason">
                      Unavailable Reason
                    </label>
                    <select
                      id="closureReason"
                      value={clinicClosureForm.reason}
                      disabled={clinicClosureFormDateIsSunday}
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
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="closureNote">Note</label>
                    <input
                      id="closureNote"
                      type="text"
                      placeholder="Example: Public holiday, clinic maintenance, emergency closure"
                      value={clinicClosureForm.note || ""}
                      disabled={clinicClosureFormDateIsSunday}
                      onChange={(event) =>
                        setClinicClosureForm((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              )}

              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={staffStyles.acceptBtn}
                  disabled={
                    isSaving ||
                    (scheduleType === "doctor" && doctorFormDisabled) ||
                    (scheduleType === "clinic" && clinicClosureFormDateIsSunday)
                  }
                >
                  {isSaving
                    ? "Saving..."
                    : scheduleType === "clinic"
                    ? editingClinicClosureId
                      ? "Update Unavailable Date"
                      : "Mark Date Unavailable"
                    : editingDoctorScheduleId
                    ? "Update Schedule"
                    : "Assign Doctor"}
                </button>

                {(editingDoctorScheduleId || editingClinicClosureId) && (
                  <button
                    type="button"
                    className={staffStyles.secondaryBtn}
                    onClick={resetForms}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </aside>
        </section>

        <section ref={scheduleListRef} className={`${staffStyles.listCard} ${styles.scheduleList}`}>
          <div className={staffStyles.listHeader}>
            <div>
              <h2>Schedules for {formatReadableDate(selectedDate)}</h2>
              <p className={staffStyles.pageSubtext}>
                {selectedDateIsSunday
                  ? "This day is unavailable by default."
                  : selectedDateIsClinicClosed
                  ? "This date has a clinic-wide unavailable status."
                  : selectedDateSchedules.length > 0
                  ? "One doctor is scheduled for this date."
                  : "No doctor is scheduled for this date yet."}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className={staffStyles.emptyState}>Loading schedules...</div>
          ) : selectedDateIsSunday ? (
            <div className={staffStyles.emptyState}>
              Sundays are unavailable for scheduling.
            </div>
          ) : (
            <>
              {selectedClinicClosure && (
                <article className={styles.scheduleCard}>
                  <div className={styles.scheduleInfo}>
                    <div className={styles.cardTop}>
                      <h3>Clinic Unavailable</h3>
                      <span
                        className={`${staffStyles.badge} ${staffStyles.statusDeclined}`}
                      >
                        Closed
                      </span>
                    </div>

                    <p className={styles.unavailableText}>
                      Reason: {selectedClinicClosure.reason}
                    </p>

                    {selectedClinicClosure.note && (
                      <p className={styles.noteText}>
                        Note: {selectedClinicClosure.note}
                      </p>
                    )}
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={staffStyles.actionBtn}
                      onClick={() => handleEditClinicClosure(selectedClinicClosure)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() =>
                        handleDeleteClinicClosure(selectedClinicClosure.id)
                      }
                    >
                      Delete
                    </button>
                  </div>
                </article>
              )}

              {selectedDateSchedules.length === 0 ? (
                <div className={staffStyles.emptyState}>
                  {selectedClinicClosure
                    ? "No doctor schedules are listed for this unavailable date."
                    : "No doctor has been assigned for this date yet."}
                </div>
              ) : (
                <div className={styles.scheduleCards}>
                  {selectedDateSchedules.map((schedule) => (
                    <article key={schedule.id} className={styles.scheduleCard}>
                      <div className={styles.scheduleInfo}>
                        <div className={styles.cardTop}>
                          <h3>{schedule.doctor_name}</h3>
                          <span
                            className={`${staffStyles.badge} ${
                              schedule.is_available
                                ? staffStyles.statusApproved
                                : staffStyles.statusDeclined
                            }`}
                          >
                            {schedule.is_available
                              ? "Bookable"
                              : "Unavailable"}
                          </span>
                        </div>

                        <p className={styles.timeText}>
                          {formatTime(schedule.start_time)} to{" "}
                          {formatTime(schedule.end_time)}
                        </p>

                        <p className={styles.modeText}>
                          {getScheduleMode(schedule)}
                        </p>

                        <p className={styles.serviceText}>
                          {schedule.services}
                        </p>

                        {!schedule.is_available &&
                          schedule.unavailable_reason && (
                            <p className={styles.unavailableText}>
                              Reason: {schedule.unavailable_reason}
                            </p>
                          )}

                        {schedule.schedule_note && (
                          <p className={styles.noteText}>
                            Note: {schedule.schedule_note}
                          </p>
                        )}
                      </div>

                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={staffStyles.actionBtn}
                          onClick={() => handleEditDoctorSchedule(schedule)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() =>
                            handleDeleteDoctorSchedule(schedule.id)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}