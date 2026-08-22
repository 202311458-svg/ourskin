"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import AppointmentInstructionsDialog from "@/app/components/portal/ui/AppointmentInstructionsDialog";
import styles from "./page.module.css";

interface Appointment {
  id: number;
  doctor_name?: string | null;
  doctor?: string | null;
  date?: string | null;
  time?: string | null;
  end_time?: string | null;
  services?: string | null;
  status: string;
  cancel_reason?: string | null;
  appointment_type?: string | null;
  consultation_mode?: string | null;
  patient_instruction?: string | null;
  approval_email_sent?: boolean | null;
  approval_email_sent_at?: string | null;
  next_visit_date?: string | null;
  follow_up_date?: string | null;
  followup_date?: string | null;
  follow_up_plan?: string | null;
  followup_plan?: string | null;
  follow_up?: string | null;
  follow_up_reason?: string | null;
  reason?: string | null;
  notes?: string | null;
}

const STATUS_FILTERS = ["All", "Approved", "Pending", "Completed", "Cancelled", "Declined", "No-Show"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const normalizeStatus = (status?: string | null) => {
  const clean = (status || "").trim().toLowerCase();
  if (clean === "confirmed" || clean === "approved") return "Approved";
  if (clean === "pending") return "Pending";
  if (clean === "completed") return "Completed";
  if (clean === "declined") return "Declined";
  if (clean === "cancelled" || clean === "canceled") return "Cancelled";
  if (clean === "no-show" || clean === "noshow" || clean === "missed") return "No-Show";
  return status?.trim() || "Unknown";
};

const getStatusLabel = (status?: string | null) => {
  const normalized = normalizeStatus(status);
  return normalized === "No-Show" ? "Missed" : normalized;
};

const normalizeAppointments = (data: unknown): Appointment[] => {
  if (Array.isArray(data)) return data as Appointment[];
  if (
    data &&
    typeof data === "object" &&
    "appointments" in data &&
    Array.isArray((data as { appointments: unknown }).appointments)
  ) {
    return (data as { appointments: Appointment[] }).appointments;
  }
  return [];
};

const getDateTimeValue = (appt: Appointment) => {
  if (!appt.date) return 0;
  const value = new Date(`${appt.date}T${appt.time || "00:00:00"}`).getTime();
  return Number.isNaN(value) ? 0 : value;
};

const formatDate = (value?: string | null) => {
  if (!value) return "To be scheduled";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const formatTime = (value?: string | null) => {
  if (!value) return "To be scheduled";
  const date = new Date(`1970-01-01T${value}`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};

const formatTimeRange = (appt: Appointment) => {
  if (!appt.time && !appt.end_time) return "To be scheduled";
  if (appt.time && appt.end_time) return `${formatTime(appt.time)} – ${formatTime(appt.end_time)}`;
  return formatTime(appt.time);
};

export default function PatientHistory() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

  const fetchAppointments = useCallback(async (showLoader = true) => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token) {
      router.push("/pages/login");
      return;
    }

    if (role !== "patient") {
      router.push("/");
      return;
    }

    try {
      if (showLoader) setLoading(true);
      const res = await fetch(`${API_BASE_URL}/appointments/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error("Failed to fetch appointments");

      const unique = Array.from(
        new Map(normalizeAppointments(data).map((appt) => [appt.id, { ...appt, status: normalizeStatus(appt.status) }])).values()
      );
      setAppointments(unique);
    } catch (error) {
      console.error("Failed to fetch appointment history:", error);
      setAppointments([]);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) void fetchAppointments(false);
    };
    const intervalId = window.setInterval(refresh, 3000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fetchAppointments]);

  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((appt) => statusFilter === "All" || normalizeStatus(appt.status) === statusFilter)
      .sort((a, b) => getDateTimeValue(b) - getDateTimeValue(a));
  }, [appointments, statusFilter]);

  const getStatusClass = (status: string) => {
    const normalized = normalizeStatus(status);
    if (normalized === "Completed") return styles.statusCompleted;
    if (normalized === "Approved") return styles.statusApproved;
    if (normalized === "Pending") return styles.statusPending;
    if (["Cancelled", "Declined", "No-Show"].includes(normalized)) return styles.statusCancelled;
    return styles.statusDefault;
  };

  return (
    <PageShell className={styles.page}>
      <PageHeader
        eyebrow="Patient portal"
        title="Appointments"
        description="Review appointment dates, clinic status, instructions, and closed appointment details."
        primaryAction={<Link href="/pages/patient/book" className={styles.primaryButton}>Book appointment</Link>}
        secondaryAction={<Link href="/pages/patient/records" className={styles.secondaryButton}>Medical records</Link>}
      />

      <nav className={styles.tabs} aria-label="Appointments views">
        <Link href="/pages/patient/history" className={`${styles.tab} ${styles.tabActive}`} aria-current="page">Appointments</Link>
        <Link href="/pages/patient/follow-ups" className={styles.tab}>Follow-Ups</Link>
      </nav>

      <div className={styles.filterBar} aria-label="Filter appointments by status">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`${styles.filterButton} ${statusFilter === status ? styles.filterButtonActive : ""}`}
          >
            {status === "No-Show" ? "Missed" : status}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.emptyState}>Loading appointments...</div>
      ) : appointments.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No appointments yet</h2>
          <p>Your appointment history will appear here after you make a booking request.</p>
          <Link href="/pages/patient/book" className={styles.primaryButton}>Book appointment</Link>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No {statusFilter === "No-Show" ? "missed" : statusFilter.toLowerCase()} appointments</h2>
          <p>Try another status filter.</p>
        </div>
      ) : (
        <div className={styles.cards}>
          {filteredAppointments.map((appt) => {
            const normalized = normalizeStatus(appt.status);
            return (
              <article key={appt.id} className={styles.card}>
                <div className={styles.appointmentGrid}>
                  <div className={styles.primaryInfo}>
                    <strong>{appt.services || "Consultation"}</strong>
                    <span>Dr. {appt.doctor_name || appt.doctor || "Assigned Doctor"}</span>
                  </div>

                  <div className={styles.metaItem}>
                    <span>Date</span>
                    <strong>{formatDate(appt.date)}</strong>
                  </div>

                  <div className={styles.metaItem}>
                    <span>Time</span>
                    <strong>{formatTimeRange(appt)}</strong>
                  </div>

                  <div className={styles.metaItem}>
                    <span>Mode</span>
                    <strong>{appt.consultation_mode || "In person"}</strong>
                  </div>

                  <div className={styles.statusArea}>
                    <span className={`${styles.statusBadge} ${getStatusClass(normalized)}`}>
                      {getStatusLabel(normalized)}
                    </span>
                  </div>
                </div>

                {(appt.patient_instruction || appt.cancel_reason || normalized === "Completed") && (
                  <div className={styles.cardFooter}>
                    <div className={styles.footerActions}>
                      {appt.patient_instruction && (
                        <AppointmentInstructionsDialog
                          instructions={appt.patient_instruction}
                          emailSent={appt.approval_email_sent}
                        />
                      )}
                      {normalized === "Completed" && (
                        <Link href="/pages/patient/records" className={styles.inlineLink}>View medical record</Link>
                      )}
                    </div>
                    {appt.cancel_reason && ["Cancelled", "Declined", "No-Show"].includes(normalized) && (
                      <p className={styles.reasonText}><strong>Reason:</strong> {appt.cancel_reason}</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
