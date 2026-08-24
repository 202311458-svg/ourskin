"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/styles/ai-progress.module.css";
import {
  getDoctorAppointments,
  getDoctorPatients,
  type DoctorPatientListItem,
} from "@/lib/doctor-api";
import { type M4Appointment } from "@/lib/doctor-ai-api";
import {
  analyzeRecoveryProgress,
  getProgressHistory,
  getProgressReferenceOptions,
  reviewProgressRun,
  saveProgressBaseline,
  type CaptureView,
  type ProgressInput,
  type ProgressReferenceOption,
  type ProgressRun,
} from "@/lib/doctor-progress-api";

const CAPTURE_VIEWS: Array<{ value: CaptureView; label: string }> = [
  { value: "FRONT", label: "Front" },
  { value: "LEFT", label: "Left" },
  { value: "RIGHT", label: "Right" },
  { value: "CLOSE_UP", label: "Close-up" },
  { value: "OTHER", label: "Other standardized view" },
  { value: "UNSPECIFIED", label: "Unspecified" },
];

const emptyInput: ProgressInput = {
  captureView: "UNSPECIFIED",
  bodySite: "",
  procedureOrTreatment: "",
  daysSinceProcedure: null,
  doctorObservation: "",
};

const blockedStatus = (status?: string | null) => {
  const value = (status || "").toLowerCase();
  return value === "declined" || value === "cancelled";
};

const appointmentDateTime = (appointment: M4Appointment) =>
  new Date(`${appointment.date}T${appointment.time || "00:00:00"}`);

const canCapture = (appointment: M4Appointment | null) => {
  if (!appointment || appointment.status !== "Approved") return false;
  const scheduled = appointmentDateTime(appointment);
  return !Number.isNaN(scheduled.getTime()) && scheduled <= new Date();
};

const pretty = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const buildPatientList = (
  reportPatients: DoctorPatientListItem[],
  appointments: M4Appointment[]
) => {
  const map = new Map<number, DoctorPatientListItem>();
  reportPatients.forEach((item) => {
    if (item.patient?.id) map.set(item.patient.id, item);
  });
  appointments.forEach((appointment) => {
    if (!appointment.patient_id || blockedStatus(appointment.status)) return;
    if (!map.has(appointment.patient_id)) {
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
    }
  });
  return Array.from(map.values()).sort((a, b) =>
    (a.patient.name || "").localeCompare(b.patient.name || "")
  );
};

