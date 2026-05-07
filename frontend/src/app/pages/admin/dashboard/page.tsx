"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";
import { API_BASE_URL } from "@/lib/api";
import { useAutoRefresh } from "@/app/hooks/useAutoRefresh";
import styles from "@/app/styles/admin.module.css";

type DashboardStats = {
  total_users: number;
  total_patients: number;
  total_staff: number;
  total_doctors: number;
  total_appointments: number;
  pending_appointments: number;
  approved_appointments: number;
  total_ai_logs: number;
};

type DashboardApiResponse = Partial<DashboardStats> & {
  detail?: string;
  message?: string;
};

type FollowUp = {
  id: number;
  patient_id?: number | null;
  patient_name?: string | null;
  patient_email?: string | null;
  doctor_id?: number | null;
  doctor_name?: string | null;
  appointment_id?: number | null;
  appointment_services?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  follow_up_date: string;
  status?: string | null;
};

type ApiErrorResponse = {
  detail?: string;
  message?: string;
};

const API_BASE = API_BASE_URL;

const EMPTY_STATS: DashboardStats = {
  total_users: 0,
  total_patients: 0,
  total_staff: 0,
  total_doctors: 0,
  total_appointments: 0,
  pending_appointments: 0,
  approved_appointments: 0,
  total_ai_logs: 0,
};

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function getApiErrorMessage(data: ApiErrorResponse | null, fallback: string) {
  if (data?.detail) return data.detail;
  if (data?.message) return data.message;
  return fallback;
}

function getPercent(value: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function getTodayInputDate() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;

  return new Date(today.getTime() - timezoneOffset).toISOString().split("T")[0];
}

function normalizeStatus(status?: string | null) {
  const cleanStatus = (status || "").trim().toLowerCase();

  if (cleanStatus === "scheduled") return "Scheduled";
  if (cleanStatus === "completed") return "Completed";
  if (cleanStatus === "pending") return "Pending";
  if (cleanStatus === "approved") return "Approved";
  if (cleanStatus === "cancelled") return "Cancelled";
  if (cleanStatus === "canceled") return "Cancelled";
  if (cleanStatus === "declined") return "Declined";

  return status?.trim() || "Unknown";
}

function getFollowUpsArray(data: unknown): FollowUp[] {
  if (Array.isArray(data)) return data as FollowUp[];

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { follow_ups?: unknown }).follow_ups)
  ) {
    return (data as { follow_ups: FollowUp[] }).follow_ups;
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { followUps?: unknown }).followUps)
  ) {
    return (data as { followUps: FollowUp[] }).followUps;
  }

  return [];
}

