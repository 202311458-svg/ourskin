"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/styles/calendar.module.css";
import { getDoctorAppointments, type Appointment } from "@/lib/doctor-api";

type CalendarProps = {
  mode?: "compact" | "full";
  statusFilter?: string;
  refreshKey?: number;
  onUpdated?: () => void;
};

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMonthGrid(baseDate: Date): Date[] {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const gridStart = new Date(firstDayOfMonth);
  const gridEnd = new Date(lastDayOfMonth);

  gridStart.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());
  gridEnd.setDate(lastDayOfMonth.getDate() + (6 - lastDayOfMonth.getDay()));

  const days: Date[] = [];
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function formatMonthTitle(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDisplayDate(dateString: string): string {
  return parseLocalDate(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDisplayTime(timeString: string): string {
  const [hourValue = "0", minute = "00"] = timeString.split(":");
  const hour = Number(hourValue);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function normalizeStatus(status: string): string {
  return (status || "pending").toLowerCase();
}

function isCalendarVisibleStatus(status: string): boolean {
  return status === "Approved" || status === "Pending";
}

export default function Calendar({
  mode = "full",
  statusFilter = "All",
  refreshKey = 0,
}: CalendarProps) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getDoctorAppointments(statusFilter);
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load calendar appointments:", err);
      setError("Could not load appointments.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments, refreshKey]);

  const calendarDays = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

  const appointmentsByDate = useMemo(() => {
    let filteredAppointments = appointments.filter((appointment) =>
      isCalendarVisibleStatus(appointment.status)
    );

    if (statusFilter === "Approved" || statusFilter === "Pending") {
      filteredAppointments = filteredAppointments.filter(
        (appointment) => appointment.status === statusFilter
      );
    }

    const grouped: Record<string, Appointment[]> = {};

    for (const appointment of filteredAppointments) {
      if (!grouped[appointment.date]) grouped[appointment.date] = [];
      grouped[appointment.date].push(appointment);
    }

    Object.values(grouped).forEach((dayAppointments) => {
      dayAppointments.sort((a, b) => a.time.localeCompare(b.time));
    });

    return grouped;
  }, [appointments, statusFilter]);

  const todayKey = toDateKey(new Date());
  const maxVisibleAppointments = mode === "compact" ? 1 : 2;

  const openAppointmentWorkspace = (appointment: Appointment) => {
    if (appointment.status === "Approved" && appointment.patient_id) {
      const params = new URLSearchParams({
        patient_id: String(appointment.patient_id),
        appointment_id: String(appointment.id),
      });
      router.push(`/pages/doctor/ai-analysis?${params.toString()}`);
      return;
    }

    router.push("/pages/doctor/appointments");
  };

  return (
    <section
      className={`${styles.wrapper} ${
        mode === "compact" ? styles.compactMode : styles.fullMode
      }`}
    >
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.title}>
            {mode === "compact" ? "Calendar Preview" : "Appointment Calendar"}
          </h1>
          <p className={styles.subtitle}>
            {mode === "compact"
              ? "Quick monthly preview of approved and pending appointments."
              : "View scheduled appointments by month. Appointment status changes are handled from the main appointment workflow."}
          </p>
        </div>

        <div className={styles.toolbar}>
          {mode === "compact" && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => router.push("/pages/doctor/appointments")}
            >
              View Full Calendar
            </button>
          )}

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setViewDate(new Date())}
          >
            Today
          </button>

          <div className={styles.monthControls}>
            <button
              type="button"
              className={styles.navButton}
              aria-label="Previous month"
              onClick={() =>
                setViewDate(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                )
              }
            >
              ‹
            </button>

            <h2 className={styles.monthTitle}>{formatMonthTitle(viewDate)}</h2>

            <button
              type="button"
              className={styles.navButton}
              aria-label="Next month"
              onClick={() =>
                setViewDate(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                )
              }
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.approved}`} /> Approved
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.pending}`} /> Pending
        </span>
      </div>

      {loading ? (
        <div className={styles.stateBox}>Loading calendar...</div>
      ) : error ? (
        <div className={styles.stateBox} role="alert">{error}</div>
      ) : (
        <div className={styles.calendarScroll}>
          <div className={styles.weekHeader}>
            {WEEK_DAYS.map((day) => (
              <div key={day} className={styles.weekDay}>{day}</div>
            ))}
          </div>

          <div className={styles.grid}>
            {calendarDays.map((day) => {
              const dateKey = toDateKey(day);
              const dayAppointments = appointmentsByDate[dateKey] || [];
              const visibleAppointments = dayAppointments.slice(0, maxVisibleAppointments);
              const hiddenCount = dayAppointments.length - visibleAppointments.length;
              const isCurrentMonth = day.getMonth() === viewDate.getMonth();
              const isToday = dateKey === todayKey;
              const cellClassName = [
                styles.dayCell,
                !isCurrentMonth ? styles.outsideMonth : "",
                isToday ? styles.today : "",
              ].filter(Boolean).join(" ");

              return (
                <div key={dateKey} className={cellClassName}>
                  <div className={styles.dayHeader}>
                    <span className={styles.dayNumber}>{day.getDate()}</span>
                    {dayAppointments.length > 0 && (
                      <span className={styles.countBadge}>{dayAppointments.length}</span>
                    )}
                  </div>

                  <div className={styles.events}>
                    {visibleAppointments.map((appointment) =>
                      mode === "compact" ? (
                        <div
                          key={appointment.id}
                          className={`${styles.eventButton} ${styles.compactStaticEvent}`}
                          data-status={normalizeStatus(appointment.status)}
                        >
                          <span className={styles.eventTime}>{formatDisplayTime(appointment.time)}</span>
                        </div>
                      ) : (
                        <button
                          key={appointment.id}
                          type="button"
                          className={styles.eventButton}
                          data-status={normalizeStatus(appointment.status)}
                          onClick={() => setSelectedAppointment(appointment)}
                        >
                          <span className={styles.eventTime}>{formatDisplayTime(appointment.time)}</span>
                          <span className={styles.eventPatient}>{appointment.patient_name}</span>
                          <span className={styles.eventService}>{appointment.services}</span>
                        </button>
                      )
                    )}

                    {hiddenCount > 0 && (
                      <div className={styles.moreText}>+{hiddenCount} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === "full" && selectedAppointment && (
        <div className={styles.modalOverlay} onClick={() => setSelectedAppointment(null)}>
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-appointment-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h3 id="calendar-appointment-title" className={styles.modalTitle}>Appointment Details</h3>
                <p className={styles.modalSubtitle}>
                  Review the appointment here, then continue in the main workflow for clinical or status actions.
                </p>
              </div>

              <button
                type="button"
                className={styles.closeButton}
                aria-label="Close appointment details"
                onClick={() => setSelectedAppointment(null)}
              >
                ✕
              </button>
            </div>

            <div className={styles.detailGrid}>
              <div className={styles.detailCard}><span className={styles.detailLabel}>Patient</span><p className={styles.detailValue}>{selectedAppointment.patient_name}</p></div>
              <div className={styles.detailCard}><span className={styles.detailLabel}>Email</span><p className={styles.detailValue}>{selectedAppointment.patient_email}</p></div>
              <div className={styles.detailCard}><span className={styles.detailLabel}>Doctor</span><p className={styles.detailValue}>{selectedAppointment.doctor_name}</p></div>
              <div className={styles.detailCard}><span className={styles.detailLabel}>Date</span><p className={styles.detailValue}>{formatDisplayDate(selectedAppointment.date)}</p></div>
              <div className={styles.detailCard}><span className={styles.detailLabel}>Time</span><p className={styles.detailValue}>{formatDisplayTime(selectedAppointment.time)}</p></div>
              <div className={styles.detailCard}><span className={styles.detailLabel}>Service</span><p className={styles.detailValue}>{selectedAppointment.services}</p></div>
              <div className={styles.detailCard}>
                <span className={styles.detailLabel}>Status</span>
                <p className={styles.statusBadge} data-status={normalizeStatus(selectedAppointment.status)}>{selectedAppointment.status}</p>
              </div>
              <div className={styles.detailCard}><span className={styles.detailLabel}>Cancel Reason</span><p className={styles.detailValue}>{selectedAppointment.cancel_reason || "None"}</p></div>
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => openAppointmentWorkspace(selectedAppointment)}
                >
                  {selectedAppointment.status === "Approved" ? "Continue Clinical Work" : "Open Appointments"}
                </button>
              </div>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setSelectedAppointment(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