export default function DoctorAiProgressPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<DoctorPatientListItem[]>([]);
  const [appointments, setAppointments] = useState<M4Appointment[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [mode, setMode] = useState<"baseline" | "compare">("compare");
  const [references, setReferences] = useState<ProgressReferenceOption[]>([]);
  const [selectedReferenceId, setSelectedReferenceId] = useState<number | null>(null);
  const [history, setHistory] = useState<ProgressRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [input, setInput] = useState<ProgressInput>(emptyInput);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    if (!token || role !== "doctor") {
      router.push("/");
      return;
    }

    Promise.all([getDoctorPatients(), getDoctorAppointments("All")])
      .then(([patientData, appointmentData]) => {
        const nextAppointments = (Array.isArray(appointmentData) ? appointmentData : []) as M4Appointment[];
        setAppointments(nextAppointments);
        setPatients(
          buildPatientList(Array.isArray(patientData) ? patientData : [], nextAppointments)
        );
      })
      .catch((error) =>
        setNotice({
          type: "error",
          text: error instanceof Error ? error.message : "Failed to load progress workspace.",
        })
      )
      .finally(() => setLoading(false));
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

  const filteredPatients = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return patients;
    return patients.filter((item) =>
      `${item.patient.name || ""} ${item.patient.email || ""}`.toLowerCase().includes(keyword)
    );
  }, [patients, search]);

  const patientAppointments = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            appointment.patient_id === selectedPatientId && !blockedStatus(appointment.status)
        )
        .sort((a, b) => appointmentDateTime(b).getTime() - appointmentDateTime(a).getTime()),
    [appointments, selectedPatientId]
  );

  const selectedAppointment = useMemo(
    () => patientAppointments.find((item) => item.id === selectedAppointmentId) || null,
    [patientAppointments, selectedAppointmentId]
  );

  const selectedReference = useMemo(
    () => references.find((item) => item.run_id === selectedReferenceId) || null,
    [references, selectedReferenceId]
  );

  const selectedRun = useMemo(
    () => history.find((item) => item.id === selectedRunId) || history[0] || null,
    [history, selectedRunId]
  );

  const refreshProgressData = async (appointmentId: number | null) => {
    if (!appointmentId) {
      setReferences([]);
      setHistory([]);
      setSelectedReferenceId(null);
      setSelectedRunId(null);
      return;
    }
    const [referenceData, historyData] = await Promise.all([
      getProgressReferenceOptions(appointmentId),
      getProgressHistory(appointmentId),
    ]);
    setReferences(Array.isArray(referenceData) ? referenceData : []);
    setHistory(Array.isArray(historyData) ? historyData : []);
    if (!selectedReferenceId && referenceData.length > 0) {
      setSelectedReferenceId(referenceData[0].run_id);
    }
  };

  useEffect(() => {
    refreshProgressData(selectedAppointmentId).catch((error) =>
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to load progress history.",
      })
    );
    // selectedReferenceId should not retrigger this load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAppointmentId]);

  useEffect(() => {
    if (!selectedReference) return;
    setInput((previous) => ({
      ...previous,
      captureView:
        selectedReference.capture_view !== "UNSPECIFIED"
          ? selectedReference.capture_view
          : previous.captureView,
      bodySite: selectedReference.body_site || previous.bodySite,
      procedureOrTreatment:
        selectedReference.procedure_or_treatment ||
        previous.procedureOrTreatment ||
        selectedAppointment?.services ||
        "",
    }));
  }, [selectedReference, selectedAppointment]);

  const choosePatient = (patientId: number) => {
    const visits = appointments
      .filter((item) => item.patient_id === patientId && !blockedStatus(item.status))
      .sort((a, b) => appointmentDateTime(b).getTime() - appointmentDateTime(a).getTime());
    const captureReady = visits.find(canCapture) || visits[0] || null;
    setSelectedPatientId(patientId);
    setSelectedAppointmentId(captureReady?.id || null);
    setSelectedReferenceId(null);
    setSelectedRunId(null);
    setSelectedFile(null);
    setInput({ ...emptyInput, procedureOrTreatment: captureReady?.services || "" });
    setNotice(null);
  };

  const handleAppointmentChange = (value: string) => {
    const appointmentId = Number(value) || null;
    const appointment = patientAppointments.find((item) => item.id === appointmentId) || null;
    setSelectedAppointmentId(appointmentId);
    setSelectedReferenceId(null);
    setSelectedFile(null);
    setInput({ ...emptyInput, procedureOrTreatment: appointment?.services || "" });
    setNotice(null);
  };

  const handleBaseline = async () => {
    if (!selectedAppointment || !selectedFile) {
      setNotice({ type: "error", text: "Select an eligible appointment and baseline image first." });
      return;
    }
    if (!canCapture(selectedAppointment)) {
      setNotice({ type: "error", text: "Baseline capture is available only after an approved appointment has started." });
      return;
    }
    if (!input.procedureOrTreatment.trim()) {
      setNotice({ type: "error", text: "Enter the procedure or treatment being tracked." });
      return;
    }

    setWorking(true);
    setNotice(null);
    try {
      const response = await saveProgressBaseline(selectedAppointment.id, selectedFile, input);
      setSelectedFile(null);
      await refreshProgressData(selectedAppointment.id);
      setSelectedRunId(response.progress.id);
      setNotice({ type: "success", text: response.message });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Baseline capture failed." });
    } finally {
      setWorking(false);
    }
  };

  const handleCompare = async () => {
    if (!selectedAppointment || !selectedFile || !selectedReferenceId) {
      setNotice({ type: "error", text: "Select a current image and an earlier reference capture first." });
      return;
    }
    if (!canCapture(selectedAppointment)) {
      setNotice({ type: "error", text: "Progress comparison is available only after an approved appointment has started." });
      return;
    }
    if (!input.procedureOrTreatment.trim()) {
      setNotice({ type: "error", text: "Enter the procedure or treatment being tracked." });
      return;
    }

    setWorking(true);
    setNotice(null);
    try {
      const response = await analyzeRecoveryProgress(
        selectedAppointment.id,
        selectedReferenceId,
        selectedFile,
        input
      );
      setSelectedFile(null);
      await refreshProgressData(selectedAppointment.id);
      setSelectedRunId(response.progress.id);
      setNotice({ type: "success", text: response.message });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Progress comparison failed." });
    } finally {
      setWorking(false);
    }
  };

  const handleReview = async (runId: number) => {
    setWorking(true);
    try {
      const response = await reviewProgressRun(runId);
      setHistory((previous) =>
        previous.map((item) => (item.id === runId ? response.progress : item))
      );
      setNotice({ type: "success", text: response.message });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to review progress result." });
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading recovery progress workspace...</div>;
  }

  if (!selectedPatientId) {
    return (
      <main className={styles.page}>
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>AI Recovery & Progress</span>
            <h1>Longitudinal visual follow-up</h1>
            <p>
              Save standardized baseline captures and compare later visits without turning image changes into a fake healing percentage.
            </p>
          </div>
          <button className={styles.secondaryButton} onClick={() => router.push("/pages/doctor/ai-analysis")}>
            Open AI analysis
          </button>
        </header>

        {notice && <div className={`${styles.notice} ${styles[notice.type]}`}>{notice.text}</div>}

        <section className={styles.patientPicker}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>Patient selection</span>
              <h2>Choose a patient to track</h2>
            </div>
            <input
              className={styles.searchInput}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
            />
          </div>
          <div className={styles.patientGrid}>
            {filteredPatients.map((item) => (
              <button key={item.patient.id} className={styles.patientCard} onClick={() => choosePatient(item.patient.id)}>
                <strong>{item.patient.name || "Unnamed patient"}</strong>
                <span>{item.patient.email || "No email"}</span>
              </button>
            ))}
            {filteredPatients.length === 0 && <div className={styles.empty}>No patients found.</div>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>AI Recovery & Progress</span>
          <h1>{patients.find((item) => item.patient.id === selectedPatientId)?.patient.name || "Patient"}</h1>
          <p>Compare like-for-like images across visits. The doctor remains responsible for the clinical interpretation.</p>
        </div>
        <div className={styles.heroActions}>
          <button className={styles.secondaryButton} onClick={() => setSelectedPatientId(null)}>Change patient</button>
          <button className={styles.secondaryButton} onClick={() => router.push("/pages/doctor/ai-analysis")}>AI analysis</button>
        </div>
      </header>

      {notice && <div className={`${styles.notice} ${styles[notice.type]}`}>{notice.text}</div>}

      <section className={styles.visitBar}>
        <label>
          Current visit
          <select value={selectedAppointmentId || ""} onChange={(event) => handleAppointmentChange(event.target.value)}>
            <option value="">Select visit</option>
            {patientAppointments.map((appointment) => (
              <option key={appointment.id} value={appointment.id}>
                {appointment.date} · {appointment.services} · {appointment.status}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.visitMeta}>
          <span>{selectedAppointment?.services || "No service selected"}</span>
          <strong>{selectedAppointment ? (canCapture(selectedAppointment) ? "Ready for capture" : selectedAppointment.status) : "—"}</strong>
        </div>
      </section>

      <div className={styles.workspaceGrid}>
        <section className={styles.capturePanel}>
          <div className={styles.modeTabs}>
            <button className={mode === "compare" ? styles.activeTab : ""} onClick={() => setMode("compare")}>Compare progress</button>
            <button className={mode === "baseline" ? styles.activeTab : ""} onClick={() => setMode("baseline")}>Save baseline</button>
          </div>

          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>{mode === "baseline" ? "Reference capture" : "Longitudinal comparison"}</span>
              <h2>{mode === "baseline" ? "Create a standardized baseline" : "Compare against an earlier visit"}</h2>
            </div>
          </div>

          {mode === "compare" && (
            <div className={styles.fieldFull}>
              <label>Reference capture</label>
              <select
                value={selectedReferenceId || ""}
                onChange={(event) => setSelectedReferenceId(Number(event.target.value) || null)}
              >
                <option value="">Select earlier capture</option>
                {references.map((reference) => (
                  <option key={reference.run_id} value={reference.run_id}>
                    {reference.appointment_date || "Earlier visit"} · {reference.service_name || "Visit"} · {pretty(reference.capture_view)} · {pretty(reference.capture_type)}
                  </option>
                ))}
              </select>
              {references.length === 0 && (
                <p className={styles.helper}>No earlier AI/baseline image is available. Save a baseline during an eligible visit first.</p>
              )}
            </div>
          )}

          {mode === "compare" && selectedReference && (
            <div className={styles.referencePreview}>
              <img src={selectedReference.image_url} alt="Selected reference capture" />
              <div>
                <strong>Reference</strong>
                <span>{selectedReference.appointment_date || "—"}</span>
                <span>{pretty(selectedReference.capture_view)}</span>
                <span>{selectedReference.body_site || "Body site not recorded"}</span>
              </div>
            </div>
          )}

          <div className={styles.formGrid}>
            <label>
              Procedure / treatment
              <input
                value={input.procedureOrTreatment}
                onChange={(event) => setInput((previous) => ({ ...previous, procedureOrTreatment: event.target.value }))}
                placeholder="e.g. Chemical peel, blepharoplasty, acne treatment"
              />
            </label>
            <label>
              Body site
              <input
                value={input.bodySite || ""}
                onChange={(event) => setInput((previous) => ({ ...previous, bodySite: event.target.value }))}
                placeholder="e.g. face, left cheek"
              />
            </label>
            <label>
              Capture view
              <select
                value={input.captureView}
                onChange={(event) => setInput((previous) => ({ ...previous, captureView: event.target.value as CaptureView }))}
              >
                {CAPTURE_VIEWS.map((view) => <option key={view.value} value={view.value}>{view.label}</option>)}
              </select>
            </label>
            {mode === "compare" && (
              <label>
                Days since procedure / treatment
                <input
                  type="number"
                  min={0}
                  max={3650}
                  value={input.daysSinceProcedure ?? ""}
                  onChange={(event) =>
                    setInput((previous) => ({
                      ...previous,
                      daysSinceProcedure: event.target.value === "" ? null : Number(event.target.value),
                    }))
                  }
                  placeholder="Optional"
                />
              </label>
            )}
            <label className={styles.fieldFull}>
              Doctor observation
              <textarea
                value={input.doctorObservation || ""}
                onChange={(event) => setInput((previous) => ({ ...previous, doctorObservation: event.target.value }))}
                placeholder="Optional clinical note; do not include unnecessary identifiers."
              />
            </label>
          </div>

          <label className={styles.uploadBox}>
            {previewUrl ? <img src={previewUrl} alt="Current capture preview" /> : <div><strong>Select current image</strong><span>JPG, PNG, or WEBP · same angle and framing when possible</span></div>}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
          </label>

          <button
            className={styles.primaryButton}
            disabled={working || !selectedFile || !selectedAppointment || (mode === "compare" && !selectedReferenceId)}
            onClick={mode === "baseline" ? handleBaseline : handleCompare}
          >
            {working ? "Processing..." : mode === "baseline" ? "Save baseline capture" : "Compare recovery progress"}
          </button>
        </section>

        <section className={styles.resultPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Latest selected record</span>
              <h2>{selectedRun?.capture_type === "BASELINE" ? "Baseline capture" : "Progress result"}</h2>
            </div>
            {selectedRun?.capture_type !== "BASELINE" && selectedRun?.review_status === "PENDING_REVIEW" && (
              <button className={styles.reviewButton} disabled={working} onClick={() => handleReview(selectedRun.id)}>Mark reviewed</button>
            )}
          </div>

          {!selectedRun ? (
            <div className={styles.empty}>No recovery/progress record yet for this patient.</div>
          ) : (
            <>
              <div className={styles.imageCompare}>
                {selectedRun.reference_image_url && (
                  <figure><img src={selectedRun.reference_image_url} alt="Reference visit" /><figcaption>Reference · {selectedRun.reference_appointment_date || "earlier visit"}</figcaption></figure>
                )}
                <figure><img src={selectedRun.current_image_url} alt="Current visit" /><figcaption>{selectedRun.capture_type === "BASELINE" ? "Baseline" : "Current"} · {selectedRun.appointment_date || "current visit"}</figcaption></figure>
              </div>

              {selectedRun.capture_type === "BASELINE" ? (
                <div className={styles.baselineNote}>
                  <strong>Reference saved</strong>
                  <p>This image passed local quality checks and can be selected during a later visit for same-view comparison.</p>
                </div>
              ) : (
                <>
                  <div className={styles.resultSummary}>
                    <div><span>Visible trend</span><strong>{pretty(selectedRun.progress_trend) || "—"}</strong></div>
                    <div><span>Comparison</span><strong>{selectedRun.comparison_reliable ? "Reliable enough for visual trend" : "Not reliably comparable"}</strong></div>
                    <div><span>Review status</span><strong>{pretty(selectedRun.review_status) || "—"}</strong></div>
                  </div>
                  <div className={styles.summaryText}>
                    <h3>AI comparison summary</h3>
                    <p>{selectedRun.progress_summary || "No summary available."}</p>
                  </div>
                  <div className={styles.findingsGrid}>
                    {(selectedRun.comparison_findings || []).map((finding, index) => (
                      <article key={`${finding.feature}-${index}`}>
                        <span className={styles.changeBadge}>{pretty(finding.change)}</span>
                        <strong>{finding.feature}</strong>
                        <p>{finding.description}</p>
                      </article>
                    ))}
                    {(selectedRun.comparison_findings || []).length === 0 && <div className={styles.emptySmall}>No structured comparison findings.</div>}
                  </div>
                  {(selectedRun.red_flags || []).length > 0 && (
                    <div className={styles.warningBlock}>
                      <h3>Visible warning features</h3>
                      <ul>{selectedRun.red_flags?.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
                    </div>
                  )}
                </>
              )}

              <div className={styles.limitationsBlock}>
                <h3>Limitations</h3>
                <ul>{(selectedRun.limitations || []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
              </div>
              <div className={styles.metaLine}>
                <span>{formatDateTime(selectedRun.created_at)}</span>
                {selectedRun.model_id && <span>{selectedRun.model_provider} · {selectedRun.model_id}</span>}
                {typeof selectedRun.latency_ms === "number" && <span>{selectedRun.latency_ms} ms</span>}
              </div>
            </>
          )}
        </section>
      </div>

      <section className={styles.timelineSection}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>Longitudinal record</span><h2>Baseline and progress history</h2></div>
        </div>
        <div className={styles.timeline}>
          {history.map((run) => (
            <button key={run.id} className={`${styles.timelineItem} ${selectedRun?.id === run.id ? styles.timelineActive : ""}`} onClick={() => setSelectedRunId(run.id)}>
              <span>{run.appointment_date || formatDateTime(run.created_at)}</span>
              <strong>{run.capture_type === "BASELINE" ? "Baseline" : pretty(run.progress_trend) || "Comparison"}</strong>
              <small>{pretty(run.current_capture_view)} · {run.service_name || "Visit"}</small>
            </button>
          ))}
          {history.length === 0 && <div className={styles.empty}>No progress history yet.</div>}
        </div>
      </section>
    </main>
  );
}
