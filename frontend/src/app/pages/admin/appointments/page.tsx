"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";
import styles from "./adminappt.module.css";

type Appointment = {
  id: number;
  patient_name: string;
  patient_email: string;
  doctor_name: string;
  date: string;
  time: string;
  services: string;
  status: string;
  cancel_reason?: string | null;
};

export default function AdminAppointmentsPage() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "admin") {
      router.push("/");
      return;
    }

    fetch("http://127.0.0.1:8000/admin/appointments", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch appointments");
        }
        return res.json();
      })
      .then((data) => {
        setAppointments(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Appointments fetch error:", err);
        setError("Unable to load appointment records.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  const handleUpdateStatus = async (
    appointmentId: number,
    status: "Approved" | "Declined",
    cancelReason?: string
  ) => {
    try {
      const token = localStorage.getItem("token");
      setActionLoading(appointmentId);

      const res = await fetch(
        `http://127.0.0.1:8000/admin/appointments/${appointmentId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            cancel_reason: status === "Declined" ? cancelReason : null,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to update appointment");
      }

      setAppointments((prev) =>
        prev.map((appointment) =>
          appointment.id === appointmentId
            ? {
                ...appointment,
                status,
                cancel_reason: status === "Declined" ? cancelReason || "" : null,
              }
            : appointment
        )
      );

      setShowDeclineModal(false);
      setSelectedAppointmentId(null);
      setDeclineReason("");
    } catch (err) {
      console.error("Status update error:", err);
      alert(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      const searchValue = search.toLowerCase();

      const matchesSearch =
        appointment.patient_name?.toLowerCase().includes(searchValue) ||
        appointment.patient_email?.toLowerCase().includes(searchValue) ||
        appointment.doctor_name?.toLowerCase().includes(searchValue) ||
        appointment.services?.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "all" ||
        appointment.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [appointments, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: appointments.length,
      pending: appointments.filter(
        (a) => a.status?.toLowerCase() === "pending"
      ).length,
      approved: appointments.filter(
        (a) => a.status?.toLowerCase() === "approved"
      ).length,
      declined: appointments.filter(
        (a) =>
          a.status?.toLowerCase() === "declined" ||
          a.status?.toLowerCase() === "cancelled"
      ).length,
    };
  }, [appointments]);

  const formatSchedule = (date: string, time: string) => {
    try {
      const formattedDate = new Date(date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const formattedTime = new Date(`1970-01-01T${time}`).toLocaleTimeString(
        undefined,
        {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }
      );

      return `${formattedDate} at ${formattedTime}`;
    } catch {
      return `${date} ${time}`;
    }
  };

  return (
    <div className="staffLayout">
      <AdminNavbar />

      <div className="staffContent">
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Appointments</h1>
            <p className={styles.subtitle}>
              Monitor all appointment records across the platform.
            </p>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span>Total Appointments</span>
            <strong>{stats.total}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Pending</span>
            <strong>{stats.pending}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Approved</span>
            <strong>{stats.approved}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Declined / Cancelled</span>
            <strong>{stats.declined}</strong>
          </div>
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Search by patient, email, doctor, or service"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.selectInput}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className={styles.tableCard}>
          {loading ? (
            <p className={styles.message}>Loading appointments...</p>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : filteredAppointments.length === 0 ? (
            <p className={styles.message}>No appointments found.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Email</th>
                  <th>Doctor</th>
                  <th>Schedule</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Cancel Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>
                      <strong>{appointment.patient_name}</strong>
                    </td>
                    <td>{appointment.patient_email}</td>
                    <td>{appointment.doctor_name || "Not assigned"}</td>
                    <td>{formatSchedule(appointment.date, appointment.time)}</td>
                    <td>{appointment.services}</td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          appointment.status?.toLowerCase() === "approved"
                            ? styles.approved
                            : appointment.status?.toLowerCase() === "pending"
                            ? styles.pending
                            : styles.declined
                        }`}
                      >
                        {appointment.status}
                      </span>
                    </td>
                    <td>{appointment.cancel_reason || "N/A"}</td>
                    <td>
                      {appointment.status?.toLowerCase() === "pending" ? (
                        <div className={styles.actionButtons}>
                          <button
                            className={styles.approveBtn}
                            onClick={() => handleUpdateStatus(appointment.id, "Approved")}
                            disabled={actionLoading === appointment.id}
                          >
                            {actionLoading === appointment.id ? "Updating..." : "✔"}
                          </button>

                          <button
                            className={styles.declineBtn}
                            onClick={() => {
                              setSelectedAppointmentId(appointment.id);
                              setShowDeclineModal(true);
                            }}
                            disabled={actionLoading === appointment.id}
                          >
                            ✖
                          </button>
                        </div>
                      ) : (
                        <span className={styles.noAction}>No actions</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showDeclineModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalCard}>
              <h3>Decline Appointment</h3>
              <p>Please provide a reason before declining this appointment.</p>

              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Enter decline reason"
                className={styles.textArea}
              />

              <div className={styles.modalActions}>
                <button
                  className={styles.cancelBtn}
                  onClick={() => {
                    setShowDeclineModal(false);
                    setSelectedAppointmentId(null);
                    setDeclineReason("");
                  }}
                >
                  Cancel
                </button>

                <button
                  className={styles.confirmDeclineBtn}
                  onClick={() => {
                    if (!selectedAppointmentId) return;
                    handleUpdateStatus(
                      selectedAppointmentId,
                      "Declined",
                      declineReason
                    );
                  }}
                  disabled={
                    !declineReason.trim() ||
                    actionLoading === selectedAppointmentId
                  }
                >
                  {actionLoading === selectedAppointmentId
                    ? "Saving..."
                    : "Confirm Decline"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}