"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import styles from "@/app/styles/ai.module.css";
import { API_BASE_URL } from "@/lib/api";
import {
  analyzeAppointmentSkin,
  getAppointmentAnalyses,
  getDoctorAppointments,
  getDoctorPatientHistory,
  getDoctorPatients,
  type Analysis,
  type Appointment,
  type DoctorPatientHistoryResponse,
  type DoctorPatientListItem,
} from "@/lib/doctor-api";

type WorkspaceStage = "scan" | "reports" | "history";

type DoctorAssessmentForm = {
  finalDiagnosis: string;
  severity: string;
  clinicalFindings: string;
  treatmentPlan: string;
  prescriptionMedication: string;
  prescriptionUsage: string;
  prescriptionReason: string;
  followUpPlan: string;
  redFlags: string;
  patientInstructions: string;
};

const emptyAssessmentForm: DoctorAssessmentForm = {
  finalDiagnosis: "",
  severity: "Needs Further Review",
  clinicalFindings: "",
  treatmentPlan: "",
  prescriptionMedication: "",
  prescriptionUsage: "",
  prescriptionReason: "",
  followUpPlan: "",
  redFlags: "",
  patientInstructions: "",
};

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

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const normalizeConfidence = (value?: number | null) => {
  if (typeof value !== "number") return null;

  return value <= 1 ? Math.round(value * 100) : Math.round(value);
};

const splitMultilineText = (value?: string | null) => {
  if (!value) return [];

  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^-\s*/, ""));
};

const parsePrescriptionSuggestions = (value?: string | null) => {
  const rows = splitMultilineText(value);

  return rows.map((row) => {
    const parts = row.split("|").map((part) => part.trim());

    const medication = parts[0] || "Suggested medication";

    const usage =
      parts
        .find((part) => part.toLowerCase().startsWith("usage:"))
        ?.replace(/^usage:\s*/i, "") || "";

    const reason =
      parts
        .find((part) => part.toLowerCase().startsWith("reason:"))
        ?.replace(/^reason:\s*/i, "") || "";

    return {
      medication,
      usage,
      reason,
    };
  });
};

const getStatusBadgeClass = (status: string | undefined) => {
  switch ((status || "").trim()) {
    case "Reviewed":
    case "Completed":
      return `${styles.statusBadge} ${styles.badgeCompleted}`;
    case "Approved":
      return `${styles.statusBadge} ${styles.badgeApproved}`;
    case "Pending Review":
    case "Pending":
      return `${styles.statusBadge} ${styles.badgePending}`;
    case "Declined":
    case "Cancelled":
      return `${styles.statusBadge} ${styles.badgeUrgent}`;
    default:
      return `${styles.statusBadge} ${styles.badgePending}`;
  }
};

