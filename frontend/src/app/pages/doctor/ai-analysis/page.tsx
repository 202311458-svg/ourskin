"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import styles from "@/app/styles/doctor.module.css";
import { API_BASE_URL } from "@/lib/api";
import {
  analyzeAppointmentSkin,
  getAppointmentAnalyses,
  getDoctorAppointments,
  getDoctorPatientHistory,
  getDoctorPatients,
  reviewAnalysis,
  type Analysis,
  type Appointment,
  type DoctorPatientHistoryResponse,
  type DoctorPatientListItem,
} from "@/lib/doctor-api";

type AiTab = "analysis" | "report" | "history";

const sortAppointmentsDesc = (items: Appointment[]) => {
  return [...items].sort((a, b) => {
    const aDate = new Date(`${a.date}T${a.time || "00:00:00"}`).getTime();
    const bDate = new Date(`${b.date}T${b.time || "00:00:00"}`).getTime();
    return bDate - aDate;
  });
};

const pickBestTargetAppointment = (items: Appointment[]) => {
  const approved = sortAppointmentsDesc(
    items.filter((item) => item.status === "Approved")
  );
  if (approved.length > 0) return approved[0];

  const completed = sortAppointmentsDesc(
    items.filter((item) => item.status === "Completed")
  );
  if (completed.length > 0) return completed[0];

  return null;
};

