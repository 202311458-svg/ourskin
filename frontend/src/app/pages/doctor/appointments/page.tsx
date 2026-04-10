"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
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

  const loadAppointments = useCallback(async (status = activeFilter) => {
    try {
      setLoading(true);
      const data = await getDoctorAppointments(status);
      setAppointments(data);
    } catch (error) {
      console.error("Failed to load appointments:", error);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

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
    } catch (error) {
      console.error("Failed to update appointment:", error);
      alert(error instanceof Error ? error.message : "Failed to update appointment");
    }
  };

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

        <div className={styles.filterRow}>
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

        <section className={styles.sectionCard}>
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