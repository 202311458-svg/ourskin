"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import Calendar from "@/app/components/Calendar";
import styles from "@/app/styles/doctor.module.css";
import { getDoctorDashboard, type DashboardData } from "@/lib/doctor-api";

type DashboardAppointment = {
  id: number;
  patient_name?: string;
  doctor_name?: string;
  date?: string;
  time?: string;
  services?: string;
  status?: string;
};

type DashboardAnalysis = {
  id: number;
  appointment_id?: number;
  patient_id?: number | null;
  patient_name?: string | null;
  patient_email?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  appointment_service?: string | null;
  appointment_status?: string | null;
  condition?: string;
  confidence?: number;
  severity?: string;
  recommendation?: string;
  review_status?: string;
  created_at?: string | null;
  red_flags?: string | null;
};

type DashboardStats = {
  todays_appointments?: number;
  pending_ai_reviews?: number;
  follow_ups_due?: number;
};

type DoctorDashboardView = DashboardData & {
  stats?: DashboardStats;
  todays_schedule?: DashboardAppointment[];
  ai_queue?: DashboardAnalysis[];
  urgent_cases?: DashboardAnalysis[];
};

function getStatusBadgeClass(status?: string) {
  switch ((status || "").trim()) {
    case "Completed":
      return `${styles.statusBadge} ${styles.badgeCompleted}`;
    case "Approved":
      return `${styles.statusBadge} ${styles.badgeApproved}`;
    case "Declined":
    case "Cancelled":
      return `${styles.statusBadge} ${styles.badgeUrgent}`;
    case "Pending":
    default:
      return `${styles.statusBadge} ${styles.badgePending}`;
  }
}

function getSeverityBadgeClass(severity?: string) {
  const normalized = (severity || "").toLowerCase();

  if (
    normalized.includes("severe") ||
    normalized.includes("high") ||
    normalized.includes("urgent")
  ) {
    return `${styles.statusBadge} ${styles.badgeUrgent}`;
  }

  if (normalized.includes("moderate")) {
    return `${styles.statusBadge} ${styles.badgePending}`;
  }

  return `${styles.statusBadge} ${styles.badgeCompleted}`;
}

function formatConfidence(value?: number) {
  if (typeof value !== "number") {
    return "N/A";
  }

  if (value <= 1) {
    return `${Math.round(value * 100)}%`;
  }

  return `${Math.round(value)}%`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "N/A";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString();
}

