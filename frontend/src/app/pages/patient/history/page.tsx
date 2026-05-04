"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { API_BASE_URL } from "@/lib/api";
import styles from "@/app/styles/patient.module.css";

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

  // Follow-up / diagnosis report fields that may come from /appointments/my
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

const STATUS_FILTERS = [
  "All",
  "Approved",
  "Completed",
  "Declined",
  "Cancelled",
  "Pending",
  "No-Show",
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

const normalizeStatus = (status?: string | null) => {
  const cleanStatus = (status || "").trim().toLowerCase();

  if (cleanStatus === "pending") return "Pending";
  if (cleanStatus === "approved") return "Approved";
  if (cleanStatus === "confirmed") return "Approved";
  if (cleanStatus === "completed") return "Completed";
  if (cleanStatus === "declined") return "Declined";
  if (cleanStatus === "cancelled") return "Cancelled";
  if (cleanStatus === "canceled") return "Cancelled";
  if (cleanStatus === "no-show") return "No-Show";
  if (cleanStatus === "noshow") return "No-Show";
  if (cleanStatus === "missed") return "No-Show";

  return status?.trim() || "Unknown";
};

const getStatusLabel = (status?: string | null) => {
  const normalized = normalizeStatus(status);

  if (normalized === "No-Show") return "Missed Appointment";

  return normalized;
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

const uniqueAppointmentsById = (appointments: Appointment[]) => {
  return Array.from(
    new Map(
      appointments.map((appt) => [
        appt.id,
        {
          ...appt,
          status: normalizeStatus(appt.status),
        },
      ])
    ).values()
  );
};

const readJsonSafely = async (res: Response) => {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const getFollowUpDate = (appt: Appointment) => {
  return (
    appt.follow_up_date ||
    appt.followup_date ||
    appt.next_visit_date ||
    null
  );
};

const getFollowUpPlan = (appt: Appointment) => {
  return (
    appt.follow_up_plan ||
    appt.followup_plan ||
    appt.follow_up ||
    appt.follow_up_reason ||
    appt.reason ||
    appt.notes ||
    ""
  );
};

const getDateTimeValue = (appt: Appointment) => {
  if (!appt.date) return 0;

  const value = new Date(`${appt.date}T${appt.time || "00:00:00"}`).getTime();

  return Number.isNaN(value) ? 0 : value;
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "To be scheduled";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatTime = (timeString?: string | null) => {
  if (!timeString) return "To be scheduled";

  const date = new Date(`1970-01-01T${timeString}`);

  if (Number.isNaN(date.getTime())) return timeString;

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatTimeRange = (appt: Appointment) => {
  if (!appt.time && !appt.end_time) return "To be scheduled";

  if (appt.time && appt.end_time) {
    return `${formatTime(appt.time)} to ${formatTime(appt.end_time)}`;
  }

  return formatTime(appt.time);
};

const getScheduleText = (appt: Appointment) => {
  if (!appt.date && !appt.time) return "Schedule to be confirmed by staff";

  return `${formatDate(appt.date)} • ${formatTimeRange(appt)}`;
};

const getTodayLocalString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getFollowUpTiming = (followUpDate?: string | null) => {
  if (!followUpDate) return "Follow-up scheduled";

  const today = getTodayLocalString();

  if (followUpDate < today) return "Follow-up date passed";
  if (followUpDate === today) return "Due today";

  return "Upcoming follow-up";
};

export default function PatientHistory() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

  const getStatusClass = (status: string) => {
    const normalized = normalizeStatus(status);

    if (normalized === "Completed") return styles.statusCompleted;
    if (normalized === "Approved") return styles.statusApproved;
    if (normalized === "Pending") return styles.statusPending;
    if (
      normalized === "Cancelled" ||
      normalized === "Declined" ||
      normalized === "No-Show"
    ) {
      return styles.statusCancelled;
    }

    return styles.statusDefault;
  };

  const fetchAppointments = useCallback(
    async (showLoader = true) => {
      try {
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

        if (showLoader) {
          setLoading(true);
        }

        const appointmentsRes = await fetch(`${API_BASE_URL}/appointments/my`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const appointmentsData = await readJsonSafely(appointmentsRes);

        if (!appointmentsRes.ok) {
          console.error("Appointments request failed:", {
            status: appointmentsRes.status,
            statusText: appointmentsRes.statusText,
            body: appointmentsData,
          });

          throw new Error("Failed to fetch appointments");
        }

        setAppointments(
          uniqueAppointmentsById(normalizeAppointments(appointmentsData))
        );
      } catch (error) {
        console.error("Failed to fetch appointment history:", error);
        setAppointments([]);
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [router]
  );

  useEffect(() => {
    const handleNavToggle = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setNavCollapsed(customEvent.detail);
    };

    setNavCollapsed(document.body.classList.contains("navCollapsed"));
    window.addEventListener("navbarToggle", handleNavToggle);

    return () => {
      window.removeEventListener("navbarToggle", handleNavToggle);
    };
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    const role = localStorage.getItem("role");

    if (role !== "patient") return;

    const refreshHistoryQuietly = () => {
      if (document.hidden) return;

      fetchAppointments(false);
    };

    const intervalId = window.setInterval(refreshHistoryQuietly, 3000);

    const handleFocus = () => {
      refreshHistoryQuietly();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshHistoryQuietly();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchAppointments]);

  const followUpAppointments = useMemo(() => {
    return uniqueAppointmentsById(appointments)
      .filter((appt) => Boolean(getFollowUpDate(appt)))
      .sort((a, b) => {
        const aDate = getFollowUpDate(a) || "";
        const bDate = getFollowUpDate(b) || "";

        if (!aDate && !bDate) return getDateTimeValue(b) - getDateTimeValue(a);
        if (!aDate) return 1;
        if (!bDate) return -1;

        return aDate.localeCompare(bDate);
      });
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    return uniqueAppointmentsById(appointments)
      .filter((appt) => {
        const appointmentStatus = normalizeStatus(appt.status);

        if (statusFilter === "All") return true;

        return appointmentStatus === statusFilter;
      })
      .sort((a, b) => getDateTimeValue(b) - getDateTimeValue(a));
  }, [appointments, statusFilter]);

  const completedCount = appointments.filter(
    (appt) => normalizeStatus(appt.status) === "Completed"
  ).length;

  const pendingCount = appointments.filter(
    (appt) => normalizeStatus(appt.status) === "Pending"
  ).length;

  const missedCount = appointments.filter(
    (appt) => normalizeStatus(appt.status) === "No-Show"
  ).length;

  const renderInstructionBox = (appt: Appointment) => {
    if (!appt.patient_instruction) return null;

    return (
      <div className={styles.noticeBox}>
        <strong>Appointment Instructions:</strong> {appt.patient_instruction}
        {appt.approval_email_sent && (
          <div style={{ marginTop: "8px", fontSize: "13px", opacity: 0.9 }}>
            Email notification was sent by the clinic.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={navCollapsed ? "nav-collapsed" : "nav-active"}>
      <Navbar />

      <main
        className={`${styles.historyContainer} ${
          navCollapsed ? styles.navCollapsed : ""
        }`}
      >
        <section className={styles.contentWrapper}>
          <div className={styles.headerRow}>
            <div>
              <p className={styles.eyebrow}>Patient Portal</p>

              <h1 className={styles.h1}>Appointment History</h1>

              <p className={styles.subtitle}>
                View your past and current appointments, including approval
                instructions, booking status, cancellation notes, missed appointment
                records, and follow-up schedules.
              </p>
            </div>

            <Link href="/pages/patient/records" className={styles.primaryButton}>
              View Medical Records
            </Link>
          </div>

          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <p className={styles.summaryLabel}>Total Appointments</p>
              <p className={styles.summaryValue}>{appointments.length}</p>
            </div>

            <div className={styles.summaryCard}>
              <p className={styles.summaryLabel}>Completed</p>
              <p className={styles.summaryValue}>{completedCount}</p>
            </div>

            <div className={styles.summaryCard}>
              <p className={styles.summaryLabel}>Pending Requests</p>
              <p className={styles.summaryValue}>{pendingCount}</p>
            </div>

            <div className={styles.summaryCard}>
              <p className={styles.summaryLabel}>Missed</p>
              <p className={styles.summaryValue}>{missedCount}</p>
            </div>
          </div>

          <section className={styles.followUpPanel}>
            <div className={styles.cardTop}>
              <div>
                <h2 className={styles.cardTitle}>Follow-Up Schedule</h2>

                <p className={styles.subtitle}>
                  Follow-up dates recommended after completed consultations.
                </p>
              </div>

              <span className={`${styles.statusBadge} ${styles.statusApproved}`}>
                {followUpAppointments.length} scheduled
              </span>
            </div>

            {followUpAppointments.length === 0 ? (
              <p className={styles.emptyStateText}>
                No follow-up schedule has been added yet.
              </p>
            ) : (
              <div className={styles.detailsGrid}>
                {followUpAppointments.slice(0, 3).map((appt) => {
                  const followUpDate = getFollowUpDate(appt);
                  const followUpPlan = getFollowUpPlan(appt);

                  return (
                    <div key={`follow-up-${appt.id}`} className={styles.detailBox}>
                      <p className={styles.detailLabel}>
                        {getFollowUpTiming(followUpDate)}
                      </p>

                      <p className={styles.detailValue}>
                        {followUpDate
                          ? formatDate(followUpDate)
                          : "Date not specified"}
                      </p>

                      <p className={styles.serviceText}>
                        Dr. {appt.doctor_name || "Assigned Doctor"}
                      </p>

                      <p className={styles.serviceText}>
                        {appt.services || "Consultation"}
                      </p>

                      {followUpPlan && (
                        <p className={styles.serviceText}>{followUpPlan}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className={styles.filterBar}>
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`${styles.filterButton} ${
                  statusFilter === status ? styles.filterButtonActive : ""
                }`}
              >
                {status === "No-Show" ? "Missed" : status}
              </button>
            ))}
          </div>

          {loading ? (
            <div className={styles.emptyState}>
              <h2>Loading appointments...</h2>
              <p>Please wait while your appointment history is being loaded.</p>
            </div>
          ) : appointments.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>No appointments found</h2>

              <p>
                Your appointment history will appear here once you have booked
                an appointment.
              </p>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>No {statusFilter === "No-Show" ? "Missed" : statusFilter} appointments found</h2>

              <p>
                There are no appointments under this status yet. Try checking
                another filter.
              </p>
            </div>
          ) : (
            <div className={styles.cards}>
              {filteredAppointments.map((appt) => {
                const cleanStatus = normalizeStatus(appt.status);
                const followUpDate = getFollowUpDate(appt);
                const followUpPlan = getFollowUpPlan(appt);

                return (
                  <article key={appt.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div>
                        <h2>Dr. {appt.doctor_name || "Assigned Doctor"}</h2>

                        <p className={styles.serviceText}>
                          {appt.services || "Consultation"}
                        </p>
                      </div>

                      <span
                        className={`${styles.statusBadge} ${getStatusClass(
                          cleanStatus
                        )}`}
                      >
                        {getStatusLabel(cleanStatus)}
                      </span>
                    </div>

                    <div className={styles.detailsGrid}>
                      <div className={styles.detailBox}>
                        <p className={styles.detailLabel}>Date</p>

                        <p className={styles.detailValue}>
                          {formatDate(appt.date)}
                        </p>
                      </div>

                      <div className={styles.detailBox}>
                        <p className={styles.detailLabel}>Time</p>

                        <p className={styles.detailValue}>
                          {formatTimeRange(appt)}
                        </p>
                      </div>

                      <div className={styles.detailBox}>
                        <p className={styles.detailLabel}>Service</p>

                        <p className={styles.detailValue}>
                          {appt.services || "Not specified"}
                        </p>
                      </div>

                      <div className={styles.detailBox}>
                        <p className={styles.detailLabel}>Mode</p>

                        <p className={styles.detailValue}>
                          {appt.consultation_mode || "In-Person"}
                        </p>
                      </div>
                    </div>

                    {renderInstructionBox(appt)}

                    {(cleanStatus === "Declined" ||
                      cleanStatus === "Cancelled" ||
                      cleanStatus === "No-Show") &&
                      appt.cancel_reason && (
                        <div className={styles.noticeBox}>
                          <strong>Reason:</strong> {appt.cancel_reason}
                        </div>
                      )}

                    {(followUpDate || followUpPlan) && (
                      <div className={styles.noticeBox}>
                        <strong>Follow-up:</strong>{" "}
                        {followUpDate
                          ? formatDate(followUpDate)
                          : "Date not specified"}
                        {followUpPlan ? ` • ${followUpPlan}` : ""}
                      </div>
                    )}

                    {cleanStatus === "Completed" && (
                      <div className={styles.noticeBox}>
                        This appointment has been completed. The doctor’s
                        consultation record can be viewed in{" "}
                        <Link
                          href="/pages/patient/records"
                          className={styles.inlineLink}
                        >
                          Medical Records
                        </Link>
                        .
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
