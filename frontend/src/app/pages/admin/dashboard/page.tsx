"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";
import { API_BASE_URL } from "@/lib/api";
import styles from "./admindash.module.css";

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

const API_BASE = API_BASE_URL;

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

function getApiErrorMessage(data: DashboardApiResponse | null, fallback: string) {
  if (data?.detail) return data.detail;
  if (data?.message) return data.message;
  return fallback;
}

function getPercent(value: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats>({
    total_users: 0,
    total_patients: 0,
    total_staff: 0,
    total_doctors: 0,
    total_appointments: 0,
    pending_appointments: 0,
    approved_appointments: 0,
    total_ai_logs: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "admin") {
      router.push("/");
      return;
    }

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/admin/dashboard`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await safeJson<DashboardApiResponse>(res);

        if (!res.ok) {
          throw new Error(getApiErrorMessage(data, "Unable to load dashboard data."));
        }

        setStats({
          total_users: data?.total_users || 0,
          total_patients: data?.total_patients || 0,
          total_staff: data?.total_staff || 0,
          total_doctors: data?.total_doctors || 0,
          total_appointments: data?.total_appointments || 0,
          pending_appointments: data?.pending_appointments || 0,
          approved_appointments: data?.approved_appointments || 0,
          total_ai_logs: data?.total_ai_logs || 0,
        });
      } catch (loadError: unknown) {
        setError(getErrorMessage(loadError, "Unable to load dashboard data."));
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

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
        stats.pending_appointments > 0 ? styles.orangeAccent : styles.greenAccent,
    },
    {
      label: "Approved",
      value: stats.approved_appointments,
      helper: `${dashboardInsights.appointmentApprovalRate}% approval share`,
      className: styles.greenAccent,
    },
    {
      label: "AI Review Monitor",
      value: stats.total_ai_logs,
      helper: "Skin analysis records",
      className: styles.blueAccent,
    },
  ];

  return (
    <div className="staffLayout">
      <AdminNavbar />

      <main className="staffContent">
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Admin Control Center</p>
            <h1>Welcome back, Admin!</h1>
            <p>
              Monitor OurSkin users, appointments, staff activity, and AI-assisted
              dermatology records in one clean workspace.
            </p>

            <div className={styles.heroActions}>
              <Link href="/pages/admin/appointments" className={styles.primaryAction}>
                Review Appointments
              </Link>

              <Link href="/pages/admin/audit-logs" className={styles.secondaryAction}>
                View Audit Logs
              </Link>
            </div>
          </div>

          <div className={styles.heroPanel}>
            <span>Appointment Overview</span>
            <strong>{stats.total_appointments}</strong>
            <p>Total appointment records monitored by the admin portal.</p>
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
                <div key={card.label} className={`${styles.statCard} ${card.className}`}>
<div className={styles.statTop}>
  <span className={styles.statLabel}>{card.label}</span>
</div>

                  <strong>{card.value}</strong>
                  <p>{card.helper}</p>
                </div>
              ))}
            </section>

            <section className={styles.statsGrid}>
              {operationalCards.map((card) => (
                <div key={card.label} className={`${styles.statCard} ${card.className}`}>
<div className={styles.statTop}>
  <span className={styles.statLabel}>{card.label}</span>
</div>

                  <strong>{card.value}</strong>
                  <p>{card.helper}</p>
                </div>
              ))}
            </section>

            <section className={styles.dashboardGrid}>
              <div className={styles.panelCard}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Appointments</p>
                    <h2>Appointment Pipeline</h2>
                  </div>

                  <Link href="/pages/admin/appointments">Manage</Link>
                </div>

                <div className={styles.pipelineList}>
                  <div className={styles.pipelineItem}>
                    <div>
                      <span>Approved Appointments</span>
                      <strong>{stats.approved_appointments}</strong>
                    </div>

                    <div className={styles.progressTrack}>
                      <div
                        className={`${styles.progressBar} ${styles.greenBar}`}
                        style={{
                          width: `${dashboardInsights.appointmentApprovalRate}%`,
                        }}
                      />
                    </div>

                    <p>{dashboardInsights.appointmentApprovalRate}% of all appointments</p>
                  </div>

                  <div className={styles.pipelineItem}>
                    <div>
                      <span>Pending Requests</span>
                      <strong>{stats.pending_appointments}</strong>
                    </div>

                    <div className={styles.progressTrack}>
                      <div
                        className={`${styles.progressBar} ${styles.orangeBar}`}
                        style={{ width: `${dashboardInsights.pendingRate}%` }}
                      />
                    </div>

                    <p>{dashboardInsights.pendingRate}% still waiting for action</p>
                  </div>
                </div>
              </div>

              <div className={styles.panelCard}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Accounts</p>
                    <h2>User Distribution</h2>
                  </div>

                  <Link href="/pages/admin/users">View Users</Link>
                </div>

                <div className={styles.breakdownGrid}>
                  <div className={styles.breakdownItem}>
                    <span>Patients</span>
                    <strong>{stats.total_patients}</strong>
                    <p>{dashboardInsights.patientShare}% of all users</p>
                  </div>

                  <div className={styles.breakdownItem}>
                    <span>Internal Users</span>
                    <strong>{dashboardInsights.internalUsers}</strong>
                    <p>{dashboardInsights.internalShare}% staff and doctors</p>
                  </div>
                </div>
              </div>

              <div className={styles.panelCard}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>AI Monitoring</p>
                    <h2>AI Activity</h2>
                  </div>

                  <Link href="/pages/admin/ai-logs">Open AI Review Monitor</Link>
                </div>

                <div className={styles.aiBox}>
                  <div>
                    <span>Total AI Records</span>
                    <strong>{stats.total_ai_logs}</strong>
                    <p>
                      AI analysis records available for review and monitoring.
                    </p>
                  </div>

                  <div className={styles.aiBadge}>
                    {stats.total_ai_logs > 0 ? "Active" : "No records yet"}
                  </div>
                </div>
              </div>

              <div className={styles.panelCard}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Quick Actions</p>
                    <h2>Admin Shortcuts</h2>
                  </div>
                </div>

                <div className={styles.quickActions}>
                  <Link href="/pages/admin/staff-mgmt">Manage Staff</Link>
                  <Link href="/pages/admin/appointments">Review Appointments</Link>
                  <Link href="/pages/admin/audit-logs">Check Audit Logs</Link>
                  <Link href="/pages/admin/records">Look Over Records</Link>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}