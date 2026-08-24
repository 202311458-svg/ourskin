"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/styles/ai-progress.module.css";
import { getDoctorAppointments } from "@/lib/doctor-api";
import type { M4Appointment } from "@/lib/doctor-ai-api";
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

const VIEWS: { value: CaptureView; label: string }[] = [
  { value: "FRONT", label: "Front" }, { value: "LEFT", label: "Left" },
  { value: "RIGHT", label: "Right" }, { value: "CLOSE_UP", label: "Close-up" },
  { value: "OTHER", label: "Other standardized view" }, { value: "UNSPECIFIED", label: "Unspecified" },
];
const EMPTY: ProgressInput = { captureView: "UNSPECIFIED", bodySite: "", procedureOrTreatment: "", daysSinceProcedure: null, doctorObservation: "" };
type Patient = { id: number; name: string; email: string; visits: M4Appointment[] };

const dt = (a: M4Appointment) => new Date(`${a.date}T${a.time || "00:00:00"}`);
const canCapture = (a: M4Appointment | null) => !!a && a.status === "Approved" && !Number.isNaN(dt(a).getTime()) && dt(a) <= new Date();
const pretty = (v?: string | null) => (v || "").toLowerCase().split("_").filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
const fDate = (v?: string | null) => {
  if (!v) return "—"; const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const fTime = (v?: string | null) => {
  if (!v) return "—"; const d = new Date(`1970-01-01T${v}`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};
const fDateTime = (v?: string | null) => {
  if (!v) return "—"; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
};
const buildPatients = (rows: M4Appointment[]) => {
  const map = new Map<number, Patient>();
  rows.filter((a) => a.patient_id && !["Declined", "Cancelled"].includes(a.status || "") && ["Approved", "Completed"].includes(a.status || ""))
    .sort((a, b) => dt(b).getTime() - dt(a).getTime())
    .forEach((a) => {
      if (!a.patient_id) return;
      const existing = map.get(a.patient_id);
      if (existing) existing.visits.push(a);
      else map.set(a.patient_id, { id: a.patient_id, name: a.patient_name || "Unnamed patient", email: a.patient_email || "No email", visits: [a] });
    });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
};
const chooseVisit = (v: M4Appointment[]) => v.find(canCapture) || v.find((a) => a.status === "Completed") || v[0] || null;

export default function DoctorAiProgressPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<M4Appointment[]>([]);
  const [patientId, setPatientId] = useState<number | null>(null);
  const [appointmentId, setAppointmentId] = useState<number | null>(null);
  const [mode, setMode] = useState<"compare" | "baseline">("compare");
  const [refs, setRefs] = useState<ProgressReferenceOption[]>([]);
  const [refId, setRefId] = useState<number | null>(null);
  const [history, setHistory] = useState<ProgressRun[]>([]);
  const [runId, setRunId] = useState<number | null>(null);
  const [input, setInput] = useState<ProgressInput>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("token") || localStorage.getItem("role") !== "doctor") { router.push("/"); return; }
    getDoctorAppointments("All")
      .then((data) => setAppointments((Array.isArray(data) ? data : []) as M4Appointment[]))
      .catch((e) => setNotice({ type: "error", text: e instanceof Error ? e.message : "Failed to load recovery progress workspace." }))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url);
  }, [file]);

  const patients = useMemo(() => buildPatients(appointments), [appointments]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase(); if (!q) return patients;
    return patients.filter((p) => `${p.name} ${p.email} ${p.visits.map((v) => v.services || "").join(" ")}`.toLowerCase().includes(q));
  }, [patients, search]);
  const patient = patients.find((p) => p.id === patientId) || null;
  const visits = patient?.visits || [];
  const appointment = visits.find((v) => v.id === appointmentId) || null;
  const reference = refs.find((r) => r.run_id === refId) || null;
  const run = history.find((r) => r.id === runId) || history[0] || null;

  const refresh = async (id: number | null) => {
    if (!id) { setRefs([]); setHistory([]); setRefId(null); setRunId(null); return; }
    const [r, h] = await Promise.all([getProgressReferenceOptions(id), getProgressHistory(id)]);
    setRefs(Array.isArray(r) ? r : []); setHistory(Array.isArray(h) ? h : []);
    if (!refId && r.length) setRefId(r[0].run_id);
    if (!runId && h.length) setRunId(h[0].id);
  };
  useEffect(() => { refresh(appointmentId).catch((e) => setNotice({ type: "error", text: e instanceof Error ? e.message : "Failed to load progress history." })); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [appointmentId]);
  useEffect(() => {
    if (!reference) return;
    setInput((p) => ({ ...p, captureView: reference.capture_view !== "UNSPECIFIED" ? reference.capture_view : p.captureView, bodySite: reference.body_site || p.bodySite, procedureOrTreatment: reference.procedure_or_treatment || p.procedureOrTreatment || appointment?.services || "" }));
  }, [reference, appointment]);

  const selectPatient = (id: number) => {
    const p = patients.find((x) => x.id === id); const v = p ? chooseVisit(p.visits) : null;
    setPatientId(id); setAppointmentId(v?.id || null); setRefId(null); setRunId(null); setFile(null);
    setInput({ ...EMPTY, procedureOrTreatment: v?.services || "" }); setNotice(null);
  };
  const selectVisit = (id: string) => {
    const value = Number(id) || null; const v = visits.find((x) => x.id === value) || null;
    setAppointmentId(value); setRefId(null); setRunId(null); setFile(null); setInput({ ...EMPTY, procedureOrTreatment: v?.services || "" }); setNotice(null);
  };
  const submit = async () => {
    if (!appointment || !file) { setNotice({ type: "error", text: "Select an eligible visit and current image first." }); return; }
    if (!canCapture(appointment)) { setNotice({ type: "error", text: "Capture is available only after an approved appointment has started." }); return; }
    if (!input.procedureOrTreatment.trim()) { setNotice({ type: "error", text: "Enter the procedure or treatment being tracked." }); return; }
    if (mode === "compare" && !refId) { setNotice({ type: "error", text: "Select an earlier reference capture first." }); return; }
    setWorking(true); setNotice(null);
    try {
      const response = mode === "baseline"
        ? await saveProgressBaseline(appointment.id, file, input)
        : await analyzeRecoveryProgress(appointment.id, refId!, file, input);
      setFile(null); await refresh(appointment.id); setRunId(response.progress.id); setNotice({ type: "success", text: response.message });
    } catch (e) { setNotice({ type: "error", text: e instanceof Error ? e.message : "Progress request failed." }); }
    finally { setWorking(false); }
  };
  const review = async (id: number) => {
    setWorking(true);
    try {
      const response = await reviewProgressRun(id);
      setHistory((items) => items.map((x) => x.id === id ? response.progress : x)); setNotice({ type: "success", text: response.message });
    } catch (e) { setNotice({ type: "error", text: e instanceof Error ? e.message : "Unable to review result." }); }
    finally { setWorking(false); }
  };

  if (loading) return <div className={styles.loadingPage}>Loading recovery progress workspace…</div>;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div><h1>Recovery progress</h1><p>Save standardized baseline images and compare later visits using visible trends instead of a fabricated healing percentage.</p></div>
        <div className={styles.heroNote}>Compare like-for-like views. AI supports review; the physician decides what visible changes mean clinically.</div>
      </header>

      {notice && <div className={`${styles.notice} ${notice.type === "error" ? styles.noticeError : styles.noticeSuccess}`}>{notice.text}</div>}

      <div className={styles.layout}>
        <aside className={styles.patientPanel}>
          <div className={styles.panelHeader}><div><span className={styles.eyebrow}>Eligible visits</span><h2>Patient and visit</h2></div></div>
          <input className={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, or service" />
          <div className={styles.patientList}>
            {filtered.map((p) => {
              const latest = p.visits[0];
              return <button key={p.id} type="button" onClick={() => selectPatient(p.id)} className={`${styles.patientItem} ${patientId === p.id ? styles.patientItemActive : ""}`}>
                <strong>{p.name}</strong><span>{p.email}</span><small>{latest?.services || "Visit"} · {fDate(latest?.date)}</small>
              </button>;
            })}
            {!filtered.length && <div className={styles.empty}>No eligible visits found.</div>}
          </div>
        </aside>

        <section className={styles.workspace}>
          {!patient ? (
            <div className={styles.emptyLarge}>
              <h2>Select a patient and visit</h2>
              <p>Choose an approved or completed visit to save a baseline, compare progress, or review longitudinal history.</p>
              <div className={styles.emptySteps}><span>1. Select visit</span><span>2. Match capture view</span><span>3. Upload image</span><span>4. Review visible trend</span></div>
            </div>
          ) : <>
            <div className={styles.patientBanner}>
              <div><span className={styles.eyebrow}>Current patient</span><h2>{patient.name}</h2><p>{patient.email}</p></div>
              <div className={styles.visitPicker}><label htmlFor="progress-visit">Target visit</label>
                <select id="progress-visit" value={appointmentId || ""} onChange={(e) => selectVisit(e.target.value)}>
                  <option value="">Select eligible visit</option>
                  {visits.map((v) => <option key={v.id} value={v.id}>{fDate(v.date)} · {fTime(v.time)} · {v.services || "Visit"} · {v.status}</option>)}
                </select>
              </div>
            </div>

            {appointment && <section className={styles.contextCard}><div className={styles.contextSummary}>
              <div><span>Booked service</span><strong>{appointment.services || "Not recorded"}</strong></div>
              <div><span>Visit date</span><strong>{fDate(appointment.date)} · {fTime(appointment.time)}</strong></div>
              <div><span>Status</span><strong>{appointment.status || "—"}</strong></div>
              <div><span>Capture availability</span><strong>{canCapture(appointment) ? "Ready now" : appointment.status === "Completed" ? "History only" : "Not ready"}</strong></div>
            </div></section>}

            <div className={styles.workspaceGrid}>
              <section className={styles.card}>
                <div className={styles.modeTabs}>
                  <button type="button" className={mode === "compare" ? styles.activeTab : ""} onClick={() => setMode("compare")}>Compare progress</button>
                  <button type="button" className={mode === "baseline" ? styles.activeTab : ""} onClick={() => setMode("baseline")}>Save baseline</button>
                </div>
                <div className={styles.cardHeader}><div><span className={styles.eyebrow}>{mode === "baseline" ? "Reference capture" : "Longitudinal comparison"}</span><h2>{mode === "baseline" ? "Create a standardized baseline" : "Compare with an earlier visit"}</h2></div></div>

                {mode === "compare" && <label className={styles.fieldFull}>Reference capture
                  <select value={refId || ""} onChange={(e) => setRefId(Number(e.target.value) || null)}>
                    <option value="">Select earlier capture</option>
                    {refs.map((r) => <option key={r.run_id} value={r.run_id}>{r.appointment_date || "Earlier visit"} · {r.service_name || "Visit"} · {pretty(r.capture_view)}</option>)}
                  </select>
                  {!refs.length && <span className={styles.helper}>No earlier capture is available. Save a baseline during an eligible visit first.</span>}
                </label>}

                {mode === "compare" && reference && <div className={styles.referencePreview}>
                  <img src={reference.image_url} alt="Selected reference capture" />
                  <div><strong>Reference</strong><span>{fDate(reference.appointment_date)}</span><span>{pretty(reference.capture_view)}</span><span>{reference.body_site || "Body site not recorded"}</span></div>
                </div>}

                <div className={styles.formGrid}>
                  <label>Procedure / treatment<input value={input.procedureOrTreatment} onChange={(e) => setInput((p) => ({ ...p, procedureOrTreatment: e.target.value }))} placeholder="e.g. Chemical peel, acne treatment" /></label>
                  <label>Body site<input value={input.bodySite || ""} onChange={(e) => setInput((p) => ({ ...p, bodySite: e.target.value }))} placeholder="e.g. face, left cheek" /></label>
                  <label>Capture view<select value={input.captureView} onChange={(e) => setInput((p) => ({ ...p, captureView: e.target.value as CaptureView }))}>{VIEWS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}</select></label>
                  {mode === "compare" && <label>Days since treatment<input type="number" min={0} max={3650} value={input.daysSinceProcedure ?? ""} onChange={(e) => setInput((p) => ({ ...p, daysSinceProcedure: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="Optional" /></label>}
                  <label className={styles.fieldFull}>Doctor observation<textarea value={input.doctorObservation || ""} onChange={(e) => setInput((p) => ({ ...p, doctorObservation: e.target.value }))} placeholder="Optional clinical observation" /></label>
                </div>

                <label className={styles.uploadBox}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  {preview ? <img src={preview} alt="Current capture preview" /> : <div><strong>Select current image</strong><span>JPG, PNG, or WEBP · match angle and framing when possible</span></div>}
                </label>
                <div className={styles.actionRow}><span>{appointment && canCapture(appointment) ? "Ready for capture." : "Choose an approved visit that has already started."}</span>
                  <button className={styles.primaryButton} disabled={working || !file || !appointment || !canCapture(appointment) || (mode === "compare" && !refId)} onClick={submit}>
                    {working ? "Processing…" : mode === "baseline" ? "Save baseline" : "Compare progress"}
                  </button>
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.cardHeader}><div><span className={styles.eyebrow}>Selected record</span><h2>{run?.capture_type === "BASELINE" ? "Baseline capture" : "Progress result"}</h2></div>
                  {run?.capture_type !== "BASELINE" && run?.review_status === "PENDING_REVIEW" && <button className={styles.secondaryButton} disabled={working} onClick={() => review(run.id)}>Mark reviewed</button>}
                </div>

                {!run ? <div className={styles.emptyResult}><h3>No progress record yet</h3><p>Save a baseline or run a comparison to populate this longitudinal result.</p></div> : <>
                  <div className={styles.imageCompare}>
                    {run.reference_image_url && <figure><img src={run.reference_image_url} alt="Reference visit" /><figcaption>Reference · {fDate(run.reference_appointment_date)}</figcaption></figure>}
                    <figure><img src={run.current_image_url} alt="Current visit" /><figcaption>{run.capture_type === "BASELINE" ? "Baseline" : "Current"} · {fDate(run.appointment_date)}</figcaption></figure>
                  </div>

                  {run.capture_type === "BASELINE" ? <div className={styles.summaryText}><h3>Reference saved</h3><p>This image passed local quality checks and is available for same-view comparison during a later visit.</p></div> : <>
                    <div className={styles.resultSummary}>
                      <div><span>Visible trend</span><strong>{pretty(run.progress_trend) || "—"}</strong></div>
                      <div><span>Comparison</span><strong>{run.comparison_reliable ? "Reliable enough" : "Not reliable"}</strong></div>
                      <div><span>Review</span><strong>{pretty(run.review_status) || "—"}</strong></div>
                    </div>
                    <div className={styles.summaryText}><h3>AI comparison summary</h3><p>{run.progress_summary || "No summary available."}</p></div>
                    <div className={styles.findingsGrid}>
                      {(run.comparison_findings || []).map((f, i) => <article key={`${f.feature}-${i}`}><span className={styles.changeBadge}>{pretty(f.change)}</span><strong>{f.feature}</strong><p>{f.description}</p></article>)}
                      {!(run.comparison_findings || []).length && <div className={styles.emptySmall}>No structured comparison findings.</div>}
                    </div>
                    {!!(run.red_flags || []).length && <div className={styles.warningBlock}><h3>Visible warning features</h3><ul>{run.red_flags!.map((x, i) => <li key={`${x}-${i}`}>{x}</li>)}</ul></div>}
                  </>}

                  <div className={styles.limitationsBlock}><h3>Limitations</h3><ul>{(run.limitations || []).map((x, i) => <li key={`${x}-${i}`}>{x}</li>)}</ul></div>
                  <div className={styles.metaLine}><span>{fDateTime(run.created_at)}</span>{run.model_id && <span>{run.model_provider} · {run.model_id}</span>}{typeof run.latency_ms === "number" && <span>{run.latency_ms} ms</span>}</div>
                </>}
              </section>
            </div>

            <section className={styles.timelineSection}>
              <div className={styles.cardHeader}><div><span className={styles.eyebrow}>Longitudinal record</span><h2>Baseline and progress history</h2></div></div>
              <div className={styles.timeline}>
                {history.map((r) => <button key={r.id} className={`${styles.timelineItem} ${run?.id === r.id ? styles.timelineActive : ""}`} onClick={() => setRunId(r.id)}>
                  <span>{r.appointment_date || fDateTime(r.created_at)}</span><strong>{r.capture_type === "BASELINE" ? "Baseline" : pretty(r.progress_trend) || "Comparison"}</strong><small>{pretty(r.current_capture_view)} · {r.service_name || "Visit"}</small>
                </button>)}
                {!history.length && <div className={styles.emptySmall}>No progress history yet.</div>}
              </div>
            </section>
          </>}
        </section>
      </div>
    </main>
  );
}
