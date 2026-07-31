"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import Calendar from "@/app/components/Calendar";
import sharedStyles from "@/app/styles/doctor-shared.module.css";
import appointmentStyles from "@/app/styles/doctor-appointments.module.css";
import {
  cancelDoctorAppointment,
  getAppointmentById,
  getAppointmentDiagnosisReport,
  getDoctorAppointments,
  type Appointment,
  type DiagnosisReportResponse,
} from "@/lib/doctor-api";

const filters = [
  "All",
  "Pending",
  "Approved",
  "Completed",
  "Declined",
  "Cancelled",
];

type ActiveAppointmentView = "list" | "calendar";

type AppointmentDetails = Appointment & {
  cancel_reason?: string | null;
};

const getAppointmentDateTime = (
  appointment: Pick<Appointment, "date" | "time">
) => {
  const datePart = appointment.date || "1900-01-01";
  const timePart = appointment.time || "00:00:00";
  const date = new Date(`${datePart}T${timePart}`);

  return Number.isNaN(date.getTime()) ? null : date;
};

const getAppointmentTimestamp = (
  appointment: Pick<Appointment, "date" | "time">
) => {
  return getAppointmentDateTime(appointment)?.getTime() ?? 0;
};

const hasAppointmentDateTimePassed = (
  appointment: Pick<Appointment, "date" | "time">
) => {
  const appointmentDateTime = getAppointmentDateTime(appointment);

  if (!appointmentDateTime) return false;

  return appointmentDateTime.getTime() <= Date.now();
};

const canCompleteAppointment = (
  appointment: Appointment | AppointmentDetails | null
) => {
  if (!appointment) return false;

  return (
    (appointment.status || "").trim() === "Approved" &&
    hasAppointmentDateTimePassed(appointment)
  );
};