export default function DoctorDashboardPage() {
  const router = useRouter();

  const [data, setData] = useState<DoctorDashboardView | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);

      const result = await getDoctorDashboard();
      setData(result as DoctorDashboardView);
    } catch (error) {
      console.error("Failed to load doctor dashboard:", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "doctor") {
      router.push("/");
      return;
    }

    loadDashboard();
  }, [router, loadDashboard]);

  const stats: DashboardStats = data?.stats ?? {};

  const todaysAppointments: DashboardAppointment[] =
    data?.todays_schedule ?? [];

  const pendingAiReviews: DashboardAnalysis[] = data?.ai_queue ?? [];

  const highPriorityCases = useMemo(() => {
    const urgentCases: DashboardAnalysis[] = data?.urgent_cases ?? [];

    return urgentCases.filter((item) => {
      const severity = (item.severity || "").toLowerCase();

      return (
        severity.includes("high") ||
        severity.includes("severe") ||
        severity.includes("urgent")
      );
    });
  }, [data?.urgent_cases]);

  const openPatientRecord = (patientName?: string | null) => {
    if (!patientName) {
      router.push("/pages/doctor/patient-records");
      return;
    }

    router.push(
      `/pages/doctor/patient-records?patient=${encodeURIComponent(
        patientName
      )}`
    );
  };

  if (loading) {
    return (
      <>
        <DoctorNavbar />

        <main className={styles.pageWrapper}>
          <div className={styles.emptyState}>Loading dashboard...</div>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <DoctorNavbar />

        <main className={styles.pageWrapper}>
          <div className={styles.emptyState}>Unable to load dashboard.</div>
        </main>
      </>
    );
  }

  return (
    <>
      <DoctorNavbar />

      <main className={styles.pageWrapper}>
        <div className={styles.headerSection}>
          <h1 className={styles.pageTitle}>Doctor Dashboard</h1>
          <p className={styles.pageSubtitle}>
            Review today&apos;s appointments, pending AI reviews, urgent cases,
            follow-ups, and schedule overview.
          </p>
        </div>

        <section className={styles.doctorStatsGrid}>
          <div className={styles.sectionCard}>
            <p className={styles.listSecondary}>Today&apos;s Appointments</p>
            <h2 className={styles.doctorStatValue}>
              {stats.todays_appointments ?? todaysAppointments.length}
            </h2>
          </div>

          <div className={styles.sectionCard}>
            <p className={styles.listSecondary}>Pending AI Reviews</p>
            <h2 className={styles.doctorStatValue}>
              {stats.pending_ai_reviews ?? pendingAiReviews.length}
            </h2>
          </div>

          <div className={styles.sectionCard}>
            <p className={styles.listSecondary}>Follow-ups Due</p>
            <h2 className={styles.doctorStatValue}>
              {stats.follow_ups_due ?? 0}
            </h2>
          </div>
        </section>

        <div className={styles.doctorDashboardGrid}>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>
                  Today&apos;s Appointments
                </h2>
                <p className={styles.listSecondary}>
                  Your schedule for today and the cases that need action.
                </p>
              </div>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => router.push("/pages/doctor/appointments")}
              >
                View All
              </button>
            </div>

            <div className={styles.list}>
              {todaysAppointments.length === 0 ? (
                <div className={styles.emptyState}>
                  No appointments scheduled today.
                </div>
              ) : (
                todaysAppointments.map((appt) => (
                  <div key={appt.id} className={styles.listItem}>
                    <div className={styles.listLeft}>
                      <div className={styles.listPrimary}>
                        {appt.patient_name || "Unnamed Patient"}
                      </div>

                      <div className={styles.listSecondary}>
                        {appt.time || "No time"} •{" "}
                        {appt.services || "Consultation"} • Dr:{" "}
                        {appt.doctor_name || "N/A"}
                      </div>
                    </div>

                    <div className={styles.listRight}>
                      <span className={getStatusBadgeClass(appt.status)}>
                        {appt.status || "Pending"}
                      </span>

                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => router.push("/pages/doctor/appointments")}
                      >
                        {appt.status === "Approved"
                          ? "Complete Report"
                          : "View"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Pending AI Reviews</h2>
                <p className={styles.listSecondary}>
                  AI results waiting for doctor confirmation.
                </p>
              </div>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => router.push("/pages/doctor/ai-analysis")}
              >
                Open AI
              </button>
            </div>

            <div className={styles.list}>
              {pendingAiReviews.length === 0 ? (
                <div className={styles.emptyState}>
                  No pending AI reviews right now.
                </div>
              ) : (
                pendingAiReviews.map((item) => (
                  <div key={item.id} className={styles.listItem}>
                    <div className={styles.listLeft}>
                      <div className={styles.listPrimary}>
                        {item.patient_name || "Unnamed Patient"}
                      </div>

                      <div className={styles.listSecondary}>
                        {item.condition || "Unknown Condition"} • Severity:{" "}
                        {item.severity || "N/A"} • Confidence:{" "}
                        {formatConfidence(item.confidence)}
                      </div>
                    </div>

                    <div className={styles.listRight}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => router.push("/pages/doctor/ai-analysis")}
                      >
                        Review
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className={styles.doctorDashboardGrid}>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Urgent Cases</h2>
                <p className={styles.listSecondary}>
                  High-severity AI cases that should be reviewed first.
                </p>
              </div>
            </div>

            <div className={styles.list}>
              {highPriorityCases.length === 0 ? (
                <div className={styles.emptyState}>
                  No urgent AI cases detected.
                </div>
              ) : (
                highPriorityCases.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openPatientRecord(item.patient_name)}
                    className={styles.urgentCaseCard}
                  >
                    <div className={styles.urgentCaseTop}>
                      <div>
                        <div className={styles.urgentCaseName}>
                          {item.patient_name || "Unnamed Patient"}
                        </div>

                        <div className={styles.urgentCaseMeta}>
                          {item.condition || "Unknown Condition"} •{" "}
                          {item.appointment_service || "Consultation"}
                        </div>
                      </div>

                      <span className={getSeverityBadgeClass(item.severity)}>
                        {item.severity || "Urgent"}
                      </span>
                    </div>

                    <div className={styles.urgentCaseText}>
                      Generated: {formatDateTime(item.created_at)}
                    </div>

                    {item.red_flags && (
                      <div className={styles.urgentCaseText}>
                        <strong>Red flags:</strong> {item.red_flags}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Follow-ups Due</h2>
                <p className={styles.listSecondary}>
                  Patients who need follow-up attention.
                </p>
              </div>
            </div>

            <div className={styles.followUpSummaryCard}>
              <p className={styles.listSecondary}>Due follow-ups</p>

              <h2 className={styles.doctorStatValue}>
                {stats.follow_ups_due ?? 0}
              </h2>

              <p className={styles.listSecondary}>
                Open the follow-up page to review patients with scheduled
                follow-up care.
              </p>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => router.push("/pages/doctor/follow-ups")}
              >
                View Follow-ups
              </button>
            </div>
          </section>
        </div>

        <div className={styles.calendarOverviewGrid}>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Calendar Overview</h2>
                <p className={styles.listSecondary}>
                  Compact schedule view for quick date checking.
                </p>
              </div>
            </div>

            <Calendar mode="compact" statusFilter="All" />
          </section>
        </div>
      </main>
    </>
  );
}