const saveDoctorAssessment = async (
  appointmentId: number,
  analysisId: number,
  payload: DoctorAssessmentForm
) => {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${API_BASE_URL}/doctor/appointments/${appointmentId}/complete-with-report`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        skin_analysis_id: analysisId,
        doctor_final_diagnosis: payload.finalDiagnosis,
        doctor_prescription: [
          payload.prescriptionMedication
            ? `Medication: ${payload.prescriptionMedication}`
            : "",
          payload.prescriptionUsage
            ? `Usage: ${payload.prescriptionUsage}`
            : "",
          payload.prescriptionReason
            ? `Reason: ${payload.prescriptionReason}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        after_appointment_notes: [
          payload.severity ? `Severity: ${payload.severity}` : "",
          payload.redFlags ? `Red Flags: ${payload.redFlags}` : "",
          payload.patientInstructions
            ? `Patient Instructions: ${payload.patientInstructions}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        follow_up_plan: payload.followUpPlan,
        next_visit_date: null,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      errorText || "Failed to save doctor clinical assessment."
    );
  }

  return response.json().catch(() => null);
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
      patientId: patientId && !Number.isNaN(patientId) ? patientId : null,
      appointmentId:
        appointmentId && !Number.isNaN(appointmentId) ? appointmentId : null,
    };
  });

  const [patients, setPatients] = useState<DoctorPatientListItem[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);

  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(
    null
  );

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    number | null
  >(null);

  const [patientHistory, setPatientHistory] =
    useState<DoctorPatientHistoryResponse | null>(null);

  const [analyses, setAnalyses] = useState<Analysis[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingPatientHistory, setLoadingPatientHistory] = useState(false);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeStage, setActiveStage] = useState<WorkspaceStage>("scan");

  const [assessmentForm, setAssessmentForm] =
    useState<DoctorAssessmentForm>(emptyAssessmentForm);

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
        const appointmentList = Array.isArray(appointmentsData)
          ? appointmentsData
          : [];

        setPatients(patientList);
        setAllAppointments(appointmentList);

        const nextPatientId = initialSelection.patientId;

        if (
          !nextPatientId ||
          !patientList.some((item) => item.patient.id === nextPatientId)
        ) {
          setSelectedPatientId(null);
          setSelectedAppointmentId(null);
          return;
        }

        setSelectedPatientId(nextPatientId);

        const matchingAppointments = appointmentList.filter(
          (appt) =>
            appt.patient_id === nextPatientId &&
            (appt.status === "Approved" || appt.status === "Completed")
        );

        if (
          initialSelection.appointmentId &&
          matchingAppointments.some(
            (appt) => appt.id === initialSelection.appointmentId
          )
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
            : "Failed to load AI analysis base data."
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
          error instanceof Error
            ? error.message
            : "Failed to load patient history."
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
            : "Failed to load appointment analyses."
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
      selectedPatientValidVisits.find(
        (appt) => appt.id === selectedAppointmentId
      ) || null
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

  const isCompletedTarget = targetAppointment?.status === "Completed";
  const isApprovedTarget = targetAppointment?.status === "Approved";

  const resetWorkspaceDrafts = () => {
    setSelectedFile(null);
    setAssessmentForm(emptyAssessmentForm);
  };

  const updateAssessmentField = (
    field: keyof DoctorAssessmentForm,
    value: string
  ) => {
    setAssessmentForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const selectPatient = (patientId: number) => {
    setSelectedPatientId(patientId);
    setActiveStage("scan");
    resetWorkspaceDrafts();

    const matchingAppointments = (
      patientAppointmentsMap.get(patientId) || []
    ).filter((appt) => appt.status === "Approved" || appt.status === "Completed");

    const best = pickBestTargetAppointment(matchingAppointments);
    setSelectedAppointmentId(best ? best.id : null);
  };

  const changePatient = () => {
    setSelectedPatientId(null);
    setSelectedAppointmentId(null);
    setActiveStage("scan");
    resetWorkspaceDrafts();

    router.replace("/pages/doctor/ai-analysis");
  };

  const handleAppointmentChange = (value: string) => {
    const nextAppointmentId = value ? Number(value) : null;

    setSelectedAppointmentId(nextAppointmentId);
    setActiveStage("scan");
    resetWorkspaceDrafts();
  };

  const handleUploadAnalysis = async () => {
    try {
      if (!selectedAppointmentId) {
        alert("Please select a target visit first.");
        return;
      }

      if (!selectedFile) {
        alert("Please select a skin image first.");
        return;
      }

      setUploading(true);

      await analyzeAppointmentSkin(selectedAppointmentId, selectedFile, "");

      setSelectedFile(null);

      const analysisData = await getAppointmentAnalyses(selectedAppointmentId);
      setAnalyses(Array.isArray(analysisData) ? analysisData : []);

      if (selectedPatientId) {
        const historyData = await getDoctorPatientHistory(selectedPatientId);
        setPatientHistory(historyData);
      }

      setActiveStage("scan");
      alert(
        "AI analysis completed. The result is now pending until the doctor completes the assessment."
      );
    } catch (error) {
      console.error("Failed to analyze image:", error);
      alert(error instanceof Error ? error.message : "Failed to analyze image.");
    } finally {
      setUploading(false);
    }
  };

  const getAiSuggestionForField = (field: keyof DoctorAssessmentForm) => {
    if (!latestAnalysis) return "";

    const prescriptions = parsePrescriptionSuggestions(
      latestAnalysis.prescription_suggestions
    );

const allMedication = prescriptions
  .map((item) => item.medication)
  .filter(Boolean)
  .join("; ");

const allUsage = prescriptions
  .map((item) => (item.usage ? `${item.medication}: ${item.usage}` : ""))
  .filter(Boolean)
  .join("; ");

const allReason = prescriptions
  .map((item) => (item.reason ? `${item.medication}: ${item.reason}` : ""))
  .filter(Boolean)
  .join("\n");

    switch (field) {
      case "finalDiagnosis":
        return (
          latestAnalysis.condition ||
          latestAnalysis.possible_conditions ||
          ""
        );

      case "severity":
        return latestAnalysis.severity || "";

      case "clinicalFindings":
        return latestAnalysis.key_findings || "";

      case "prescriptionMedication":
        return allMedication;

      case "prescriptionUsage":
        return allUsage;

      case "prescriptionReason":
        return allReason;

      case "followUpPlan":
        return latestAnalysis.follow_up_suggestions || "";

      case "redFlags":
        return latestAnalysis.red_flags || "";

      case "patientInstructions":
        return latestAnalysis.recommendation || "";

      default:
        return "";
    }
  };

  const applyAiSuggestionForField = (field: keyof DoctorAssessmentForm) => {
    const suggestion = getAiSuggestionForField(field);

    if (!suggestion.trim()) {
      alert("No AI suggestion is available for this field.");
      return;
    }

    updateAssessmentField(field, suggestion);
  };

  const renderUseAiSuggestionButton = (field: keyof DoctorAssessmentForm) => {
    const suggestion = getAiSuggestionForField(field);

    return (
      <button
        type="button"
        className={styles.aiSuggestionButton}
        onClick={() => applyAiSuggestionForField(field)}
        disabled={!suggestion.trim()}
      >
        Use AI Suggestion
      </button>
    );
  };

  const renderAiSuggestionPreview = (
    field: keyof DoctorAssessmentForm,
    title: string
  ) => {
    const suggestion = getAiSuggestionForField(field);

    if (!suggestion.trim()) return null;

    return (
      <div className={styles.aiSuggestionPreview}>
        <span>{title}</span>
        <p>{suggestion}</p>
      </div>
    );
  };

  const handleSaveDoctorAssessment = async () => {
    try {
      if (!selectedAppointmentId) {
        alert("Please select a target visit first.");
        return;
      }

      if (!latestAnalysis) {
        alert("Please run an AI analysis before saving the doctor assessment.");
        return;
      }

      if (!assessmentForm.finalDiagnosis.trim()) {
        alert("Please enter the doctor final diagnosis.");
        return;
      }

      setSavingAssessment(true);

      await saveDoctorAssessment(
        selectedAppointmentId,
        latestAnalysis.id,
        assessmentForm
      );

      if (selectedPatientId) {
        const historyData = await getDoctorPatientHistory(selectedPatientId);
        setPatientHistory(historyData);
      }

      setActiveStage("history");
      alert(
        "Doctor assessment saved successfully. The completed record is now available in History."
      );
    } catch (error) {
      console.error("Failed to save doctor assessment:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to save doctor assessment."
      );
    } finally {
      setSavingAssessment(false);
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
        label: "Ready for Review",
        badgeClass: `${styles.statusBadge} ${styles.badgeApproved}`,
        latestVisitText: latestVisit
          ? `${latestVisit.date} • ${latestVisit.services}`
          : "No visit yet",
      };
    }

    if (visits.some((appt) => appt.status === "Completed")) {
      return {
        label: "Completed",
        badgeClass: `${styles.statusBadge} ${styles.badgeCompleted}`,
        latestVisitText: latestVisit
          ? `${latestVisit.date} • ${latestVisit.services}`
          : "No visit yet",
      };
    }

    if (latestVisit) {
      return {
        label: latestVisit.status || "No Valid Visit",
        badgeClass: getStatusBadgeClass(latestVisit.status),
        latestVisitText: `${latestVisit.date} • ${latestVisit.services}`,
      };
    }

    return {
      label: "No Visits",
      badgeClass: `${styles.statusBadge} ${styles.badgePending}`,
      latestVisitText: "No visit yet",
    };
  };

  const renderAiReadOnlyResult = () => {
    if (loadingAnalyses) {
      return <div className={styles.emptyState}>Loading AI results...</div>;
    }

    if (!latestAnalysis) {
      return (
        <div className={styles.emptyState}>
          No AI result yet. Upload a skin image to generate the first analysis.
        </div>
      );
    }

    const confidenceValue = normalizeConfidence(latestAnalysis.confidence);

    const prescriptionItems = parsePrescriptionSuggestions(
      latestAnalysis.prescription_suggestions
    );

    const followUpItems = splitMultilineText(latestAnalysis.follow_up_suggestions);
    const redFlagItems = splitMultilineText(latestAnalysis.red_flags);

    return (
      <div className={styles.aiResultCard}>
        <div className={styles.aiResultHeader}>
          <div>
            <p className={styles.eyebrow}>AI Generated Result</p>
            <h3 className={styles.resultTitle}>
              {latestAnalysis.condition || "Unknown condition"}
            </h3>
            <p className={styles.resultMeta}>
              Generated {formatDateTime(latestAnalysis.created_at)}
            </p>
          </div>

          <div className={styles.resultBadgeStack}>
            <span className={styles.aiOnlyBadge}>Read-only AI output</span>
            <span className={styles.confidenceBadge}>
              Confidence: {confidenceValue !== null ? `${confidenceValue}%` : "—"}
            </span>
          </div>
        </div>

        <div className={styles.aiResultGrid}>
          <div className={styles.imagePanel}>
            {latestAnalysis.image_path ? (
              <img
                src={buildImageUrl(latestAnalysis.image_path)}
                alt="AI skin analysis result"
                className={styles.analysisImage}
              />
            ) : (
              <div className={styles.imagePlaceholder}>No image available</div>
            )}
          </div>

          <div className={styles.aiSummaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.infoLabel}>Possible Condition</span>
              <strong>{latestAnalysis.possible_conditions || "—"}</strong>
            </div>

            <div className={styles.summaryCard}>
              <span className={styles.infoLabel}>AI Severity</span>
              <strong>{latestAnalysis.severity || "—"}</strong>
            </div>

            <div className={styles.summaryCardWide}>
              <span className={styles.infoLabel}>Key Findings</span>
              <p>{latestAnalysis.key_findings || "No findings available."}</p>
            </div>

            <div className={styles.summaryCardWide}>
              <span className={styles.infoLabel}>AI Recommendation</span>
              <p>
                {latestAnalysis.recommendation ||
                  "Further clinical review is recommended."}
              </p>
            </div>
          </div>
        </div>

        <div className={styles.detailSectionGrid}>
          <section className={styles.detailBlock}>
            <div className={styles.blockHeader}>
              <h4>Prescription Suggestions</h4>
              <p>Medication, usage, and reason are separated for review.</p>
            </div>

            {prescriptionItems.length === 0 ? (
              <div className={styles.emptyStateSmall}>
                No prescription suggestions available.
              </div>
            ) : (
              <div className={styles.medicationStack}>
                {prescriptionItems.map((item, index) => (
                  <div
                    key={`${item.medication}-${index}`}
                    className={styles.medicationCard}
                  >
                    <strong>{item.medication}</strong>

                    <div className={styles.medicationRow}>
                      <span>Usage</span>
                      <p>{item.usage || "—"}</p>
                    </div>

                    <div className={styles.medicationRow}>
                      <span>Reason</span>
                      <p>{item.reason || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={styles.detailBlock}>
            <div className={styles.blockHeader}>
              <h4>Follow-up Suggestions</h4>
              <p>For doctor review before including in the final report.</p>
            </div>

            {followUpItems.length === 0 ? (
              <div className={styles.emptyStateSmall}>
                No follow-up suggestions available.
              </div>
            ) : (
              <div className={styles.softList}>
                {followUpItems.map((item, index) => (
                  <div key={`${item}-${index}`} className={styles.softListItem}>
                    {item}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={`${styles.detailBlock} ${styles.warningBlock}`}>
            <div className={styles.blockHeader}>
              <h4>Red Flags</h4>
              <p>Items that need extra attention during clinical review.</p>
            </div>

            {redFlagItems.length === 0 ? (
              <div className={styles.emptyStateSmall}>No red flags noted.</div>
            ) : (
              <div className={styles.warningList}>
                {redFlagItems.map((item, index) => (
                  <div key={`${item}-${index}`} className={styles.warningItem}>
                    {item}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  };

  const renderDoctorAssessmentForm = () => {
    if (!latestAnalysis || selectedVisitReport) {
      return null;
    }

    return (
      <section className={styles.workflowCard}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.eyebrow}>Doctor Assessment</p>
            <h2>Complete Doctor Assessment</h2>
            <p>
              Review the AI result above, then complete the doctor-confirmed
              diagnosis, prescription, follow-up plan, red flags, and patient
              instructions.
            </p>
          </div>
        </div>

        <div className={styles.assessmentForm}>
          <div className={styles.formGroup}>
            <div className={styles.fieldHeader}>
              <label htmlFor="finalDiagnosis">Final Diagnosis</label>
              {renderUseAiSuggestionButton("finalDiagnosis")}
            </div>

            {renderAiSuggestionPreview(
              "finalDiagnosis",
              "AI Suggested Diagnosis"
            )}

            <input
              id="finalDiagnosis"
              value={assessmentForm.finalDiagnosis}
              onChange={(e) =>
                updateAssessmentField("finalDiagnosis", e.target.value)
              }
              placeholder="Enter doctor-confirmed diagnosis"
            />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.fieldHeader}>
              <label htmlFor="severity">Doctor Severity Assessment</label>
              {renderUseAiSuggestionButton("severity")}
            </div>

            {renderAiSuggestionPreview("severity", "AI Suggested Severity")}

            <select
              id="severity"
              value={assessmentForm.severity}
              onChange={(e) => updateAssessmentField("severity", e.target.value)}
            >
              <option value="Mild">Mild</option>
              <option value="Moderate">Moderate</option>
              <option value="Severe">Severe</option>
              <option value="Needs Further Review">Needs Further Review</option>
            </select>
          </div>

          <div className={styles.prescriptionBox}>
            <div className={styles.prescriptionHeader}>
              <h3>Prescription</h3>
              <p>
                Review each AI suggestion before applying it to the final
                prescription.
              </p>
            </div>

<div className={styles.formGroup}>
  <div className={styles.fieldHeader}>
    <label htmlFor="prescriptionMedication">Medication</label>
    {renderUseAiSuggestionButton("prescriptionMedication")}
  </div>

  {renderAiSuggestionPreview(
    "prescriptionMedication",
    "AI Suggested Medication"
  )}

  <input
    id="prescriptionMedication"
    type="text"
    value={assessmentForm.prescriptionMedication}
    onChange={(e) =>
      updateAssessmentField("prescriptionMedication", e.target.value)
    }
    placeholder="Medication name"
  />
</div>

<div className={styles.formGroup}>
  <div className={styles.fieldHeader}>
    <label htmlFor="prescriptionUsage">Usage</label>
    {renderUseAiSuggestionButton("prescriptionUsage")}
  </div>

  {renderAiSuggestionPreview(
    "prescriptionUsage",
    "AI Suggested Usage"
  )}

  <input
    id="prescriptionUsage"
    type="text"
    value={assessmentForm.prescriptionUsage}
    onChange={(e) =>
      updateAssessmentField("prescriptionUsage", e.target.value)
    }
    placeholder="Enter..."
  />
</div>

            <div className={styles.formGroupFull}>
              <div className={styles.fieldHeader}>
                <label htmlFor="prescriptionReason">Reason</label>
                {renderUseAiSuggestionButton("prescriptionReason")}
              </div>

              {renderAiSuggestionPreview(
                "prescriptionReason",
                "AI Suggested Reason"
              )}

              <textarea
                id="prescriptionReason"
                value={assessmentForm.prescriptionReason}
                onChange={(e) =>
                  updateAssessmentField("prescriptionReason", e.target.value)
                }
                placeholder="Why this prescription is recommended"
              />
            </div>
          </div>

          <div className={styles.formGroupFull}>
            <div className={styles.fieldHeader}>
              <label htmlFor="followUpPlan">Follow-up Plan</label>
              {renderUseAiSuggestionButton("followUpPlan")}
            </div>

            {renderAiSuggestionPreview(
              "followUpPlan",
              "AI Suggested Follow-up Plan"
            )}

            <textarea
              id="followUpPlan"
              value={assessmentForm.followUpPlan}
              onChange={(e) =>
                updateAssessmentField("followUpPlan", e.target.value)
              }
              placeholder="Example: Review in 1 to 2 weeks if symptoms persist"
            />
          </div>

          <div className={styles.formGroupFull}>
            <div className={styles.fieldHeader}>
              <label htmlFor="redFlags">Red Flags Observed</label>
              {renderUseAiSuggestionButton("redFlags")}
            </div>

            {renderAiSuggestionPreview("redFlags", "AI Suggested Red Flags")}

            <textarea
              id="redFlags"
              value={assessmentForm.redFlags}
              onChange={(e) => updateAssessmentField("redFlags", e.target.value)}
              placeholder="List warning signs or concerns"
            />
          </div>

          <div className={styles.formGroupFull}>
            <div className={styles.fieldHeader}>
              <label htmlFor="patientInstructions">Patient Instructions</label>
              {renderUseAiSuggestionButton("patientInstructions")}
            </div>

            {renderAiSuggestionPreview(
              "patientInstructions",
              "AI Suggested Patient Instructions"
            )}

            <textarea
              id="patientInstructions"
              value={assessmentForm.patientInstructions}
              onChange={(e) =>
                updateAssessmentField("patientInstructions", e.target.value)
              }
              placeholder="Instructions that may be shown to the patient"
            />
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleSaveDoctorAssessment}
              disabled={savingAssessment || isCompletedTarget}
            >
              {savingAssessment ? "Saving assessment..." : "Save Doctor Assessment"}
            </button>
          </div>
        </div>
      </section>
    );
  };

const renderScanStage = () => {
  if (loadingPatientHistory && isCompletedTarget) {
    return (
      <section className={styles.workflowCard}>
        <div className={styles.emptyState}>Checking completed case...</div>
      </section>
    );
  }

if (selectedVisitReport || isCompletedTarget) {
  return (
    <div className={styles.scanStack}>
      <section className={styles.workflowCard}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.eyebrow}>Completed Case</p>
            <h2>This Consultation Is Already Completed</h2>
            <p>
              The AI analysis and doctor assessment for this consultation have
              already been saved. Please review the completed record in History.
            </p>
          </div>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setActiveStage("history")}
          >
            View in History
          </button>
        </div>
      </section>
    </div>
  );
}

  return (
    <div className={styles.scanStack}>
      <div className={styles.scanUploadCenter}>
        <section className={styles.workflowCard}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.eyebrow}>Step 1</p>
              <h2>Upload Skin Image</h2>
              <p>
                Upload the patient image for the selected approved visit. The AI
                result will appear below after processing.
              </p>
            </div>
          </div>

          {!targetAppointment ? (
            <div className={styles.emptyState}>
              No approved or completed visit is available for this patient yet.
            </div>
          ) : (
            <>
              <label className={styles.dropZone} htmlFor="skin_file">
                <input
                  id="skin_file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                  }}
                />

                <span className={styles.dropIcon}>＋</span>
                <strong>
                  {selectedFile
                    ? selectedFile.name
                    : "Choose or drop skin image"}
                </strong>
                <small>Accepted formats: JPG, PNG, WEBP</small>
              </label>

              <button
                className={styles.primaryButton}
                onClick={handleUploadAnalysis}
                disabled={uploading || !selectedFile || !isApprovedTarget}
              >
                {uploading ? "Analyzing image..." : "Run AI Analysis"}
              </button>
            </>
          )}
        </section>
      </div>

      <section className={styles.workflowCard}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.eyebrow}>Pending Case</p>
            <h2>Latest AI Result</h2>
            <p>
              This AI-generated result stays here until the doctor completes the
              assessment below.
            </p>
          </div>
        </div>

        {renderAiReadOnlyResult()}
      </section>

      {renderDoctorAssessmentForm()}
    </div>
  );
};

  const renderReportsStage = () => {
    if (loadingPatientHistory) {
      return <div className={styles.emptyState}>Loading completed reports...</div>;
    }

    if (sortedCompletedReports.length === 0) {
      return (
        <section className={styles.workflowCard}>
          <div className={styles.emptyState}>
            No completed reports found for this patient yet.
          </div>
        </section>
      );
    }

    return (
      <section className={styles.workflowCard}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.eyebrow}>Patient Record</p>
            <h2>All Completed Reports</h2>
            <p>Review the patient’s completed diagnosis history.</p>
          </div>
        </div>

        <div className={styles.reportGrid}>
          {sortedCompletedReports.map((item) => (
            <article key={item.report.id} className={styles.historyCard}>
              <div className={styles.historyHeader}>
                <div>
                  <strong>
                    {item.appointment?.date || "Unknown date"} •{" "}
                    {item.appointment?.services || "Consultation"}
                  </strong>
                  <span>Doctor: {item.doctor?.name || "Unknown"}</span>
                </div>

                <span className={`${styles.statusBadge} ${styles.badgeCompleted}`}>
                  Completed
                </span>
              </div>

              <div className={styles.historyBody}>
                <p>
                  <b>Diagnosis:</b>{" "}
                  {item.report.doctor_final_diagnosis || "—"}
                </p>

                <p>
                  <b>Prescription:</b>{" "}
                  {item.report.doctor_prescription || "—"}
                </p>

                <p>
                  <b>Follow-up:</b> {item.report.follow_up_plan || "—"}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  };



  const renderHistoryStage = () => {
    if (loadingPatientHistory) {
      return (
        <section className={styles.workflowCard}>
          <div className={styles.emptyState}>Loading medical history...</div>
        </section>
      );
    }

    const completedMedicalHistory = sortedCompletedReports.filter(
      (item) =>
        item.report?.doctor_final_diagnosis ||
        item.report?.doctor_prescription ||
        item.linked_analysis
    );

    if (completedMedicalHistory.length === 0) {
      return (
        <section className={styles.workflowCard}>
          <div className={styles.emptyState}>
            No completed medical history yet.
          </div>
        </section>
      );
    }

    return (
      <section className={styles.workflowCard}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.eyebrow}>Medical History</p>
            <h2>Completed AI Results and Doctor Diagnoses</h2>
            <p>
              This section shows completed AI results together with the saved
              doctor diagnosis.
            </p>
          </div>
        </div>

        <div className={styles.medicalHistoryGrid}>
          {completedMedicalHistory.map((item) => {
            const linkedAnalysis = item.linked_analysis;

            return (
              <article key={item.report.id} className={styles.historyCard}>
                <div className={styles.historyHeader}>
                  <div>
                    <strong>
                      {item.appointment?.date || "Unknown date"} •{" "}
                      {item.appointment?.services || "Consultation"}
                    </strong>
                    <span>Doctor: {item.doctor?.name || "Unknown"}</span>
                  </div>

                  <span className={`${styles.statusBadge} ${styles.badgeCompleted}`}>
                    Completed
                  </span>
                </div>

                {linkedAnalysis?.image_path && (
                  <img
                    src={buildImageUrl(linkedAnalysis.image_path)}
                    alt="Completed AI analysis"
                    className={styles.historyImage}
                  />
                )}

                <div className={styles.historyBody}>
                  <p>
                    <b>AI Result:</b>{" "}
                    {linkedAnalysis?.condition
                      ? `${linkedAnalysis.condition} • ${
                          linkedAnalysis.severity || "—"
                        }`
                      : "No linked AI result"}
                  </p>

                  <p>
                    <b>Doctor Diagnosis:</b>{" "}
                    {item.report.doctor_final_diagnosis || "—"}
                  </p>

                  <p>
                    <b>Prescription:</b>{" "}
                    {item.report.doctor_prescription || "—"}
                  </p>

                  <p>
                    <b>Follow-up Plan:</b>{" "}
                    {item.report.follow_up_plan || "—"}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <>
      <DoctorNavbar />

      <main className={styles.pageShell}>
        <section className={styles.pageHeader}>
          <div>
       
            <h1>AI Skin Analysis</h1>
            <p>
              Run AI scans, complete doctor assessment, review final reports, and
              maintain patient medical history.
            </p>
          </div>
        </section>

        {loading ? (
          <section className={styles.workflowCard}>
            <div className={styles.emptyState}>
              Loading AI analysis workspace...
            </div>
          </section>
        ) : !selectedPatient ? (
          <section className={styles.patientPickerShell}>
            <div className={styles.patientPickerCard}>
              <div className={styles.patientPickerHeader}>
                <div>
                 
                  <h2>Patients</h2>
                  <p>
                    Search and select a patient to open the clinical AI analysis
                    workspace.
                  </p>
                </div>
              </div>

              <div className={styles.searchBox}>
                <label htmlFor="patient_search">Search Patient</label>
                <input
                  id="patient_search"
                  type="text"
                  placeholder="Search by name or email"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className={styles.patientListPicker}>
                {filteredPatients.length === 0 ? (
                  <div className={styles.emptyStateSmall}>
                    No patient matched your search.
                  </div>
                ) : (
                  filteredPatients.map((item) => {
                    const meta = getPatientListMeta(item.patient.id);

                    return (
                      <button
                        key={item.patient.id}
                        type="button"
                        className={styles.patientItem}
                        onClick={() => selectPatient(item.patient.id)}
                      >
                        <div className={styles.patientItemTop}>
                          <div>
                            <strong>
                              {item.patient.name || "Unnamed patient"}
                            </strong>
                            <span>
                              {item.latest_report?.doctor_final_diagnosis ||
                                "No diagnosis yet"}
                            </span>
                          </div>

                          <span className={meta.badgeClass}>{meta.label}</span>
                        </div>

                        <div className={styles.patientItemFooter}>
                          <span>{meta.latestVisitText}</span>
                          <span>
                            {item.total_reports} report
                            {item.total_reports > 1 ? "s" : ""}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.selectedPatientShell}>
            <section className={styles.patientSummaryCard}>
              <div className={styles.patientIdentity}>
                <div className={styles.avatarCircle}>
                  {(selectedPatient.patient.name || "P")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>

                <div>
                  <h2>{selectedPatient.patient.name || "Unnamed patient"}</h2>
                  <p>{selectedPatient.patient.email || "No email available"}</p>
                </div>
              </div>

              <div className={styles.patientHeaderActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={changePatient}
                >
                  Change Patient
                </button>

                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={openPatientRecord}
                >
                  Open Patient Record
                </button>
              </div>

              <div className={styles.summaryMetrics}>
                <div>
                  <span className={styles.infoLabel}>Reports</span>
                  <strong>{selectedPatient.total_reports}</strong>
                </div>

                <div>
                  <span className={styles.infoLabel}>Latest Diagnosis</span>
                  <strong>
                    {selectedPatient.latest_report?.doctor_final_diagnosis ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span className={styles.infoLabel}>Latest Visit</span>
                  <strong>
                    {selectedPatientAllVisits[0]
                      ? `${selectedPatientAllVisits[0].date} • ${selectedPatientAllVisits[0].services}`
                      : "No visit yet"}
                  </strong>
                </div>

                <div>
                  <span className={styles.infoLabel}>Selected Visit</span>
                  <strong>
                    {targetAppointment
                      ? `${targetAppointment.date} • ${targetAppointment.services}`
                      : "No valid visit"}
                  </strong>
                </div>
              </div>

              <div className={styles.visitSelector}>
                <label htmlFor="appointment_selector">Visit to Review</label>
                <select
                  id="appointment_selector"
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
            </section>

            <section className={styles.stepperCard}>
              <button
                type="button"
                className={`${styles.stepButton} ${
                  activeStage === "scan" ? styles.stepButtonActive : ""
                }`}
                onClick={() => setActiveStage("scan")}
              >
                <span>1</span>
                AI Scan
              </button>

              <button
                type="button"
                className={`${styles.stepButton} ${
                  activeStage === "reports" ? styles.stepButtonActive : ""
                }`}
                onClick={() => setActiveStage("reports")}
              >
                <span>2</span>
                Final Reports
              </button>

              <button
                type="button"
                className={`${styles.stepButton} ${
                  activeStage === "history" ? styles.stepButtonActive : ""
                }`}
                onClick={() => setActiveStage("history")}
              >
                <span>3</span>
                History
              </button>
            </section>

            {isCompletedTarget && (
              <div className={styles.readOnlyBanner}>
                This selected visit is completed. You may review the AI result
                and final doctor report in read-only mode.
              </div>
            )}

            {activeStage === "scan" && renderScanStage()}
            {activeStage === "reports" && renderReportsStage()}
            {activeStage === "history" && renderHistoryStage()}
          </section>
        )}
      </main>
    </>
  );
}