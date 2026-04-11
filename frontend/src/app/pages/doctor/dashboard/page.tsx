"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import Calendar from "@/app/components/Calendar";
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
            Review your schedule and patient activity in one place.
          </p>
        </div>

        <div className={styles.dashboardTopGrid}>
          <Calendar mode="compact" statusFilter="All" />

          <section className={`${styles.sectionCard} ${styles.recentRecordsSection}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Today&apos;s Appointments</h2>
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
                        {appt.time} • {appt.services} • Dr: {appt.doctor_name}
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
        </div>

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
      </main>
    </>
  );
}