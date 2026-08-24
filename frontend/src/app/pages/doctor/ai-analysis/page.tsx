"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "@/app/styles/ai-clinical.module.css";
import {
  createDoctorFollowUp,
  getDoctorAppointments,
  getDoctorPatients,
  type DoctorPatientListItem,
} from "@/lib/doctor-api";
import {
  analyzeClinicalAppointment,
  completeClinicalDoctorAssessment,
  getClinicalAppointmentAnalyses,
  getClinicalDiagnosisReport,
  type ClinicalAIAnalysis,
  type ClinicalAnalysisInput,
  type M4Appointment,
  type M4DiagnosisReport,
  type MedicationSuggestion,
  type PregnancyStatus,
} from "@/lib/doctor-ai-api";

type PrescriptionDraft = {
  medication: string;
  usage: string;
  reason: string;
};

type AssessmentDraft = {
  finalDiagnosis: string;
  doctorNotes: string;
  prescriptionItems: PrescriptionDraft[];
  followUpPlan: string;
};

type VisitRecord = {
  appointment: M4Appointment;
  analyses: ClinicalAIAnalysis[];
  report: M4DiagnosisReport | null;
  linkedAnalysis: ClinicalAIAnalysis | null;
};

const emptyContext: ClinicalAnalysisInput = {
  bodySite: "",
  duration: "",
  symptoms: "",
  progression: "",
  doctorObservation: "",
  knownAllergies: "",
  currentMedications: "",
  pregnancyStatus: "UNKNOWN",
  medicationContextReviewed: false,
};

const emptyAssessment: AssessmentDraft = {
  finalDiagnosis: "",
  doctorNotes: "",
  prescriptionItems: [{ medication: "", usage: "", reason: "" }],
  followUpPlan: "",
};

const blockedStatus = (status?: string | null) => {
  const value = (status || "").toLowerCase();
  return value === "declined" || value === "cancelled";
};

const appointmentDateTime = (appointment: M4Appointment) =>
  new Date(`${appointment.date}T${appointment.time || "00:00:00"}`);

