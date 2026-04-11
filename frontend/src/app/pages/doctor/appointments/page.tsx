"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import Calendar from "@/app/components/Calendar";
import styles from "@/app/styles/doctor.module.css";
import {
  getDoctorAppointments,
  updateDoctorAppointmentStatus,
  type Appointment,
} from "@/lib/doctor-api";

const filters = ["All", "Pending", "Approved", "Completed", "Declined"];

export default function DoctorAppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  const loadAppointments = useCallback(async (status: string) => {
    try {
      setLoading(true);
      const data = await getDoctorAppointments(status);
      setAppointments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load appointments:", error);
      setAppointments([]);
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

    loadAppointments(activeFilter);
  }, [router, activeFilter, loadAppointments]);

  const handleStatusUpdate = async (appointmentId: number, status: string) => {
    try {
      let cancel_reason: string | undefined;

      if (status === "Declined") {
        const reason = window.prompt("Enter cancel reason:");
        if (!reason) return;
        cancel_reason = reason;
      }

      await updateDoctorAppointmentStatus(appointmentId, status, cancel_reason);
      await loadAppointments(activeFilter);
      setCalendarRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to update appointment:", error);
      alert(error instanceof Error ? error.message : "Failed to update appointment");
    }
  };

  const calendarStatusFilter =
    activeFilter === "Approved" || activeFilter === "Pending"
      ? activeFilter
      : "All";

  return (
    <>
      <DoctorNavbar />

      <main className={styles.pageWrapper}>
        <div className={styles.headerSection}>
  <h1 className={styles.pageTitle}>Appointments</h1>
  <p className={styles.pageSubtitle}>
    Review and manage all doctor consultations.
  </p>
</div>

<Calendar
  mode="full"
  statusFilter={calendarStatusFilter}
  refreshKey={calendarRefreshKey}
  onUpdated={() => loadAppointments(activeFilter)}
/>

<section className={`${styles.sectionCard} ${styles.appointmentListSection}`}>
  <div className={styles.sectionHeader}>
    <h2 className={styles.sectionTitle}>Appointment List</h2>
  </div>

  <div className={styles.filterRowInside}>
    {filters.map((filter) => (
      <button
        key={filter}
        className={`${styles.filterChip} ${
          activeFilter === filter ? styles.activeChip : ""
        }`}
        onClick={() => setActiveFilter(filter)}
      >
        {filter}
      </button>
    ))}
  </div>

  {loading ? (
    <div className={styles.emptyState}>Loading appointments...</div>
  ) : appointments.length === 0 ? (
    <div className={styles.emptyState}>No appointments found.</div>
  ) : (
    <div className={styles.tableWrapper}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>Patient</th>
            <th>Doctor</th>
            <th>Date</th>
            <th>Time</th>
            <th>Service</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {appointments.map((appt) => (
            <tr key={appt.id}>
              <td>{appt.patient_name}</td>
              <td>{appt.doctor_name}</td>
              <td>{appt.date}</td>
              <td>{appt.time}</td>
              <td>{appt.services}</td>
              <td>{appt.status}</td>
              <td>
                <div className={styles.buttonRow}>
                  {appt.status !== "Approved" && (
                    <button
                      className={styles.actionButton}
                      onClick={() => handleStatusUpdate(appt.id, "Approved")}
                    >
                      Approve
                    </button>
                  )}

                  {appt.status !== "Completed" && (
                    <button
                      className={styles.secondaryButton}
                      onClick={() => handleStatusUpdate(appt.id, "Completed")}
                    >
                      Complete
                    </button>
                  )}

                  {appt.status !== "Declined" && (
                    <button
                      className={styles.dangerButton}
                      onClick={() => handleStatusUpdate(appt.id, "Declined")}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</section>
      </main>
    </>
  );
}