const formatDate = (value?: string | null) => {
  if (!value) return "N/A";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatTime = (timeValue?: string | null) => {
  if (!timeValue) return "N/A";

  const [hour, minute] = timeValue.split(":");

  if (!hour || !minute) return timeValue;

  const date = new Date();
  date.setHours(Number(hour), Number(minute), 0, 0);

  if (Number.isNaN(date.getTime())) return timeValue;

  return date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatAppointmentSchedule = (
  appointment: Pick<Appointment, "date" | "time">
) => {
  const date = getAppointmentDateTime(appointment);

  if (!date) {
    return `${appointment.date || "No date"} ${appointment.time || ""}`.trim();
  }

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function DoctorAppointmentsPage() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeView, setActiveView] = useState<ActiveAppointmentView>("list");
  const [loading, setLoading] = useState(true);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentDetails | null>(null);
  const [diagnosisReportData, setDiagnosisReportData] =
    useState<DiagnosisReportResponse | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

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

  const normalizeStatus = (status?: string | null) => (status || "").trim();

  const getStatusBadgeClass = (status?: string | null) => {
    switch (normalizeStatus(status)) {
      case "Approved":
        return `${sharedStyles.statusBadge} ${sharedStyles.badgeApproved}`;
      case "Pending":
        return `${sharedStyles.statusBadge} ${sharedStyles.badgePending}`;
      case "Completed":
        return `${sharedStyles.statusBadge} ${sharedStyles.badgeCompleted}`;
      case "Declined":
      case "Cancelled":
        return `${sharedStyles.statusBadge} ${sharedStyles.badgeUrgent}`;
      default:
        return `${sharedStyles.statusBadge} ${sharedStyles.badgePending}`;
    }
  };

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const aStatus = normalizeStatus(a.status);
      const bStatus = normalizeStatus(b.status);

      const aCompleted = aStatus === "Completed";
      const bCompleted = bStatus === "Completed";

      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }

      return getAppointmentTimestamp(b) - getAppointmentTimestamp(a);
    });
  }, [appointments]);

  const approvedReadyCount = useMemo(() => {
    return appointments.filter((item) => canCompleteAppointment(item)).length;
  }, [appointments]);

  const approvedFutureCount = useMemo(() => {
    return appointments.filter(
      (item) =>
        normalizeStatus(item.status) === "Approved" &&
        !hasAppointmentDateTimePassed(item)
    ).length;
  }, [appointments]);

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedAppointment(null);
    setDiagnosisReportData(null);
  };

  const openDetails = useCallback(async (appointmentId: number) => {
    try {
      setDetailsLoading(true);
      setDetailsOpen(true);
      setDiagnosisReportData(null);

      const [appointmentData, diagnosisReportResult] = await Promise.all([
        getAppointmentById(appointmentId),
        getAppointmentDiagnosisReport(appointmentId).catch(() => null),
      ]);

      setSelectedAppointment(appointmentData);
      setDiagnosisReportData(diagnosisReportResult);
    } catch (error) {
      console.error("Failed to open details:", error);
      alert(error instanceof Error ? error.message : "Failed to load details");
      closeDetails();
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const openPatientMedicalRecords = (appointment: Appointment | null) => {
    if (!appointment?.patient_id) {
      alert("This appointment has no linked patient record.");
      return;
    }

    const params = new URLSearchParams({
      patient_id: String(appointment.patient_id),
    });

    if (appointment.patient_name) {
      params.set("patient", appointment.patient_name);
    }

    router.push(`/pages/doctor/patient-records?${params.toString()}`);
  };

  const openAiAnalysisWorkspace = (appointment: Appointment) => {
    if (!appointment.patient_id) {
      alert("This appointment has no linked patient record.");
      return;
    }

    router.push(
      `/pages/doctor/ai-analysis?patient_id=${appointment.patient_id}&appointment_id=${appointment.id}`
    );
  };

  const handleCancel = async (appointmentId: number) => {
    try {
      const appointment = appointments.find((item) => item.id === appointmentId);

      if (!appointment) {
        alert("Appointment not found.");
        return;
      }

      if (appointment.status !== "Approved") {
        alert("Doctors can only cancel approved appointments.");
        return;
      }

      const reason = window.prompt("Enter cancellation reason:");

      if (!reason || !reason.trim()) {
        return;
      }

      await cancelDoctorAppointment(appointmentId, reason.trim());
      await loadAppointments(activeFilter);
      setCalendarRefreshKey((prev) => prev + 1);

      if (detailsOpen && selectedAppointment?.id === appointmentId) {
        await openDetails(appointmentId);
      }
    } catch (error) {
      console.error("Failed to cancel appointment:", error);
      alert(
        error instanceof Error ? error.message : "Failed to cancel appointment"
      );
    }
  };

  const calendarStatusFilter =
    activeFilter === "Approved" || activeFilter === "Pending"
      ? activeFilter
      : "All";

  const selectedCanComplete = canCompleteAppointment(selectedAppointment);
  const selectedFollowUpDate = diagnosisReportData?.report?.next_visit_date;

  return (
    <>
      <DoctorNavbar />

      <main className={sharedStyles.pageWrapper}>
        <div className={sharedStyles.headerSection}>
          <div>
            <h1 className={sharedStyles.pageTitle}>Appointments</h1>
            <p className={sharedStyles.pageSubtitle}>
              Review appointment details and continue clinical work from the
              patient record or AI analysis workspace.
            </p>
          </div>
        </div>

        <section className={`${sharedStyles.sectionCard} ${sharedStyles.statsGrid}`}>
          <div className={`${sharedStyles.statCard} ${sharedStyles.statCardPink}`}>
            <p className={sharedStyles.listSecondary}>Total Appointments</p>
            <h2>{appointments.length}</h2>
          </div>

          <div className={`${sharedStyles.statCard} ${sharedStyles.statCardGreen}`}>
            <p className={sharedStyles.listSecondary}>Ready to Complete</p>
            <h2>{approvedReadyCount}</h2>
          </div>

          <div className={`${sharedStyles.statCard} ${sharedStyles.statCardBlue}`}>
            <p className={sharedStyles.listSecondary}>Approved, Not Yet Due</p>
            <h2>{approvedFutureCount}</h2>
          </div>
        </section>

        <div className={appointmentStyles.filtersRow}>
          <button
            type="button"
            onClick={() => setActiveView("list")}
            className={`${appointmentStyles.filterChip} ${
              activeView === "list" ? appointmentStyles.activeChip : ""
            }`}
          >
            Appointment List
          </button>

          <button
            type="button"
            onClick={() => setActiveView("calendar")}
            className={`${appointmentStyles.filterChip} ${
              activeView === "calendar" ? appointmentStyles.activeChip : ""
            }`}
          >
            Calendar View
          </button>
        </div>

        {activeView === "list" && (
          <section
            className={`${sharedStyles.sectionCard} ${appointmentStyles.appointmentListSection}`}
          >
            <div className={sharedStyles.sectionHeader}>
              <div>
                <h2 className={sharedStyles.sectionTitle}>Appointment List</h2>
                <p className={`${sharedStyles.pageSubtitle} ${sharedStyles.pageSubtitleSpaced}`}>
                  The Complete action opens the AI Analysis workspace only when
                  the approved appointment has already started.
                </p>
              </div>
            </div>

            <div className={appointmentStyles.filterRowInside}>
              {filters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`${appointmentStyles.filterChip} ${
                    activeFilter === filter ? appointmentStyles.activeChip : ""
                  }`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>

            {loading ? (
              <div className={sharedStyles.emptyState}>Loading appointments...</div>
            ) : sortedAppointments.length === 0 ? (
              <div className={sharedStyles.emptyState}>No appointments found.</div>
            ) : (
              <div className={appointmentStyles.doctorAppointmentsList}>
                {sortedAppointments.map((appt) => {
                  const apptStatus = normalizeStatus(appt.status);
                  const isApproved = apptStatus === "Approved";
                  const readyToComplete = canCompleteAppointment(appt);
                  const isFutureApproved =
                    isApproved && !hasAppointmentDateTimePassed(appt);

                  return (
                    <article key={appt.id} className={appointmentStyles.doctorAppointmentCard}>
                      <div className={appointmentStyles.doctorAppointmentTop}>
                        <div>
                          <h3>{appt.patient_name || "Unknown Patient"}</h3>
                          <p>{appt.patient_email || "No email provided"}</p>
                        </div>

                        <span className={getStatusBadgeClass(appt.status)}>
                          {appt.status || "Pending"}
                        </span>
                      </div>

                      <div className={appointmentStyles.doctorAppointmentDetails}>
                        <div className={appointmentStyles.doctorAppointmentInfoBox}>
                          <span>Date</span>
                          <strong>{formatDate(appt.date)}</strong>
                        </div>

                        <div className={appointmentStyles.doctorAppointmentInfoBox}>
                          <span>Time</span>
                          <strong>{formatTime(appt.time)}</strong>
                        </div>

                        <div className={appointmentStyles.doctorAppointmentInfoBox}>
                          <span>Service</span>
                          <strong>{appt.services || "No service listed"}</strong>
                        </div>

                        <div className={appointmentStyles.doctorAppointmentInfoBox}>
                          <span>Doctor</span>
                          <strong>{appt.doctor_name || "Not assigned"}</strong>
                        </div>

                        {isFutureApproved && (
                          <div
                            className={`${appointmentStyles.doctorAppointmentInfoBox} ${sharedStyles.fullWidth}`}
                          >
                            <span>Completion Availability</span>
                            <strong>
                              Available on {formatAppointmentSchedule(appt)}
                            </strong>
                          </div>
                        )}

                        {(appt.cancel_reason ||
                          appt.status === "Cancelled" ||
                          appt.status === "Declined") && (
                          <div
                            className={`${appointmentStyles.doctorAppointmentInfoBox} ${sharedStyles.fullWidth}`}
                          >
                            <span>Reason / Notes</span>
                            <strong>
                              {appt.cancel_reason || "No reason provided"}
                            </strong>
                          </div>
                        )}
                      </div>

                      <div className={appointmentStyles.doctorAppointmentFooter}>
                        <button
                          type="button"
                          className={sharedStyles.secondaryButton}
                          onClick={() => openDetails(appt.id)}
                        >
                          View
                        </button>

                        {readyToComplete && (
                          <button
                            type="button"
                            className={sharedStyles.actionButton}
                            onClick={() => openAiAnalysisWorkspace(appt)}
                          >
                            Complete
                          </button>
                        )}

                        {isFutureApproved && (
                          <span className={sharedStyles.availabilityBadge}>
                            Complete later
                          </span>
                        )}

                        {isApproved && (
                          <button
                            type="button"
                            className={appointmentStyles.dangerButton}
                            onClick={() => handleCancel(appt.id)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeView === "calendar" && (
          <Calendar
            mode="full"
            statusFilter={calendarStatusFilter}
            refreshKey={calendarRefreshKey}
            onUpdated={() => loadAppointments(activeFilter)}
          />
        )}

        {detailsOpen && (
          <div className={appointmentStyles.modalOverlay}>
            <div className={appointmentStyles.modalPanel}>
              <div className={appointmentStyles.modalHeader}>
                <div>
                  <h3 className={appointmentStyles.modalTitle}>Appointment Details</h3>
                  <p className={appointmentStyles.modalSubtitle}>
                    View the selected appointment information and open the
                    patient medical records when clinical history is needed.
                  </p>
                </div>

                <button
                  type="button"
                  className={sharedStyles.secondaryButton}
                  onClick={closeDetails}
                >
                  Close
                </button>
              </div>

              <div className={appointmentStyles.modalContent}>
                {detailsLoading || !selectedAppointment ? (
                  <div className={sharedStyles.emptyState}>Loading details...</div>
                ) : (
                  <section className={appointmentStyles.modalSection}>
                    <div className={appointmentStyles.modalSummaryHeader}>
                      <div>
                        <h4 className={appointmentStyles.modalSectionTitle}>
                          Appointment Summary
                        </h4>
                        <p className={`${sharedStyles.pageSubtitle} ${sharedStyles.pageSubtitleSpaced}`}>
                          This view only shows appointment details. Use Medical
                          Records to review clinical history.
                        </p>
                      </div>

                      <span className={getStatusBadgeClass(selectedAppointment.status)}>
                        {selectedAppointment.status || "Pending"}
                      </span>
                    </div>

                    <div className={appointmentStyles.modalGrid}>
                      <div className={appointmentStyles.infoCard}>
                        <p className={appointmentStyles.infoLabel}>Appointment ID</p>
                        <p className={appointmentStyles.infoValue}>#{selectedAppointment.id}</p>
                      </div>

                      <div className={appointmentStyles.infoCard}>
                        <p className={appointmentStyles.infoLabel}>Patient</p>
                        <p className={appointmentStyles.infoValue}>
                          {selectedAppointment.patient_name || "N/A"}
                        </p>
                      </div>

                      <div className={appointmentStyles.infoCard}>
                        <p className={appointmentStyles.infoLabel}>Email</p>
                        <p className={appointmentStyles.infoValue}>
                          {selectedAppointment.patient_email || "N/A"}
                        </p>
                      </div>

                      <div className={appointmentStyles.infoCard}>
                        <p className={appointmentStyles.infoLabel}>Doctor</p>
                        <p className={appointmentStyles.infoValue}>
                          {selectedAppointment.doctor_name || "N/A"}
                        </p>
                      </div>

                      <div className={appointmentStyles.infoCard}>
                        <p className={appointmentStyles.infoLabel}>Date</p>
                        <p className={appointmentStyles.infoValue}>
                          {formatDate(selectedAppointment.date)}
                        </p>
                      </div>

                      <div className={appointmentStyles.infoCard}>
                        <p className={appointmentStyles.infoLabel}>Time</p>
                        <p className={appointmentStyles.infoValue}>
                          {formatTime(selectedAppointment.time)}
                        </p>
                      </div>

                      <div className={appointmentStyles.infoCard}>
                        <p className={appointmentStyles.infoLabel}>Service</p>
                        <p className={appointmentStyles.infoValue}>
                          {selectedAppointment.services || "Consultation"}
                        </p>
                      </div>

                      <div className={appointmentStyles.infoCard}>
                        <p className={appointmentStyles.infoLabel}>Completion Availability</p>
                        <p className={appointmentStyles.infoValue}>
                          {selectedCanComplete
                            ? "Available now"
                            : selectedAppointment.status === "Approved"
                            ? `Available on ${formatAppointmentSchedule(
                                selectedAppointment
                              )}`
                            : "Not available for this status"}
                        </p>
                      </div>

                      <div className={appointmentStyles.infoCard}>
                        <p className={appointmentStyles.infoLabel}>Follow-Up Date</p>
                        <p className={appointmentStyles.infoValue}>
                          {selectedFollowUpDate
                            ? formatDate(selectedFollowUpDate)
                            : "No follow-up date recorded"}
                        </p>
                      </div>
                    </div>

                    {selectedAppointment.cancel_reason && (
                      <div className={`${appointmentStyles.notePanel} ${appointmentStyles.notePanelSpaced}`}>
                        <p className={appointmentStyles.infoLabel}>Cancellation Reason</p>
                        <p className={appointmentStyles.infoValue}>
                          {selectedAppointment.cancel_reason}
                        </p>
                      </div>
                    )}

                    <div className={`${appointmentStyles.buttonRow} ${appointmentStyles.modalActionRow}`}>
                      <button
                        type="button"
                        className={sharedStyles.secondaryButton}
                        onClick={() => openPatientMedicalRecords(selectedAppointment)}
                      >
                        Open Patient Medical Records
                      </button>

                      {selectedCanComplete && (
                        <button
                          type="button"
                          className={sharedStyles.actionButton}
                          onClick={() => openAiAnalysisWorkspace(selectedAppointment)}
                        >
                          Continue in AI Analysis
                        </button>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
