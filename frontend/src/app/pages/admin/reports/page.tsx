"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import {
  AdminReportsData,
  getAdminReports,
} from "@/lib/admin-management-api";
import styles from "./page.module.css";

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
    <main className={styles.reportsPage}>
      <div className={styles.container}>
        <PageHeader
          title="Reports"
          description="Review appointment trends, AI screening activity, user growth, and doctor workload without exposing restricted medical details."
          primaryAction={
            <button
              type="button"
              className={styles.refreshButton}
              onClick={loadReports}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          }
        />

        {loading ? (
          <div className={styles.message}>Loading reports...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : !reports ? (
          <div className={styles.message}>No report data available.</div>
        ) : (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span>Latest Month Appointments</span>
                <strong>{overview.totalAppointments}</strong>
              </div>

              <div className={`${styles.statCard} ${styles.greenAccent}`}>
                <span>Completed Appointments</span>
                <strong>{overview.completed}</strong>
              </div>

              <div className={`${styles.statCard} ${styles.orangeAccent}`}>
                <span>Cancelled Appointments</span>
                <strong>{overview.cancelled}</strong>
              </div>

              <div className={`${styles.statCard} ${styles.blueAccent}`}>
                <span>Total AI Cases</span>
                <strong>{overview.totalAiCases}</strong>
              </div>

              <div className={`${styles.statCard} ${styles.pinkAccent}`}>
                <span>Total Users</span>
                <strong>{overview.totalUsers}</strong>
              </div>
            </div>

            <section className={styles.reportCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Monthly Appointment Summary</h2>
                  <p>Shows appointment volume and status movement per month.</p>
                </div>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
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
                        <td data-label="Month">{item.month}</td>
                        <td data-label="Total">{item.total}</td>
                        <td data-label="Pending">{item.pending}</td>
                        <td data-label="Approved">{item.approved}</td>
                        <td data-label="Completed">{item.completed}</td>
                        <td data-label="Cancelled">{item.cancelled}</td>
                        <td data-label="Declined">{item.declined}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className={styles.twoColumnGrid}>
              <section className={styles.reportCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>Completed vs Cancelled Appointments</h2>
                    <p>
                      Compares successful appointments against cancelled
                      bookings.
                    </p>
                  </div>
                </div>

                <div className={styles.rateGrid}>
                  <div>
                    <span>Completed</span>
                    <strong>{reports.completed_vs_cancelled.completed}</strong>
                  </div>
                  <div>
                    <span>Cancelled</span>
                    <strong>{reports.completed_vs_cancelled.cancelled}</strong>
                  </div>
                  <div>
                    <span>Completion Rate</span>
                    <strong>
                      {formatPercent(
                        reports.completed_vs_cancelled.completion_rate
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Cancellation Rate</span>
                    <strong>
                      {formatPercent(
                        reports.completed_vs_cancelled.cancellation_rate
                      )}
                    </strong>
                  </div>
                </div>
              </section>

              <section className={styles.reportCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>User Growth</h2>
                    <p>Summarises users by role, status, and verification.</p>
                  </div>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
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
                          <td data-label="Role">{capitalize(item.role)}</td>
                          <td data-label="Total">{item.total}</td>
                          <td data-label="Active">{item.active}</td>
                          <td data-label="Inactive">{item.inactive}</td>
                          <td data-label="Verified">{item.verified}</td>
                          <td data-label="Unverified">{item.unverified}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <section className={styles.reportCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>AI Condition Summary</h2>
                  <p>
                    Shows common AI screening results and confidence movement.
                  </p>
                </div>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Condition</th>
                      <th>Cases</th>
                      <th>Average Confidence</th>
                      <th>Common Severity</th>
                    </tr>
                  </thead>

                  <tbody>
                    {reports.ai_condition_summary.map((item) => (
                      <tr key={item.condition}>
                        <td data-label="Condition">{item.condition || "N/A"}</td>
                        <td data-label="Cases">{item.cases}</td>
                        <td data-label="Average Confidence">{formatConfidence(item.average_confidence)}</td>
                        <td data-label="Common Severity">{capitalize(item.common_severity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.reportCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Doctor Activity</h2>
                  <p>
                    Tracks workload, completed appointments, and AI review
                    activity by doctor.
                  </p>
                </div>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Doctor</th>
                      <th>Assigned</th>
                      <th>Completed</th>
                      <th>Pending AI Reviews</th>
                      <th>Reviewed AI Cases</th>
                    </tr>
                  </thead>

                  <tbody>
                    {reports.doctor_activity.map((item) => (
                      <tr key={item.doctor_name}>
                        <td data-label="Doctor">{item.doctor_name || "Unassigned"}</td>
                        <td data-label="Assigned">{item.assigned_appointments}</td>
                        <td data-label="Completed">{item.completed_appointments}</td>
                        <td data-label="Pending AI Reviews">{item.pending_ai_reviews}</td>
                        <td data-label="Reviewed AI Cases">{item.reviewed_ai_cases}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
