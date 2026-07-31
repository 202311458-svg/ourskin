"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import Calendar from "@/app/components/Calendar";
import sharedStyles from "@/app/styles/doctor-shared.module.css";
import dashboardStyles from "@/app/styles/doctor-dashboard.module.css";
import { getDoctorDashboard, type DashboardData } from "@/lib/doctor-api";
import { useAutoRefresh } from "@/app/hooks/useAutoRefresh";

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

type DashboardFollowUp = {
  id: number;
  appointment_id: number;
  patient_id?: number | null;
  patient_name?: string | null;
  patient_email?: string | null;
  doctor_name?: string | null;
  follow_up_date: string;
  reason?: string | null;
  notes?: string | null;
  status?: string;
  appointment_services?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
};

type DashboardStats = {
  todays_appointments?: number;
  pending_ai_reviews?: number;
  follow_ups_due?: number;
  follow_ups_scheduled?: number;
  completed_today?: number;
};

type DoctorDashboardView = DashboardData & {
  stats?: DashboardStats;
  todays_schedule?: DashboardAppointment[];
  ai_queue?: DashboardAnalysis[];
  urgent_cases?: DashboardAnalysis[];
  follow_ups_due_items?: DashboardFollowUp[];
  upcoming_follow_ups?: DashboardFollowUp[];
};

function getStatusBadgeClass(status?: string) {
  switch ((status || "").trim()) {
    case "Completed":
      return `${sharedStyles.statusBadge} ${sharedStyles.badgeCompleted}`;
    case "Approved":
      return `${sharedStyles.statusBadge} ${sharedStyles.badgeApproved}`;
    case "Declined":
    case "Cancelled":
      return `${sharedStyles.statusBadge} ${sharedStyles.badgeUrgent}`;
    case "Pending":
    default:
      return `${sharedStyles.statusBadge} ${sharedStyles.badgePending}`;
  }
}

