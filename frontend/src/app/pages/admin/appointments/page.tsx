"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";
import PortalShell from "@/app/components/PortalShell";
import { useAutoRefresh } from "@/app/hooks/useAutoRefresh";
import {
  AdminAppointment,
  AdminFollowUp,
  AppointmentStatus,
  AssignableDoctor,
  AssignableSlot,
  assignInitialEvaluationSchedule,
  getAdminAppointments,
  getAdminFollowUps,
  getAssignableInitialEvaluationDoctors,
  getAssignableInitialEvaluationSlots,
  updateAdminFollowUp,
  updateAppointmentStatus as saveAppointmentStatus,
} from "@/lib/admin-api";
import styles from "@/app/styles/admin.module.css";

type ModalAction = "decline" | "cancel" | "no-show";
type ManualConsultationMode = "In-Person" | "Online Consultation";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function normalizeStatus(status?: string | null) {
  return (status || "").trim().toLowerCase();
}

function formatStatus(status?: string | null) {
  if (!status) return "N/A";

  return status
    .replaceAll("-", " ")
    .split(" ")
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(dateString?: string | null) {
  if (!dateString) return "To be scheduled";

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

  const [hourText, minuteText] = timeString.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return timeString;

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatSchedule(
  date?: string | null,
  time?: string | null,
  endTime?: string | null
) {
  if (!date && !time) return "To be scheduled";

  const dateText = formatDate(date);
  const startText = formatTime(time);
  const endText = formatTime(endTime);

  if (!startText) return dateText;

  return `${dateText} • ${startText}${endText ? ` - ${endText}` : ""}`;
}

function getTodayInputDate() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;

  return new Date(today.getTime() - timezoneOffset).toISOString().split("T")[0];
}

function addDaysToInputDate(days: number) {
  const today = new Date();
  today.setDate(today.getDate() + days);

  const timezoneOffset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - timezoneOffset).toISOString().split("T")[0];
}

function getStatusClass(status: string) {
  const cleanStatus = normalizeStatus(status);

  if (cleanStatus === "approved") return styles.approved;
  if (cleanStatus === "pending") return styles.pending;
  if (cleanStatus === "completed") return styles.completed;
  if (cleanStatus === "cancelled") return styles.cancelled;
  if (cleanStatus === "no-show") return styles.cancelled;

  return styles.declined;
}

function getFollowUpTiming(item: AdminFollowUp) {
  const today = getTodayInputDate();
  const status = normalizeStatus(item.status);

  if (status === "completed") return "Completed";
  if (status === "cancelled" || status === "canceled") return "Cancelled";
  if (item.follow_up_date < today) return "Overdue";
  if (item.follow_up_date === today) return "Due Today";

  return "Upcoming";
}

function getFollowUpStatusClass(item: AdminFollowUp) {
  const timing = getFollowUpTiming(item);

  if (timing === "Completed") return styles.followUpBadgeCompleted;
  if (timing === "Overdue") return styles.followUpBadgeOverdue;
  if (timing === "Due Today") return styles.followUpBadgeDue;

  return styles.followUpBadgeUpcoming;
}

function canCompleteFollowUp(item: AdminFollowUp) {
  const today = getTodayInputDate();
  const status = normalizeStatus(item.status);

  return status !== "completed" && item.follow_up_date <= today;
}

function uniqueAppointmentsById(appointments: AdminAppointment[]) {
  return Array.from(
    new Map(appointments.map((appointment) => [appointment.id, appointment])).values()
  );
}

function uniqueFollowUpsById(followUps: AdminFollowUp[]) {
  return Array.from(new Map(followUps.map((item) => [item.id, item])).values());
}

function needsInitialEvaluationSchedule(appointment: AdminAppointment) {
  return (
    appointment.is_initial_evaluation_request &&
    (!appointment.doctor_id ||
      !appointment.date ||
      !appointment.time ||
      !appointment.end_time)
  );
}