function uniqueFollowUpsById(followUps: FollowUp[]) {
  return Array.from(
    new Map(
      followUps.map((item) => [
        item.id,
        {
          ...item,
          status: normalizeStatus(item.status),
        },
      ])
    ).values()
  );
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

  const parts = value.split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getFollowUpTiming(item: FollowUp) {
  const today = getTodayInputDate();
  const status = (item.status || "").toLowerCase();

  if (status === "completed") return "Completed";
  if (item.follow_up_date < today) return "Overdue";
  if (item.follow_up_date === today) return "Due Today";

  return "Upcoming";
}

function getFollowUpBadgeClass(item: FollowUp) {
  const timing = getFollowUpTiming(item);

  if (timing === "Completed") return styles.followUpBadgeCompleted;
  if (timing === "Overdue") return styles.followUpBadgeOverdue;
  if (timing === "Due Today") return styles.followUpBadgeDue;

  return styles.followUpBadgeUpcoming;
}

function canCompleteFollowUp(item: FollowUp) {
  const today = getTodayInputDate();
  const status = (item.status || "").toLowerCase();

  return status !== "completed" && item.follow_up_date <= today;
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingFollowUpId, setUpdatingFollowUpId] = useState<number | null>(
    null
  );

  const fetchFollowUps = async (token: string) => {
    const res = await fetch(`${API_BASE}/doctor/follow-ups`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await safeJson<unknown>(res);

    if (!res.ok) {
      console.error("/doctor/follow-ups request failed:", {
        status: res.status,
        data,
      });
      return [];
    }

    return uniqueFollowUpsById(getFollowUpsArray(data));
  };

  const loadDashboard = useCallback(
    async (showLoader = true) => {
      const token = localStorage.getItem("token");
      const role = localStorage.getItem("role");

      if (!token || role !== "admin") {
        router.push("/");
        return;
      }

      try {
        if (showLoader) setLoading(true);
        setError("");

        const [statsRes, followUpData] = await Promise.all([
          fetch(`${API_BASE}/admin/dashboard`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetchFollowUps(token),
        ]);

        const data = await safeJson<DashboardApiResponse>(statsRes);

        if (!statsRes.ok) {
          throw new Error(
            getApiErrorMessage(data, "Unable to load dashboard data")
          );
        }

        setStats({
          ...EMPTY_STATS,
          ...(data || {}),
        });
        setFollowUps(uniqueFollowUpsById(followUpData));
      } catch (loadError: unknown) {
        setError(getErrorMessage(loadError, "Unable to load dashboard."));
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useAutoRefresh(() => loadDashboard(false), {
    enabled: true,
    intervalMs: 10000,
    pause: loading || updatingFollowUpId !== null,
  });

  const dashboardInsights = useMemo(() => {
    const internalUsers = stats.total_staff + stats.total_doctors;
    const appointmentApprovalRate = getPercent(
      stats.approved_appointments,
      stats.total_appointments
    );
    const pendingRate = getPercent(
      stats.pending_appointments,
      stats.total_appointments
    );
    const patientShare = getPercent(stats.total_patients, stats.total_users);
    const internalShare = getPercent(internalUsers, stats.total_users);

    return {
      internalUsers,
      appointmentApprovalRate,
      pendingRate,
      patientShare,
      internalShare,
    };
  }, [stats]);

  const sortedFollowUps = useMemo(() => {
    return uniqueFollowUpsById(followUps).sort((a, b) => {
      const aCompleted = (a.status || "").toLowerCase() === "completed";
      const bCompleted = (b.status || "").toLowerCase() === "completed";

      if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

      return a.follow_up_date.localeCompare(b.follow_up_date);
    });
  }, [followUps]);

  const activeFollowUps = useMemo(() => {
    return sortedFollowUps.filter(
      (item) => (item.status || "").toLowerCase() !== "completed"
    );
  }, [sortedFollowUps]);

  const dueFollowUps = useMemo(() => {
    return sortedFollowUps.filter((item) => {
      const timing = getFollowUpTiming(item);
      return timing === "Due Today" || timing === "Overdue";
    });
  }, [sortedFollowUps]);

  const completedFollowUps = useMemo(() => {
    return sortedFollowUps.filter(
      (item) => (item.status || "").toLowerCase() === "completed"
    );
  }, [sortedFollowUps]);

  const primaryCards = [
    {
      label: "Total Users",
      value: stats.total_users,
      helper: "All registered accounts",
      className: styles.pinkAccent,
    },
    {
      label: "Patients",
      value: stats.total_patients,
      helper: `${dashboardInsights.patientShare}% of total users`,
      className: styles.greenAccent,
    },
    {
      label: "Doctors",
      value: stats.total_doctors,
      helper: "Active clinical users",
      className: styles.blueAccent,
    },
    {
      label: "Staff",
      value: stats.total_staff,
      helper: "Internal support users",
      className: styles.orangeAccent,
    },
  ];

  const operationalCards = [
    {
      label: "Total Appointments",
      value: stats.total_appointments,
      helper: "All appointment records",
      className: styles.pinkAccent,
    },
    {
      label: "Pending Requests",
      value: stats.pending_appointments,
      helper:
        stats.pending_appointments > 0
          ? "Needs admin review"
          : "No pending requests",
      className:
        stats.pending_appointments > 0
          ? styles.orangeAccent
          : styles.greenAccent,
    },
    {
      label: "Approved",
      value: stats.approved_appointments,
      helper: `${dashboardInsights.appointmentApprovalRate}% approval share`,
      className: styles.greenAccent,
    },
    {
      label: "Follow-ups Due",
      value: dueFollowUps.length,
      helper:
        dueFollowUps.length > 0
          ? "Ready for completion review"
          : "No due follow-ups",
      className: dueFollowUps.length > 0 ? styles.orangeAccent : styles.blueAccent,
    },
  ];

  async function markFollowUpCompleted(followUpId: number) {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/");
      return;
    }

    const selectedFollowUp = followUps.find((item) => item.id === followUpId);

    if (!selectedFollowUp) {
      alert("Follow-up schedule was not found.");
      return;
    }

    if (!canCompleteFollowUp(selectedFollowUp)) {
      alert("This follow-up can only be completed on or after its scheduled date.");
      return;
    }

    try {
      setUpdatingFollowUpId(followUpId);

      const res = await fetch(`${API_BASE}/doctor/follow-ups/${followUpId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "Completed" }),
      });

      const data = await safeJson<
        {
          follow_up?: FollowUp;
        } & ApiErrorResponse
      >(res);

      if (!res.ok) {
        throw new Error(
          getApiErrorMessage(data, "Unable to complete follow-up schedule.")
        );
      }

      setFollowUps((prev) =>
        uniqueFollowUpsById(
          prev.map((item) =>
            item.id === followUpId
              ? { ...item, ...(data?.follow_up || {}), status: "Completed" }
              : item
          )
        )
      );

      await loadDashboard(false);
    } catch (completeError: unknown) {
      alert(
        getErrorMessage(
          completeError,
          "Unable to mark this follow-up as completed."
        )
      );
    } finally {
      setUpdatingFollowUpId(null);
    }
  }

  return (
    <div className="staffLayout">
      <AdminNavbar />

      <main className={`staffContent ${styles.dashboardPage}`}>
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Admin Control Center</p>
            <h1>Welcome back, Admin!</h1>
            <p>
              Monitor OurSkin users, appointments, staff activity, AI-assisted
              dermatology records, and follow-up schedules in one clean
              workspace.
            </p>

            <div className={styles.heroActions}>
              <Link
                href="/pages/admin/appointments"
                className={styles.primaryAction}
              >
                Review Appointments
              </Link>

              <Link
                href="/pages/admin/audit-logs"
                className={styles.secondaryAction}
              >
                View Audit Logs
              </Link>
            </div>
          </div>

          <div className={styles.heroPanel}>
            <span>Active Follow-ups</span>
            <strong>{activeFollowUps.length}</strong>
            <p>Scheduled follow-ups that still need monitoring.</p>
          </div>
        </section>

        {loading ? (
          <div className={styles.stateCard}>
            <p className={styles.message}>Loading dashboard...</p>
          </div>
        ) : error ? (
          <div className={styles.stateCard}>
            <p className={styles.error}>{error}</p>
          </div>
        ) : (
          <>
            <section className={styles.statsGrid}>
              {primaryCards.map((card) => (
                <div
                  key={card.label}
                  className={`${styles.statCard} ${card.className}`}
                >
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <p>{card.helper}</p>
                </div>
              ))}
            </section>

            <section className={styles.statsGrid}>
              {operationalCards.map((card) => (
                <div
                  key={card.label}
                  className={`${styles.statCard} ${card.className}`}
                >
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <p>{card.helper}</p>
                </div>
              ))}
            </section>

            <section className={styles.followUpPanel}>
              <div className={styles.followUpHeader}>
                <div>
                  <h2>Follow-up Schedule</h2>
                  <p>Admin view of doctor-created follow-up schedules.</p>
                </div>

                <span className={styles.followUpCount}>
                  {sortedFollowUps.length} total
                </span>
              </div>

              {sortedFollowUps.length === 0 ? (
                <div className={styles.followUpEmpty}>
                  No follow-up schedules found.
                </div>
              ) : (
                <div className={styles.followUpList}>
                  {sortedFollowUps.slice(0, 5).map((item) => {
                    const timing = getFollowUpTiming(item);
                    const isCompleted =
                      (item.status || "").toLowerCase() === "completed";
                    const canComplete = canCompleteFollowUp(item);
                    const isUpdating = updatingFollowUpId === item.id;

                    return (
                      <div key={item.id} className={styles.followUpRow}>
                        <div className={styles.followUpMain}>
                          <strong>
                            {item.patient_name ||
                              (item.patient_id
                                ? `Patient #${item.patient_id}`
                                : "Patient details unavailable")}
                          </strong>

                          <span>
                            {formatDate(item.follow_up_date)}
                            {item.doctor_name ? ` • ${item.doctor_name}` : ""}
                          </span>

                          {(item.appointment_date || item.appointment_time) && (
                            <small>
                              Related Visit: {" "}
                              {item.appointment_date
                                ? formatDate(item.appointment_date)
                                : "No date"}{" "}
                              {item.appointment_time
                                ? `at ${formatTime(item.appointment_time)}`
                                : ""}
                            </small>
                          )}
                        </div>

                        <div className={styles.followUpActions}>
                          <span
                            className={`${styles.followUpBadge} ${getFollowUpBadgeClass(
                              item
                            )}`}
                          >
                            {timing}
                          </span>

                          {!isCompleted && (
                            <button
                              type="button"
                              className={
                                canComplete
                                  ? styles.followUpCompleteBtn
                                  : styles.followUpDisabledBtn
                              }
                              onClick={() => markFollowUpCompleted(item.id)}
                              disabled={!canComplete || isUpdating}
                            >
                              {isUpdating
                                ? "Completing..."
                                : canComplete
                                ? "Mark Completed"
                                : "Not Due Yet"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {sortedFollowUps.length > 5 && (
                <div className={styles.followUpFooter}>
                  <Link href="/pages/admin/appointments">View all follow-ups</Link>
                </div>
              )}
            </section>

            <section className={styles.panelCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Operational Snapshot</h2>
                  <p>
                    {dashboardInsights.pendingRate}% of appointment records are
                    pending, while {dashboardInsights.internalShare}% of users
                    are internal clinic users. Completed follow-ups: {" "}
                    {completedFollowUps.length}. Active follow-ups: {" "}
                    {activeFollowUps.length}.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
