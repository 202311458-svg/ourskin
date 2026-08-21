"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import PageShell from "@/app/components/portal/ui/PageShell"
import PageHeader from "@/app/components/portal/ui/PageHeader";
import Section from "@/app/components/portal/ui/Section";
import StatCard from "@/app/components/portal/ui/StatCard";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import EmptyState from "@/app/components/portal/ui/EmptyState";
import styles from "./page.module.css";

type Appointment = {
  id: number;
  patient_name?: string;
  doctor_name?: string;
  date?: string;
  time?: string;
  services?: string;
  status?: string;
};

type Analysis = {
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

type FollowUp = {
  id: number;
  appointment_id: number;
  patient_id?: number | null;
  patient_name?: string | null;
  patient_email?: string | null;
  doctor_name?: string | null;
  appointment_services?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  follow_up_date: string;
  reason?: string | null;
  notes?: string | null;
  status?: string;
};

type DashboardStats = {
  todays_appointments?: number;
  pending_ai_reviews?: number;
  follow_ups_due?: number;
  follow_ups_scheduled?: number;
  completed_today?: number;
};

type DashboardData = {
  stats?: DashboardStats;
  todays_schedule?: Appointment[];
  ai_queue?: Analysis[];
  urgent_cases?: Analysis[];
  follow_ups_due_items?: FollowUp[];
  upcoming_follow_ups?: FollowUp[];
};

function getStatusBadgeClass(status?: string) {
  const normalized = (status || "").trim();

  if (normalized === "Completed") return `${styles.statusBadge} ${styles.badgeCompleted}`;
  if (normalized === "Approved") return `${styles.statusBadge} ${styles.badgeApproved}`;
  if (["Declined", "Cancelled"].includes(normalized)) return `${styles.statusBadge} ${styles.badgeUrgent}`;

  return `${styles.statusBadge} ${styles.badgePending}`;
}

function getSeverityBadgeClass(severity?: string) {
  const normalized = (severity || "").toLowerCase();

  if (["severe", "high", "urgent"].some((keyword) => normalized.includes(keyword))) {
    return `${styles.statusBadge} ${styles.badgeUrgent}`;
  }

  if (normalized.includes("moderate")) {
    return `${styles.statusBadge} ${styles.badgePending}`;
  }

  return `${styles.statusBadge} ${styles.badgeCompleted}`;
}

function formatConfidence(value?: number) {
  if (typeof value !== "number") return "N/A";

  if (value <= 1) {
    return `${Math.round(value * 100)}%`;
  }

  return `${Math.round(value)}%`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString();
}

export default function DoctorDashboardPage() {
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const res = await fetch(`${API_BASE_URL}/doctor/dashboard`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const result = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(result?.detail || "Failed to load dashboard");
      }

      setData(result as DashboardData);
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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.hidden) return;
      loadDashboard(false);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [loadDashboard]);

  const stats: DashboardStats = data?.stats ?? {};

  const todaysAppointments: Appointment[] = data?.todays_schedule ?? [];
  const pendingAiReviews: Analysis[] = data?.ai_queue ?? [];
  const dueFollowUps: FollowUp[] = data?.follow_ups_due_items ?? [];
  const upcomingFollowUps: FollowUp[] = data?.upcoming_follow_ups ?? [];

  const followUpPreview = dueFollowUps.length > 0 ? dueFollowUps : upcomingFollowUps;

  const highPriorityCases = useMemo(() => {
    const urgentCases: Analysis[] = data?.urgent_cases ?? [];

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
      `/pages/doctor/patient-records?patient=${encodeURIComponent(patientName)}`
    );
  };

  if (loading) {
    return (
      <PageShell className={styles.page}>
        <PageHeader eyebrow="Doctor overview" title="Clinical workspace" />
        <EmptyState title="Loading dashboard..." />
      </PageShell>
    );
  }

  if (!data) {
    return (
      <PageShell className={styles.page}>
        <PageHeader eyebrow="Doctor overview" title="Clinical workspace" />
        <EmptyState title="Unable to load dashboard." />
      </PageShell>
    );
  }

  return (
    <PageShell className={styles.page}>
      <PageHeader
        eyebrow="Doctor overview"
        title="Clinical workspace"
        description="Review the patients who need attention today, the pending AI review queue, and the follow-ups that should be covered next."
      />

      <div className={styles.stats}>
        <StatCard label="Today's appointments" value={stats.todays_appointments ?? todaysAppointments.length} hint="Scheduled for today" tone="info" />
        <StatCard label="AI reviews" value={stats.pending_ai_reviews ?? pendingAiReviews.length} hint="Waiting for your confirmation" tone="warning" />
        <StatCard label="Follow-ups" value={stats.follow_ups_due ?? 0} hint="Due or overdue" tone={stats.follow_ups_due ? "danger" : "default"} />
      </div>

      <div className={styles.grid}>
        <Section
          title="Today's schedule"
          description="The patients scheduled today and the clinical work that needs attention."
          action={
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => router.push("/pages/doctor/appointments")}
            >
              View All
            </button>
          }
        >
          {todaysAppointments.length === 0 ? (
            <EmptyState title="No appointments scheduled today." />
          ) : (
            <div className={styles.list}>
              {todaysAppointments.map((appt) => (
                <div key={appt.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowPrimary}>
                      {appt.patient_name || "Unnamed Patient"}
                    </div>
                    <div className={styles.rowSecondary}>
                      {appt.time || "No time"} • {appt.services || "Consultation"} • Dr: {appt.doctor_name || "N/A"}
                    </div>
                  </div>

                  <div className={styles.rowActions}>
                    <span className={getStatusBadgeClass(appt.status)}>
                      {appt.status || "Pending"}
                    </span>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => router.push("/pages/doctor/appointments")}
                    >
                      {appt.status === "Approved" ? "Complete Report" : "View"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Review queue"
          description="AI-assisted cases that need your clinical confirmation."
          action={
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => router.push("/pages/doctor/ai-analysis")}
            >
              Open AI
            </button>
          }
        >
          {pendingAiReviews.length === 0 ? (
            <EmptyState title="No pending AI reviews right now." />
          ) : (
            <div className={styles.list}>
              {pendingAiReviews.map((item) => (
                <div key={item.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowPrimary}>
                      {item.patient_name || "Unnamed Patient"}
                    </div>
                    <div className={styles.rowSecondary}>
                      {item.condition || "Unknown Condition"} • Severity: {item.severity || "N/A"} • Confidence: {formatConfidence(item.confidence)}
                    </div>
                  </div>

                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => router.push("/pages/doctor/ai-analysis")}
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {highPriorityCases.length > 0 && (
          <Section
            title="Priority cases"
            description="High-severity AI cases that should be reviewed first."
          >
            <div className={styles.list}>
              {highPriorityCases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openPatientRecord(item.patient_name)}
                  className={styles.urgentRow}
                >
                  <div className={styles.rowMain}>
                    <div className={styles.rowPrimary}>
                      {item.patient_name || "Unnamed Patient"}
                    </div>
                    <div className={styles.rowSecondary}>
                      {item.condition || "Unknown Condition"} • {item.appointment_service || "Consultation"}
                    </div>
                    <div className={styles.rowSecondary}>
                      Generated: {formatDateTime(item.created_at)}
                    </div>
                    {item.red_flags && (
                      <div className={styles.redFlags}>
                        <strong>Red flags:</strong> {item.red_flags}
                      </div>
                    )}
                  </div>

                  <div className={styles.rowActions}>
                    <span className={getSeverityBadgeClass(item.severity)}>
                      {item.severity || "Urgent"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}

        <Section
          title={dueFollowUps.length > 0 ? "Care follow-ups" : "Upcoming follow-ups"}
          description="Patients with scheduled follow-up care and the next steps in their plan."
          action={
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => router.push("/pages/doctor/follow-ups")}
            >
              View All
            </button>
          }
        >
          {followUpPreview.length === 0 ? (
            <EmptyState title="No scheduled follow-ups right now." />
          ) : (
            <div className={styles.list}>
              {followUpPreview.map((item) => {
                const isDue = dueFollowUps.some((due) => due.id === item.id);

                return (
                  <div key={item.id} className={styles.row}>
                    <div className={styles.rowMain}>
                      <div className={styles.rowPrimary}>
                        {item.patient_name || `Patient #${item.patient_id || "N/A"}`}
                      </div>
                      <div className={styles.rowSecondary}>
                        {item.follow_up_date} • {item.appointment_services || "Follow-up consultation"}
                      </div>
                      <div className={styles.rowSecondary}>
                        Reason: {item.reason || "Follow-up consultation"}
                      </div>
                    </div>

                    <div className={styles.rowActions}>
                      <span className={`${styles.statusBadge} ${isDue ? styles.badgeUrgent : styles.badgePending}`}>
                        {isDue ? "Due" : "Upcoming"}
                      </span>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => router.push("/pages/doctor/follow-ups")}
                      >
                        Open
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>
      </PageShell>
    );
}