function buildDefaultApprovalInstruction(appointment: AdminAppointment) {
  const service = appointment.services || "your selected service";
  const doctor = appointment.doctor_name || "your assigned doctor";
  const date = appointment.date ? formatDate(appointment.date) : "the scheduled date";
  const start = appointment.time ? formatTime(appointment.time) : "the scheduled start time";
  const end = appointment.end_time ? formatTime(appointment.end_time) : "the scheduled end time";

  if (appointment.consultation_mode === "Online Consultation") {
    return `Your appointment for ${service} has been approved. It is scheduled on ${date} from ${start} to ${end} with ${doctor}. Please make sure you have a stable internet connection and are in a well-lit area during the consultation. The clinic will provide the consultation access details before your schedule. If you need to cancel or reschedule, please do this ahead of your appointment time through your patient portal.`;
  }

  if (
    appointment.appointment_type === "Initial Evaluation" ||
    appointment.appointment_type === "Initial Evaluation Request"
  ) {
    return `Your initial evaluation for ${service} has been approved and scheduled on ${date} from ${start} to ${end} with ${doctor}. Please arrive at least 15 minutes before your appointment. The doctor will assess your concern first before confirming the next treatment or procedure plan. Please bring a valid ID and any previous prescriptions, laboratory results, or skin-related medical records if available.`;
  }

  return `Your appointment for ${service} has been approved. It is scheduled on ${date} from ${start} to ${end} with ${doctor}. Please arrive at least 15 minutes before your scheduled time and bring a valid ID, previous prescriptions, laboratory results, or skin-related medical records if available. If you need to cancel or reschedule, please do this ahead of your appointment time through your patient portal.`;
}

function getGuardianName(appointment: AdminAppointment) {
  return [appointment.guardian_first_name, appointment.guardian_last_name]
    .filter(Boolean)
    .join(" ");
}

const TIME_OPTIONS = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
];

