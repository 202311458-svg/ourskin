"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PortalShell from "@/app/components/PortalShell";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import {
  AdminDoctor,
  AdminService,
  ClinicUnavailableDate,
  DoctorSchedule,
  createAdminClinicUnavailableDate,
  createAdminDoctorSchedule,
  deleteAdminClinicUnavailableDate,
  deleteAdminDoctorSchedule,
  getAdminClinicUnavailableDates,
  getAdminDoctorSchedules,
  getAdminDoctors,
  getAdminServices,
  updateAdminClinicUnavailableDate,
  updateAdminDoctorSchedule,
} from "@/lib/admin-api";
import styles from "./page.module.css";

type ScheduleForm = {
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

type ClosureForm = {
  id: number | null;
  closure_date: string;
  reason: string;
  note: string;
};

const EMPTY_SCHEDULE_FORM: ScheduleForm = {
  id: null,
  doctor_id: "",
  services: [],
  schedule_date: "",
  start_time: "10:00",
  end_time: "11:00",
  is_available: true,
  consultation_mode: "In-Person",
  unavailable_reason: "",
  schedule_note: "",
};

const EMPTY_CLOSURE_FORM: ClosureForm = {
  id: null,
  closure_date: "",
  reason: "Holiday",
  note: "",
};

const TIME_OPTIONS = [
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

const UNAVAILABLE_REASONS = [
  "Holiday",
  "Doctor Leave",
  "Clinic Event",
  "Emergency Closure",
  "Maintenance",
  "Other",
];

function getTodayInputDate() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;

  return new Date(today.getTime() - timezoneOffset).toISOString().split("T")[0];
}

function isPastDate(dateString?: string | null) {
  if (!dateString) return false;
  return dateString < getTodayInputDate();
}

function isSunday(dateString?: string | null) {
  if (!dateString) return false;

  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  return date.getDay() === 0;
}

function formatDate(value?: string | null) {
  if (!value) return "No date";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(value?: string | null) {
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function getScheduleStatusClass(schedule: DoctorSchedule) {
  if (!schedule.is_available) return styles.cancelled;
  if (isPastDate(schedule.schedule_date)) return styles.neutral;

  return styles.approved;
}

function getScheduleStatusText(schedule: DoctorSchedule) {
  if (!schedule.is_available) return "Unavailable";
  if (isPastDate(schedule.schedule_date)) return "Past";

  return "Available";
}

export default function AdminSchedulesPage() {
  const router = useRouter();

  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [closures, setClosures] = useState<ClinicUnavailableDate[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("all");

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] =
    useState<ScheduleForm>(EMPTY_SCHEDULE_FORM);

  const [showClosureModal, setShowClosureModal] = useState(false);
  const [closureForm, setClosureForm] = useState<ClosureForm>(EMPTY_CLOSURE_FORM);

  const loadData = useCallback(async () => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "admin") {
      router.push("/");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [doctorData, serviceData, scheduleData, closureData] =
        await Promise.all([
          getAdminDoctors(),
          getAdminServices(),
          getAdminDoctorSchedules(),
          getAdminClinicUnavailableDates(),
        ]);

      setDoctors(Array.isArray(doctorData) ? doctorData : []);
      setServices(Array.isArray(serviceData) ? serviceData : []);
      setSchedules(Array.isArray(scheduleData) ? scheduleData : []);
      setClosures(Array.isArray(closureData) ? closureData : []);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load schedules."));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSchedules = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return schedules.filter((schedule) => {
      const matchesSearch =
        !keyword ||
        (schedule.doctor_name || "").toLowerCase().includes(keyword) ||
        (schedule.services || "").toLowerCase().includes(keyword) ||
        (schedule.consultation_mode || "").toLowerCase().includes(keyword) ||
        (schedule.schedule_note || "").toLowerCase().includes(keyword);

      const matchesDate = !dateFilter || schedule.schedule_date === dateFilter;

      const matchesDoctor =
        doctorFilter === "all" || String(schedule.doctor_id) === doctorFilter;

      return matchesSearch && matchesDate && matchesDoctor;
    });
  }, [schedules, search, dateFilter, doctorFilter]);

  const stats = useMemo(() => {
    return {
      total: schedules.length,
      upcoming: schedules.filter(
        (schedule) => schedule.is_available && !isPastDate(schedule.schedule_date)
      ).length,
      unavailable: schedules.filter((schedule) => !schedule.is_available).length,
      closures: closures.length,
    };
  }, [schedules, closures]);

  function openCreateScheduleModal() {
    setScheduleForm({
      ...EMPTY_SCHEDULE_FORM,
      schedule_date: getTodayInputDate(),
    });
    setShowScheduleModal(true);
  }

  function openEditScheduleModal(schedule: DoctorSchedule) {
    setScheduleForm({
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
    });
    setShowScheduleModal(true);
  }

  function closeScheduleModal() {
    if (actionLoading) return;
    setShowScheduleModal(false);
    setScheduleForm(EMPTY_SCHEDULE_FORM);
  }

  function openCreateClosureModal() {
    setClosureForm({
      ...EMPTY_CLOSURE_FORM,
      closure_date: getTodayInputDate(),
    });
    setShowClosureModal(true);
  }

  function openEditClosureModal(item: ClinicUnavailableDate) {
    setClosureForm({
      id: item.id,
      closure_date: item.closure_date,
      reason: item.reason,
      note: item.note || "",
    });
    setShowClosureModal(true);
  }

  function closeClosureModal() {
    if (actionLoading) return;
    setShowClosureModal(false);
    setClosureForm(EMPTY_CLOSURE_FORM);
  }

  function toggleService(serviceName: string) {
    setScheduleForm((prev) => {
      const exists = prev.services.includes(serviceName);

      return {
        ...prev,
        services: exists
          ? prev.services.filter((item) => item !== serviceName)
          : [...prev.services, serviceName],
      };
    });
  }

  async function handleSaveSchedule() {
    if (!scheduleForm.doctor_id) {
      alert("Please select a doctor.");
      return;
    }

    if (scheduleForm.services.length === 0) {
      alert("Please select at least one service.");
      return;
    }

    if (!scheduleForm.schedule_date) {
      alert("Please select a schedule date.");
      return;
    }

    if (isSunday(scheduleForm.schedule_date)) {
      alert("Sundays are unavailable for scheduling.");
      return;
    }

    if (scheduleForm.start_time >= scheduleForm.end_time) {
      alert("End time must be later than start time.");
      return;
    }

    if (!scheduleForm.is_available && !scheduleForm.unavailable_reason) {
      alert("Please select a reason for marking this schedule unavailable.");
      return;
    }

    const payload = {
      doctor_id: Number(scheduleForm.doctor_id),
      services: scheduleForm.services.join(", "),
      schedule_date: scheduleForm.schedule_date,
      start_time: scheduleForm.start_time,
      end_time: scheduleForm.end_time,
      is_available: scheduleForm.is_available,
      consultation_mode: scheduleForm.consultation_mode,
      unavailable_reason: scheduleForm.is_available
        ? null
        : scheduleForm.unavailable_reason,
      schedule_note: scheduleForm.schedule_note.trim() || null,
    };

    try {
      setActionLoading(true);

      if (scheduleForm.id) {
        const updated = await updateAdminDoctorSchedule(scheduleForm.id, payload);
        setSchedules((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
      } else {
        const created = await createAdminDoctorSchedule(payload);
        setSchedules((prev) => [created, ...prev]);
      }

      closeScheduleModal();
      await loadData();
    } catch (saveError) {
      alert(getErrorMessage(saveError, "Unable to save schedule."));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteSchedule(schedule: DoctorSchedule) {
    if (
      !confirm(
        `Delete the schedule for ${schedule.doctor_name} on ${formatDate(
          schedule.schedule_date
        )}?`
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      await deleteAdminDoctorSchedule(schedule.id);
      setSchedules((prev) => prev.filter((item) => item.id !== schedule.id));
    } catch (deleteError) {
      alert(getErrorMessage(deleteError, "Unable to delete schedule."));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveClosure() {
    if (!closureForm.closure_date) {
      alert("Please select a closure date.");
      return;
    }

    if (isSunday(closureForm.closure_date)) {
      alert("Sundays are already unavailable by default.");
      return;
    }

    if (!closureForm.reason.trim()) {
      alert("Please select a closure reason.");
      return;
    }

    const payload = {
      closure_date: closureForm.closure_date,
      reason: closureForm.reason.trim(),
      note: closureForm.note.trim() || null,
    };

    try {
      setActionLoading(true);

      if (closureForm.id) {
        const updated = await updateAdminClinicUnavailableDate(
          closureForm.id,
          payload
        );
        setClosures((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
      } else {
        const created = await createAdminClinicUnavailableDate(payload);
        setClosures((prev) => [created, ...prev]);
      }

      closeClosureModal();
      await loadData();
    } catch (saveError) {
      alert(getErrorMessage(saveError, "Unable to save unavailable date."));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteClosure(item: ClinicUnavailableDate) {
    if (!confirm(`Remove clinic unavailable date on ${formatDate(item.closure_date)}?`)) {
      return;
    }

    try {
      setActionLoading(true);
      await deleteAdminClinicUnavailableDate(item.id);
      setClosures((prev) => prev.filter((closure) => closure.id !== item.id));
    } catch (deleteError) {
      alert(getErrorMessage(deleteError, "Unable to delete unavailable date."));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="staffLayout">
      <PortalShell role="admin">
      <main className={styles.schedulesPage}>
        <PageHeader
          title="Schedules"
          description="Manage doctor schedules, consultation modes, service coverage, and clinic unavailable dates."
          primaryAction={
            <>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={openCreateClosureModal}
              >
                + Unavailable Date
              </button>

              <button
                type="button"
                className={styles.addButton}
                onClick={openCreateScheduleModal}
              >
                + New Schedule
              </button>
            </>
          }
        />

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span>Total Schedules</span>
            <strong>{stats.total}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.greenAccent}`}>
            <span>Upcoming Available</span>
            <strong>{stats.upcoming}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.orangeAccent}`}>
            <span>Unavailable Schedules</span>
            <strong>{stats.unavailable}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.pinkAccent}`}>
            <span>Clinic Closures</span>
            <strong>{stats.closures}</strong>
          </div>
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Search by doctor, service, mode, or note"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={styles.searchInput}
          />

          <select
            className={styles.selectInput}
            value={doctorFilter}
            onChange={(event) => setDoctorFilter(event.target.value)}
          >
            <option value="all">All Doctors</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            className={styles.searchInput}
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          />

          {dateFilter ? (
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => setDateFilter("")}
            >
              Clear Date
            </button>
          ) : null}
        </div>

        <section className={styles.tableCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Doctor Schedule List</h2>
              <p>
                Past schedules are locked from editing to protect appointment
                history.
              </p>
            </div>
          </div>

          {loading ? (
            <p className={styles.message}>Loading schedules...</p>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : filteredSchedules.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No schedules found</h3>
              <p>Try changing your filters or add a doctor schedule.</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Doctor</th>
                  <th>Time</th>
                  <th>Services</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredSchedules.map((schedule) => {
                  const past = isPastDate(schedule.schedule_date);

                  return (
                    <tr key={schedule.id}>
                      <td>{formatDate(schedule.schedule_date)}</td>
                      <td>
                        <strong>{schedule.doctor_name}</strong>
                      </td>
                      <td>
                        {formatTime(schedule.start_time)} -{" "}
                        {formatTime(schedule.end_time)}
                      </td>
                      <td>{schedule.services}</td>
                      <td>{schedule.consultation_mode}</td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${getScheduleStatusClass(
                            schedule
                          )}`}
                        >
                          {getScheduleStatusText(schedule)}
                        </span>
                      </td>
                      <td>{schedule.created_by_staff_name || "N/A"}</td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button
                            type="button"
                            className={styles.secondaryAction}
                            disabled={past}
                            onClick={() => openEditScheduleModal(schedule)}
                          >
                            {past ? "Locked" : "Edit"}
                          </button>

                          <button
                            type="button"
                            className={styles.cancelAppointmentBtn}
                            disabled={past || actionLoading}
                            onClick={() => handleDeleteSchedule(schedule)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.tableCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Clinic Unavailable Dates</h2>
              <p>
                These dates block schedule creation for the whole clinic.
              </p>
            </div>
          </div>

          {closures.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No unavailable dates</h3>
              <p>Clinic closure dates will appear here.</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reason</th>
                  <th>Note</th>
                  <th>Created By</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {closures.map((item) => {
                  const past = isPastDate(item.closure_date);

                  return (
                    <tr key={item.id}>
                      <td>{formatDate(item.closure_date)}</td>
                      <td>{item.reason}</td>
                      <td>{item.note || "N/A"}</td>
                      <td>{item.created_by_staff_name || "N/A"}</td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button
                            type="button"
                            className={styles.secondaryAction}
                            disabled={past}
                            onClick={() => openEditClosureModal(item)}
                          >
                            {past ? "Locked" : "Edit"}
                          </button>

                          <button
                            type="button"
                            className={styles.cancelAppointmentBtn}
                            disabled={past || actionLoading}
                            onClick={() => handleDeleteClosure(item)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {showScheduleModal && (
          <div className={styles.modalBackdrop}>
            <div className={`${styles.modalCard} ${styles.modalLarge}`}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>
                    {scheduleForm.id ? "Edit Doctor Schedule" : "Create Doctor Schedule"}
                  </h2>
                  <p>
                    Schedules must use whole-hour slots between 10:00 AM and
                    7:00 PM. Sundays and past times are blocked by the backend.
                  </p>
                </div>

                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={closeScheduleModal}
                  disabled={actionLoading}
                >
                  ×
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <label className={styles.formGroup}>
                    <span>Doctor</span>
                    <select
                      className={styles.selectInput}
                      value={scheduleForm.doctor_id}
                      onChange={(event) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          doctor_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select doctor</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.name}
                          {doctor.specialty ? ` • ${doctor.specialty}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.formGroup}>
                    <span>Date</span>
                    <input
                      className={styles.searchInput}
                      type="date"
                      min={getTodayInputDate()}
                      value={scheduleForm.schedule_date}
                      onChange={(event) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          schedule_date: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className={styles.formGroup}>
                    <span>Start Time</span>
                    <select
                      className={styles.selectInput}
                      value={scheduleForm.start_time}
                      onChange={(event) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          start_time: event.target.value,
                        }))
                      }
                    >
                      {TIME_OPTIONS.slice(0, -1).map((time) => (
                        <option key={time} value={time}>
                          {formatTime(time)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.formGroup}>
                    <span>End Time</span>
                    <select
                      className={styles.selectInput}
                      value={scheduleForm.end_time}
                      onChange={(event) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          end_time: event.target.value,
                        }))
                      }
                    >
                      {TIME_OPTIONS.slice(1).map((time) => (
                        <option key={time} value={time}>
                          {formatTime(time)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.formGroup}>
                    <span>Consultation Mode</span>
                    <select
                      className={styles.selectInput}
                      value={scheduleForm.consultation_mode}
                      onChange={(event) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          consultation_mode: event.target
                            .value as ScheduleForm["consultation_mode"],
                        }))
                      }
                    >
                      <option value="In-Person">In-Person</option>
                      <option value="Online Consultation">
                        Online Consultation
                      </option>
                    </select>
                  </label>

                  <label className={styles.formGroup}>
                    <span>Availability</span>
                    <select
                      className={styles.selectInput}
                      value={scheduleForm.is_available ? "available" : "unavailable"}
                      onChange={(event) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          is_available: event.target.value === "available",
                        }))
                      }
                    >
                      <option value="available">Available</option>
                      <option value="unavailable">Unavailable</option>
                    </select>
                  </label>
                </div>

                {!scheduleForm.is_available && (
                  <label className={styles.formGroup}>
                    <span>Unavailable Reason</span>
                    <select
                      className={styles.selectInput}
                      value={scheduleForm.unavailable_reason}
                      onChange={(event) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          unavailable_reason: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select reason</option>
                      {UNAVAILABLE_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <section className={styles.detailSection}>
                  <h3>Services</h3>
                  <div className={styles.badgeRow}>
                    {services.map((service) => (
                      <label key={service.id} className={styles.checkboxRow}>
                        <input
                          type="checkbox"
                          checked={scheduleForm.services.includes(service.name)}
                          onChange={() => toggleService(service.name)}
                        />
                        <span>{service.name}</span>
                      </label>
                    ))}
                  </div>
                </section>

                <label className={styles.formGroup}>
                  <span>Schedule Note</span>
                  <textarea
                    className={styles.textArea}
                    rows={4}
                    value={scheduleForm.schedule_note}
                    onChange={(event) =>
                      setScheduleForm((prev) => ({
                        ...prev,
                        schedule_note: event.target.value,
                      }))
                    }
                    placeholder="Optional internal note"
                  />
                </label>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={closeScheduleModal}
                  disabled={actionLoading}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={styles.approveBtn}
                  onClick={handleSaveSchedule}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Saving..." : "Save Schedule"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showClosureModal && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>
                    {closureForm.id
                      ? "Edit Unavailable Date"
                      : "Create Unavailable Date"}
                  </h2>
                  <p>
                    Mark a whole clinic date unavailable. Remove doctor schedules
                    first before closing a scheduled date.
                  </p>
                </div>

                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={closeClosureModal}
                  disabled={actionLoading}
                >
                  ×
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <label className={styles.formGroup}>
                    <span>Date</span>
                    <input
                      className={styles.searchInput}
                      type="date"
                      min={getTodayInputDate()}
                      value={closureForm.closure_date}
                      onChange={(event) =>
                        setClosureForm((prev) => ({
                          ...prev,
                          closure_date: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className={styles.formGroup}>
                    <span>Reason</span>
                    <select
                      className={styles.selectInput}
                      value={closureForm.reason}
                      onChange={(event) =>
                        setClosureForm((prev) => ({
                          ...prev,
                          reason: event.target.value,
                        }))
                      }
                    >
                      {UNAVAILABLE_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className={styles.formGroup}>
                  <span>Note</span>
                  <textarea
                    className={styles.textArea}
                    rows={4}
                    value={closureForm.note}
                    onChange={(event) =>
                      setClosureForm((prev) => ({
                        ...prev,
                        note: event.target.value,
                      }))
                    }
                    placeholder="Optional note"
                  />
                </label>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={closeClosureModal}
                  disabled={actionLoading}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={styles.approveBtn}
                  onClick={handleSaveClosure}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Saving..." : "Save Unavailable Date"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      </PortalShell>
    </div>
  );
}
