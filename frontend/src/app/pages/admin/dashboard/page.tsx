"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import EmptyState from "@/app/components/portal/ui/EmptyState";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import Section from "@/app/components/portal/ui/Section";
import StatCard from "@/app/components/portal/ui/StatCard";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import {
  AdminDashboardStats,
  AdminFollowUp,
  getAdminDashboard,
  getAdminFollowUps,
  updateAdminFollowUp,
} from "@/lib/admin-api";
import styles from "./page.module.css";

const EMPTY_STATS: AdminDashboardStats = {
  total_users: 0,
  total_patients: 0,
  total_staff: 0,
  total_doctors: 0,
  total_appointments: 0,
  pending_appointments: 0,
  approved_appointments: 0,
  total_ai_logs: 0,
};

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
  if (cleanStatus === "cancelled" || cleanStatus === "canceled") return "Cancelled";
  return status?.trim() || "Unknown";
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function getFollowUpTiming(item: AdminFollowUp) {
  const today = getTodayInputDate();
  const status = (item.status || "").toLowerCase();
  if (status === "completed") return "Completed";
  if (status === "cancelled" || status === "canceled") return "Cancelled";
  if (item.follow_up_date < today) return "Overdue";
  if (item.follow_up_date === today) return "Due Today";
  return "Upcoming";
}

function getFollowUpTone(item: AdminFollowUp): "success" | "warning" | "danger" | "info" | "neutral" {
  const timing = getFollowUpTiming(item);
  if (timing === "Completed") return "success";
  if (timing === "Overdue") return "danger";
  if (timing === "Due Today") return "warning";
  if (timing === "Upcoming") return "info";
  return "neutral";
}