export default function AdminAppointmentsPage() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [followUps, setFollowUps] = useState<AdminFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [followUpActionLoading, setFollowUpActionLoading] = useState<number | null>(
    null
  );
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedAppointment, setSelectedAppointment] =
    useState<AdminAppointment | null>(null);
  const [detailsAppointment, setDetailsAppointment] =
    useState<AdminAppointment | null>(null);

  const [modalAction, setModalAction] = useState<ModalAction | null>(null);
  const [reason, setReason] = useState("");

  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalInstruction, setApprovalInstruction] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignDoctors, setAssignDoctors] = useState<AssignableDoctor[]>([]);
  const [assignSlots, setAssignSlots] = useState<AssignableSlot[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [weekStart, setWeekStart] = useState(getTodayInputDate());
  const [manualDate, setManualDate] = useState(addDaysToInputDate(1));
  const [manualStartTime, setManualStartTime] = useState("10:00");
  const [manualEndTime, setManualEndTime] = useState("11:00");
  const [manualConsultationMode, setManualConsultationMode] =
    useState<ManualConsultationMode>("In-Person");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");

  const loadAppointments = useCallback(
    async (showLoader = true) => {
      const token = localStorage.getItem("token");
      const role = localStorage.getItem("role");

      if (!token || role !== "admin") {
        router.push("/");
        return;
      }

      try {
        if (showLoader) setLoading(true);
        setError("");

        const [appointmentData, followUpData] = await Promise.all([
          getAdminAppointments(),
          getAdminFollowUps(),
        ]);

        setAppointments(
          uniqueAppointmentsById(Array.isArray(appointmentData) ? appointmentData : [])
        );
        setFollowUps(uniqueFollowUpsById(Array.isArray(followUpData) ? followUpData : []));
      } catch (loadError: unknown) {
        setError(
          getErrorMessage(
            loadError,
            "Something went wrong while loading appointments."
          )
        );
        setFollowUps([]);
      } finally {
        if (showLoader) setLoading(false);
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
      selectedAppointment !== null ||
      detailsAppointment !== null ||
      showAssignModal ||
      showApprovalModal,
  });

useEffect(() => {
  if (!showAssignModal || !selectedAppointment) return;

  const appointmentId = selectedAppointment.id;
  let cancelled = false;

  async function loadDoctors() {
    try {
      setAssignError("");
      setAssignLoading(true);

      const doctors = await getAssignableInitialEvaluationDoctors(appointmentId);

      if (cancelled) return;

      setAssignDoctors(doctors);

      if (doctors.length > 0) {
        setSelectedDoctorId((currentDoctorId) => currentDoctorId ?? doctors[0].id);
      } else {
        setSelectedDoctorId(null);
      }
    } catch (loadError: unknown) {
      if (!cancelled) {
        setAssignError(
          getErrorMessage(loadError, "Unable to load assignable doctors.")
        );
        setAssignDoctors([]);
        setSelectedDoctorId(null);
      }
    } finally {
      if (!cancelled) setAssignLoading(false);
    }
  }

  loadDoctors();

  return () => {
    cancelled = true;
  };
}, [showAssignModal, selectedAppointment]);

useEffect(() => {
  if (!showAssignModal || !selectedAppointment || selectedDoctorId === null) {
    return;
  }

  const appointmentId = selectedAppointment.id;
  const doctorId = selectedDoctorId;
  let cancelled = false;

  async function loadSlots() {
    try {
      setAssignError("");
      setAssignLoading(true);
      setSelectedSlotId("");

      const slots = await getAssignableInitialEvaluationSlots(appointmentId, {
        doctor_id: doctorId,
        week_start: weekStart,
      });

      if (cancelled) return;

      setAssignSlots(slots);
    } catch (loadError: unknown) {
      if (!cancelled) {
        setAssignError(
          getErrorMessage(loadError, "Unable to load assignable slots.")
        );
        setAssignSlots([]);
      }
    } finally {
      if (!cancelled) setAssignLoading(false);
    }
  }

  loadSlots();

  return () => {
    cancelled = true;
  };
}, [showAssignModal, selectedAppointment, selectedDoctorId, weekStart]);

  const filteredAppointments = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return appointments.filter((appointment) => {
      const status = normalizeStatus(appointment.status);
      const guardianName = getGuardianName(appointment);

      const matchesSearch =
        !keyword ||
        (appointment.patient_name || "").toLowerCase().includes(keyword) ||
        (appointment.patient_email || "").toLowerCase().includes(keyword) ||
        (appointment.patient_contact || "").toLowerCase().includes(keyword) ||
        (appointment.doctor_name || "").toLowerCase().includes(keyword) ||
        (appointment.services || "").toLowerCase().includes(keyword) ||
        (appointment.status || "").toLowerCase().includes(keyword) ||
        guardianName.toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "all" || status === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [appointments, search, statusFilter]);

  const sortedFollowUps = useMemo(() => {
    return uniqueFollowUpsById(followUps).sort((a, b) => {
      const aCompleted = normalizeStatus(a.status) === "completed";
      const bCompleted = normalizeStatus(b.status) === "completed";

      if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

      return a.follow_up_date.localeCompare(b.follow_up_date);
    });
  }, [followUps]);

  const stats = useMemo(() => {
    return {
      total: appointments.length,
      pending: appointments.filter(
        (appointment) => normalizeStatus(appointment.status) === "pending"
      ).length,
      initialEvaluation: appointments.filter(
        (appointment) =>
          appointment.is_initial_evaluation_request &&
          normalizeStatus(appointment.status) === "pending"
      ).length,
      approved: appointments.filter(
        (appointment) => normalizeStatus(appointment.status) === "approved"
      ).length,
      followUps: sortedFollowUps.filter(
        (item) => normalizeStatus(item.status) !== "completed"
      ).length,
    };
  }, [appointments, sortedFollowUps]);

  function updateAppointmentInState(updated: AdminAppointment) {
    setAppointments((prev) =>
      uniqueAppointmentsById(
        prev.map((appointment) =>
          appointment.id === updated.id ? updated : appointment
        )
      )
    );
  }

  function openReasonModal(appointment: AdminAppointment, action: ModalAction) {
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

  function openApprovalModal(appointment: AdminAppointment) {
    setSelectedAppointment(appointment);
    setApprovalInstruction(
      appointment.patient_instruction || buildDefaultApprovalInstruction(appointment)
    );
    setSendEmail(true);
    setShowApprovalModal(true);
  }

  function closeApprovalModal() {
    if (actionLoading !== null) return;

    setSelectedAppointment(null);
    setApprovalInstruction("");
    setSendEmail(true);
    setShowApprovalModal(false);
  }

  function openAssignModal(appointment: AdminAppointment) {
    setSelectedAppointment(appointment);
    setShowAssignModal(true);
    setAssignDoctors([]);
    setAssignSlots([]);
    setSelectedDoctorId(null);
    setSelectedSlotId("");
    setAssignError("");
    setWeekStart(getTodayInputDate());
    setManualDate(addDaysToInputDate(1));
    setManualStartTime("10:00");
    setManualEndTime("11:00");
    setManualConsultationMode("In-Person");
  }

  function closeAssignModal() {
    if (assignLoading) return;

    setSelectedAppointment(null);
    setShowAssignModal(false);
    setAssignDoctors([]);
    setAssignSlots([]);
    setSelectedDoctorId(null);
    setSelectedSlotId("");
    setAssignError("");
  }

  function handleApproveClick(appointment: AdminAppointment) {
    if (needsInitialEvaluationSchedule(appointment)) {
      openAssignModal(appointment);
      return;
    }

    openApprovalModal(appointment);
  }

  async function updateAppointmentStatus(
    appointmentId: number,
    status: AppointmentStatus,
    options?: {
      cancelReason?: string;
      patientInstruction?: string;
      sendEmail?: boolean;
    }
  ) {
    try {
      setActionLoading(appointmentId);

      const data = await saveAppointmentStatus(appointmentId, {
        status,
        cancel_reason: options?.cancelReason || null,
        patient_instruction: options?.patientInstruction || null,
        send_email: options?.sendEmail || false,
      });

      if (data.appointment) updateAppointmentInState(data.appointment);

      if (data.email_warning) {
        alert(
          `Appointment updated, but the email notification was not sent: ${data.email_warning}`
        );
      }

      closeReasonModal();
      closeApprovalModal();
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

  async function handleConfirmApproval() {
    if (!selectedAppointment) return;

    const trimmedInstruction = approvalInstruction.trim();

    if (!trimmedInstruction) {
      alert("Please provide patient instructions before approving.");
      return;
    }

    await updateAppointmentStatus(selectedAppointment.id, "Approved", {
      patientInstruction: trimmedInstruction,
      sendEmail,
    });
  }

  async function handleConfirmReasonAction() {
    if (!selectedAppointment || !modalAction) return;

    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      alert(
        modalAction === "decline"
          ? "Please provide a reason for declining this appointment."
          : modalAction === "no-show"
          ? "Please provide a reason for marking this appointment as no-show."
          : "Please provide a reason for cancelling this appointment."
      );
      return;
    }

    if (modalAction === "decline") {
      await updateAppointmentStatus(selectedAppointment.id, "Declined", {
        cancelReason: trimmedReason,
      });
      return;
    }

    if (modalAction === "no-show") {
      await updateAppointmentStatus(selectedAppointment.id, "No-Show", {
        cancelReason: trimmedReason,
      });
      return;
    }

    await updateAppointmentStatus(selectedAppointment.id, "Cancelled", {
      cancelReason: trimmedReason,
    });
  }

  async function markFollowUpCompleted(followUpId: number) {
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

      const data = await updateAdminFollowUp(followUpId, {
        status: "Completed",
      });

      setFollowUps((prev) =>
        uniqueFollowUpsById(
          prev.map((item) =>
            item.id === followUpId
              ? { ...item, ...(data?.follow_up || {}), status: "Completed" }
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

  async function handleAssignSelectedSlot() {
    if (!selectedAppointment) return;

    const selectedSlot = assignSlots.find((slot) => slot.slot_id === selectedSlotId);

    if (!selectedSlot) {
      alert("Please select an available slot first.");
      return;
    }

    if (!selectedSlot.is_available) {
      alert("This slot is already booked. Please select another slot.");
      return;
    }

    try {
      setAssignLoading(true);
      setAssignError("");

      const data = await assignInitialEvaluationSchedule(selectedAppointment.id, {
        schedule_id: selectedSlot.schedule_id,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
      });

      updateAppointmentInState(data.appointment);
      setShowAssignModal(false);
      openApprovalModal(data.appointment);
    } catch (assignErrorValue: unknown) {
      setAssignError(
        getErrorMessage(assignErrorValue, "Unable to assign schedule.")
      );
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleManualAssign() {
    if (!selectedAppointment) return;

    if (!selectedDoctorId) {
      alert("Please select a doctor first.");
      return;
    }

    if (!manualDate || !manualStartTime || !manualEndTime) {
      alert("Please complete the manual schedule fields.");
      return;
    }

    if (manualEndTime <= manualStartTime) {
      alert("End time must be later than start time.");
      return;
    }

    try {
      setAssignLoading(true);
      setAssignError("");

      const data = await assignInitialEvaluationSchedule(selectedAppointment.id, {
        schedule_id: null,
        doctor_id: selectedDoctorId,
        schedule_date: manualDate,
        start_time: manualStartTime,
        end_time: manualEndTime,
        consultation_mode: manualConsultationMode,
      });

      updateAppointmentInState(data.appointment);
      setShowAssignModal(false);
      openApprovalModal(data.appointment);
    } catch (assignErrorValue: unknown) {
      setAssignError(
        getErrorMessage(assignErrorValue, "Unable to manually assign schedule.")
      );
    } finally {
      setAssignLoading(false);
    }
  }

  return (
    <div className="staffLayout">
      <AdminNavbar />

      <PortalShell role="admin">
      <main className={styles.appointmentsPage}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Appointments</h1>
            <p className={styles.subtitle}>
              Manage patient requests, initial evaluations, approvals,
              cancellations, no-shows, follow-ups, and appointment history.
            </p>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span>Total Appointments</span>
            <strong>{stats.total}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.orangeAccent}`}>
            <span>Pending</span>
            <strong>{stats.pending}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.pinkAccent}`}>
            <span>Initial Evaluation</span>
            <strong>{stats.initialEvaluation}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.greenAccent}`}>
            <span>Approved</span>
            <strong>{stats.approved}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.blueAccent}`}>
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
            <div className={styles.followUpEmpty}>
              Doctor-created follow-ups will appear here.
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

                    <div className={styles.followUpMeta}>
                      <span>{formatDate(item.follow_up_date)}</span>
                      <small>{item.doctor_name || "Doctor unavailable"}</small>
                    </div>

                    <span
                      className={`${styles.followUpBadge} ${getFollowUpStatusClass(
                        item
                      )}`}
                    >
                      {timing}
                    </span>

                    {!isCompleted && (
                      <button
                        type="button"
                        className={
                          canComplete
                            ? styles.followUpCompleteBtn
                            : styles.followUpDisabledBtn
                        }
                        onClick={() => markFollowUpCompleted(item.id)}
                        disabled={!canComplete || isUpdating}
                      >
                        {isUpdating
                          ? "Completing..."
                          : canComplete
                          ? "Mark Completed"
                          : "Not Due"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Search by patient, email, contact, guardian, doctor, service, or status"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={styles.searchInput}
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={styles.selectInput}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
            <option value="declined">Declined</option>
            <option value="cancelled">Cancelled</option>
            <option value="no-show">No-Show</option>
          </select>
        </div>

        {loading ? (
          <p className={styles.message}>Loading appointments...</p>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : filteredAppointments.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>No appointments found</h3>
            <p>Try adjusting the search or status filter.</p>
          </div>
        ) : (
          <section className={styles.appointmentsList}>
            {filteredAppointments.map((appointment) => {
              const status = formatStatus(appointment.status);
              const normalized = normalizeStatus(appointment.status);
              const isUpdating = actionLoading === appointment.id;
              const canApprove = normalized === "pending";
              const canDecline = normalized === "pending";
              const canCancel = normalized === "approved";
              const canComplete = normalized === "approved";
              const canNoShow = normalized === "approved";

              return (
                <article key={appointment.id} className={styles.appointmentCard}>
                  <div className={styles.cardTop}>
                    <div>
                      <h3>
                        {appointment.patient_name || "Unknown Patient"}
                        {appointment.is_minor ? (
                          <span className={styles.minorBadge}>Minor</span>
                        ) : null}
                      </h3>
                      <p>{appointment.patient_email || "No email available"}</p>
                    </div>

                    <span
                      className={`${styles.statusBadge} ${getStatusClass(
                        appointment.status
                      )}`}
                    >
                      {status}
                    </span>
                  </div>

                  <div className={styles.cardDetails}>
                    <div className={styles.detailItem}>
                      <span>Doctor</span>
                      <strong>{appointment.doctor_name || "Not assigned"}</strong>
                    </div>

                    <div className={styles.detailItem}>
                      <span>Schedule</span>
                      <strong>
                        {formatSchedule(
                          appointment.date,
                          appointment.time,
                          appointment.end_time
                        )}
                      </strong>
                    </div>

                    <div className={styles.detailItem}>
                      <span>Service</span>
                      <strong>{appointment.services || "N/A"}</strong>
                    </div>

                    <div className={styles.detailItem}>
                      <span>Type</span>
                      <strong>{appointment.appointment_type || "Regular"}</strong>
                    </div>

                    <div className={styles.detailItem}>
                      <span>Mode</span>
                      <strong>{appointment.consultation_mode || "N/A"}</strong>
                    </div>

                    <div className={styles.detailItem}>
                      <span>Email Sent</span>
                      <strong>{appointment.approval_email_sent ? "Yes" : "No"}</strong>
                    </div>
                  </div>

                  {appointment.concern ? (
                    <p className={styles.compactMeta}>
                      <strong>Concern:</strong> {appointment.concern}
                    </p>
                  ) : null}

                  {appointment.cancel_reason ? (
                    <p className={styles.compactMeta}>
                      <strong>Reason:</strong> {appointment.cancel_reason}
                    </p>
                  ) : null}

                  {appointment.is_minor ? (
                    <p className={styles.compactMeta}>
                      <strong>Guardian:</strong>{" "}
                      {getGuardianName(appointment) || "Guardian details unavailable"}
                      {appointment.guardian_relationship
                        ? ` • ${appointment.guardian_relationship}`
                        : ""}
                    </p>
                  ) : null}

                  <div className={styles.cardFooter}>
                    <div className={styles.actionButtons}>
                      <button
                        type="button"
                        className={styles.secondaryAction}
                        onClick={() => setDetailsAppointment(appointment)}
                      >
                        View Details
                      </button>

                      {canApprove && (
                        <button
                          type="button"
                          className={styles.approveBtn}
                          disabled={isUpdating}
                          onClick={() => handleApproveClick(appointment)}
                        >
                          {needsInitialEvaluationSchedule(appointment)
                            ? "Assign Schedule"
                            : isUpdating
                            ? "Updating..."
                            : "Approve"}
                        </button>
                      )}

                      {canDecline && (
                        <button
                          type="button"
                          className={styles.declineBtn}
                          disabled={isUpdating}
                          onClick={() => openReasonModal(appointment, "decline")}
                        >
                          Decline
                        </button>
                      )}

                      {canComplete && (
                        <button
                          type="button"
                          className={styles.approveBtn}
                          disabled={isUpdating}
                          onClick={() =>
                            updateAppointmentStatus(appointment.id, "Completed")
                          }
                        >
                          Complete
                        </button>
                      )}

                      {canNoShow && (
                        <button
                          type="button"
                          className={styles.cancelAppointmentBtn}
                          disabled={isUpdating}
                          onClick={() => openReasonModal(appointment, "no-show")}
                        >
                          No-Show
                        </button>
                      )}

                      {canCancel && (
                        <button
                          type="button"
                          className={styles.cancelAppointmentBtn}
                          disabled={isUpdating}
                          onClick={() => openReasonModal(appointment, "cancel")}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {detailsAppointment && (
          <div className={styles.modalBackdrop}>
            <div className={`${styles.modalCard} ${styles.modalLarge}`}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>Appointment Details</h2>
                  <p>
                    Review the full patient, guardian, schedule, and appointment
                    context.
                  </p>
                </div>

                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={() => setDetailsAppointment(null)}
                >
                  ×
                </button>
              </div>

              <div className={styles.modalBody}>
                <section className={styles.detailSection}>
                  <h3>Patient Information</h3>
                  <div className={styles.detailGrid}>
                    <div>
                      <span>Name</span>
                      <strong>{detailsAppointment.patient_name}</strong>
                    </div>
                    <div>
                      <span>Email</span>
                      <strong>{detailsAppointment.patient_email}</strong>
                    </div>
                    <div>
                      <span>Contact</span>
                      <strong>{detailsAppointment.patient_contact || "N/A"}</strong>
                    </div>
                    <div>
                      <span>Age</span>
                      <strong>
                        {detailsAppointment.patient_age_label ||
                          detailsAppointment.patient_age ||
                          "N/A"}
                      </strong>
                    </div>
                    <div>
                      <span>Address</span>
                      <strong>{detailsAppointment.patient_address || "N/A"}</strong>
                    </div>
                  </div>
                </section>

                {detailsAppointment.is_minor && (
                  <section className={styles.detailSection}>
                    <h3>Guardian Information</h3>
                    <div className={styles.detailGrid}>
                      <div>
                        <span>Name</span>
                        <strong>{getGuardianName(detailsAppointment) || "N/A"}</strong>
                      </div>
                      <div>
                        <span>Relationship</span>
                        <strong>
                          {detailsAppointment.guardian_relationship || "N/A"}
                        </strong>
                      </div>
                      <div>
                        <span>Contact</span>
                        <strong>{detailsAppointment.guardian_contact || "N/A"}</strong>
                      </div>
                      <div>
                        <span>Email</span>
                        <strong>{detailsAppointment.guardian_email || "N/A"}</strong>
                      </div>
                      <div>
                        <span>Consent</span>
                        <strong>
                          {detailsAppointment.guardian_consent
                            ? "Provided"
                            : "Not provided"}
                        </strong>
                      </div>
                    </div>
                  </section>
                )}

                <section className={styles.detailSection}>
                  <h3>Appointment Workflow</h3>
                  <div className={styles.detailGrid}>
                    <div>
                      <span>Service</span>
                      <strong>{detailsAppointment.services}</strong>
                    </div>
                    <div>
                      <span>Type</span>
                      <strong>{detailsAppointment.appointment_type}</strong>
                    </div>
                    <div>
                      <span>Mode</span>
                      <strong>{detailsAppointment.consultation_mode}</strong>
                    </div>
                    <div>
                      <span>Doctor</span>
                      <strong>{detailsAppointment.doctor_name || "Not assigned"}</strong>
                    </div>
                    <div>
                      <span>Schedule</span>
                      <strong>
                        {formatSchedule(
                          detailsAppointment.date,
                          detailsAppointment.time,
                          detailsAppointment.end_time
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{formatStatus(detailsAppointment.status)}</strong>
                    </div>
                  </div>

                  {detailsAppointment.concern ? (
                    <p className={styles.compactMeta}>
                      <strong>Concern:</strong> {detailsAppointment.concern}
                    </p>
                  ) : null}

                  {detailsAppointment.patient_instruction ? (
                    <p className={styles.compactMeta}>
                      <strong>Patient Instruction:</strong>{" "}
                      {detailsAppointment.patient_instruction}
                    </p>
                  ) : null}
                </section>
              </div>
            </div>
          </div>
        )}

        {showAssignModal && selectedAppointment && (
          <div className={styles.modalBackdrop}>
            <div className={`${styles.modalCard} ${styles.modalLarge}`}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>Assign Initial Evaluation</h2>
                  <p>
                    Select a doctor and schedule before approving this request.
                  </p>
                </div>

                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={closeAssignModal}
                  disabled={assignLoading}
                >
                  ×
                </button>
              </div>

              <div className={styles.modalBody}>
                <section className={styles.detailSection}>
                  <h3>Request Summary</h3>
                  <div className={styles.detailGrid}>
                    <div>
                      <span>Patient</span>
                      <strong>{selectedAppointment.patient_name}</strong>
                    </div>
                    <div>
                      <span>Service</span>
                      <strong>{selectedAppointment.services}</strong>
                    </div>
                    <div>
                      <span>Concern</span>
                      <strong>{selectedAppointment.concern || "N/A"}</strong>
                    </div>
                  </div>
                </section>

                {assignError ? <p className={styles.error}>{assignError}</p> : null}

                <div className={styles.formGrid}>
                  <label className={styles.formGroup}>
                    <span>Doctor</span>
                    <select
                      className={styles.selectInput}
                      value={selectedDoctorId || ""}
                      onChange={(event) =>
                        setSelectedDoctorId(Number(event.target.value) || null)
                      }
                    >
                      <option value="">Select doctor</option>
                      {assignDoctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.name}
                          {doctor.specialty ? ` • ${doctor.specialty}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.formGroup}>
                    <span>Week Start</span>
                    <input
                      className={styles.searchInput}
                      type="date"
                      value={weekStart}
                      min={getTodayInputDate()}
                      onChange={(event) => setWeekStart(event.target.value)}
                    />
                  </label>
                </div>

                <section className={styles.detailSection}>
                  <h3>Available Slots</h3>

                  {assignLoading ? (
                    <p className={styles.message}>Loading slots...</p>
                  ) : assignSlots.length === 0 ? (
                    <p className={styles.mutedText}>
                      No available slots found for this doctor and week. Use manual
                      assignment if the clinic already coordinated a schedule.
                    </p>
                  ) : (
                    <div className={styles.slotList}>
                      {assignSlots.map((slot) => (
                        <button
                          key={slot.slot_id}
                          type="button"
                          className={`${styles.slotButton} ${
                            selectedSlotId === slot.slot_id
                              ? styles.slotButtonActive
                              : ""
                          } ${
                            !slot.is_available ? styles.slotButtonDisabled : ""
                          }`}
                          disabled={!slot.is_available}
                          onClick={() => setSelectedSlotId(slot.slot_id)}
                        >
                          <strong>{formatDate(slot.schedule_date)}</strong>
                          <span>
                            {formatTime(slot.start_time)} -{" "}
                            {formatTime(slot.end_time)}
                          </span>
                          <small>
                            {slot.doctor_name} • {slot.consultation_mode}
                            {!slot.is_available
                              ? ` • ${slot.unavailable_reason || "Unavailable"}`
                              : ""}
                          </small>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={styles.modalFooter}>
                    <button
                      type="button"
                      className={styles.approveBtn}
                      disabled={assignLoading || !selectedSlotId}
                      onClick={handleAssignSelectedSlot}
                    >
                      {assignLoading ? "Assigning..." : "Use Selected Slot"}
                    </button>
                  </div>
                </section>

                <section className={styles.detailSection}>
                  <h3>Manual Assignment</h3>
                  <p className={styles.mutedText}>
                    Use this only when the schedule was coordinated outside the
                    weekly schedule template.
                  </p>

                  <div className={styles.formGrid}>
                    <label className={styles.formGroup}>
                      <span>Date</span>
                      <input
                        className={styles.searchInput}
                        type="date"
                        min={getTodayInputDate()}
                        value={manualDate}
                        onChange={(event) => setManualDate(event.target.value)}
                      />
                    </label>

                    <label className={styles.formGroup}>
                      <span>Start Time</span>
                      <select
                        className={styles.selectInput}
                        value={manualStartTime}
                        onChange={(event) => setManualStartTime(event.target.value)}
                      >
                        {TIME_OPTIONS.slice(0, -1).map((time) => (
                          <option key={time} value={time}>
                            {formatTime(time)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.formGroup}>
                      <span>End Time</span>
                      <select
                        className={styles.selectInput}
                        value={manualEndTime}
                        onChange={(event) => setManualEndTime(event.target.value)}
                      >
                        {TIME_OPTIONS.slice(1).map((time) => (
                          <option key={time} value={time}>
                            {formatTime(time)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.formGroup}>
                      <span>Mode</span>
                      <select
                        className={styles.selectInput}
                        value={manualConsultationMode}
                        onChange={(event) =>
                          setManualConsultationMode(
                            event.target.value as ManualConsultationMode
                          )
                        }
                      >
                        <option value="In-Person">In-Person</option>
                        <option value="Online Consultation">
                          Online Consultation
                        </option>
                      </select>
                    </label>
                  </div>

                  <div className={styles.modalFooter}>
                    <button
                      type="button"
                      className={styles.secondaryAction}
                      onClick={closeAssignModal}
                      disabled={assignLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.approveBtn}
                      disabled={assignLoading}
                      onClick={handleManualAssign}
                    >
                      {assignLoading ? "Assigning..." : "Use Manual Schedule"}
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {showApprovalModal && selectedAppointment && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>Approve Appointment</h2>
                  <p>
                    Review or edit the instruction that will be saved to the
                    patient record and optionally emailed.
                  </p>
                </div>

                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={closeApprovalModal}
                  disabled={actionLoading !== null}
                >
                  ×
                </button>
              </div>

              <div className={styles.modalBody}>
                <label className={styles.formGroup}>
                  <span>Patient Instruction</span>
                  <textarea
                    className={styles.textArea}
                    value={approvalInstruction}
                    onChange={(event) => setApprovalInstruction(event.target.value)}
                    rows={7}
                  />
                </label>

                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(event) => setSendEmail(event.target.checked)}
                  />
                  <span>Send approval email to patient</span>
                </label>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={closeApprovalModal}
                  disabled={actionLoading !== null}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={styles.approveBtn}
                  onClick={handleConfirmApproval}
                  disabled={actionLoading !== null}
                >
                  {actionLoading ? "Approving..." : "Approve Appointment"}
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedAppointment && modalAction && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>
                    {modalAction === "decline"
                      ? "Decline Appointment"
                      : modalAction === "no-show"
                      ? "Mark No-Show"
                      : "Cancel Appointment"}
                  </h2>
                  <p>
                    Provide a clear reason. This keeps the appointment history
                    accountable.
                  </p>
                </div>

                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={closeReasonModal}
                  disabled={actionLoading !== null}
                >
                  ×
                </button>
              </div>

              <div className={styles.modalBody}>
                <p>
                  <strong>{selectedAppointment.patient_name}</strong> •{" "}
                  {selectedAppointment.services}
                </p>

                <textarea
                  className={styles.textArea}
                  placeholder="Enter reason here"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={5}
                />
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={closeReasonModal}
                  disabled={actionLoading !== null}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={styles.cancelAppointmentBtn}
                  onClick={handleConfirmReasonAction}
                  disabled={actionLoading !== null}
                >
                  {actionLoading ? "Saving..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      </PortalShell>
    </div>
  );
}
