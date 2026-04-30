"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { API_BASE_URL } from "@/lib/api";
import styles from "./history.module.css";

interface Appointment {
  id: number;
  doctor_name: string;
  date: string;
  time: string;
  services: string;
  status: string;
  cancel_reason?: string | null;

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

  return status?.trim() || "Unknown";
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

const hasScheduledFollowUp = (appt: Appointment) => {
  return Boolean(getFollowUpDate(appt));
};

export default function PatientHistory() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "No date";

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeString?: string | null) => {
    if (!timeString) return "No time";

    const date = new Date(`1970-01-01T${timeString}`);

    if (Number.isNaN(date.getTime())) return timeString;

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getDateTimeValue = (appt: Appointment) => {
    return new Date(`${appt.date}T${appt.time || "00:00:00"}`).getTime();
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

  const getStatusClass = (status: string) => {
    const normalized = normalizeStatus(status);

    if (normalized === "Completed") return styles.statusCompleted;
    if (normalized === "Approved") return styles.statusApproved;
    if (normalized === "Pending") return styles.statusPending;
    if (normalized === "Cancelled" || normalized === "Declined") {
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

  return (
    <div className={`${navCollapsed ? "nav-collapsed" : "nav-active"}`}>
      <Navbar />

      <main
        className={styles.historyContainer}
        style={{
          marginLeft: navCollapsed ? "80px" : "220px",
        }}
      >
        <section className={styles.contentWrapper}>
          <div className={styles.headerRow}>
            <div>
              <p className={styles.eyebrow}>Patient Portal</p>
              <h1 className={styles.h1}>Appointment History</h1>

              <p className={styles.subtitle}>
                View your past and current appointments, including booking
                status, schedule details, cancellation notes, and follow-up
                schedules.
              </p>
            </div>

            <Link href="/pages/patient/records" className={styles.primaryButton}>
              View Medical Records
            </Link>
          </div>

          <section
            style={{
              marginBottom: "22px",
              border: "1px solid #f3d3df",
              borderRadius: "18px",
              padding: "18px",
              background:
                "linear-gradient(135deg, rgba(255, 241, 246, 0.95), rgba(255, 255, 255, 0.96))",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "14px",
                alignItems: "flex-start",
                flexWrap: "wrap",
                marginBottom: "14px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    color: "#831843",
                    fontSize: "1.15rem",
                  }}
                >
                  Follow-Up Schedule
                </h2>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#64748b",
                    fontSize: "0.92rem",
                  }}
                >
                  Follow-up dates recommended after completed consultations.
                </p>
              </div>

              <span
                style={{
                  borderRadius: "999px",
                  padding: "8px 12px",
                  background: "#fce7f3",
                  color: "#be185d",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                }}
              >
                {followUpAppointments.length} scheduled
              </span>
            </div>

            {followUpAppointments.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  color: "#64748b",
                }}
              >
                No follow-up schedule has been added yet.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "12px",
                }}
              >
                {followUpAppointments.slice(0, 3).map((appt) => {
                  const followUpDate = getFollowUpDate(appt);
            

                  return (
                    <div
                      key={`follow-up-${appt.id}`}
                      style={{
                        border: "1px solid #fbcfe8",
                        borderRadius: "16px",
                        padding: "14px",
                        background: "#ffffff",
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 4px",
                          color: "#be185d",
                          fontWeight: 800,
                          fontSize: "0.82rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {getFollowUpTiming(followUpDate)}
                      </p>

                      <h3
                        style={{
                          margin: "0 0 8px",
                          color: "#111827",
                          fontSize: "1rem",
                        }}
                      >
                        {followUpDate
                          ? formatDate(followUpDate)
                          : "Date not specified"}
                      </h3>

                      <p
                        style={{
                          margin: "0 0 4px",
                          color: "#334155",
                          fontWeight: 700,
                        }}
                      >
                        Dr. {appt.doctor_name || "Assigned Doctor"}
                      </p>

                      <p
                        style={{
                          margin: 0,
                          color: "#64748b",
                          lineHeight: 1.5,
                        }}
                      >
                        {appt.services || "Consultation"}
                      </p>

                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "20px",
            }}
          >
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                style={{
                  border:
                    statusFilter === status
                      ? "1px solid #c0265a"
                      : "1px solid #e5e7eb",
                  background: statusFilter === status ? "#c0265a" : "#ffffff",
                  color: statusFilter === status ? "#ffffff" : "#475569",
                  borderRadius: "999px",
                  padding: "9px 15px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "0.2s ease",
                }}
              >
                {status}
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
              <h2>No {statusFilter} appointments found</h2>
              <p>
                There are no appointments under this status yet. Try checking
                another filter.
              </p>
            </div>
          ) : (
            <div className={styles.cards}>
              {filteredAppointments.map((appt) => {
                const cleanStatus = normalizeStatus(appt.status);
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
                        {cleanStatus}
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
                          {formatTime(appt.time)}
                        </p>
                      </div>

                      <div className={styles.detailBox}>
                        <p className={styles.detailLabel}>Service</p>
                        <p className={styles.detailValue}>
                          {appt.services || "Not specified"}
                        </p>
                      </div>


                    </div>



                    {(cleanStatus === "Declined" ||
                      cleanStatus === "Cancelled") &&
                      appt.cancel_reason && (
                        <div className={styles.noticeBox}>
                          <strong>Reason:</strong> {appt.cancel_reason}
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
