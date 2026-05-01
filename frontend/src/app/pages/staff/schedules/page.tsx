"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  services: string;
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
  services: "",
  schedule_date: "",
  start_time: "",
  end_time: "",
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

const unavailableReasons = [
  "Holiday",
  "Doctor Leave",
  "Clinic Event",
  "Emergency Closure",
  "Other",
];

const clinicUnavailableReasons = [
  "Holiday",
  "Clinic Event",
  "Emergency Closure",
  "Maintenance",
  "Other",
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

function getScheduleMode(schedule: DoctorSchedule) {
  return schedule.consultation_mode || "In-Person";
}

export default function StaffSchedulesPage() {
  const today = useMemo(() => new Date(), []);
  const todayValue = useMemo(() => toDateInputValue(today), [today]);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
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

    if (!res.ok) {
      throw new Error("Unable to load doctors.");
    }

    const data = await res.json();
    setDoctors(Array.isArray(data) ? data : []);
  }, [getHeaders]);

  const fetchSchedules = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/staff/doctor-schedules`, {
      headers: getHeaders(),
    });

    if (!res.ok) {
      throw new Error("Unable to load doctor schedules.");
    }

    const data = await res.json();
    setSchedules(Array.isArray(data) ? data : []);
  }, [getHeaders]);

  const fetchClinicUnavailableDates = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/staff/clinic-unavailable-dates`, {
      headers: getHeaders(),
    });

    if (!res.ok) {
      throw new Error("Unable to load clinic unavailable dates.");
    }

    const data = await res.json();
    setClinicUnavailableDates(Array.isArray(data) ? data : []);
  }, [getHeaders]);

  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      await Promise.all([
        fetchDoctors(),
        fetchSchedules(),
        fetchClinicUnavailableDates(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchDoctors, fetchSchedules, fetchClinicUnavailableDates]);

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

  const totalSlots = filteredSchedules.length;
  const availableSlots = filteredSchedules.filter(
    (schedule) => schedule.is_available
  ).length;
  const unavailableSlots = totalSlots - availableSlots;
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
      is_available: sunday ? false : current.is_available,
      unavailable_reason: sunday ? "Sunday Unavailable" : current.unavailable_reason,
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
      is_available: !isSunday(selectedDate),
      unavailable_reason: isSunday(selectedDate) ? "Sunday Unavailable" : "",
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

  function handleEditDoctorSchedule(schedule: DoctorSchedule) {
    const date = parseDateOnly(schedule.schedule_date);

    setScheduleType("doctor");
    setEditingDoctorScheduleId(schedule.id);
    setEditingClinicClosureId(null);
    setSelectedDate(schedule.schedule_date);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));

    setForm({
      doctor_id: String(schedule.doctor_id),
      services: schedule.services || "",
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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
      !(form.services || "").trim() ||
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

    if (!form.is_available && !(form.unavailable_reason || "").trim()) {
      setError("Please select a reason for marking this schedule unavailable.");
      setIsSaving(false);
      return;
    }

    const payload = {
      doctor_id: Number(form.doctor_id),
      services: (form.services || "").trim(),
      schedule_date: form.schedule_date,
      start_time: form.start_time,
      end_time: form.end_time,
      is_available: form.is_available,
      consultation_mode: form.consultation_mode || "In-Person",
      unavailable_reason: form.is_available
        ? null
        : (form.unavailable_reason || "").trim(),
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
          : "Doctor schedule added successfully."
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
    const confirmed = window.confirm("Delete this doctor schedule?");

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
      setMessage("Doctor schedule deleted successfully.");

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
              Manage doctor availability, online consultations, holidays, and
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
            <div className={staffStyles.statLabel}>Total Schedule Slots</div>
            <div className={staffStyles.statValue}>{totalSlots}</div>
            <div className={staffStyles.statMeta}>Based on current filter</div>
          </div>

          <div className={staffStyles.statCard}>
            <div className={staffStyles.statLabel}>Available Slots</div>
            <div className={staffStyles.statValue}>{availableSlots}</div>
            <div className={staffStyles.statMeta}>Visible for booking flow</div>
          </div>

          <div className={staffStyles.statCard}>
            <div className={staffStyles.statLabel}>Unavailable Slots</div>
            <div className={staffStyles.statValue}>{unavailableSlots}</div>
            <div className={staffStyles.statMeta}>
              Doctor-specific unavailable slots
            </div>
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

                return (
                  <button
                    key={day.dateValue}
                    type="button"
                    className={`${styles.calendarDay} ${
                      isSelected ? styles.selectedDay : ""
                    } ${isSundayDate ? styles.sundayDay : ""} ${
                      isClinicClosedDate ? styles.clinicClosedDay : ""
                    }`}
                    onClick={() => handleSelectDate(day.dateValue)}
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
                      day.schedules.length > 0 && (
                        <span className={styles.slotCount}>
                          {day.schedules.length} slot
                          {day.schedules.length > 1 ? "s" : ""}
                        </span>
                      )}
                  </button>
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
                    ? "Edit Doctor Schedule"
                    : "Add Doctor Schedule"}
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

            {selectedDateIsSunday && (
              <div className={styles.sundayNotice}>
                Sundays are automatically unavailable. Choose another date for
                doctor schedules or clinic closures.
              </div>
            )}

            {selectedDateIsClinicClosed && selectedClinicClosure && (
              <div className={styles.sundayNotice}>
                This date is marked unavailable for the clinic:{" "}
                <strong>{selectedClinicClosure.reason}</strong>
              </div>
            )}

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
                    <label htmlFor="services">Service/s</label>
                    <input
                      id="services"
                      type="text"
                      placeholder="Example: Consultation, Acne Treatment"
                      value={form.services}
                      disabled={doctorFormDisabled}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          services: event.target.value,
                        }))
                      }
                    />
                    <small>
                      Use comma-separated services if the doctor can handle
                      multiple services in this slot.
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

                  <div className={styles.timeGrid}>
                    <div className={styles.formGroup}>
                      <label htmlFor="startTime">Start Time</label>
                      <input
                        id="startTime"
                        type="time"
                        value={form.start_time}
                        disabled={doctorFormDisabled}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            start_time: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="endTime">End Time</label>
                      <input
                        id="endTime"
                        type="time"
                        value={form.end_time}
                        disabled={doctorFormDisabled}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            end_time: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className={styles.availabilityBox}>
                    <label className={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={form.is_available}
                        disabled={doctorFormDisabled}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            is_available: event.target.checked,
                            unavailable_reason: event.target.checked
                              ? ""
                              : current.unavailable_reason,
                          }))
                        }
                      />
                      Mark this schedule as available
                    </label>

                    {!form.is_available && !doctorFormDisabled && (
                      <div className={styles.formGroup}>
                        <label htmlFor="unavailableReason">
                          Unavailable Reason
                        </label>
                        <select
                          id="unavailableReason"
                          value={form.unavailable_reason}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              unavailable_reason: event.target.value,
                            }))
                          }
                        >
                          <option value="">Select reason</option>
                          {unavailableReasons.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
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
                    : "Add Schedule"}
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

        <section className={`${staffStyles.listCard} ${styles.scheduleList}`}>
          <div className={staffStyles.listHeader}>
            <div>
              <h2>Schedules for {formatReadableDate(selectedDate)}</h2>
              <p className={staffStyles.pageSubtext}>
                {selectedDateIsSunday
                  ? "This day is unavailable by default."
                  : selectedDateIsClinicClosed
                  ? "This date has a clinic-wide unavailable status."
                  : `${selectedDateSchedules.length} schedule slot${
                      selectedDateSchedules.length === 1 ? "" : "s"
                    } found.`}
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
                    : "No doctor schedules added for this date yet."}
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
                              ? "Available"
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