function canCompleteFollowUp(item: AdminFollowUp) {
  const today = getTodayInputDate();
  const status = (item.status || "").toLowerCase();
  return status !== "completed" && item.follow_up_date <= today;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function uniqueFollowUpsById(followUps: AdminFollowUp[]) {
  return Array.from(new Map(followUps.map((item) => [item.id, { ...item, status: normalizeStatus(item.status) }])).values());
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats>(EMPTY_STATS);
  const [followUps, setFollowUps] = useState<AdminFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingFollowUpId, setUpdatingFollowUpId] = useState<number | null>(null);

  const loadDashboard = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError("");
      const [dashboardData, followUpData] = await Promise.all([getAdminDashboard(), getAdminFollowUps()]);
      setStats({ ...EMPTY_STATS, ...(dashboardData || {}) });
      setFollowUps(uniqueFollowUpsById(Array.isArray(followUpData) ? followUpData : []));
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, "Unable to load dashboard."));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.hidden || updatingFollowUpId !== null) return;
      void loadDashboard(false);
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [loadDashboard, updatingFollowUpId]);

  const dashboardInsights = useMemo(() => ({
    appointmentApprovalRate: getPercent(stats.approved_appointments, stats.total_appointments),
    pendingRate: getPercent(stats.pending_appointments, stats.total_appointments),
    patientShare: getPercent(stats.total_patients, stats.total_users),
  }), [stats]);

  const sortedFollowUps = useMemo(() => uniqueFollowUpsById(followUps).sort((a, b) => {
    const aCompleted = (a.status || "").toLowerCase() === "completed";
    const bCompleted = (b.status || "").toLowerCase() === "completed";
    if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
    return a.follow_up_date.localeCompare(b.follow_up_date);
  }), [followUps]);

  async function markFollowUpCompleted(followUpId: number) {
    const selectedFollowUp = followUps.find((item) => item.id === followUpId);
    if (!selectedFollowUp) return;
    if (!canCompleteFollowUp(selectedFollowUp)) return;

    try {
      setUpdatingFollowUpId(followUpId);
      const result = await updateAdminFollowUp(followUpId, { status: "Completed" });
      setFollowUps((prev) => uniqueFollowUpsById(prev.map((item) => item.id === followUpId ? { ...item, ...(result?.follow_up || {}), status: "Completed" } : item)));
      await loadDashboard(false);
    } catch (completeError: unknown) {
      setError(getErrorMessage(completeError, "Unable to mark this follow-up as completed."));
    } finally {
      setUpdatingFollowUpId(null);
    }
  }

  return (
    <PageShell className={styles.page}>
      <PageHeader eyebrow="Operations overview" title="Administration" description="Monitor the people, appointments, and follow-up activity that keeps the clinic running smoothly." />

      {loading ? (
        <EmptyState title="Loading dashboard…" />
      ) : error ? (
        <EmptyState title="Dashboard unavailable" description={error} />
      ) : (
        <>
          <AdminStatsGrid>
            <StatCard label="Registered users" value={stats.total_users} hint="All accounts in the system" />
            <StatCard label="Patients" value={stats.total_patients} hint={`${dashboardInsights.patientShare}% of all users`} tone="success" />
            <StatCard label="Doctors" value={stats.total_doctors} hint="Clinical users" tone="info" />
            <StatCard label="Staff" value={stats.total_staff} hint="Operational users" tone="warning" />
            <StatCard label="Appointments" value={stats.total_appointments} hint="All appointment records" />
            <StatCard label="Pending requests" value={stats.pending_appointments} hint={`${dashboardInsights.pendingRate}% still need action`} tone={stats.pending_appointments > 0 ? "warning" : "success"} />
            <StatCard label="Approved" value={stats.approved_appointments} hint={`${dashboardInsights.appointmentApprovalRate}% approval share`} tone="success" />
            <StatCard label="AI logs" value={stats.total_ai_logs} hint="AI-assisted reviews" tone="info" />
          </AdminStatsGrid>

          <Section
            title="Follow-up activity"
            description="Doctor-created follow-up schedules and their current operational status."
            action={<StatusBadge tone="neutral">{sortedFollowUps.length} total</StatusBadge>}
          >
            {sortedFollowUps.length === 0 ? (
              <EmptyState title="No follow-up schedules found." />
            ) : (
              <div className={styles.followUpList}>
                {sortedFollowUps.slice(0, 5).map((item) => {
                  const timing = getFollowUpTiming(item);
                  const isCompleted = (item.status || "").toLowerCase() === "completed";
                  const canComplete = canCompleteFollowUp(item);
                  const isUpdating = updatingFollowUpId === item.id;

                  return (
                    <div key={item.id} className={styles.followUpRow}>
                      <div className={styles.followUpMain}>
                        <strong>{item.patient_name || (item.patient_id ? `Patient #${item.patient_id}` : "Patient details unavailable")}</strong>
                        <span>{formatDate(item.follow_up_date)}{item.doctor_name ? ` • ${item.doctor_name}` : ""}</span>
                        {(item.appointment_date || item.appointment_time) ? (
                          <small>Related visit: {item.appointment_date ? formatDate(item.appointment_date) : "No date"} {item.appointment_time ? `at ${formatTime(item.appointment_time)}` : ""}</small>
                        ) : null}
                      </div>

                      <div className={styles.followUpActions}>
                        <StatusBadge tone={getFollowUpTone(item)}>{timing}</StatusBadge>
                        {!isCompleted ? (
                          <AdminActionButton
                            tone={canComplete ? "primary" : "secondary"}
                            onClick={() => markFollowUpCompleted(item.id)}
                            disabled={!canComplete || isUpdating}
                          >
                            {isUpdating ? "Completing…" : canComplete ? "Mark completed" : "Not due yet"}
                          </AdminActionButton>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {sortedFollowUps.length > 5 ? (
              <div className={styles.followUpFooter}><Link href="/pages/admin/follow-ups">View all follow-ups</Link></div>
            ) : null}
          </Section>
        </>
      )}
    </PageShell>
  );
}
