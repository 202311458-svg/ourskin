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

const filters = ["All", "Pending", "Approved", "Completed", "Declined", "Cancelled"];

type AppointmentLog = {
  id: number;
  appointment_id: number;
  action: string;
  performed_by_id: number | null;
  performed_by_name: string;
  performed_by_role: string;
  reason: string | null;
  created_at: string | null;
};

type AppointmentDetails = Appointment & {
  cancel_reason?: string | null;
};

export default function DoctorAppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDetails | null>(null);
  const [appointmentLogs, setAppointmentLogs] = useState<AppointmentLog[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const normalizeStatus = (status?: string) => (status || "").trim();

  const getDoctorActions = (status?: string) => {
    const normalized = normalizeStatus(status);

    if (normalized === "Approved") {
      return {
        canView: true,
        canComplete: true,
        canCancel: true,
      };
    }

    return {
      canView: true,
      canComplete: false,
      canCancel: false,
    };
  };

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

  const handleStatusUpdate = async (appointmentId: number, status: "Completed" | "Cancelled") => {
    try {
      const appointment = appointments.find((item) => item.id === appointmentId);

      if (!appointment) {
        alert("Appointment not found.");
        return;
      }

      if (appointment.status !== "Approved") {
        alert("Doctors can only complete or cancel approved appointments.");
        return;
      }

      let cancel_reason: string | undefined;

      if (status === "Cancelled") {
        const reason = window.prompt("Enter cancellation reason:");
        if (!reason || !reason.trim()) return;
        cancel_reason = reason.trim();
      }

      await updateDoctorAppointmentStatus(appointmentId, status, cancel_reason);
      await loadAppointments(activeFilter);
      setCalendarRefreshKey((prev) => prev + 1);

      if (detailsOpen && selectedAppointment?.id === appointmentId) {
        await openDetails(appointmentId);
      }
    } catch (error) {
      console.error("Failed to update appointment:", error);
      alert(error instanceof Error ? error.message : "Failed to update appointment");
    }
  };

  const openDetails = async (appointmentId: number) => {
    try {
      setDetailsLoading(true);
      setDetailsOpen(true);

      const token = localStorage.getItem("token");

      const [appointmentRes, logsRes] = await Promise.all([
        fetch(`http://127.0.0.1:8000/appointments/${appointmentId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(`http://127.0.0.1:8000/appointments/${appointmentId}/logs`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      const appointmentData = await appointmentRes.json();
      const logsData = await logsRes.json();

      if (!appointmentRes.ok) {
        throw new Error(appointmentData.detail || "Failed to load appointment details");
      }

      if (!logsRes.ok) {
        throw new Error(logsData.detail || "Failed to load appointment logs");
      }

      setSelectedAppointment(appointmentData);
      setAppointmentLogs(Array.isArray(logsData) ? logsData : []);
    } catch (error) {
      console.error("Failed to open details:", error);
      alert(error instanceof Error ? error.message : "Failed to load details");
      setDetailsOpen(false);
      setSelectedAppointment(null);
      setAppointmentLogs([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedAppointment(null);
    setAppointmentLogs([]);
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
                  {appointments.map((appt) => {
                    const actions = getDoctorActions(appt.status);

                    return (
                      <tr key={appt.id}>
                        <td>{appt.patient_name}</td>
                        <td>{appt.doctor_name}</td>
                        <td>{appt.date}</td>
                        <td>{appt.time}</td>
                        <td>{appt.services}</td>
                        <td>{appt.status}</td>
                        <td>
                          <div className={styles.buttonRow}>
                            {actions.canView && (
                              <button
                                className={styles.secondaryButton}
                                onClick={() => openDetails(appt.id)}
                              >
                                View
                              </button>
                            )}

                            {actions.canComplete && (
                              <button
                                className={styles.actionButton}
                                onClick={() => handleStatusUpdate(appt.id, "Completed")}
                              >
                                Complete
                              </button>
                            )}

                            {actions.canCancel && (
                              <button
                                className={styles.dangerButton}
                                onClick={() => handleStatusUpdate(appt.id, "Cancelled")}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {detailsOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "20px",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "720px",
                maxHeight: "85vh",
                overflowY: "auto",
                background: "#fff",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <h3 style={{ margin: 0 }}>Appointment Details</h3>
                <button className={styles.secondaryButton} onClick={closeDetails}>
                  Close
                </button>
              </div>

              {detailsLoading || !selectedAppointment ? (
                <p>Loading details...</p>
              ) : (
                <>
                  <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
                    <p><strong>Patient:</strong> {selectedAppointment.patient_name}</p>
                    <p><strong>Doctor:</strong> {selectedAppointment.doctor_name}</p>
                    <p><strong>Date:</strong> {selectedAppointment.date}</p>
                    <p><strong>Time:</strong> {selectedAppointment.time}</p>
                    <p><strong>Service:</strong> {selectedAppointment.services}</p>
                    <p><strong>Status:</strong> {selectedAppointment.status}</p>

                    {selectedAppointment.cancel_reason && (
                      <p><strong>Reason:</strong> {selectedAppointment.cancel_reason}</p>
                    )}
                  </div>

                  <div>
                    <h4 style={{ marginBottom: "12px" }}>Activity Log</h4>

                    {appointmentLogs.length === 0 ? (
                      <p>No activity log found.</p>
                    ) : (
                      <div style={{ display: "grid", gap: "12px" }}>
                        {appointmentLogs.map((log) => (
                          <div
                            key={log.id}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: "12px",
                              padding: "12px 14px",
                            }}
                          >
                            <p><strong>Action:</strong> {log.action}</p>
                            <p>
                              <strong>By:</strong> {log.performed_by_name} ({log.performed_by_role})
                            </p>
                            {log.reason && (
                              <p><strong>Reason:</strong> {log.reason}</p>
                            )}
                            {log.created_at && (
                              <p><strong>Date:</strong> {new Date(log.created_at).toLocaleString()}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}