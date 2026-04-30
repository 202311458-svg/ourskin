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

type FollowUp = {
  id: number;
  patient_id?: number | null;
  patient_name?: string | null;
  patient_email?: string | null;
  doctor_id?: number | null;
  doctor_name?: string | null;
  appointment_id?: number | null;
  appointment_services?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  follow_up_date: string;
  status?: string | null;
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

function normalizeStatus(status?: string | null) {
  return (status || "").toLowerCase();
}

function formatStatus(status?: string | null) {
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

function formatDate(dateString?: string | null) {
  if (!dateString) return "No date";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(timeString?: string | null) {
  if (!timeString) return "";

  const parts = timeString.split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return timeString;

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getTodayInputDate() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;

  return new Date(today.getTime() - timezoneOffset).toISOString().split("T")[0];
}

function getStatusClass(status: string) {
  const cleanStatus = normalizeStatus(status);

  if (cleanStatus === "approved") return styles.approved;
  if (cleanStatus === "pending") return styles.pending;
  if (cleanStatus === "completed") return styles.completed;
  if (cleanStatus === "cancelled") return styles.cancelled;
  return styles.declined;
}

function getFollowUpTiming(item: FollowUp) {
  const today = getTodayInputDate();
  const status = normalizeStatus(item.status);

  if (status === "completed") return "Completed";
  if (item.follow_up_date < today) return "Overdue";
  if (item.follow_up_date === today) return "Due Today";

  return "Upcoming";
}

function getFollowUpStatusClass(item: FollowUp) {
  const timing = getFollowUpTiming(item);

  if (timing === "Completed") return styles.completed;
  if (timing === "Overdue") return styles.declined;
  if (timing === "Due Today") return styles.pending;

  return styles.approved;
}

function canCompleteFollowUp(item: FollowUp) {
  const today = getTodayInputDate();
  const status = normalizeStatus(item.status);

  return status !== "completed" && item.follow_up_date <= today;
}

function uniqueAppointmentsById(appointments: Appointment[]) {
  return Array.from(
    new Map(
      appointments.map((appointment) => [appointment.id, appointment])
    ).values()
  );
}

function getFollowUpsArray(data: unknown): FollowUp[] {
  if (Array.isArray(data)) return data as FollowUp[];

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { follow_ups?: unknown }).follow_ups)
  ) {
    return (data as { follow_ups: FollowUp[] }).follow_ups;
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { followUps?: unknown }).followUps)
  ) {
    return (data as { followUps: FollowUp[] }).followUps;
  }

  return [];
}

function uniqueFollowUpsById(followUps: FollowUp[]) {
  return Array.from(
    new Map(
      followUps.map((item) => [
        item.id,
        {
          ...item,
          status: formatStatus(item.status),
        },
      ])
    ).values()
  );
}

