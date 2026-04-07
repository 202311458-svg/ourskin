"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";
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

    fetch("http://127.0.0.1:8000/admin/dashboard", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch dashboard data");
        }
        return res.json();
      })
      .then((data) => {
        setStats({
          total_users: data.total_users || 0,
          total_patients: data.total_patients || 0,
          total_staff: data.total_staff || 0,
          total_doctors: data.total_doctors || 0,
          total_appointments: data.total_appointments || 0,
          pending_appointments: data.pending_appointments || 0,
          approved_appointments: data.approved_appointments || 0,
          total_ai_logs: data.total_ai_logs || 0,
        });
      })
      .catch((err) => {
        console.error("Dashboard fetch error:", err);
        setError("Unable to load dashboard data.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  return (
    <div className="staffLayout">
      <AdminNavbar />

      <div className="staffContent">
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Admin Dashboard</h1>
            <p className={styles.subtitle}>
              Overview of users, appointments, and AI activity across the platform.
            </p>
          </div>
        </div>

        {loading ? (
          <div className={styles.tableCard}>
            <p className={styles.message}>Loading dashboard...</p>
          </div>
        ) : error ? (
          <div className={styles.tableCard}>
            <p className={styles.error}>{error}</p>
          </div>
        ) : (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span>Total Users</span>
                <strong>{stats.total_users}</strong>
              </div>

              <div className={styles.statCard}>
                <span>Total Patients</span>
                <strong>{stats.total_patients}</strong>
              </div>

              <div className={styles.statCard}>
                <span>Total Staff</span>
                <strong>{stats.total_staff}</strong>
              </div>

              <div className={styles.statCard}>
                <span>Total Doctors</span>
                <strong>{stats.total_doctors}</strong>
              </div>

              <div className={styles.statCard}>
                <span>Total Appointments</span>
                <strong>{stats.total_appointments}</strong>
              </div>

              <div className={styles.statCard}>
                <span>Pending Appointments</span>
                <strong>{stats.pending_appointments}</strong>
              </div>

              <div className={styles.statCard}>
                <span>Approved Appointments</span>
                <strong>{stats.approved_appointments}</strong>
              </div>

              <div className={styles.statCard}>
                <span>Total AI Logs</span>
                <strong>{stats.total_ai_logs}</strong>
              </div>
            </div>

            <div className={styles.dashboardGrid}>
              <div className={styles.tableCard}>
                <div className={styles.cardHeader}>
                  <h2>User Summary</h2>
                </div>

                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Total Users</td>
                      <td>{stats.total_users}</td>
                    </tr>
                    <tr>
                      <td>Patients</td>
                      <td>{stats.total_patients}</td>
                    </tr>
                    <tr>
                      <td>Staff</td>
                      <td>{stats.total_staff}</td>
                    </tr>
                    <tr>
                      <td>Doctors</td>
                      <td>{stats.total_doctors}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className={styles.tableCard}>
                <div className={styles.cardHeader}>
                  <h2>Appointment Summary</h2>
                </div>

                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Total Appointments</td>
                      <td>{stats.total_appointments}</td>
                    </tr>
                    <tr>
                      <td>Pending</td>
                      <td>{stats.pending_appointments}</td>
                    </tr>
                    <tr>
                      <td>Approved</td>
                      <td>{stats.approved_appointments}</td>
                    </tr>
                    <tr>
                      <td>AI Logs</td>
                      <td>{stats.total_ai_logs}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}