const canAnalyzeAppointment = (appointment: M4Appointment | null) => {
  if (!appointment || appointment.status !== "Approved") return false;
  const scheduled = appointmentDateTime(appointment);
  return !Number.isNaN(scheduled.getTime()) && scheduled <= new Date();
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const prettyToken = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const normalizeStringList = (value?: string[] | string | null) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value
    .split("\n")
    .map((item) => item.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
};

const analysisTitle = (analysis: ClinicalAIAnalysis | null) => {
  if (!analysis) return "No AI result";
  if (analysis.kind === "legacy") return analysis.condition || "Legacy AI result";
  return (
    analysis.primary_condition_display ||
    prettyToken(analysis.status) ||
    "AI decision-support result"
  );
};

const chooseVisit = (appointments: M4Appointment[]) => {
  const visible = appointments
    .filter((item) => item.patient_id && !blockedStatus(item.status))
    .sort((a, b) => appointmentDateTime(b).getTime() - appointmentDateTime(a).getTime());
  return (
    visible.find((item) => canAnalyzeAppointment(item)) ||
    visible.find((item) => item.status === "Completed") ||
    visible[0] ||
    null
  );
};

const buildPatientList = (
  reportPatients: DoctorPatientListItem[],
  appointments: M4Appointment[]
) => {
  const map = new Map<number, DoctorPatientListItem>();
  reportPatients.forEach((item) => {
    if (item.patient?.id) map.set(item.patient.id, item);
  });

  [...appointments]
    .filter((item) => item.patient_id && !blockedStatus(item.status))
    .sort((a, b) => appointmentDateTime(b).getTime() - appointmentDateTime(a).getTime())
    .forEach((appointment) => {
      if (!appointment.patient_id) return;
      const existing = map.get(appointment.patient_id);
      if (!existing) {
        map.set(appointment.patient_id, {
          patient: {
            id: appointment.patient_id,
            name: appointment.patient_name,
            email: appointment.patient_email,
          },
          latest_report: null,
          latest_appointment: appointment,
          total_reports: 0,
        });
      } else if (!existing.latest_appointment) {
        map.set(appointment.patient_id, {
          ...existing,
          latest_appointment: appointment,
        });
      }
    });

  return Array.from(map.values()).sort((a, b) =>
    (a.patient.name || "").localeCompare(b.patient.name || "")
  );
};

function DoctorAiAnalysisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPatientId = Number(searchParams.get("patient_id") || 0) || null;
  const initialAppointmentId = Number(searchParams.get("appointment_id") || 0) || null;

  const [patients, setPatients] = useState<DoctorPatientListItem[]>([]);
  const [appointments, setAppointments] = useState<M4Appointment[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(initialPatientId);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(initialAppointmentId);
  const [analyses, setAnalyses] = useState<ClinicalAIAnalysis[]>([]);
  const [history, setHistory] = useState<VisitRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"workspace" | "history">("workspace");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [context, setContext] = useState<ClinicalAnalysisInput>(emptyContext);
  const [assessment, setAssessment] = useState<AssessmentDraft>(emptyAssessment);
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const refreshBase = async () => {
    const [patientData, appointmentData] = await Promise.all([
      getDoctorPatients(),
      getDoctorAppointments("All"),
    ]);
    const nextAppointments = (Array.isArray(appointmentData) ? appointmentData : []) as M4Appointment[];
    setAppointments(nextAppointments);
    setPatients(buildPatientList(Array.isArray(patientData) ? patientData : [], nextAppointments));
    return nextAppointments;
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    if (!token || role !== "doctor") {
      router.push("/");
      return;
    }

    refreshBase()
      .then((nextAppointments) => {
        if (selectedPatientId) {
          const patientVisits = nextAppointments.filter(
            (item) => item.patient_id === selectedPatientId && !blockedStatus(item.status)
          );
          const requested = patientVisits.find((item) => item.id === selectedAppointmentId);
          const fallback = requested || chooseVisit(patientVisits);
          setSelectedAppointmentId(fallback?.id || null);
        }
      })
      .catch((error) =>
        setNotice({ type: "error", text: error instanceof Error ? error.message : "Failed to load doctor AI workspace." })
      )
      .finally(() => setLoading(false));
    // Initial selection is intentionally read once from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const selectedPatient = useMemo(
    () => patients.find((item) => item.patient.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  const patientVisits = useMemo(
    () =>
      appointments
        .filter((item) => item.patient_id === selectedPatientId && !blockedStatus(item.status))
        .sort((a, b) => appointmentDateTime(b).getTime() - appointmentDateTime(a).getTime()),
    [appointments, selectedPatientId]
  );

  const selectedAppointment = useMemo(
    () => patientVisits.find((item) => item.id === selectedAppointmentId) || null,
    [patientVisits, selectedAppointmentId]
  );

  const latestAnalysis = useMemo(
    () =>
      [...analyses].sort(
        (a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
      )[0] || null,
    [analyses]
  );

  const filteredPatients = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return patients;
    return patients.filter((item) =>
      `${item.patient.name || ""} ${item.patient.email || ""}`.toLowerCase().includes(keyword)
    );
  }, [patients, searchTerm]);

  const loadAnalyses = async (appointmentId: number | null) => {
    if (!appointmentId) {
      setAnalyses([]);
      return;
    }
    setLoadingAnalyses(true);
    try {
      const data = await getClinicalAppointmentAnalyses(appointmentId);
      setAnalyses(Array.isArray(data) ? data : []);
    } finally {
      setLoadingAnalyses(false);
    }
  };

  const loadHistory = async (patientId: number | null, sourceAppointments = appointments) => {
    if (!patientId) {
      setHistory([]);
      return;
    }
    const visits = sourceAppointments.filter(
      (item) => item.patient_id === patientId && !blockedStatus(item.status)
    );
    const records = await Promise.all(
      visits.map(async (appointment) => {
        const [analysisResult, reportResult] = await Promise.allSettled([
          getClinicalAppointmentAnalyses(appointment.id),
          getClinicalDiagnosisReport(appointment.id),
        ]);
        const visitAnalyses = analysisResult.status === "fulfilled" ? analysisResult.value : [];
        const reportResponse = reportResult.status === "fulfilled" ? reportResult.value : null;
        return {
          appointment,
          analyses: visitAnalyses,
          report: reportResponse?.report || null,
          linkedAnalysis: reportResponse?.linked_analysis || visitAnalyses[0] || null,
        };
      })
    );
    setHistory(
      records.sort((a, b) => appointmentDateTime(b.appointment).getTime() - appointmentDateTime(a.appointment).getTime())
    );
  };

  useEffect(() => {
    loadAnalyses(selectedAppointmentId).catch((error) =>
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Failed to load AI analyses." })
    );
  }, [selectedAppointmentId]);

  useEffect(() => {
    loadHistory(selectedPatientId).catch(() => setHistory([]));
  }, [selectedPatientId, appointments]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedPatientId) params.set("patient_id", String(selectedPatientId));
    if (selectedAppointmentId) params.set("appointment_id", String(selectedAppointmentId));
    router.replace(`/pages/doctor/ai-analysis${params.toString() ? `?${params}` : ""}`);
  }, [router, selectedPatientId, selectedAppointmentId]);

  const selectPatient = (patientId: number) => {
    const visits = appointments.filter(
      (item) => item.patient_id === patientId && !blockedStatus(item.status)
    );
    setSelectedPatientId(patientId);
    setSelectedAppointmentId(chooseVisit(visits)?.id || null);
    setAssessment(emptyAssessment);
    setContext(emptyContext);
    setSelectedFile(null);
    setNotice(null);
    setActiveTab("workspace");
  };

  const handleAnalyze = async () => {
    if (!selectedAppointment || !selectedFile) {
      setNotice({ type: "error", text: "Select an eligible visit and a skin image first." });
      return;
    }
    if (!canAnalyzeAppointment(selectedAppointment)) {
      setNotice({ type: "error", text: "AI analysis is available only after an approved appointment has started." });
      return;
    }

    setUploading(true);
    setNotice(null);
    try {
      await analyzeClinicalAppointment(selectedAppointment.id, selectedFile, context);
      setSelectedFile(null);
      await loadAnalyses(selectedAppointment.id);
      await loadHistory(selectedPatientId);
      setNotice({ type: "success", text: "Structured AI decision-support analysis completed." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "AI analysis failed." });
    } finally {
      setUploading(false);
    }
  };

  const addMedicationSuggestion = (suggestion: MedicationSuggestion) => {
    setAssessment((previous) => {
      const duplicate = previous.prescriptionItems.some(
        (item) => item.medication.trim().toLowerCase() === suggestion.name_or_class.toLowerCase()
      );
      if (duplicate) return previous;
      const blankOnly =
        previous.prescriptionItems.length === 1 &&
        !previous.prescriptionItems[0].medication &&
        !previous.prescriptionItems[0].usage &&
        !previous.prescriptionItems[0].reason;
      const item = {
        medication: suggestion.name_or_class,
        usage: "",
        reason: suggestion.role,
      };
      return {
        ...previous,
        prescriptionItems: blankOnly ? [item] : [...previous.prescriptionItems, item],
      };
    });
  };

  const updatePrescription = (index: number, field: keyof PrescriptionDraft, value: string) => {
    setAssessment((previous) => ({
      ...previous,
      prescriptionItems: previous.prescriptionItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const buildPrescriptionText = () =>
    assessment.prescriptionItems
      .filter((item) => item.medication.trim() || item.usage.trim() || item.reason.trim())
      .map(
        (item) =>
          `Medication: ${item.medication.trim() || "—"} | Usage: ${item.usage.trim() || "—"} | Reason: ${item.reason.trim() || "—"}`
      )
      .join("\n");

  const handleSaveAssessment = async () => {
    if (!selectedAppointment || !latestAnalysis) {
      setNotice({ type: "error", text: "Run or select an AI analysis before completing this visit." });
      return;
    }
    if (!assessment.finalDiagnosis.trim()) {
      setNotice({ type: "error", text: "Doctor final diagnosis is required." });
      return;
    }
    if (scheduleFollowUp && !followUpDate) {
      setNotice({ type: "error", text: "Choose a follow-up date or turn off follow-up scheduling." });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      await completeClinicalDoctorAssessment(selectedAppointment.id, {
        ai_analysis_run_id: latestAnalysis.kind === "clinical_run" ? latestAnalysis.id : null,
        skin_analysis_id: latestAnalysis.kind === "legacy" ? latestAnalysis.id : null,
        doctor_final_diagnosis: assessment.finalDiagnosis.trim(),
        doctor_prescription: buildPrescriptionText(),
        after_appointment_notes: assessment.doctorNotes.trim(),
        follow_up_plan: assessment.followUpPlan.trim(),
        next_visit_date: scheduleFollowUp ? followUpDate : null,
      });

      if (scheduleFollowUp && followUpDate) {
        await createDoctorFollowUp({
          appointment_id: selectedAppointment.id,
          follow_up_date: followUpDate,
          reason: followUpReason.trim() || assessment.followUpPlan.trim() || "Follow-up consultation",
          notes: assessment.doctorNotes.trim(),
        });
      }

      const nextAppointments = await refreshBase();
      await loadHistory(selectedPatientId, nextAppointments);
      await loadAnalyses(selectedAppointment.id);
      setActiveTab("history");
      setNotice({ type: "success", text: "Doctor assessment saved. The visit is now complete." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Failed to save doctor assessment." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loadingPage}>Loading AI clinical workspace…</div>;
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Doctor Clinical Decision Support</span>
          <h1>AI Analysis</h1>
          <p>
            Review image-based findings, service compatibility, and medication options before recording your own diagnosis and plan.
          </p>
        </div>
        <div className={styles.heroNote}>AI supports clinical review. It does not replace physician judgment.</div>
      </header>

      {notice && (
        <div className={`${styles.notice} ${notice.type === "error" ? styles.noticeError : styles.noticeSuccess}`}>
          {notice.text}
        </div>
      )}

      <div className={styles.layout}>
        <aside className={styles.patientPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Patients</span>
              <h2>Select a patient</h2>
            </div>
          </div>
          <input
            className={styles.searchInput}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search name or email"
          />
          <div className={styles.patientList}>
            {filteredPatients.map((item) => (
              <button
                key={item.patient.id}
                type="button"
                onClick={() => selectPatient(item.patient.id)}
                className={`${styles.patientItem} ${selectedPatientId === item.patient.id ? styles.patientItemActive : ""}`}
              >
                <strong>{item.patient.name || "Unnamed patient"}</strong>
                <span>{item.patient.email || "No email"}</span>
              </button>
            ))}
            {filteredPatients.length === 0 && <div className={styles.empty}>No matching patients.</div>}
          </div>
        </aside>

        <section className={styles.workspace}>
          {!selectedPatient ? (
            <div className={styles.emptyLarge}>
              <h2>Select a patient to begin</h2>
              <p>The workspace will show their eligible visits, AI results, and completed history.</p>
            </div>
          ) : (
            <>
              <div className={styles.patientBanner}>
                <div>
                  <span className={styles.eyebrow}>Current Patient</span>
                  <h2>{selectedPatient.patient.name}</h2>
                  <p>{selectedPatient.patient.email}</p>
                </div>
                <div className={styles.visitPicker}>
                  <label htmlFor="visit">Target visit</label>
                  <select
                    id="visit"
                    value={selectedAppointmentId || ""}
                    onChange={(event) => {
                      setSelectedAppointmentId(Number(event.target.value) || null);
                      setSelectedFile(null);
                      setAssessment(emptyAssessment);
                      setNotice(null);
                    }}
                  >
                    <option value="">Select visit</option>
                    {patientVisits.map((visit) => (
                      <option key={visit.id} value={visit.id}>
                        {visit.date} • {visit.services} • {visit.status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.tabs}>
                <button className={activeTab === "workspace" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("workspace")}>
                  AI Workspace
                </button>
                <button className={activeTab === "history" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("history")}>
                  History
                </button>
              </div>

              {activeTab === "workspace" ? (
                <>
                  {selectedAppointment && (
                    <section className={styles.contextCard}>
                      <div className={styles.contextSummary}>
                        <div><span>Booked service</span><strong>{selectedAppointment.services}</strong></div>
                        <div><span>Appointment concern</span><strong>{selectedAppointment.concern || "Not provided"}</strong></div>
                        <div><span>Status</span><strong>{selectedAppointment.status}</strong></div>
                        <div><span>Patient age</span><strong>{selectedAppointment.patient_age_label || selectedAppointment.patient_age || "—"}</strong></div>
                      </div>
                    </section>
                  )}

                  {selectedAppointment?.status !== "Completed" && (
                    <section className={styles.card}>
                      <div className={styles.cardHeader}>
                        <div><span className={styles.eyebrow}>Clinical context</span><h2>Prepare the analysis</h2></div>
                        <span className={styles.muted}>Optional context improves relevance; patient identity is not sent to the vision provider.</span>
                      </div>

                      <div className={styles.formGrid}>
                        <label>Body site<input value={context.bodySite || ""} onChange={(e) => setContext((p) => ({ ...p, bodySite: e.target.value }))} placeholder="e.g. face, left forearm" /></label>
                        <label>Duration<input value={context.duration || ""} onChange={(e) => setContext((p) => ({ ...p, duration: e.target.value }))} placeholder="e.g. 3 weeks" /></label>
                        <label>Symptoms<input value={context.symptoms || ""} onChange={(e) => setContext((p) => ({ ...p, symptoms: e.target.value }))} placeholder="itching, pain, burning" /></label>
                        <label>Progression<select value={context.progression || ""} onChange={(e) => setContext((p) => ({ ...p, progression: e.target.value }))}><option value="">Not provided</option><option value="stable">Stable</option><option value="improving">Improving</option><option value="worsening">Worsening</option><option value="spreading">Spreading</option></select></label>
                        <label className={styles.fullField}>Doctor observation<textarea value={context.doctorObservation || ""} onChange={(e) => setContext((p) => ({ ...p, doctorObservation: e.target.value }))} placeholder="Short visual/clinical observation before AI review" /></label>
                      </div>

                      <div className={styles.safetyBox}>
                        <div className={styles.safetyHeader}><div><strong>Medication safety context</strong><p>Used locally for physician-facing medication suggestions.</p></div></div>
                        <div className={styles.formGrid}>
                          <label>Known allergies<input value={context.knownAllergies || ""} onChange={(e) => setContext((p) => ({ ...p, knownAllergies: e.target.value }))} placeholder="comma-separated, if known" /></label>
                          <label>Current medications<input value={context.currentMedications || ""} onChange={(e) => setContext((p) => ({ ...p, currentMedications: e.target.value }))} placeholder="comma-separated, if known" /></label>
                          <label>Pregnancy / breastfeeding<select value={context.pregnancyStatus || "UNKNOWN"} onChange={(e) => setContext((p) => ({ ...p, pregnancyStatus: e.target.value as PregnancyStatus }))}><option value="UNKNOWN">Unknown / not reviewed</option><option value="NOT_APPLICABLE">Not applicable</option><option value="NOT_PREGNANT">Not pregnant</option><option value="PREGNANT">Pregnant</option><option value="BREASTFEEDING">Breastfeeding</option></select></label>
                          <label className={styles.checkboxLabel}><input type="checkbox" checked={Boolean(context.medicationContextReviewed)} onChange={(e) => setContext((p) => ({ ...p, medicationContextReviewed: e.target.checked }))} /><span>I reviewed the available medication-safety context.</span></label>
                        </div>
                      </div>

                      <div className={styles.uploadGrid}>
                        <label className={styles.uploadBox}>
                          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
                          {previewUrl ? <img src={previewUrl} alt="Selected skin image preview" /> : <div><strong>Choose a skin image</strong><span>JPG, PNG, or WEBP • max 8 MB</span></div>}
                        </label>
                        <div className={styles.uploadActions}>
                          <p>{canAnalyzeAppointment(selectedAppointment) ? "Ready for analysis." : "Analysis becomes available after the approved appointment starts."}</p>
                          <button className={styles.primaryButton} disabled={!selectedFile || !canAnalyzeAppointment(selectedAppointment) || uploading} onClick={handleAnalyze}>
                            {uploading ? "Analyzing…" : "Run AI analysis"}
                          </button>
                        </div>
                      </div>
                    </section>
                  )}

                  <section className={styles.card}>
                    <div className={styles.cardHeader}><div><span className={styles.eyebrow}>AI decision support</span><h2>Latest structured result</h2></div>{latestAnalysis && <span className={styles.runMeta}>{formatDateTime(latestAnalysis.created_at)}</span>}</div>
                    {loadingAnalyses ? <div className={styles.empty}>Loading AI result…</div> : <AnalysisResult analysis={latestAnalysis} onAddMedication={addMedicationSuggestion} />}
                  </section>

                  {latestAnalysis && selectedAppointment?.status === "Approved" && (
                    <section className={styles.card}>
                      <div className={styles.cardHeader}><div><span className={styles.eyebrow}>Physician record</span><h2>Doctor final assessment</h2></div><span className={styles.muted}>Only your entries become the final clinical report.</span></div>
                      <div className={styles.formGrid}>
                        <label className={styles.fullField}>Final diagnosis<div className={styles.inlineAction}><input value={assessment.finalDiagnosis} onChange={(e) => setAssessment((p) => ({ ...p, finalDiagnosis: e.target.value }))} placeholder="Doctor-confirmed diagnosis" /><button type="button" className={styles.secondaryButton} disabled={!latestAnalysis.primary_condition_display} onClick={() => setAssessment((p) => ({ ...p, finalDiagnosis: latestAnalysis.primary_condition_display || p.finalDiagnosis }))}>Use as consideration</button></div></label>
                        <label className={styles.fullField}>Doctor notes<textarea value={assessment.doctorNotes} onChange={(e) => setAssessment((p) => ({ ...p, doctorNotes: e.target.value }))} placeholder="Clinical findings and reasoning for the official record" /></label>
                      </div>

                      <div className={styles.prescriptionSection}>
                        <div className={styles.sectionHeading}><div><strong>Prescription / treatment plan</strong><p>AI medication options only prefill the medication name and rationale. You set instructions.</p></div><button type="button" className={styles.secondaryButton} onClick={() => setAssessment((p) => ({ ...p, prescriptionItems: [...p.prescriptionItems, { medication: "", usage: "", reason: "" }] }))}>Add item</button></div>
                        {assessment.prescriptionItems.map((item, index) => (
                          <div className={styles.prescriptionRow} key={index}>
                            <input value={item.medication} onChange={(e) => updatePrescription(index, "medication", e.target.value)} placeholder="Medication / treatment" />
                            <input value={item.usage} onChange={(e) => updatePrescription(index, "usage", e.target.value)} placeholder="Doctor instructions" />
                            <input value={item.reason} onChange={(e) => updatePrescription(index, "reason", e.target.value)} placeholder="Clinical rationale" />
                            <button type="button" className={styles.iconButton} onClick={() => setAssessment((p) => ({ ...p, prescriptionItems: p.prescriptionItems.length === 1 ? [{ medication: "", usage: "", reason: "" }] : p.prescriptionItems.filter((_, i) => i !== index) }))}>Remove</button>
                          </div>
                        ))}
                      </div>

                      <label className={styles.fullField}>Follow-up plan<textarea value={assessment.followUpPlan} onChange={(e) => setAssessment((p) => ({ ...p, followUpPlan: e.target.value }))} placeholder="Monitoring, return precautions, or next clinical step" /></label>
                      <div className={styles.followUpBox}>
                        <label className={styles.checkboxLabel}><input type="checkbox" checked={scheduleFollowUp} onChange={(e) => setScheduleFollowUp(e.target.checked)} /><span>Schedule a follow-up visit</span></label>
                        {scheduleFollowUp && <div className={styles.formGrid}><label>Follow-up date<input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} /></label><label>Reason<input value={followUpReason} onChange={(e) => setFollowUpReason(e.target.value)} placeholder="Optional reason" /></label></div>}
                      </div>
                      <div className={styles.saveRow}><button className={styles.primaryButton} disabled={saving} onClick={handleSaveAssessment}>{saving ? "Saving…" : "Complete visit with doctor assessment"}</button></div>
                    </section>
                  )}
                </>
              ) : (
                <HistoryView records={history} />
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function AnalysisResult({ analysis, onAddMedication }: { analysis: ClinicalAIAnalysis | null; onAddMedication: (item: MedicationSuggestion) => void }) {
  if (!analysis) return <div className={styles.empty}>No AI result for this visit yet.</div>;

  if (analysis.kind === "legacy") {
    return (
      <div className={styles.legacyBox}>
        <div className={styles.resultHeader}><div><span className={styles.legacyBadge}>Historical legacy AI</span><h3>{analysis.condition || "Legacy result"}</h3></div><span>{formatDateTime(analysis.created_at)}</span></div>
        <p>{analysis.key_findings || analysis.recommendation || "Historical AI result retained for continuity."}</p>
        <div className={styles.warningCallout}>Legacy results may include old confidence/severity logic. Use them as historical reference only.</div>
      </div>
    );
  }

  const qualityIssues = analysis.image_quality?.issues || [];
  const redFlags = normalizeStringList(analysis.red_flags);
  const imageUrl = analysis.image_url || analysis.image_path || null;

  return (
    <div className={styles.resultStack}>
      <div className={styles.resultHeader}>
        <div><span className={`${styles.statusBadge} ${styles[`status${analysis.status || "FAILED"}`] || ""}`}>{prettyToken(analysis.status)}</span><h3>{analysisTitle(analysis)}</h3><p>{analysis.evidence_strength ? `${prettyToken(analysis.evidence_strength)} evidence` : "No evidence strength assigned"}</p></div>
        <div className={styles.resultHeaderMeta}><span>{analysis.model_id || "Model not recorded"}</span><span>{analysis.latency_ms != null ? `${analysis.latency_ms} ms` : "—"}</span></div>
      </div>

      <div className={styles.resultTopGrid}>
        <div className={styles.imageCard}>{imageUrl ? <img src={imageUrl} alt="Analyzed dermatology image" /> : <div className={styles.empty}>Image unavailable</div>}<div className={styles.qualityLine}><strong>Image quality:</strong> {analysis.image_quality?.usable ? "usable" : "retake recommended"}{qualityIssues.length > 0 && <span> • {qualityIssues.map(prettyToken).join(", ")}</span>}</div></div>
        <div className={styles.summaryGrid}>
          <div className={styles.metricCard}><span>Primary consideration</span><strong>{analysis.primary_condition_display || "No supported match"}</strong></div>
          <div className={styles.metricCard}><span>Evidence strength</span><strong>{prettyToken(analysis.evidence_strength) || "—"}</strong></div>
          <div className={styles.metricCard}><span>Apparent severity</span><strong>{analysis.severity_assessment?.assessable ? prettyToken(analysis.severity_assessment.level) : "Not reliably assessable"}</strong><p>{analysis.severity_assessment?.reason}</p></div>
          <div className={styles.metricCard}><span>Booked service</span><strong>{analysis.booked_service_name || "—"}</strong></div>
        </div>
      </div>

      <section className={styles.resultSection}><div className={styles.sectionHeading}><div><strong>Visual findings</strong><p>Observable features returned by the image-analysis layer.</p></div></div>{analysis.visual_findings?.length ? <div className={styles.findingGrid}>{analysis.visual_findings.map((item, index) => <div className={styles.findingCard} key={`${item.finding}-${index}`}><strong>{item.finding}</strong>{item.location && <span>{item.location}</span>}<p>{item.description || ""}</p></div>)}</div> : <div className={styles.empty}>No structured visual findings.</div>}</section>

      <section className={styles.resultSection}><div className={styles.sectionHeading}><div><strong>Differential considerations</strong><p>Alternatives remain possibilities, not confirmed diagnoses.</p></div></div>{analysis.differentials?.length ? <div className={styles.differentialList}>{analysis.differentials.map((item) => <div key={item.condition_code}><div><strong>{item.display_name}</strong><span>{prettyToken(item.evidence_strength)}</span></div><p>{item.reason}</p></div>)}</div> : <div className={styles.empty}>No additional differential returned.</div>}</section>

      <section className={`${styles.resultSection} ${styles.compatibilitySection}`}><div className={styles.sectionHeading}><div><strong>Booked-service compatibility</strong><p>{analysis.compatibility_reason || "No compatibility assessment available."}</p></div><span className={styles.compatibilityBadge}>{prettyToken(analysis.service_compatibility) || "Not assessed"}</span></div>{analysis.service_recommendations?.length ? <div className={styles.serviceGrid}>{analysis.service_recommendations.map((item) => <div className={styles.serviceCard} key={`${item.service_id}-${item.relationship_type}`}><span>{prettyToken(item.relationship_type)}</span><strong>{item.service_name}</strong><p>{item.reason}</p></div>)}</div> : null}</section>

      <section className={styles.resultSection}><div className={styles.sectionHeading}><div><strong>Medication options for doctor review</strong><p>{analysis.medication_guidance || "No medication guidance available."}</p></div></div>{analysis.medication_suggestions?.length ? <div className={styles.medicationGrid}>{analysis.medication_suggestions.map((item) => <div className={styles.medicationCard} key={item.name_or_class}><div><strong>{item.name_or_class}</strong>{item.requires_more_context && <span className={styles.contextNeeded}>More context needed</span>}</div><p>{item.role}</p>{item.considerations?.length > 0 && <ul>{item.considerations.map((note) => <li key={note}>{note}</li>)}</ul>}<button type="button" className={styles.secondaryButton} onClick={() => onAddMedication(item)}>Add to prescription draft</button></div>)}</div> : <div className={styles.empty}>No medication options generated for this result.</div>}</section>

      {redFlags.length > 0 && <section className={`${styles.resultSection} ${styles.redFlagSection}`}><strong>Visible warning features</strong><ul>{redFlags.map((item) => <li key={item}>{item}</li>)}</ul></section>}
      {analysis.limitations?.length ? <section className={styles.limitations}><strong>Limitations</strong><ul>{analysis.limitations.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
    </div>
  );
}

function HistoryView({ records }: { records: VisitRecord[] }) {
  const meaningful = records.filter((item) => item.report || item.analyses.length > 0);
  if (meaningful.length === 0) return <div className={styles.emptyLarge}><h2>No AI history yet</h2><p>Completed reports and prior AI runs will appear here.</p></div>;

  return (
    <div className={styles.historyList}>
      {meaningful.map((record) => (
        <article className={styles.historyCard} key={record.appointment.id}>
          <div className={styles.historyHeader}><div><span>{record.appointment.date} • {record.appointment.services}</span><h3>{record.report?.doctor_final_diagnosis || analysisTitle(record.linkedAnalysis)}</h3></div><span className={styles.statusBadge}>{record.appointment.status}</span></div>
          <div className={styles.historyGrid}>
            <div><span>Doctor final diagnosis</span><strong>{record.report?.doctor_final_diagnosis || "Not completed"}</strong></div>
            <div><span>Linked AI consideration</span><strong>{analysisTitle(record.linkedAnalysis)}</strong></div>
            <div><span>AI runs</span><strong>{record.analyses.length}</strong></div>
            <div><span>Report updated</span><strong>{formatDateTime(record.report?.updated_at)}</strong></div>
          </div>
          {record.report?.doctor_prescription && <div className={styles.historyText}><span>Doctor prescription / plan</span><pre>{record.report.doctor_prescription}</pre></div>}
          {record.report?.follow_up_plan && <div className={styles.historyText}><span>Follow-up plan</span><p>{record.report.follow_up_plan}</p></div>}
        </article>
      ))}
    </div>
  );
}

export default function DoctorAiAnalysisPage() {
  return (
    <Suspense fallback={<div className={styles.loadingPage}>Loading AI clinical workspace…</div>}>
      <DoctorAiAnalysisContent />
    </Suspense>
  );
}
