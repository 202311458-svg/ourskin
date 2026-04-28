"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import Calendar from "@/app/components/Calendar";
import styles from "@/app/styles/doctor.module.css";
import { API_BASE_URL } from "@/lib/api";
import {
  cancelDoctorAppointment,
  completeDoctorAppointmentWithReport,
  getAppointmentAnalyses,
  getAppointmentById,
  getAppointmentDiagnosisReport,
  getAppointmentLogs,
  getAppointmentPatientHistory,
  getDoctorAppointments,
  type Analysis,
  type Appointment,
  type AppointmentLog,
  type AppointmentPatientHistoryResponse,
  type CompleteDiagnosisPayload,
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

const emptyReportForm: CompleteDiagnosisPayload = {
  skin_analysis_id: null,
  doctor_final_diagnosis: "",
  doctor_prescription: "",
  after_appointment_notes: "",
  follow_up_plan: "",
  next_visit_date: "",
};

export default function DoctorAppointmentsPage() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeView, setActiveView] =
    useState<ActiveAppointmentView>("list");
  const [loading, setLoading] = useState(true);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentDetails | null>(null);
  const [appointmentLogs, setAppointmentLogs] = useState<AppointmentLog[]>([]);
  const [appointmentAnalyses, setAppointmentAnalyses] = useState<Analysis[]>(
    []
  );
  const [diagnosisReportData, setDiagnosisReportData] =
    useState<DiagnosisReportResponse | null>(null);
  const [patientHistoryData, setPatientHistoryData] =
    useState<AppointmentPatientHistoryResponse | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

  const [reportForm, setReportForm] =
    useState<CompleteDiagnosisPayload>(emptyReportForm);

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

  const handleFilterChange = (filter: string) => {
    if (filter === activeFilter) {
      return;
    }

    setActiveFilter(filter);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "doctor") {
      router.push("/");
      return;
    }

    loadAppointments(activeFilter);
  }, [router, activeFilter, loadAppointments]);

  const normalizeStatus = (status?: string) => (status || "").trim();

  const getDoctorActions = (status?: string) => {
    const normalized = normalizeStatus(status);

    if (normalized === "Approved") {
      return {
        primaryLabel: "Complete Report",
        canComplete: true,
        canCancel: true,
      };
    }

    if (normalized === "Completed") {
      return {
        primaryLabel: "View Report",
        canComplete: false,
        canCancel: false,
      };
    }

    return {
      primaryLabel: "View",
      canComplete: false,
      canCancel: false,
    };
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (normalizeStatus(status)) {
      case "Approved":
        return `${styles.statusBadge} ${styles.badgeApproved}`;
      case "Pending":
        return `${styles.statusBadge} ${styles.badgePending}`;
      case "Completed":
        return `${styles.statusBadge} ${styles.badgeCompleted}`;
      case "Declined":
      case "Cancelled":
        return `${styles.statusBadge} ${styles.badgeUrgent}`;
      default:
        return `${styles.statusBadge} ${styles.badgePending}`;
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "N/A";

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  };

  const formatPercent = (value?: number | null) => {
    if (typeof value !== "number") return "N/A";

    return `${Math.round(value * 100)}%`;
  };


const getAppointmentTimestamp = (appointment: Appointment) => {
  const datePart = appointment.date || "1900-01-01";
  const timePart = appointment.time || "00:00:00";

  const timestamp = new Date(`${datePart}T${timePart}`).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const sortedAppointments = useMemo(() => {
  return [...appointments].sort((a, b) => {
    return getAppointmentTimestamp(b) - getAppointmentTimestamp(a);
  });
}, [appointments]);

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


  const buildImageUrl = (path?: string | null) => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;

    return `${API_BASE_URL}${path}`;
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedAppointment(null);
    setAppointmentLogs([]);
    setAppointmentAnalyses([]);
    setDiagnosisReportData(null);
    setPatientHistoryData(null);
    setReportForm(emptyReportForm);
  };

  const openDetails = useCallback(async (appointmentId: number) => {
    try {
      setDetailsLoading(true);
      setDetailsOpen(true);

      const [
        appointmentData,
        logsData,
        analysesData,
        patientHistoryResult,
        diagnosisReportResult,
      ] = await Promise.all([
        getAppointmentById(appointmentId),
        getAppointmentLogs(appointmentId),
        getAppointmentAnalyses(appointmentId),
        getAppointmentPatientHistory(appointmentId).catch(() => null),
        getAppointmentDiagnosisReport(appointmentId).catch(() => null),
      ]);

      const latestAnalysisId =
        Array.isArray(analysesData) && analysesData.length > 0
          ? analysesData[0].id
          : null;

      setSelectedAppointment(appointmentData);
      setAppointmentLogs(Array.isArray(logsData) ? logsData : []);
      setAppointmentAnalyses(Array.isArray(analysesData) ? analysesData : []);
      setPatientHistoryData(patientHistoryResult);
      setDiagnosisReportData(diagnosisReportResult);

      if (diagnosisReportResult?.report) {
        setReportForm({
          skin_analysis_id:
            diagnosisReportResult.report.skin_analysis_id ?? latestAnalysisId,
          doctor_final_diagnosis:
            diagnosisReportResult.report.doctor_final_diagnosis ?? "",
          doctor_prescription:
            diagnosisReportResult.report.doctor_prescription ?? "",
          after_appointment_notes:
            diagnosisReportResult.report.after_appointment_notes ?? "",
          follow_up_plan: diagnosisReportResult.report.follow_up_plan ?? "",
          next_visit_date: diagnosisReportResult.report.next_visit_date ?? "",
        });
      } else {
        setReportForm({
          ...emptyReportForm,
          skin_analysis_id: latestAnalysisId,
        });
      }
    } catch (error) {
      console.error("Failed to open details:", error);
      alert(error instanceof Error ? error.message : "Failed to load details");
      closeDetails();
    } finally {
      setDetailsLoading(false);
    }
  }, []);

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

  const handleReportFieldChange = (
    field: keyof CompleteDiagnosisPayload,
    value: string | number | null
  ) => {
    setReportForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCompleteWithReport = async () => {
    try {
      if (!selectedAppointment) {
        alert("No appointment selected.");
        return;
      }

      if (selectedAppointment.status !== "Approved") {
        alert("Only approved appointments can be completed with a diagnosis report.");
        return;
      }

      if (!reportForm.doctor_final_diagnosis?.trim()) {
        alert("Final diagnosis is required.");
        return;
      }

      setSubmittingReport(true);

      await completeDoctorAppointmentWithReport(selectedAppointment.id, {
        skin_analysis_id: reportForm.skin_analysis_id || null,
        doctor_final_diagnosis: reportForm.doctor_final_diagnosis.trim(),
        doctor_prescription: reportForm.doctor_prescription?.trim() || "",
        after_appointment_notes:
          reportForm.after_appointment_notes?.trim() || "",
        follow_up_plan: reportForm.follow_up_plan?.trim() || "",
        next_visit_date: reportForm.next_visit_date || null,
      });

      await loadAppointments(activeFilter);
      setCalendarRefreshKey((prev) => prev + 1);
      await openDetails(selectedAppointment.id);

      alert("Appointment completed with diagnosis report successfully.");
    } catch (error) {
      console.error("Failed to complete appointment with report:", error);
      alert(
        error instanceof Error ? error.message : "Failed to complete appointment"
      );
    } finally {
      setSubmittingReport(false);
    }
  };

  const previousReports = useMemo(() => {
    const reports = patientHistoryData?.previous_reports ?? [];

    if (!selectedAppointment) {
      return reports;
    }

    return reports.filter(
      (item) => item.report.appointment_id !== selectedAppointment.id
    );
  }, [patientHistoryData, selectedAppointment]);

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
            Review consultations, see previous diagnosis history, and complete
            visits with a full diagnosis report.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveView("list")}
            className={`${styles.filterChip} ${
              activeView === "list" ? styles.activeChip : ""
            }`}
          >
            Appointment List
          </button>

          <button
            type="button"
            onClick={() => setActiveView("calendar")}
            className={`${styles.filterChip} ${
              activeView === "calendar" ? styles.activeChip : ""
            }`}
          >
            Calendar View
          </button>
        </div>

        {activeView === "list" && (
          <section
            className={`${styles.sectionCard} ${styles.appointmentListSection}`}
          >
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Appointment List</h2>
            </div>

            <div className={styles.filterRowInside}>
              {filters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`${styles.filterChip} ${
                    activeFilter === filter ? styles.activeChip : ""
                  }`}
                  onClick={() => handleFilterChange(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>

            {loading ? (
              <div className={styles.emptyState}>Loading appointments...</div>
            ) : sortedAppointments.length === 0 ? (
              <div className={styles.emptyState}>No appointments found.</div>
            ) : (
              <div className={styles.doctorAppointmentsList}>
  {sortedAppointments.map((appt) => (
    <article key={appt.id} className={styles.doctorAppointmentCard}>
      <div className={styles.doctorAppointmentTop}>
        <div>
          <h3>{appt.patient_name || "Unknown Patient"}</h3>
          <p>
            {appt.patient_email || "No email provided"}
          </p>
        </div>

        <span className={getStatusBadgeClass(appt.status)}>
          {appt.status || "Pending"}
        </span>
      </div>

      <div className={styles.doctorAppointmentDetails}>
        <div className={styles.doctorAppointmentInfoBox}>
          <span>Date</span>
          <strong>{appt.date || "No date"}</strong>
        </div>

        <div className={styles.doctorAppointmentInfoBox}>
          <span>Time</span>
          <strong>{appt.time || "No time"}</strong>
        </div>

        <div className={styles.doctorAppointmentInfoBox}>
          <span>Service</span>
          <strong>{appt.services || "No service listed"}</strong>
        </div>

        <div className={styles.doctorAppointmentInfoBox}>
          <span>Doctor</span>
          <strong>{appt.doctor_name || "Not assigned"}</strong>
        </div>

        {(appt.cancel_reason || appt.status === "Cancelled" || appt.status === "Declined") && (
          <div className={`${styles.doctorAppointmentInfoBox} ${styles.fullWidth}`}>
            <span>Reason / Notes</span>
            <strong>{appt.cancel_reason || "No reason provided"}</strong>
          </div>
        )}
      </div>

      <div className={styles.doctorAppointmentFooter}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => openDetails(appt.id)}
        >
          View
        </button>

        {appt.status === "Approved" && (
          <>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => openDetails(appt.id)}
            >
              Complete
            </button>

            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => handleCancel(appt.id)}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </article>
  ))}
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
          <div className={styles.modalOverlay}>
            <div className={styles.modalPanel}>
              <div className={styles.modalHeader}>
                <div>
                  <h3 className={styles.modalTitle}>Appointment Details</h3>
                  <p className={styles.modalSubtitle}>
                    Review the appointment, AI output, and patient history
                    before making clinical decisions.
                  </p>
                </div>

                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={closeDetails}
                >
                  Close
                </button>
              </div>

              <div className={styles.modalContent}>
                {detailsLoading || !selectedAppointment ? (
                  <div className={styles.emptyState}>Loading details...</div>
                ) : (
                  <>
                    <section className={styles.modalSection}>
                      <h4 className={styles.modalSectionTitle}>
                        Appointment Summary
                      </h4>

                      <div className={styles.modalGrid}>
                        <div className={styles.infoCard}>
                          <p className={styles.infoLabel}>Patient</p>
                          <p className={styles.infoValue}>
                            {selectedAppointment.patient_name}
                          </p>
                        </div>

                        <div className={styles.infoCard}>
                          <p className={styles.infoLabel}>Doctor</p>
                          <p className={styles.infoValue}>
                            {selectedAppointment.doctor_name}
                          </p>
                        </div>

                        <div className={styles.infoCard}>
                          <p className={styles.infoLabel}>Date</p>
                          <p className={styles.infoValue}>
                            {selectedAppointment.date}
                          </p>
                        </div>

                        <div className={styles.infoCard}>
                          <p className={styles.infoLabel}>Time</p>
                          <p className={styles.infoValue}>
                            {selectedAppointment.time}
                          </p>
                        </div>

                        <div className={styles.infoCard}>
                          <p className={styles.infoLabel}>Service</p>
                          <p className={styles.infoValue}>
                            {selectedAppointment.services}
                          </p>
                        </div>

                        <div className={styles.infoCard}>
                          <p className={styles.infoLabel}>Status</p>
                          <p className={styles.infoValue}>
                            <span
                              className={getStatusBadgeClass(
                                selectedAppointment.status
                              )}
                            >
                              {selectedAppointment.status}
                            </span>
                          </p>
                        </div>
                      </div>

                      {selectedAppointment.cancel_reason && (
                        <div className={styles.notePanel}>
                          <p className={styles.infoLabel}>
                            Cancellation Reason
                          </p>
                          <p className={styles.infoValue}>
                            {selectedAppointment.cancel_reason}
                          </p>
                        </div>
                      )}
                    </section>

                    <section className={styles.modalSection}>
                      <h4 className={styles.modalSectionTitle}>
                        Previous Diagnosis Reports
                      </h4>

                      {!patientHistoryData || previousReports.length === 0 ? (
                        <div className={styles.emptyState}>
                          No previous diagnosis reports found for this patient.
                        </div>
                      ) : (
                        <div className={styles.stackList}>
                          {previousReports.map((item) => (
                            <div
                              key={item.report.id}
                              className={styles.stackCard}
                            >
                              <div className={styles.stackCardHeader}>
                                <div>
                                  <p className={styles.cardTitle}>
                                    {item.appointment?.date || "Unknown date"} •{" "}
                                    {item.appointment?.services ||
                                      "Previous consultation"}
                                  </p>
                                  <p className={styles.cardMeta}>
                                    Doctor: {item.doctor?.name || "Unknown"}
                                  </p>
                                </div>

                                <span
                                  className={`${styles.statusBadge} ${styles.badgeCompleted}`}
                                >
                                  Completed
                                </span>
                              </div>

                              <div className={styles.stackCardBody}>
                                <p>
                                  <strong>Final Diagnosis:</strong>{" "}
                                  {item.report.doctor_final_diagnosis || "N/A"}
                                </p>
                                <p>
                                  <strong>Prescription:</strong>{" "}
                                  {item.report.doctor_prescription || "N/A"}
                                </p>
                                <p>
                                  <strong>After Notes:</strong>{" "}
                                  {item.report.after_appointment_notes || "N/A"}
                                </p>
                                <p>
                                  <strong>Follow-up Plan:</strong>{" "}
                                  {item.report.follow_up_plan || "N/A"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className={styles.modalSection}>
                      <h4 className={styles.modalSectionTitle}>AI Analyses</h4>

                      {appointmentAnalyses.length === 0 ? (
                        <div className={styles.emptyState}>
                          No AI analyses found for this appointment yet.
                        </div>
                      ) : (
                        <div className={styles.stackList}>
                          {appointmentAnalyses.map((analysis) => (
                            <div
                              key={analysis.id}
                              className={styles.stackCard}
                            >
                              <div className={styles.stackCardHeader}>
                                <div>
                                  <p className={styles.cardTitle}>
                                    {analysis.condition} • {analysis.severity}
                                  </p>
                                  <p className={styles.cardMeta}>
                                    Confidence:{" "}
                                    {formatPercent(analysis.confidence)} •{" "}
                                    {analysis.review_status}
                                  </p>
                                </div>

                                <span
                                  className={
                                    analysis.review_status === "Reviewed"
                                      ? `${styles.statusBadge} ${styles.badgeCompleted}`
                                      : `${styles.statusBadge} ${styles.badgePending}`
                                  }
                                >
                                  {analysis.review_status}
                                </span>
                              </div>

                              {analysis.image_path && (
                                <img
                                  src={buildImageUrl(analysis.image_path)}
                                  alt={`Analysis ${analysis.id}`}
                                  className={styles.analysisImage}
                                />
                              )}

                              <div className={styles.stackCardBody}>
                                <p>
                                  <strong>Recommendation:</strong>{" "}
                                  {analysis.recommendation || "N/A"}
                                </p>
                                <p>
                                  <strong>Possible Conditions:</strong>{" "}
                                  {analysis.possible_conditions || "N/A"}
                                </p>
                                <p>
                                  <strong>Key Findings:</strong>{" "}
                                  {analysis.key_findings || "N/A"}
                                </p>
                                <p>
                                  <strong>Treatment Suggestions:</strong>{" "}
                                  {analysis.treatment_suggestions || "N/A"}
                                </p>
                                <p>
                                  <strong>Prescription Suggestions:</strong>{" "}
                                  {analysis.prescription_suggestions || "N/A"}
                                </p>
                                <p>
                                  <strong>Follow-up Suggestions:</strong>{" "}
                                  {analysis.follow_up_suggestions || "N/A"}
                                </p>
                                <p>
                                  <strong>Red Flags:</strong>{" "}
                                  {analysis.red_flags || "N/A"}
                                </p>
                                <p>
                                  <strong>Doctor Note:</strong>{" "}
                                  {analysis.doctor_note ||
                                    "No doctor note yet"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    {diagnosisReportData?.report && (
                      <section className={styles.modalSection}>
                        <h4 className={styles.modalSectionTitle}>
                          Diagnosis Report
                        </h4>

                        <div className={styles.reportCard}>
                          <div className={styles.reportGrid}>
                            <div className={styles.infoCard}>
                              <p className={styles.infoLabel}>
                                Final Diagnosis
                              </p>
                              <p className={styles.infoValue}>
                                {diagnosisReportData.report
                                  .doctor_final_diagnosis || "N/A"}
                              </p>
                            </div>

                            <div className={styles.infoCard}>
                              <p className={styles.infoLabel}>
                                Next Visit Date
                              </p>
                              <p className={styles.infoValue}>
                                {diagnosisReportData.report.next_visit_date ||
                                  "N/A"}
                              </p>
                            </div>

                            <div className={styles.infoCard}>
                              <p className={styles.infoLabel}>Prescription</p>
                              <p className={styles.infoValue}>
                                {diagnosisReportData.report
                                  .doctor_prescription || "N/A"}
                              </p>
                            </div>

                            <div className={styles.infoCard}>
                              <p className={styles.infoLabel}>
                                Follow-up Plan
                              </p>
                              <p className={styles.infoValue}>
                                {diagnosisReportData.report.follow_up_plan ||
                                  "N/A"}
                              </p>
                            </div>
                          </div>

                          <div className={styles.notePanel}>
                            <p className={styles.infoLabel}>
                              After Appointment Notes
                            </p>
                            <p className={styles.infoValue}>
                              {diagnosisReportData.report
                                .after_appointment_notes || "N/A"}
                            </p>
                          </div>
                        </div>
                      </section>
                    )}

                    {selectedAppointment.status === "Approved" &&
                      !diagnosisReportData?.report && (
                        <section className={styles.modalSection}>
                          <h4 className={styles.modalSectionTitle}>
                            Complete Appointment with Diagnosis Report
                          </h4>

                          <div className={styles.formGrid}>
                            <div className={styles.inputGroup}>
                              <label htmlFor="skin_analysis_id">
                                Linked AI Analysis
                              </label>
                              <select
                                id="skin_analysis_id"
                                className={styles.select}
                                value={reportForm.skin_analysis_id ?? ""}
                                onChange={(e) =>
                                  handleReportFieldChange(
                                    "skin_analysis_id",
                                    e.target.value
                                      ? Number(e.target.value)
                                      : null
                                  )
                                }
                              >
                                <option value="">No linked analysis</option>
                                {appointmentAnalyses.map((analysis) => (
                                  <option key={analysis.id} value={analysis.id}>
                                    #{analysis.id} • {analysis.condition} •{" "}
                                    {analysis.severity}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className={styles.inputGroup}>
                              <label htmlFor="next_visit_date">
                                Next Visit Date
                              </label>
                              <input
                                id="next_visit_date"
                                type="date"
                                className={styles.input}
                                value={reportForm.next_visit_date ?? ""}
                                onChange={(e) =>
                                  handleReportFieldChange(
                                    "next_visit_date",
                                    e.target.value
                                  )
                                }
                              />
                            </div>

                            <div
                              className={`${styles.inputGroup} ${styles.fullWidth}`}
                            >
                              <label htmlFor="doctor_final_diagnosis">
                                Final Diagnosis
                              </label>
                              <textarea
                                id="doctor_final_diagnosis"
                                className={styles.textarea}
                                value={reportForm.doctor_final_diagnosis}
                                onChange={(e) =>
                                  handleReportFieldChange(
                                    "doctor_final_diagnosis",
                                    e.target.value
                                  )
                                }
                                placeholder="Enter the doctor's final diagnosis"
                              />
                            </div>

                            <div
                              className={`${styles.inputGroup} ${styles.fullWidth}`}
                            >
                              <label htmlFor="doctor_prescription">
                                Prescription
                              </label>
                              <textarea
                                id="doctor_prescription"
                                className={styles.textarea}
                                value={reportForm.doctor_prescription ?? ""}
                                onChange={(e) =>
                                  handleReportFieldChange(
                                    "doctor_prescription",
                                    e.target.value
                                  )
                                }
                                placeholder="Enter prescription details"
                              />
                            </div>

                            <div
                              className={`${styles.inputGroup} ${styles.fullWidth}`}
                            >
                              <label htmlFor="after_appointment_notes">
                                After Appointment Notes
                              </label>
                              <textarea
                                id="after_appointment_notes"
                                className={styles.textarea}
                                value={reportForm.after_appointment_notes ?? ""}
                                onChange={(e) =>
                                  handleReportFieldChange(
                                    "after_appointment_notes",
                                    e.target.value
                                  )
                                }
                                placeholder="Enter after appointment notes"
                              />
                            </div>

                            <div
                              className={`${styles.inputGroup} ${styles.fullWidth}`}
                            >
                              <label htmlFor="follow_up_plan">
                                Follow-up Plan
                              </label>
                              <textarea
                                id="follow_up_plan"
                                className={styles.textarea}
                                value={reportForm.follow_up_plan ?? ""}
                                onChange={(e) =>
                                  handleReportFieldChange(
                                    "follow_up_plan",
                                    e.target.value
                                  )
                                }
                                placeholder="Enter follow-up plan"
                              />
                            </div>
                          </div>

                          <div className={styles.buttonRow}>
                            <button
                              type="button"
                              className={styles.saveButton}
                              onClick={handleCompleteWithReport}
                              disabled={submittingReport}
                            >
                              {submittingReport
                                ? "Saving..."
                                : "Complete Appointment"}
                            </button>

                            <button
                              type="button"
                              className={styles.dangerButton}
                              onClick={() => handleCancel(selectedAppointment.id)}
                              disabled={submittingReport}
                            >
                              Cancel Appointment
                            </button>
                          </div>
                        </section>
                      )}

                    <section className={styles.modalSection}>
                      <h4 className={styles.modalSectionTitle}>Activity Log</h4>

                      {appointmentLogs.length === 0 ? (
                        <div className={styles.emptyState}>
                          No activity log found.
                        </div>
                      ) : (
                        <div className={styles.stackList}>
                          {appointmentLogs.map((log) => (
                            <div key={log.id} className={styles.stackCard}>
                              <div className={styles.stackCardHeader}>
                                <p className={styles.cardTitle}>
                                  {log.action}
                                </p>
                                <p className={styles.cardMeta}>
                                  {formatDateTime(log.created_at)}
                                </p>
                              </div>

                              <div className={styles.stackCardBody}>
                                <p>
                                  <strong>By:</strong>{" "}
                                  {log.performed_by_name} (
                                  {log.performed_by_role})
                                </p>
                                {log.reason && (
                                  <p>
                                    <strong>Reason:</strong> {log.reason}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}