export default function AdminAppointmentsPage() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [followUpActionLoading, setFollowUpActionLoading] = useState<
    number | null
  >(null);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [modalAction, setModalAction] = useState<ModalAction | null>(null);
  const [reason, setReason] = useState("");

  const fetchFollowUps = async (token: string) => {
    const res = await fetch(`${API_BASE}/doctor/follow-ups`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await safeJson<unknown>(res);

    if (!res.ok) {
      console.error("/doctor/follow-ups request failed:", {
        status: res.status,
        data,
      });

      return [];
    }

    return uniqueFollowUpsById(getFollowUpsArray(data));
  };

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

        const [appointmentsRes, followUpData] = await Promise.all([
          fetch(`${API_BASE}/admin/appointments`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetchFollowUps(token),
        ]);

        const appointmentData = await safeJson<unknown>(appointmentsRes);

        if (!appointmentsRes.ok) {
          throw new Error(
            getApiErrorMessage(
              appointmentData as ApiErrorResponse | null,
              "Unable to load appointments"
            )
          );
        }

        setAppointments(
          uniqueAppointmentsById(
            Array.isArray(appointmentData) ? appointmentData : []
          )
        );

        setFollowUps(uniqueFollowUpsById(followUpData));
      } catch (loadError: unknown) {
        setError(
          getErrorMessage(
            loadError,
            "Something went wrong while loading appointments."
          )
        );
        setFollowUps([]);
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
    pause:
      actionLoading !== null ||
      followUpActionLoading !== null ||
      selectedAppointment !== null,
  });

  const filteredAppointments = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return appointments.filter((appointment) => {
      const status = normalizeStatus(appointment.status);

      const matchesSearch =
        (appointment.patient_name || "").toLowerCase().includes(keyword) ||
        (appointment.patient_email || "").toLowerCase().includes(keyword) ||
        (appointment.doctor_name || "").toLowerCase().includes(keyword) ||
        (appointment.services || "").toLowerCase().includes(keyword) ||
        (appointment.status || "").toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "all" || status === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [appointments, search, statusFilter]);

  const sortedFollowUps = useMemo(() => {
    return uniqueFollowUpsById(followUps).sort((a, b) => {
      const aCompleted = normalizeStatus(a.status) === "completed";
      const bCompleted = normalizeStatus(b.status) === "completed";

      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }

      return a.follow_up_date.localeCompare(b.follow_up_date);
    });
  }, [followUps]);

  const stats = useMemo(() => {
    return {
      total: appointments.length,
      pending: appointments.filter(
        (appointment) => normalizeStatus(appointment.status) === "pending"
      ).length,
      approved: appointments.filter(
        (appointment) => normalizeStatus(appointment.status) === "approved"
      ).length,
      followUps: sortedFollowUps.filter(
        (item) => normalizeStatus(item.status) !== "completed"
      ).length,
    };
  }, [appointments, sortedFollowUps]);

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

  async function markFollowUpCompleted(followUpId: number) {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/");
      return;
    }

    const selectedFollowUp = followUps.find((item) => item.id === followUpId);

    if (!selectedFollowUp) {
      alert("Follow-up schedule was not found.");
      return;
    }

    if (!canCompleteFollowUp(selectedFollowUp)) {
      alert("This follow-up can only be completed on or after its scheduled date.");
      return;
    }

    try {
      setFollowUpActionLoading(followUpId);

      const res = await fetch(`${API_BASE}/doctor/follow-ups/${followUpId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: "Completed",
        }),
      });

      const data = await safeJson<
        {
          follow_up?: FollowUp;
        } & ApiErrorResponse
      >(res);

      if (!res.ok) {
        alert(getApiErrorMessage(data, "Unable to complete follow-up schedule."));
        return;
      }

      setFollowUps((prev) =>
        uniqueFollowUpsById(
          prev.map((item) =>
            item.id === followUpId
              ? {
                  ...item,
                  ...(data?.follow_up || {}),
                  status: "Completed",
                }
              : item
          )
        )
      );

      await loadAppointments(false);
    } catch (completeError: unknown) {
      alert(
        getErrorMessage(
          completeError,
          "Unable to mark this follow-up as completed."
        )
      );
    } finally {
      setFollowUpActionLoading(null);
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
              Manage patient appointment requests, approvals, cancellations,
              follow-up schedules, and history.
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
            <span>Active Follow-ups</span>
            <strong>{stats.followUps}</strong>
          </div>
        </div>

        <section className={styles.followUpPanel}>
          <div className={styles.followUpHeader}>
            <div>
              <h2>Follow-up Schedule</h2>
              <p>View scheduled follow-ups and complete due records.</p>
            </div>

            <span className={styles.followUpCount}>
              {sortedFollowUps.length} total
            </span>
          </div>

          {loading ? (
            <p className={styles.message}>Loading follow-up schedules...</p>
          ) : sortedFollowUps.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No follow-up schedules found</h3>
              <p>Doctor-created follow-ups will appear here.</p>
            </div>
          ) : (
            <div className={styles.followUpCompactList}>
              {sortedFollowUps.map((item) => {
                const timing = getFollowUpTiming(item);
                const isCompleted = normalizeStatus(item.status) === "completed";
                const canComplete = canCompleteFollowUp(item);
                const isUpdating = followUpActionLoading === item.id;

                return (
                  <div key={item.id} className={styles.followUpCompactRow}>
                    <div className={styles.followUpPatient}>
                      <strong>
                        {item.patient_name ||
                          (item.patient_id
                            ? `Patient #${item.patient_id}`
                            : "Patient details unavailable")}
                      </strong>

                      <span>{item.patient_email || "No email provided"}</span>
                    </div>

                    <div className={styles.followUpInfo}>
                      <span>Follow-up</span>
                      <strong>{formatDate(item.follow_up_date)}</strong>
                    </div>

                    <div className={styles.followUpInfo}>
                      <span>Doctor</span>
                      <strong>{item.doctor_name || "Assigned doctor"}</strong>
                    </div>

                    <div className={styles.followUpInfo}>
                      <span>Visit</span>
                      <strong>
                        {item.appointment_date
                          ? formatDate(item.appointment_date)
                          : "No date"}{" "}
                        {item.appointment_time
                          ? `at ${formatTime(item.appointment_time)}`
                          : ""}
                      </strong>
                    </div>

                    <div className={styles.followUpStatusArea}>
                      <span
                        className={`${styles.statusBadge} ${getFollowUpStatusClass(
                          item
                        )}`}
                      >
                        {timing}
                      </span>

                      {isCompleted ? (
                        <span className={styles.noAction}>Completed</span>
                      ) : (
                        <button
                          type="button"
                          className={
                            canComplete
                              ? styles.approveBtn
                              : styles.followUpDisabledBtn
                          }
                          onClick={() => markFollowUpCompleted(item.id)}
                          disabled={!canComplete || isUpdating}
                        >
                          {isUpdating
                            ? "Completing..."
                            : canComplete
                            ? "Mark Completed"
                            : "Not Due Yet"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

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