function getSeverityBadgeClass(severity?: string) {
  const normalized = (severity || "").toLowerCase();

  if (
    normalized.includes("severe") ||
    normalized.includes("high") ||
    normalized.includes("urgent")
  ) {
    return `${sharedStyles.statusBadge} ${sharedStyles.badgeUrgent}`;
  }

  if (normalized.includes("moderate")) {
    return `${sharedStyles.statusBadge} ${sharedStyles.badgePending}`;
  }

  return `${sharedStyles.statusBadge} ${sharedStyles.badgeCompleted}`;
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

  const loadDashboard = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const result = await getDoctorDashboard();
      setData(result as DoctorDashboardView);
    } catch (error) {
      console.error("Failed to load doctor dashboard:", error);
      setData(null);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
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

  useAutoRefresh(() => loadDashboard(false), {
    enabled: true,
    intervalMs: 5000,
    pause: loading,
  });

  const stats: DashboardStats = data?.stats ?? {};

  const todaysAppointments: DashboardAppointment[] =
    data?.todays_schedule ?? [];

  const pendingAiReviews: DashboardAnalysis[] = data?.ai_queue ?? [];

  const dueFollowUps: DashboardFollowUp[] = data?.follow_ups_due_items ?? [];
  const upcomingFollowUps: DashboardFollowUp[] =
    data?.upcoming_follow_ups ?? [];

  const followUpPreview =
    dueFollowUps.length > 0 ? dueFollowUps : upcomingFollowUps;

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

        <main className={sharedStyles.pageWrapper}>
          <div className={sharedStyles.emptyState}>Loading dashboard...</div>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <DoctorNavbar />

        <main className={sharedStyles.pageWrapper}>
          <div className={sharedStyles.emptyState}>Unable to load dashboard.</div>
        </main>
      </>
    );
  }

  return (
    <>
      <DoctorNavbar />

      <main className={sharedStyles.pageWrapper}>
        <div className={sharedStyles.headerSection}>
          <h1 className={sharedStyles.pageTitle}>Doctor Dashboard</h1>
          <p className={sharedStyles.pageSubtitle}>
            Review today&apos;s appointments, pending AI reviews, urgent cases,
            follow-ups, and schedule overview.
          </p>
        </div>

        <section className={dashboardStyles.doctorStatsGrid}>
          <div className={sharedStyles.sectionCard}>
            <p className={sharedStyles.listSecondary}>Today&apos;s Appointments</p>
            <h2 className={dashboardStyles.doctorStatValue}>
              {stats.todays_appointments ?? todaysAppointments.length}
            </h2>
          </div>

          <div className={sharedStyles.sectionCard}>
            <p className={sharedStyles.listSecondary}>Pending AI Reviews</p>
            <h2 className={dashboardStyles.doctorStatValue}>
              {stats.pending_ai_reviews ?? pendingAiReviews.length}
            </h2>
          </div>

          <div className={sharedStyles.sectionCard}>
            <p className={sharedStyles.listSecondary}>Follow-ups Due</p>
            <h2 className={dashboardStyles.doctorStatValue}>
              {stats.follow_ups_due ?? 0}
            </h2>
          </div>

          <div className={sharedStyles.sectionCard}>
            <p className={sharedStyles.listSecondary}>Scheduled Follow-ups</p>
            <h2 className={dashboardStyles.doctorStatValue}>
              {stats.follow_ups_scheduled ?? followUpPreview.length}
            </h2>
          </div>
        </section>

        <div className={dashboardStyles.doctorDashboardGrid}>
          <section className={sharedStyles.sectionCard}>
            <div className={sharedStyles.sectionHeader}>
              <div>
                <h2 className={sharedStyles.sectionTitle}>
                  Today&apos;s Appointments
                </h2>
                <p className={sharedStyles.listSecondary}>
                  Your schedule for today and the cases that need action.
                </p>
              </div>

              <button
                type="button"
                className={sharedStyles.secondaryButton}
                onClick={() => router.push("/pages/doctor/appointments")}
              >
                View All
              </button>
            </div>

            <div className={dashboardStyles.list}>
              {todaysAppointments.length === 0 ? (
                <div className={sharedStyles.emptyState}>
                  No appointments scheduled today.
                </div>
              ) : (
                todaysAppointments.map((appt) => (
                  <div key={appt.id} className={dashboardStyles.listItem}>
                    <div className={dashboardStyles.listLeft}>
                      <div className={dashboardStyles.listPrimary}>
                        {appt.patient_name || "Unnamed Patient"}
                      </div>

                      <div className={sharedStyles.listSecondary}>
                        {appt.time || "No time"} •{" "}
                        {appt.services || "Consultation"} • Dr:{" "}
                        {appt.doctor_name || "N/A"}
                      </div>
                    </div>

                    <div className={dashboardStyles.listRight}>
                      <span className={getStatusBadgeClass(appt.status)}>
                        {appt.status || "Pending"}
                      </span>

                      <button
                        type="button"
                        className={sharedStyles.secondaryButton}
                        onClick={() => router.push("/pages/doctor/appointments")}
                      >
                        {appt.status === "Approved" ? "Complete Report" : "View"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={sharedStyles.sectionCard}>
            <div className={sharedStyles.sectionHeader}>
              <div>
                <h2 className={sharedStyles.sectionTitle}>Pending AI Reviews</h2>
                <p className={sharedStyles.listSecondary}>
                  AI results waiting for doctor confirmation.
                </p>
              </div>

              <button
                type="button"
                className={sharedStyles.secondaryButton}
                onClick={() => router.push("/pages/doctor/ai-analysis")}
              >
                Open AI
              </button>
            </div>

            <div className={dashboardStyles.list}>
              {pendingAiReviews.length === 0 ? (
                <div className={sharedStyles.emptyState}>
                  No pending AI reviews right now.
                </div>
              ) : (
                pendingAiReviews.map((item) => (
                  <div key={item.id} className={dashboardStyles.listItem}>
                    <div className={dashboardStyles.listLeft}>
                      <div className={dashboardStyles.listPrimary}>
                        {item.patient_name || "Unnamed Patient"}
                      </div>

                      <div className={sharedStyles.listSecondary}>
                        {item.condition || "Unknown Condition"} • Severity:{" "}
                        {item.severity || "N/A"} • Confidence:{" "}
                        {formatConfidence(item.confidence)}
                      </div>
                    </div>

                    <div className={dashboardStyles.listRight}>
                      <button
                        type="button"
                        className={sharedStyles.secondaryButton}
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

        <div className={dashboardStyles.doctorDashboardGrid}>
          <section className={sharedStyles.sectionCard}>
            <div className={sharedStyles.sectionHeader}>
              <div>
                <h2 className={sharedStyles.sectionTitle}>Urgent Cases</h2>
                <p className={sharedStyles.listSecondary}>
                  High-severity AI cases that should be reviewed first.
                </p>
              </div>
            </div>

            <div className={dashboardStyles.list}>
              {highPriorityCases.length === 0 ? (
                <div className={sharedStyles.emptyState}>
                  No urgent AI cases detected.
                </div>
              ) : (
                highPriorityCases.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openPatientRecord(item.patient_name)}
                    className={dashboardStyles.urgentCaseCard}
                  >
                    <div className={dashboardStyles.urgentCaseTop}>
                      <div>
                        <div className={dashboardStyles.urgentCaseName}>
                          {item.patient_name || "Unnamed Patient"}
                        </div>

                        <div className={dashboardStyles.urgentCaseMeta}>
                          {item.condition || "Unknown Condition"} •{" "}
                          {item.appointment_service || "Consultation"}
                        </div>
                      </div>

                      <span className={getSeverityBadgeClass(item.severity)}>
                        {item.severity || "Urgent"}
                      </span>
                    </div>

                    <div className={dashboardStyles.urgentCaseText}>
                      Generated: {formatDateTime(item.created_at)}
                    </div>

                    {item.red_flags && (
                      <div className={dashboardStyles.urgentCaseText}>
                        <strong>Red flags:</strong> {item.red_flags}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </section>

          <section className={sharedStyles.sectionCard}>
            <div className={sharedStyles.sectionHeader}>
              <div>
                <h2 className={sharedStyles.sectionTitle}>
                  {dueFollowUps.length > 0
                    ? "Follow-ups Due"
                    : "Upcoming Follow-ups"}
                </h2>
                <p className={sharedStyles.listSecondary}>
                  Patients with scheduled follow-up care.
                </p>
              </div>

              <button
                type="button"
                className={sharedStyles.secondaryButton}
                onClick={() => router.push("/pages/doctor/follow-ups")}
              >
                View All
              </button>
            </div>

            <div className={sharedStyles.followUpSummaryCard}>
              <p className={sharedStyles.listSecondary}>Due follow-ups</p>

              <h2 className={dashboardStyles.doctorStatValue}>
                {stats.follow_ups_due ?? 0}
              </h2>

              <p className={sharedStyles.listSecondary}>
                Total scheduled: {stats.follow_ups_scheduled ?? followUpPreview.length}
              </p>
            </div>

            <div className={`${dashboardStyles.list} ${dashboardStyles.listSpaced}`}>
              {followUpPreview.length === 0 ? (
                <div className={sharedStyles.emptyState}>
                  No scheduled follow-ups right now.
                </div>
              ) : (
                followUpPreview.map((item) => {
                  const isDue = dueFollowUps.some((due) => due.id === item.id);

                  return (
                    <div key={item.id} className={dashboardStyles.listItem}>
                      <div className={dashboardStyles.listLeft}>
                        <div className={dashboardStyles.listPrimary}>
                          {item.patient_name || `Patient #${item.patient_id || "N/A"}`}
                        </div>

                        <div className={sharedStyles.listSecondary}>
                          {item.follow_up_date} •{" "}
                          {item.appointment_services || "Follow-up consultation"}
                        </div>

                        <div className={sharedStyles.listSecondary}>
                          Reason: {item.reason || "Follow-up consultation"}
                        </div>
                      </div>

                      <div className={dashboardStyles.listRight}>
                        <span
                          className={`${sharedStyles.statusBadge} ${
                            isDue ? sharedStyles.badgeUrgent : sharedStyles.badgePending
                          }`}
                        >
                          {isDue ? "Due" : "Upcoming"}
                        </span>

                        <button
                          type="button"
                          className={sharedStyles.secondaryButton}
                          onClick={() => router.push("/pages/doctor/follow-ups")}
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <div className={dashboardStyles.calendarOverviewGrid}>
          <section className={sharedStyles.sectionCard}>
            <div className={sharedStyles.sectionHeader}>
              <div>
                <h2 className={sharedStyles.sectionTitle}>Calendar Overview</h2>
                <p className={sharedStyles.listSecondary}>
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
