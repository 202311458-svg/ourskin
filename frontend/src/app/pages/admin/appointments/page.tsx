"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";
import { API_BASE_URL } from "@/lib/api";
import styles from "./adminappt.module.css";
import { useAutoRefresh } from "@/app/hooks/useAutoRefresh";

type AppointmentStatus =
  | "Pending"
  | "Approved"
  | "Declined"
  | "Cancelled"
  | "Completed";

type Appointment = {
  id: number;
  patient_name: string;
  patient_email: string;
  doctor_name: string;
  date: string;
  time: string;
  services: string;
  status: AppointmentStatus | string;
  cancel_reason?: string | null;
};

type ApiErrorResponse = {
  detail?: string;
  message?: string;
};

type ModalAction = "decline" | "cancel";

const API_BASE = API_BASE_URL;

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function getApiErrorMessage(data: ApiErrorResponse | null, fallback: string) {
  if (data?.detail) return data.detail;
  if (data?.message) return data.message;
  return fallback;
}

function normalizeStatus(status?: string) {
  return (status || "").toLowerCase();
}

function formatStatus(status?: string) {
  if (!status) return "N/A";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function formatSchedule(date: string, time: string) {
  const rawDate = date || "";
  const rawTime = time || "";

  if (!rawDate && !rawTime) return "N/A";

  const dateObj = new Date(`${rawDate}T${rawTime}`);

  if (Number.isNaN(dateObj.getTime())) {
    return `${rawDate || "N/A"}${rawTime ? ` at ${rawTime}` : ""}`;
  }

  return dateObj.toLocaleString([], {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusClass(status: string) {
  const cleanStatus = normalizeStatus(status);

  if (cleanStatus === "approved") return styles.approved;
  if (cleanStatus === "pending") return styles.pending;
  if (cleanStatus === "completed") return styles.completed;
  if (cleanStatus === "cancelled") return styles.cancelled;
  return styles.declined;
}

function uniqueAppointmentsById(appointments: Appointment[]) {
  return Array.from(
    new Map(
      appointments.map((appointment) => [appointment.id, appointment])
    ).values()
  );
}

export default function AdminAppointmentsPage() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [modalAction, setModalAction] = useState<ModalAction | null>(null);
  const [reason, setReason] = useState("");

  const loadAppointments = useCallback(
    async (showLoader = true) => {
      const token = localStorage.getItem("token");
      const role = localStorage.getItem("role");

      if (!token || role !== "admin") {
        router.push("/");
        return;
      }

      try {
        if (showLoader) {
          setLoading(true);
        }

        setError("");

        const res = await fetch(`${API_BASE}/admin/appointments`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await safeJson<Appointment[] & ApiErrorResponse>(res);

        if (!res.ok) {
          throw new Error(
            getApiErrorMessage(data, "Unable to load appointments")
          );
        }

        setAppointments(uniqueAppointmentsById(Array.isArray(data) ? data : []));
      } catch (loadError: unknown) {
        setError(
          getErrorMessage(
            loadError,
            "Something went wrong while loading appointments."
          )
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [router]
  );

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useAutoRefresh(() => loadAppointments(false), {
    enabled: true,
    intervalMs: 5000,
    pause: actionLoading !== null || selectedAppointment !== null,
  });

  const filteredAppointments = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return appointments.filter((appointment) => {
      const status = normalizeStatus(appointment.status);

      const matchesSearch =
        appointment.patient_name.toLowerCase().includes(keyword) ||
        appointment.patient_email.toLowerCase().includes(keyword) ||
        appointment.doctor_name.toLowerCase().includes(keyword) ||
        appointment.services.toLowerCase().includes(keyword) ||
        appointment.status.toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "all" || status === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [appointments, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: appointments.length,
      pending: appointments.filter(
        (appointment) => normalizeStatus(appointment.status) === "pending"
      ).length,
      approved: appointments.filter(
        (appointment) => normalizeStatus(appointment.status) === "approved"
      ).length,
      declinedCancelled: appointments.filter((appointment) => {
        const status = normalizeStatus(appointment.status);
        return status === "declined" || status === "cancelled";
      }).length,
    };
  }, [appointments]);

  function openReasonModal(appointment: Appointment, action: ModalAction) {
    setSelectedAppointment(appointment);
    setModalAction(action);
    setReason("");
  }

  function closeReasonModal() {
    if (actionLoading !== null) return;

    setSelectedAppointment(null);
    setModalAction(null);
    setReason("");
  }

  async function updateAppointmentStatus(
    appointmentId: number,
    status: AppointmentStatus,
    cancelReason?: string
  ) {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/");
      return;
    }

    try {
      setActionLoading(appointmentId);

      const res = await fetch(
        `${API_BASE}/admin/appointments/${appointmentId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            cancel_reason: cancelReason || null,
          }),
        }
      );

      const data = await safeJson<
        {
          id: number;
          status: string;
          cancel_reason?: string | null;
        } & ApiErrorResponse
      >(res);

      if (!res.ok) {
        alert(getApiErrorMessage(data, "Failed to update appointment."));
        return;
      }

      setAppointments((prev) =>
        uniqueAppointmentsById(
          prev.map((appointment) =>
            appointment.id === appointmentId
              ? {
                  ...appointment,
                  status: data?.status || status,
                  cancel_reason: data?.cancel_reason || cancelReason || null,
                }
              : appointment
          )
        )
      );

      closeReasonModal();
      await loadAppointments(false);
    } catch (updateError: unknown) {
      alert(
        getErrorMessage(
          updateError,
          "Something went wrong while updating the appointment."
        )
      );
    } finally {
      setActionLoading(null);
    }
  }

  function handleConfirmReasonAction() {
    if (!selectedAppointment || !modalAction) return;

    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      alert(
        modalAction === "decline"
          ? "Please provide a reason for declining this appointment."
          : "Please provide a reason for cancelling this appointment."
      );
      return;
    }

    if (modalAction === "decline") {
      updateAppointmentStatus(selectedAppointment.id, "Declined", trimmedReason);
      return;
    }

    updateAppointmentStatus(selectedAppointment.id, "Cancelled", trimmedReason);
  }

  return (
    <div className="staffLayout">
      <AdminNavbar />

      <main className="staffContent">
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Appointments</h1>
            <p className={styles.subtitle}>
              Manage patient appointment requests, approvals, cancellations, and history.
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
            <strong>{stats.declinedCancelled}</strong>
          </div>
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Search by patient, email, doctor, service, or status"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={styles.searchInput}
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={styles.selectInput}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
            <option value="declined">Declined</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <section className={styles.appointmentsList}>
          {loading ? (
            <div className={styles.fullWidthCard}>
              <p className={styles.message}>Loading appointments...</p>
            </div>
          ) : error ? (
            <div className={styles.fullWidthCard}>
              <p className={styles.error}>{error}</p>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No appointments found</h3>
              <p>Appointments that match your filters will appear here.</p>
            </div>
          ) : (
            filteredAppointments.map((appointment) => {
              const status = normalizeStatus(appointment.status);
              const isPending = status === "pending";
              const isApproved = status === "approved";
              const reasonLabel =
                status === "cancelled"
                  ? "Cancellation Reason"
                  : status === "declined"
                  ? "Decline Reason"
                  : "Reason";

              return (
                <article key={appointment.id} className={styles.appointmentCard}>
                  <div className={styles.cardTop}>
                    <div>
                      <h3>{appointment.patient_name || "Unnamed Patient"}</h3>
                      <p>{appointment.patient_email || "No email provided"}</p>
                    </div>

                    <span
                      className={`${styles.statusBadge} ${getStatusClass(
                        appointment.status
                      )}`}
                    >
                      {formatStatus(appointment.status)}
                    </span>
                  </div>

                  <div className={styles.cardDetails}>
                    <div className={styles.detailItem}>
                      <span>Doctor</span>
                      <strong>{appointment.doctor_name || "N/A"}</strong>
                    </div>

                    <div className={styles.detailItem}>
                      <span>Schedule</span>
                      <strong>
                        {formatSchedule(appointment.date, appointment.time)}
                      </strong>
                    </div>

                    <div className={styles.detailItem}>
                      <span>Service</span>
                      <strong>{appointment.services || "N/A"}</strong>
                    </div>

                    <div className={styles.detailItem}>
                      <span>{reasonLabel}</span>
                      <strong>
                        {appointment.cancel_reason &&
                        appointment.cancel_reason.trim()
                          ? appointment.cancel_reason
                          : "N/A"}
                      </strong>
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    {isPending ? (
                      <div className={styles.actionButtons}>
                        <button
                          type="button"
                          className={styles.approveBtn}
                          onClick={() =>
                            updateAppointmentStatus(appointment.id, "Approved")
                          }
                          disabled={actionLoading === appointment.id}
                        >
                          {actionLoading === appointment.id
                            ? "Updating..."
                            : "Approve"}
                        </button>

                        <button
                          type="button"
                          className={styles.declineBtn}
                          onClick={() => openReasonModal(appointment, "decline")}
                          disabled={actionLoading === appointment.id}
                        >
                          Decline
                        </button>
                      </div>
                    ) : isApproved ? (
                      <div className={styles.actionButtons}>
                        <button
                          type="button"
                          className={styles.cancelAppointmentBtn}
                          onClick={() => openReasonModal(appointment, "cancel")}
                          disabled={actionLoading === appointment.id}
                        >
                          {actionLoading === appointment.id
                            ? "Updating..."
                            : "Cancel Appointment"}
                        </button>
                      </div>
                    ) : (
                      <span className={styles.noAction}>No action required</span>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>

        {selectedAppointment && modalAction && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <div
                  className={
                    modalAction === "decline"
                      ? styles.modalWarningIcon
                      : styles.modalNeutralIcon
                  }
                >
                  {modalAction === "decline" ? "!" : "×"}
                </div>

                <div>
                  <p className={styles.modalEyebrow}>
                    {modalAction === "decline"
                      ? "Decline Appointment"
                      : "Cancel Appointment"}
                  </p>

                  <h3>
                    {modalAction === "decline"
                      ? "Decline this appointment?"
                      : "Cancel this approved appointment?"}
                  </h3>
                </div>
              </div>

              <p className={styles.modalText}>
                {modalAction === "decline"
                  ? "Please provide a reason before declining this pending appointment. This reason will remain visible in the appointment record."
                  : "Please provide a reason before cancelling this approved appointment. The record will remain saved for tracking and history."}
              </p>

              <div className={styles.modalAppointmentBox}>
                <div>
                  <span>Patient</span>
                  <strong>{selectedAppointment.patient_name}</strong>
                </div>

                <div>
                  <span>Schedule</span>
                  <strong>
                    {formatSchedule(
                      selectedAppointment.date,
                      selectedAppointment.time
                    )}
                  </strong>
                </div>
              </div>

              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={
                  modalAction === "decline"
                    ? "Enter decline reason..."
                    : "Enter cancellation reason..."
                }
                className={styles.textArea}
              />

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={closeReasonModal}
                  disabled={actionLoading !== null}
                >
                  Keep Appointment
                </button>

                <button
                  type="button"
                  className={
                    modalAction === "decline"
                      ? styles.confirmDeclineBtn
                      : styles.confirmCancelBtn
                  }
                  onClick={handleConfirmReasonAction}
                  disabled={actionLoading !== null}
                >
                  {actionLoading !== null
                    ? "Processing..."
                    : modalAction === "decline"
                    ? "Confirm Decline"
                    : "Confirm Cancellation"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}