const buildImageUrl = (path?: string | null) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path}`;
};

const formatPercent = (value?: number | null) => {
  if (typeof value !== "number") return "—";
  return `${Math.round(value * 100)}%`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const getStatusBadgeClass = (status: string | undefined, stylesObj: typeof styles) => {
  switch ((status || "").trim()) {
    case "Reviewed":
    case "Completed":
      return `${stylesObj.statusBadge} ${stylesObj.badgeCompleted}`;
    case "Approved":
      return `${stylesObj.statusBadge} ${stylesObj.badgeApproved}`;
    case "Pending Review":
    case "Pending":
      return `${stylesObj.statusBadge} ${stylesObj.badgePending}`;
    case "Declined":
    case "Cancelled":
      return `${stylesObj.statusBadge} ${stylesObj.badgeUrgent}`;
    default:
      return `${stylesObj.statusBadge} ${stylesObj.badgePending}`;
  }
};

export default function DoctorAiAnalysisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [initialSelection] = useState(() => {
    const patientIdParam = searchParams.get("patient_id");
    const appointmentIdParam = searchParams.get("appointment_id");

    const patientId = patientIdParam ? Number(patientIdParam) : null;
    const appointmentId = appointmentIdParam ? Number(appointmentIdParam) : null;

    return {
      patientId:
        patientId && !Number.isNaN(patientId) ? patientId : null,
      appointmentId:
        appointmentId && !Number.isNaN(appointmentId) ? appointmentId : null,
    };
  });

  const [patients, setPatients] = useState<DoctorPatientListItem[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);

  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);

  const [patientHistory, setPatientHistory] =
    useState<DoctorPatientHistoryResponse | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingPatientHistory, setLoadingPatientHistory] = useState(false);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [doctorNote, setDoctorNote] = useState("");
  const [uploading, setUploading] = useState(false);

  const [reviewingAnalysisId, setReviewingAnalysisId] = useState<number | null>(null);
  const [editDoctorNote, setEditDoctorNote] = useState("");
  const [editReviewStatus, setEditReviewStatus] = useState("Pending Review");

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<AiTab>("analysis");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "doctor") {
      router.push("/");
      return;
    }

    const loadBaseData = async () => {
      try {
        setLoading(true);

        const [patientsData, appointmentsData] = await Promise.all([
          getDoctorPatients(),
          getDoctorAppointments("All"),
        ]);

        const patientList = Array.isArray(patientsData) ? patientsData : [];
        const appointmentList = Array.isArray(appointmentsData) ? appointmentsData : [];

        setPatients(patientList);
        setAllAppointments(appointmentList);

        let nextPatientId = initialSelection.patientId;

        if (
          !nextPatientId ||
          !patientList.some((item) => item.patient.id === nextPatientId)
        ) {
          nextPatientId = patientList[0]?.patient.id ?? null;
        }

        setSelectedPatientId(nextPatientId);

        if (!nextPatientId) {
          setSelectedAppointmentId(null);
          return;
        }

        const matchingAppointments = appointmentList.filter(
          (appt) =>
            appt.patient_id === nextPatientId &&
            (appt.status === "Approved" || appt.status === "Completed")
        );

        if (
          initialSelection.appointmentId &&
          matchingAppointments.some((appt) => appt.id === initialSelection.appointmentId)
        ) {
          setSelectedAppointmentId(initialSelection.appointmentId);
          return;
        }

        const best = pickBestTargetAppointment(matchingAppointments);
        setSelectedAppointmentId(best ? best.id : null);
      } catch (error) {
        console.error("Failed to load AI analysis base data:", error);
        alert(
          error instanceof Error
            ? error.message
            : "Failed to load AI analysis base data"
        );
      } finally {
        setLoading(false);
      }
    };

    loadBaseData();
  }, [router, initialSelection]);

  useEffect(() => {
    if (!selectedPatientId) {
      setPatientHistory(null);
      return;
    }

    const loadPatientHistory = async () => {
      try {
        setLoadingPatientHistory(true);
        const data = await getDoctorPatientHistory(selectedPatientId);
        setPatientHistory(data);
      } catch (error) {
        console.error("Failed to load patient history:", error);
        alert(
          error instanceof Error ? error.message : "Failed to load patient history"
        );
        setPatientHistory(null);
      } finally {
        setLoadingPatientHistory(false);
      }
    };

    loadPatientHistory();
  }, [selectedPatientId]);

  useEffect(() => {
    if (!selectedAppointmentId) {
      setAnalyses([]);
      return;
    }

    const loadAppointmentAnalyses = async () => {
      try {
        setLoadingAnalyses(true);
        const data = await getAppointmentAnalyses(selectedAppointmentId);
        setAnalyses(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load appointment analyses:", error);
        alert(
          error instanceof Error
            ? error.message
            : "Failed to load appointment analyses"
        );
        setAnalyses([]);
      } finally {
        setLoadingAnalyses(false);
      }
    };

    loadAppointmentAnalyses();
  }, [selectedAppointmentId]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (selectedPatientId) {
      params.set("patient_id", String(selectedPatientId));
    }

    if (selectedAppointmentId) {
      params.set("appointment_id", String(selectedAppointmentId));
    }

    const query = params.toString();

    router.replace(
      query
        ? `/pages/doctor/ai-analysis?${query}`
        : `/pages/doctor/ai-analysis`
    );
  }, [router, selectedPatientId, selectedAppointmentId]);

  const patientAppointmentsMap = useMemo(() => {
    const map = new Map<number, Appointment[]>();

    allAppointments.forEach((appt) => {
      if (!appt.patient_id) return;
      const current = map.get(appt.patient_id) || [];
      current.push(appt);
      map.set(appt.patient_id, current);
    });

    map.forEach((value, key) => {
      map.set(key, sortAppointmentsDesc(value));
    });

    return map;
  }, [allAppointments]);

  const filteredPatients = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    if (!keyword) return patients;

    return patients.filter((item) => {
      const name = item.patient.name?.toLowerCase() || "";
      const email = item.patient.email?.toLowerCase() || "";
      return name.includes(keyword) || email.includes(keyword);
    });
  }, [patients, searchTerm]);

  const selectedPatient = useMemo(() => {
    return patients.find((item) => item.patient.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);

  const selectedPatientAllVisits = useMemo(() => {
    if (!selectedPatientId) return [];
    return patientAppointmentsMap.get(selectedPatientId) || [];
  }, [patientAppointmentsMap, selectedPatientId]);

  const selectedPatientValidVisits = useMemo(() => {
    return selectedPatientAllVisits.filter(
      (appt) => appt.status === "Approved" || appt.status === "Completed"
    );
  }, [selectedPatientAllVisits]);

  const targetAppointment = useMemo(() => {
    return (
      selectedPatientValidVisits.find((appt) => appt.id === selectedAppointmentId) || null
    );
  }, [selectedPatientValidVisits, selectedAppointmentId]);

  const sortedAnalyses = useMemo(() => {
    return [...analyses].sort((a, b) => {
      const aDate = new Date(a.created_at || "").getTime();
      const bDate = new Date(b.created_at || "").getTime();
      return bDate - aDate;
    });
  }, [analyses]);

  const latestAnalysis = useMemo(() => {
    return sortedAnalyses.length > 0 ? sortedAnalyses[0] : null;
  }, [sortedAnalyses]);

  const sortedCompletedReports = useMemo(() => {
    if (!patientHistory) return [];

    return [...patientHistory.history].sort((a, b) => {
      const aDate = new Date(
        `${a.appointment?.date || ""}T${a.appointment?.time || "00:00:00"}`
      ).getTime();
      const bDate = new Date(
        `${b.appointment?.date || ""}T${b.appointment?.time || "00:00:00"}`
      ).getTime();
      return bDate - aDate;
    });
  }, [patientHistory]);

  const selectedVisitReport = useMemo(() => {
    if (!selectedAppointmentId) return null;

    return (
      sortedCompletedReports.find(
        (item) => item.appointment?.id === selectedAppointmentId
      ) || null
    );
  }, [sortedCompletedReports, selectedAppointmentId]);

  const patientPastAnalyses = useMemo(() => {
    if (!patientHistory) return [];

    return patientHistory.history
      .filter((item) => item.linked_analysis)
      .map((item) => ({
        appointment: item.appointment,
        report: item.report,
        linked_analysis: item.linked_analysis,
        doctor: item.doctor,
      }))
      .sort((a, b) => {
        const aDate = new Date(
          `${a.appointment?.date || ""}T${a.appointment?.time || "00:00:00"}`
        ).getTime();
        const bDate = new Date(
          `${b.appointment?.date || ""}T${b.appointment?.time || "00:00:00"}`
        ).getTime();
        return bDate - aDate;
      });
  }, [patientHistory]);

  const previousAnalyses = useMemo(() => {
    return patientPastAnalyses.filter(
      (item) => item.appointment?.id !== selectedAppointmentId
    );
  }, [patientPastAnalyses, selectedAppointmentId]);

  const isCompletedTarget = targetAppointment?.status === "Completed";
  const isApprovedTarget = targetAppointment?.status === "Approved";

  const resetEditorState = () => {
    setSelectedFile(null);
    setDoctorNote("");
    setReviewingAnalysisId(null);
    setEditDoctorNote("");
    setEditReviewStatus("Pending Review");
  };

  const selectPatient = (patientId: number) => {
    setSelectedPatientId(patientId);
    setActiveTab("analysis");
    resetEditorState();

    const matchingAppointments = (patientAppointmentsMap.get(patientId) || []).filter(
      (appt) => appt.status === "Approved" || appt.status === "Completed"
    );

    const best = pickBestTargetAppointment(matchingAppointments);
    setSelectedAppointmentId(best ? best.id : null);
  };

  const handleAppointmentChange = (value: string) => {
    const nextAppointmentId = value ? Number(value) : null;
    setSelectedAppointmentId(nextAppointmentId);
    resetEditorState();
  };

  const handleUploadAnalysis = async () => {
    try {
      if (!selectedAppointmentId) {
        alert("Please select a target appointment first.");
        return;
      }

      if (!selectedFile) {
        alert("Please select a skin image first.");
        return;
      }

      setUploading(true);

      await analyzeAppointmentSkin(selectedAppointmentId, selectedFile, doctorNote);

      setSelectedFile(null);
      setDoctorNote("");

      const analysisData = await getAppointmentAnalyses(selectedAppointmentId);
      setAnalyses(Array.isArray(analysisData) ? analysisData : []);

      if (selectedPatientId) {
        const historyData = await getDoctorPatientHistory(selectedPatientId);
        setPatientHistory(historyData);
      }

      alert("AI analysis completed successfully.");
    } catch (error) {
      console.error("Failed to analyze image:", error);
      alert(error instanceof Error ? error.message : "Failed to analyze image");
    } finally {
      setUploading(false);
    }
  };

  const startReviewEdit = (analysis: Analysis) => {
    setReviewingAnalysisId(analysis.id);
    setEditDoctorNote(analysis.doctor_note || "");
    setEditReviewStatus(analysis.review_status || "Pending Review");
  };

  const cancelReviewEdit = () => {
    setReviewingAnalysisId(null);
    setEditDoctorNote("");
    setEditReviewStatus("Pending Review");
  };

  const saveReviewEdit = async (analysisId: number) => {
    try {
      await reviewAnalysis(analysisId, editDoctorNote, editReviewStatus);

      if (selectedAppointmentId) {
        const analysisData = await getAppointmentAnalyses(selectedAppointmentId);
        setAnalyses(Array.isArray(analysisData) ? analysisData : []);
      }

      if (selectedPatientId) {
        const historyData = await getDoctorPatientHistory(selectedPatientId);
        setPatientHistory(historyData);
      }

      cancelReviewEdit();
      alert("Analysis updated successfully.");
    } catch (error) {
      console.error("Failed to update analysis:", error);
      alert(error instanceof Error ? error.message : "Failed to update analysis");
    }
  };

  const openPatientRecord = () => {
    if (!selectedPatientId) return;
    router.push(`/pages/doctor/patient-records?patient_id=${selectedPatientId}`);
  };

  const getPatientListMeta = (patientId: number) => {
    const visits = patientAppointmentsMap.get(patientId) || [];
    const latestVisit = visits[0];

    if (visits.some((appt) => appt.status === "Approved")) {
      return {
        label: "Approved Visit",
        badgeClass: `${styles.statusBadge} ${styles.badgeApproved}`,
        latestVisitText: latestVisit
          ? `${latestVisit.date} • ${latestVisit.services}`
          : "No visit yet",
      };
    }

    if (visits.some((appt) => appt.status === "Completed")) {
      return {
        label: "Completed Only",
        badgeClass: `${styles.statusBadge} ${styles.badgeCompleted}`,
        latestVisitText: latestVisit
          ? `${latestVisit.date} • ${latestVisit.services}`
          : "No visit yet",
      };
    }

    if (latestVisit) {
      return {
        label: latestVisit.status || "No Valid Visit",
        badgeClass: getStatusBadgeClass(latestVisit.status, styles),
        latestVisitText: `${latestVisit.date} • ${latestVisit.services}`,
      };
    }

    return {
      label: "No Visits",
      badgeClass: `${styles.statusBadge} ${styles.badgePending}`,
      latestVisitText: "No visit yet",
    };
  };

  const renderLatestAnalysisCard = () => {
    if (loadingAnalyses) {
      return <div className={styles.emptyState}>Loading analyses...</div>;
    }

    if (!latestAnalysis) {
      return (
        <div className={styles.emptyState}>
          No AI analysis found for the selected visit yet.
        </div>
      );
    }

    return (
      <div className={styles.stackCard}>
        <div className={styles.stackCardHeader}>
          <div>
            <p className={styles.cardTitle}>
              {latestAnalysis.condition} • {latestAnalysis.severity}
            </p>
            <p className={styles.cardMeta}>
              Confidence: {formatPercent(latestAnalysis.confidence)} •{" "}
              {formatDateTime(latestAnalysis.created_at)}
            </p>
          </div>

          <span className={getStatusBadgeClass(latestAnalysis.review_status, styles)}>
            {latestAnalysis.review_status || "Pending Review"}
          </span>
        </div>

        {latestAnalysis.image_path && (
          <img
            src={buildImageUrl(latestAnalysis.image_path)}
            alt="Latest AI analysis"
            className={styles.analysisImageLarge}
          />
        )}

        <div className={styles.stackCardBody}>
          <p>
            <strong>Recommendation:</strong> {latestAnalysis.recommendation || "—"}
          </p>
          <p>
            <strong>Possible Conditions:</strong>{" "}
            {latestAnalysis.possible_conditions || "—"}
          </p>
          <p>
            <strong>Key Findings:</strong> {latestAnalysis.key_findings || "—"}
          </p>
          <p>
            <strong>Treatment Suggestions:</strong>{" "}
            {latestAnalysis.treatment_suggestions || "—"}
          </p>
          <p>
            <strong>Prescription Suggestions:</strong>{" "}
            {latestAnalysis.prescription_suggestions || "—"}
          </p>
          <p>
            <strong>Follow-up Suggestions:</strong>{" "}
            {latestAnalysis.follow_up_suggestions || "—"}
          </p>
          <p>
            <strong>Red Flags:</strong> {latestAnalysis.red_flags || "—"}
          </p>
          <p>
            <strong>Doctor Note:</strong>{" "}
            {latestAnalysis.doctor_note || "No doctor note yet"}
          </p>
        </div>

        {isApprovedTarget && (
          <div className={styles.buttonRow}>
            {reviewingAnalysisId === latestAnalysis.id ? (
              <>
                <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                  <label htmlFor="edit_doctor_note">Edit Doctor Note</label>
                  <textarea
                    id="edit_doctor_note"
                    className={styles.textarea}
                    value={editDoctorNote}
                    onChange={(e) => setEditDoctorNote(e.target.value)}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="edit_review_status">Review Status</label>
                  <select
                    id="edit_review_status"
                    className={styles.select}
                    value={editReviewStatus}
                    onChange={(e) => setEditReviewStatus(e.target.value)}
                  >
                    <option value="Pending Review">Pending Review</option>
                    <option value="Reviewed">Reviewed</option>
                  </select>
                </div>

                <button
                  className={styles.saveButton}
                  onClick={() => saveReviewEdit(latestAnalysis.id)}
                >
                  Save Review
                </button>

                <button
                  className={styles.secondaryButton}
                  onClick={cancelReviewEdit}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                className={styles.secondaryButton}
                onClick={() => startReviewEdit(latestAnalysis)}
              >
                Review / Edit Analysis
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <DoctorNavbar />

      <main className={styles.pageWrapper}>
        <div className={styles.headerSection}>
          <h1 className={styles.pageTitle}>AI Analysis</h1>
          <p className={styles.pageSubtitle}>
            Search a patient, open their clinical workspace, and review AI analysis in one place.
          </p>
        </div>

        {loading ? (
          <section className={styles.sectionCard}>
            <div className={styles.emptyState}>Loading AI analysis page...</div>
          </section>
        ) : (
          <div className={styles.aiLayout}>
            <aside className={styles.aiSidebar}>
              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>Patients</h2>
                    <p className={styles.sectionSubtext}>
                      Search and select a patient to open the full report workspace.
                    </p>
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="patient_search">Search Patient</label>
                  <input
                    id="patient_search"
                    type="text"
                    className={styles.input}
                    placeholder="Search by patient name or email"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className={styles.patientList}>
                  {filteredPatients.length === 0 ? (
                    <div className={styles.emptyState}>No patient matched your search.</div>
                  ) : (
                    filteredPatients.map((item) => {
                      const meta = getPatientListMeta(item.patient.id);
                      const isActive = selectedPatientId === item.patient.id;

                      return (
                        <button
                          key={item.patient.id}
                          type="button"
                          className={`${styles.patientListItem} ${
                            isActive ? styles.patientListItemActive : ""
                          }`}
                          onClick={() => selectPatient(item.patient.id)}
                        >
                          <div className={styles.patientListTop}>
                            <div>
                              <p className={styles.patientListTitle}>
                                {item.patient.name || "Unnamed patient"}
                              </p>
                              <p className={styles.patientListMeta}>
                                {item.latest_report?.doctor_final_diagnosis || "No diagnosis yet"}
                              </p>
                            </div>

                            <span className={meta.badgeClass}>{meta.label}</span>
                          </div>

                          <div className={styles.patientListFooter}>
                            <span>{meta.latestVisitText}</span>
                            <span>
                              {item.total_reports} report{item.total_reports > 1 ? "s" : ""}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>
            </aside>

            <section className={styles.aiWorkspace}>
              {!selectedPatient ? (
                <section className={styles.sectionCard}>
                  <div className={styles.emptyState}>
                    Select a patient from the left panel to view the full AI analysis workspace.
                  </div>
                </section>
              ) : (
                <>
                  <section className={styles.sectionCard}>
                    <div className={styles.aiWorkspaceHeader}>
                      <div>
                        <h2 className={styles.sectionTitle}>
                          {selectedPatient.patient.name || "Unnamed patient"}
                        </h2>
                        <p className={styles.sectionSubtext}>
                          {selectedPatient.patient.email || "No email available"}
                        </p>
                      </div>

                      <button
                        className={styles.secondaryButton}
                        onClick={openPatientRecord}
                      >
                        Open Patient Record
                      </button>
                    </div>

                    <div className={styles.aiWorkspaceSummary}>
                      <div className={styles.aiCompactItem}>
                        <span className={styles.infoLabel}>Reports</span>
                        <span className={styles.infoValue}>
                          {selectedPatient.total_reports}
                        </span>
                      </div>

                      <div className={styles.aiCompactItem}>
                        <span className={styles.infoLabel}>Latest Diagnosis</span>
                        <span className={styles.infoValue}>
                          {selectedPatient.latest_report?.doctor_final_diagnosis || "—"}
                        </span>
                      </div>

                      <div className={styles.aiCompactItem}>
                        <span className={styles.infoLabel}>Latest Visit</span>
                        <span className={styles.infoValue}>
                          {selectedPatientAllVisits[0]
                            ? `${selectedPatientAllVisits[0].date} • ${selectedPatientAllVisits[0].services}`
                            : "No visit yet"}
                        </span>
                      </div>

                      <div className={styles.aiCompactItem}>
                        <span className={styles.infoLabel}>Target Visit</span>
                        <span className={styles.infoValue}>
                          {targetAppointment
                            ? `${targetAppointment.date} • ${targetAppointment.services}`
                            : "No valid appointment"}
                        </span>
                      </div>
                    </div>

                    <div className={styles.aiVisitToolbar}>
                      <div className={styles.inputGroup}>
                        <label htmlFor="appointment_selector">Visit to Review</label>
                        <select
                          id="appointment_selector"
                          className={styles.select}
                          value={selectedAppointmentId ?? ""}
                          onChange={(e) => handleAppointmentChange(e.target.value)}
                          disabled={selectedPatientValidVisits.length === 0}
                        >
                          <option value="">Select visit</option>
                          {selectedPatientValidVisits.map((appt) => (
                            <option key={appt.id} value={appt.id}>
                              #{appt.id} • {appt.date} • {appt.services} • {appt.status}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>

                  <section className={styles.sectionCard}>
                    <div className={styles.aiTabs}>
                      <button
                        type="button"
                        className={`${styles.aiTabButton} ${
                          activeTab === "analysis" ? styles.aiTabButtonActive : ""
                        }`}
                        onClick={() => setActiveTab("analysis")}
                      >
                        AI Analyses
                      </button>

                      <button
                        type="button"
                        className={`${styles.aiTabButton} ${
                          activeTab === "report" ? styles.aiTabButtonActive : ""
                        }`}
                        onClick={() => setActiveTab("report")}
                      >
                        Complete Report
                      </button>

                      <button
                        type="button"
                        className={`${styles.aiTabButton} ${
                          activeTab === "history" ? styles.aiTabButtonActive : ""
                        }`}
                        onClick={() => setActiveTab("history")}
                      >
                        Visit History
                      </button>
                    </div>

                    {activeTab === "analysis" && (
                      <div className={styles.aiPanel}>
                        {!targetAppointment ? (
                          <div className={styles.aiReadOnlyBanner}>
                            No approved or completed visit is available for this patient yet.
                          </div>
                        ) : (
                          <>
                            {isCompletedTarget && (
                              <div className={styles.aiReadOnlyBanner}>
                                This visit is already completed. AI analysis is now in read-only mode.
                              </div>
                            )}

                            <div
                              className={
                                isApprovedTarget
                                  ? styles.aiPanelGrid
                                  : styles.aiPanelSingle
                              }
                            >
                              {isApprovedTarget && (
                                <section className={styles.sectionCard}>
                                  <div className={styles.sectionHeader}>
                                    <div>
                                      <h2 className={styles.sectionTitle}>Upload Skin Image</h2>
                                      <p className={styles.sectionSubtext}>
                                        Run AI analysis for the selected approved visit.
                                      </p>
                                    </div>
                                  </div>

                                  <div className={styles.formGrid}>
                                    <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                                      <label htmlFor="skin_file">Patient Skin Image</label>
                                      <input
                                        id="skin_file"
                                        type="file"
                                        accept="image/*"
                                        className={styles.input}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0] || null;
                                          setSelectedFile(file);
                                        }}
                                      />
                                    </div>

                                    <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                                      <label htmlFor="doctor_note">Doctor Note</label>
                                      <textarea
                                        id="doctor_note"
                                        className={styles.textarea}
                                        value={doctorNote}
                                        onChange={(e) => setDoctorNote(e.target.value)}
                                        placeholder="Add a short clinical note before running AI analysis"
                                      />
                                    </div>
                                  </div>

                                  <div className={styles.buttonRow}>
                                    <button
                                      className={styles.actionButton}
                                      onClick={handleUploadAnalysis}
                                      disabled={uploading || !targetAppointment}
                                    >
                                      {uploading ? "Analyzing..." : "Run AI Analysis"}
                                    </button>
                                  </div>
                                </section>
                              )}

                              <section className={styles.sectionCard}>
                                <div className={styles.sectionHeader}>
                                  <div>
                                    <h2 className={styles.sectionTitle}>Latest Analysis</h2>
                                    <p className={styles.sectionSubtext}>
                                      The latest result for the selected visit.
                                    </p>
                                  </div>
                                </div>

                                {renderLatestAnalysisCard()}
                              </section>
                            </div>

                            <section className={styles.sectionCard}>
                              <div className={styles.sectionHeader}>
                                <div>
                                  <h2 className={styles.sectionTitle}>Previous AI Analyses</h2>
                                  <p className={styles.sectionSubtext}>
                                    Earlier AI results for comparison.
                                  </p>
                                </div>
                              </div>

                              {previousAnalyses.length === 0 ? (
                                <div className={styles.emptyState}>
                                  No previous AI analyses found for this patient.
                                </div>
                              ) : (
                                <div className={styles.aiHistoryGrid}>
                                  {previousAnalyses.map((item) => (
                                    <div
                                      key={`${item.report.id}-${item.linked_analysis?.id}`}
                                      className={styles.stackCard}
                                    >
                                      <div className={styles.stackCardHeader}>
                                        <div>
                                          <p className={styles.cardTitle}>
                                            {item.linked_analysis?.condition || "Unknown"} •{" "}
                                            {item.linked_analysis?.severity || "—"}
                                          </p>
                                          <p className={styles.cardMeta}>
                                            {item.appointment?.date || "Unknown date"} •{" "}
                                            {item.appointment?.services || "Consultation"} •{" "}
                                            {item.doctor?.name || "Unknown doctor"}
                                          </p>
                                        </div>

                                        <span
                                          className={getStatusBadgeClass(
                                            item.linked_analysis?.review_status,
                                            styles
                                          )}
                                        >
                                          {item.linked_analysis?.review_status || "Pending Review"}
                                        </span>
                                      </div>

                                      {item.linked_analysis?.image_path && (
                                        <img
                                          src={buildImageUrl(item.linked_analysis.image_path)}
                                          alt="Past AI analysis"
                                          className={styles.analysisImage}
                                        />
                                      )}

                                      <div className={styles.stackCardBody}>
                                        <p>
                                          <strong>Recommendation:</strong>{" "}
                                          {item.linked_analysis?.recommendation || "—"}
                                        </p>
                                        <p>
                                          <strong>Key Findings:</strong>{" "}
                                          {item.linked_analysis?.key_findings || "—"}
                                        </p>
                                        <p>
                                          <strong>Prescription Suggestions:</strong>{" "}
                                          {item.linked_analysis?.prescription_suggestions || "—"}
                                        </p>
                                        <p>
                                          <strong>Doctor Note:</strong>{" "}
                                          {item.linked_analysis?.doctor_note || "No doctor note yet"}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </section>
                          </>
                        )}
                      </div>
                    )}

                    {activeTab === "report" && (
                      <div className={styles.aiPanel}>
                        {loadingPatientHistory ? (
                          <div className={styles.emptyState}>Loading patient reports...</div>
                        ) : sortedCompletedReports.length === 0 ? (
                          <div className={styles.emptyState}>
                            No completed diagnosis reports found for this patient.
                          </div>
                        ) : (
                          <>
                            {selectedVisitReport && (
                              <section className={styles.sectionCard}>
                                <div className={styles.sectionHeader}>
                                  <div>
                                    <h2 className={styles.sectionTitle}>Selected Visit Report</h2>
                                    <p className={styles.sectionSubtext}>
                                      The completed report linked to the current selected visit.
                                    </p>
                                  </div>
                                </div>

                                <div className={styles.stackCard}>
                                  <div className={styles.stackCardHeader}>
                                    <div>
                                      <p className={styles.cardTitle}>
                                        {selectedVisitReport.appointment?.date || "Unknown date"} •{" "}
                                        {selectedVisitReport.appointment?.services || "Consultation"}
                                      </p>
                                      <p className={styles.cardMeta}>
                                        Doctor: {selectedVisitReport.doctor?.name || "Unknown"}
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
                                      {selectedVisitReport.report.doctor_final_diagnosis || "—"}
                                    </p>
                                    <p>
                                      <strong>Prescription:</strong>{" "}
                                      {selectedVisitReport.report.doctor_prescription || "—"}
                                    </p>
                                    <p>
                                      <strong>After Notes:</strong>{" "}
                                      {selectedVisitReport.report.after_appointment_notes || "—"}
                                    </p>
                                    <p>
                                      <strong>Follow-up Plan:</strong>{" "}
                                      {selectedVisitReport.report.follow_up_plan || "—"}
                                    </p>
                                  </div>
                                </div>
                              </section>
                            )}

                            <section className={styles.sectionCard}>
                              <div className={styles.sectionHeader}>
                                <div>
                                  <h2 className={styles.sectionTitle}>All Completed Reports</h2>
                                  <p className={styles.sectionSubtext}>
                                    The patient’s complete diagnosis history.
                                  </p>
                                </div>
                              </div>

                              <div className={styles.aiHistoryGrid}>
                                {sortedCompletedReports.map((item) => (
                                  <div key={item.report.id} className={styles.stackCard}>
                                    <div className={styles.stackCardHeader}>
                                      <div>
                                        <p className={styles.cardTitle}>
                                          {item.appointment?.date || "Unknown date"} •{" "}
                                          {item.appointment?.services || "Consultation"}
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
                                        {item.report.doctor_final_diagnosis || "—"}
                                      </p>
                                      <p>
                                        <strong>Prescription:</strong>{" "}
                                        {item.report.doctor_prescription || "—"}
                                      </p>
                                      <p>
                                        <strong>After Notes:</strong>{" "}
                                        {item.report.after_appointment_notes || "—"}
                                      </p>
                                      <p>
                                        <strong>Follow-up Plan:</strong>{" "}
                                        {item.report.follow_up_plan || "—"}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </section>
                          </>
                        )}
                      </div>
                    )}

                    {activeTab === "history" && (
                      <div className={styles.aiPanel}>
                        {selectedPatientAllVisits.length === 0 ? (
                          <div className={styles.emptyState}>
                            No visit history found for this patient.
                          </div>
                        ) : (
                          <div className={styles.aiHistoryGrid}>
                            {selectedPatientAllVisits.map((appt) => {
                              const reportMatch =
                                sortedCompletedReports.find(
                                  (item) => item.appointment?.id === appt.id
                                ) || null;

                              const linkedAnalysisMatch =
                                patientPastAnalyses.find(
                                  (item) => item.appointment?.id === appt.id
                                ) || null;

                              return (
                                <div key={appt.id} className={styles.stackCard}>
                                  <div className={styles.stackCardHeader}>
                                    <div>
                                      <p className={styles.cardTitle}>
                                        #{appt.id} • {appt.date} • {appt.services}
                                      </p>
                                      <p className={styles.cardMeta}>
                                        {appt.time || "No time"} •{" "}
                                        {appt.doctor_name || "No doctor assigned"}
                                      </p>
                                    </div>

                                    <span className={getStatusBadgeClass(appt.status, styles)}>
                                      {appt.status}
                                    </span>
                                  </div>

                                  <div className={styles.stackCardBody}>
                                    <p>
                                      <strong>Diagnosis:</strong>{" "}
                                      {reportMatch?.report.doctor_final_diagnosis || "No completed report yet"}
                                    </p>
                                    <p>
                                      <strong>AI Result:</strong>{" "}
                                      {linkedAnalysisMatch?.linked_analysis?.condition
                                        ? `${linkedAnalysisMatch.linked_analysis.condition} • ${linkedAnalysisMatch.linked_analysis.severity || "—"}`
                                        : "No AI analysis linked"}
                                    </p>
                                    <p>
                                      <strong>Follow-up Plan:</strong>{" "}
                                      {reportMatch?.report.follow_up_plan || "—"}
                                    </p>
                                    <p>
                                      <strong>Cancel Reason:</strong>{" "}
                                      {appt.cancel_reason || "—"}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </>
  );
}