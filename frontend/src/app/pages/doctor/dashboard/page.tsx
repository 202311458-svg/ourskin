"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import styles from "@/app/styles/doctor.module.css";
import { getDoctorDashboard, type DashboardData } from "@/lib/doctor-api";

export default function DoctorDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getDoctorDashboard();
      setData(result);
    } catch (error) {
      console.error("Failed to load doctor dashboard:", error);
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
            Review appointments, AI cases, and follow-ups in one place.
          </p>
        </div>

        <div className={styles.cardGrid}>
          <div className={styles.dashboardCard}>
            <div className={styles.statValue}>{data.stats.todays_appointments}</div>
            <div className={styles.statLabel}>Today&apos;s Appointments</div>
          </div>

          <div className={styles.dashboardCard}>
            <div className={styles.statValue}>{data.stats.pending_ai_reviews}</div>
            <div className={styles.statLabel}>Pending AI Reviews</div>
          </div>

          <div className={styles.dashboardCard}>
            <div className={styles.statValue}>{data.stats.follow_ups_due}</div>
            <div className={styles.statLabel}>Follow-Ups Due</div>
          </div>

          <div className={styles.dashboardCard}>
            <div className={styles.statValue}>{data.stats.completed_today}</div>
            <div className={styles.statLabel}>Completed Today</div>
          </div>
        </div>

        <div className={styles.twoColumnGrid}>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Today&apos;s Schedule</h2>
            </div>

            <div className={styles.list}>
              {data.todays_schedule.length === 0 ? (
                <div className={styles.emptyState}>No appointments scheduled today.</div>
              ) : (
                data.todays_schedule.map((appt) => (
                  <div key={appt.id} className={styles.listItem}>
                    <div className={styles.listLeft}>
                      <div className={styles.listPrimary}>{appt.patient_name}</div>
                      <div className={styles.listSecondary}>
                        {appt.date} • {appt.time} • {appt.services} • Dr: {appt.doctor_name}
                      </div>
                    </div>

                    <div className={styles.listRight}>
                      <span
                        className={`${styles.statusBadge} ${
                          appt.status === "Completed"
                            ? styles.badgeCompleted
                            : appt.status === "Approved"
                            ? styles.badgeApproved
                            : appt.status === "Declined"
                            ? styles.badgeUrgent
                            : styles.badgePending
                        }`}
                      >
                        {appt.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>AI Queue</h2>
            </div>

            <div className={styles.list}>
              {data.ai_queue.length === 0 ? (
                <div className={styles.emptyState}>No pending AI cases.</div>
              ) : (
                data.ai_queue.map((item) => (
                  <div key={item.id} className={styles.listItem}>
                    <div className={styles.listLeft}>
                      <div className={styles.listPrimary}>{item.condition}</div>
                      <div className={styles.listSecondary}>
                        Severity: {item.severity} • Confidence: {item.confidence}
                      </div>
                    </div>

                    <div className={styles.listRight}>
                      <button
                        className={styles.actionButton}
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

        <div className={styles.twoColumnGrid}>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Recent Patient Records</h2>
            </div>

            <div className={styles.list}>
              {data.recent_records.length === 0 ? (
                <div className={styles.emptyState}>No recent records available.</div>
              ) : (
                data.recent_records.map((item) => (
                  <div key={item.id} className={styles.listItem}>
                    <div className={styles.listLeft}>
                      <div className={styles.listPrimary}>{item.patient_name}</div>
                      <div className={styles.listSecondary}>
                        {item.date} • {item.services} • Dr: {item.doctor_name}
                      </div>
                    </div>

                    <div className={styles.listRight}>
                      <button
                        className={styles.secondaryButton}
                        onClick={() => router.push("/pages/doctor/patient-records")}
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Urgent Cases</h2>
            </div>

            <div className={styles.list}>
              {data.urgent_cases.length === 0 ? (
                <div className={styles.emptyState}>No urgent cases right now.</div>
              ) : (
                data.urgent_cases.map((item) => (
                  <div key={item.id} className={styles.listItem}>
                    <div className={styles.listLeft}>
                      <div className={styles.listPrimary}>{item.condition}</div>
                      <div className={styles.listSecondary}>
                        Severity: {item.severity}
                      </div>
                    </div>

                    <div className={styles.listRight}>
                      <span className={`${styles.statusBadge} ${styles.badgeUrgent}`}>
                        Urgent
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}