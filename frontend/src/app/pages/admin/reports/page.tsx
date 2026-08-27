"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDataTable from "@/app/components/portal/admin/AdminDataTable";
import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import EmptyState from "@/app/components/portal/ui/EmptyState";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import Section from "@/app/components/portal/ui/Section";
import StatCard from "@/app/components/portal/ui/StatCard";
import {
  AdminReportsData,
  getAdminReports,
} from "@/lib/admin-management-api";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(1)}%`;
}

function formatConfidence(value: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }

  if (value <= 1) return `${Math.round(value * 100)}%`;

  return `${Math.round(value)}%`;
}

function capitalize(value: string) {
  if (!value) return "N/A";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function getEmptyReports(): AdminReportsData {
  return {
    monthly_appointments: [],
    ai_condition_summary: [],
    user_growth: [],
    completed_vs_cancelled: {
      completed: 0,
      cancelled: 0,
      total: 0,
      completion_rate: 0,
      cancellation_rate: 0,
    },
    doctor_activity: [],
  };
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getAdminReports();
      setReports(data || getEmptyReports());
    } catch (loadError) {
      console.error("Reports load failed:", loadError);
      setError(getErrorMessage(loadError, "Unable to load reports."));
      setReports(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const overview = useMemo(() => {
    if (!reports) {
      return {
        totalAppointments: 0,
        completed: 0,
        cancelled: 0,
        totalAiCases: 0,
        totalUsers: 0,
      };
    }

    const latestMonth = reports.monthly_appointments[0];
    const totalAiCases = reports.ai_condition_summary.reduce(
      (sum, item) => sum + item.cases,
      0
    );
    const totalUsers = reports.user_growth.reduce(
      (sum, item) => sum + item.total,
      0
    );

    return {
      totalAppointments: latestMonth?.total || 0,
      completed: reports.completed_vs_cancelled.completed || 0,
      cancelled: reports.completed_vs_cancelled.cancelled || 0,
      totalAiCases,
      totalUsers,
    };
  }, [reports]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operational reporting"
        title="Reports"
        description="Review appointment trends, AI screening activity, user growth, and doctor workload without exposing restricted medical details."
        primaryAction={
          <AdminActionButton tone="secondary" onClick={loadReports} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </AdminActionButton>
        }
      />

      {loading ? (
        <EmptyState title="Loading reports…" />
      ) : error ? (
        <EmptyState title="Unable to load reports" description={error} />
      ) : !reports ? (
        <EmptyState title="No report data available." />
      ) : (
        <>
          <AdminStatsGrid>
            <StatCard label="Latest month appointments" value={overview.totalAppointments} hint="Appointment volume in the latest reporting month" />
            <StatCard label="Completed appointments" value={overview.completed} hint="Completed records across the reporting set" tone="success" />
            <StatCard label="Cancelled appointments" value={overview.cancelled} hint="Cancelled records across the reporting set" tone="warning" />
            <StatCard label="AI cases" value={overview.totalAiCases} hint="Cases represented in AI condition summaries" tone="info" />
            <StatCard label="Users" value={overview.totalUsers} hint="Accounts represented in user-growth data" />
          </AdminStatsGrid>

          <AdminDataTable
            title="Monthly appointment summary"
            description="Appointment volume and status movement by month."
            empty={reports.monthly_appointments.length === 0}
            emptyTitle="No monthly appointment data yet."
          >
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Total</th>
                  <th>Pending</th>
                  <th>Approved</th>
                  <th>Completed</th>
                  <th>Cancelled</th>
                  <th>Declined</th>
                </tr>
              </thead>
              <tbody>
                {reports.monthly_appointments.map((item) => (
                  <tr key={item.month}>
                    <td>{item.month}</td>
                    <td>{item.total}</td>
                    <td>{item.pending}</td>
                    <td>{item.approved}</td>
                    <td>{item.completed}</td>
                    <td>{item.cancelled}</td>
                    <td>{item.declined}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminDataTable>

          <Section
            title="Completed vs cancelled"
            description="A concise view of appointment outcomes across the reporting set."
          >
            <AdminStatsGrid compact>
              <StatCard label="Completed" value={reports.completed_vs_cancelled.completed} tone="success" />
              <StatCard label="Cancelled" value={reports.completed_vs_cancelled.cancelled} tone="warning" />
              <StatCard label="Completion rate" value={formatPercent(reports.completed_vs_cancelled.completion_rate)} tone="success" />
              <StatCard label="Cancellation rate" value={formatPercent(reports.completed_vs_cancelled.cancellation_rate)} tone="warning" />
            </AdminStatsGrid>
          </Section>

          <AdminDataTable
            title="User growth"
            description="Users grouped by role, status, and verification."
            empty={reports.user_growth.length === 0}
            emptyTitle="No user-growth data yet."
          >
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Total</th>
                  <th>Active</th>
                  <th>Inactive</th>
                  <th>Verified</th>
                  <th>Unverified</th>
                </tr>
              </thead>
              <tbody>
                {reports.user_growth.map((item) => (
                  <tr key={item.role}>
                    <td>{capitalize(item.role)}</td>
                    <td>{item.total}</td>
                    <td>{item.active}</td>
                    <td>{item.inactive}</td>
                    <td>{item.verified}</td>
                    <td>{item.unverified}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminDataTable>

          <AdminDataTable
            title="AI condition summary"
            description="Common AI screening outputs and confidence movement."
            empty={reports.ai_condition_summary.length === 0}
            emptyTitle="No AI condition summary data yet."
          >
            <table>
              <thead>
                <tr>
                  <th>Condition</th>
                  <th>Cases</th>
                  <th>Average confidence</th>
                  <th>Common severity</th>
                </tr>
              </thead>
              <tbody>
                {reports.ai_condition_summary.map((item) => (
                  <tr key={item.condition}>
                    <td>{item.condition || "N/A"}</td>
                    <td>{item.cases}</td>
                    <td>{formatConfidence(item.average_confidence)}</td>
                    <td>{capitalize(item.common_severity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminDataTable>

          <AdminDataTable
            title="Doctor activity"
            description="Workload, completed appointments, and AI review activity by doctor."
            empty={reports.doctor_activity.length === 0}
            emptyTitle="No doctor activity data yet."
          >
            <table>
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Assigned</th>
                  <th>Completed</th>
                  <th>Pending AI reviews</th>
                  <th>Reviewed AI cases</th>
                </tr>
              </thead>
              <tbody>
                {reports.doctor_activity.map((item) => (
                  <tr key={item.doctor_name}>
                    <td>{item.doctor_name || "Unassigned"}</td>
                    <td>{item.assigned_appointments}</td>
                    <td>{item.completed_appointments}</td>
                    <td>{item.pending_ai_reviews}</td>
                    <td>{item.reviewed_ai_cases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminDataTable>
        </>
      )}
    </PageShell>
  );
}
