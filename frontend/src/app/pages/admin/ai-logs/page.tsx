"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";
import styles from "./ailogs.module.css";

type AiLog = {
  id: number;
  appointment_id?: number | null;
  diagnosis_report_id?: number | null;

  patient_name?: string | null;
  patient_email?: string | null;
  doctor_name?: string | null;

  condition?: string | null;
  confidence?: number | null;
  severity?: string | null;
  recommendation?: string | null;

  possible_conditions?: string | null;
  key_findings?: string | null;
  treatment_suggestions?: string | null;
  prescription_suggestions?: string | null;
  follow_up_suggestions?: string | null;
  red_flags?: string | null;

  created_at?: string | null;
  reviewed_at?: string | null;
  review_status?: string | null;

  final_diagnosis?: string | null;
  doctor_final_diagnosis?: string | null;
  doctor_prescription?: string | null;
  prescription?: string | null;
  doctor_notes?: string | null;
  after_appointment_notes?: string | null;
  follow_up_plan?: string | null;
  next_visit_date?: string | null;
};

type ApiErrorResponse = {
  detail?: string;
  message?: string;
};

type SeverityFilter = "all" | "mild" | "moderate" | "severe" | "unspecified";
type ReviewFilter = "all" | "pending" | "reviewed" | "completed";

type PrescriptionItem = {
  medicine: string;
  usage: string;
  reason: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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

function cleanText(value?: string | null) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function capitalizeFirst(value?: string | null) {
  if (!value) return "N/A";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function normalizeAiLog(raw: Partial<AiLog>): AiLog {
  return {
    id: Number(raw.id),
    appointment_id: raw.appointment_id ?? null,
    diagnosis_report_id: raw.diagnosis_report_id ?? null,

    patient_name: raw.patient_name || "Unknown Patient",
    patient_email: raw.patient_email || "",
    doctor_name: raw.doctor_name || "Not assigned",

    condition: raw.condition || "No result",
    confidence: raw.confidence ?? null,
    severity: raw.severity || "Unspecified",
    recommendation: raw.recommendation || "",

    possible_conditions: raw.possible_conditions || "",
    key_findings: raw.key_findings || "",
    treatment_suggestions: raw.treatment_suggestions || "",
    prescription_suggestions: raw.prescription_suggestions || "",
    follow_up_suggestions: raw.follow_up_suggestions || "",
    red_flags: raw.red_flags || "",

    created_at: raw.created_at || null,
    reviewed_at: raw.reviewed_at || null,
    review_status: raw.review_status || "Pending",

    final_diagnosis: raw.final_diagnosis || raw.doctor_final_diagnosis || "",
    doctor_final_diagnosis: raw.doctor_final_diagnosis || raw.final_diagnosis || "",

    doctor_prescription: raw.doctor_prescription || raw.prescription || "",
    prescription: raw.prescription || raw.doctor_prescription || "",

    doctor_notes: raw.doctor_notes || raw.after_appointment_notes || "",
    after_appointment_notes: raw.after_appointment_notes || raw.doctor_notes || "",

    follow_up_plan: raw.follow_up_plan || "",
    next_visit_date: raw.next_visit_date || null,
  };
}

function getLabelSection(text: string, startLabel: string, endLabel?: string) {
  const lower = text.toLowerCase();
  const startToken = `${startLabel.toLowerCase()}:`;
  const start = lower.indexOf(startToken);

  if (start === -1) return "";

  const contentStart = start + startToken.length;
  let end = text.length;

  if (endLabel) {
    const endToken = `${endLabel.toLowerCase()}:`;
    const endIndex = lower.indexOf(endToken, contentStart);

    if (endIndex !== -1) {
      end = endIndex;
    }
  }

  return text.slice(contentStart, end).trim();
}

function getDetailForMedicine(
  section: string,
  medicine: string,
  medicines: string[]
) {
  const lowerSection = section.toLowerCase();
  const label = `${medicine.toLowerCase()}:`;
  const start = lowerSection.indexOf(label);

  if (start === -1) return "";

  const contentStart = start + label.length;
  let end = section.length;

  medicines.forEach((otherMedicine) => {
    if (otherMedicine === medicine) return;

    const otherLabel = `${otherMedicine.toLowerCase()}:`;
    const otherIndex = lowerSection.indexOf(otherLabel, contentStart);

    if (otherIndex !== -1 && otherIndex < end) {
      end = otherIndex;
    }
  });

  return section
    .slice(contentStart, end)
    .replace(/^[;,\s]+|[;,\s]+$/g, "")
    .trim();
}

function parsePrescriptionItems(value?: string | null): PrescriptionItem[] {
  const original = value || "";
  const lines = original
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const pipeItems = lines
    .map((line) => {
      const cleanedLine = line.replace(/^[-•]\s*/, "").trim();

      if (!cleanedLine.includes("|")) return null;

      const medicine = cleanedLine.split("|")[0].trim();

      const usage =
        cleanedLine.match(/Usage:\s*(.*?)(?:\s*\|\s*Reason:|$)/i)?.[1]?.trim() ||
        "";

      const reason = cleanedLine.match(/Reason:\s*(.*)$/i)?.[1]?.trim() || "";

      return {
        medicine,
        usage,
        reason,
      };
    })
    .filter((item): item is PrescriptionItem => Boolean(item?.medicine));

  if (pipeItems.length > 0) {
    return pipeItems;
  }

  const text = cleanText(original);

  if (!text) return [];

  const medicationSection = getLabelSection(text, "Medication", "Usage");
  const usageSection = getLabelSection(text, "Usage", "Reason");
  const reasonSection = getLabelSection(text, "Reason");

  if (medicationSection) {
    const medicines = medicationSection
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);

    return medicines.map((medicine) => ({
      medicine,
      usage: getDetailForMedicine(usageSection, medicine, medicines),
      reason: getDetailForMedicine(reasonSection, medicine, medicines),
    }));
  }

  const simpleItems = lines
    .map((line) => {
      const cleanedLine = line.replace(/^[-•]\s*/, "").trim();
      const match = cleanedLine.match(/^(.+?):\s*(.*?)(?:\((.*?)\))?$/);

      if (!match) return null;

      return {
        medicine: match[1]?.trim() || "",
        usage: match[2]?.trim() || "",
        reason: match[3]?.trim() || "",
      };
    })
    .filter((item): item is PrescriptionItem => Boolean(item?.medicine));

  if (simpleItems.length > 0) {
    return simpleItems;
  }

  return [
    {
      medicine: text,
      usage: "",
      reason: "",
    },
  ];
}

function renderPrescriptionItems(
  items: PrescriptionItem[],
  emptyMessage: string
) {
  if (items.length === 0) {
    return <p className={styles.emptyMiniText}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.prescriptionTable}>
      <div className={styles.prescriptionHeader}>
        <span>Medicine</span>
        <span>Usage</span>
        <span>Reason</span>
      </div>

      {items.map((item, index) => (
        <div
          className={styles.prescriptionRow}
          key={`${item.medicine}-${index}`}
        >
          <p>{item.medicine || "Not provided"}</p>
          <p>{item.usage || "Not provided"}</p>
          <p>{item.reason || "Not provided"}</p>
        </div>
      ))}
    </div>
  );
}

function renderTextList(
  value?: string | null,
  emptyMessage = "No details provided."
) {
  const lines = (value || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return <p className={styles.emptyMiniText}>{emptyMessage}</p>;
  }

  return (
    <ul className={styles.detailList}>
      {lines.map((line, index) => (
        <li key={`${line}-${index}`}>{line}</li>
      ))}
    </ul>
  );
}

export default function AdminAiLogsPage() {
  const router = useRouter();

  const [logs, setLogs] = useState<AiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");

  const [selectedLog, setSelectedLog] = useState<AiLog | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "admin") {
      router.push("/");
      return;
    }

    loadAiLogs(token);
  }, [router]);

  async function loadAiLogs(tokenFromEffect?: string) {
    const token = tokenFromEffect || localStorage.getItem("token");

    try {
      setLoading(true);
      setActionLoading(true);
      setError("");

      const res = await fetch(`${API_BASE}/admin/ai-logs`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await safeJson<AiLog[] | { logs?: AiLog[] } | ApiErrorResponse>(
        res
      );

      if (!res.ok) {
        throw new Error(
          getApiErrorMessage(data as ApiErrorResponse, "Unable to load AI logs")
        );
      }

      if (Array.isArray(data)) {
        setLogs(data.map(normalizeAiLog));
      } else if (data && "logs" in data && Array.isArray(data.logs)) {
        setLogs(data.logs.map(normalizeAiLog));
      } else {
        setLogs([]);
      }
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, "Unable to load AI logs."));
    } finally {
      setLoading(false);
      setActionLoading(false);
    }
  }

  function getReviewStatus(log: AiLog) {
    const status = log.review_status?.toLowerCase();

    if (status === "completed") return "Completed";

    if (
      log.final_diagnosis?.trim() ||
      log.doctor_final_diagnosis?.trim() ||
      log.doctor_prescription?.trim() ||
      log.follow_up_plan?.trim()
    ) {
      return "Completed";
    }

    if (status === "reviewed" || log.reviewed_at) {
      return "Reviewed";
    }

    return "Pending";
  }

  function formatConfidence(confidence?: number | null) {
    if (confidence === null || confidence === undefined) return "N/A";

    const value = confidence <= 1 ? confidence * 100 : confidence;
    return `${value.toFixed(1)}%`;
  }

  function formatDate(dateValue?: string | null) {
    if (!dateValue) return "N/A";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "N/A";

    return date.toLocaleDateString();
  }

  function handleView(log: AiLog) {
    setSelectedLog(log);
    setShowViewModal(true);
  }

  const filteredLogs = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return logs.filter((log) => {
      const reviewStatus = getReviewStatus(log).toLowerCase();

      const matchesSearch =
        (log.patient_name || "").toLowerCase().includes(keyword) ||
        (log.patient_email || "").toLowerCase().includes(keyword) ||
        (log.doctor_name || "").toLowerCase().includes(keyword) ||
        (log.condition || "").toLowerCase().includes(keyword) ||
        (log.severity || "").toLowerCase().includes(keyword);

      const matchesSeverity =
        severityFilter === "all" ||
        (log.severity || "").toLowerCase() === severityFilter;

      const matchesReview =
        reviewFilter === "all" || reviewStatus === reviewFilter;

      return matchesSearch && matchesSeverity && matchesReview;
    });
  }, [logs, search, severityFilter, reviewFilter]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      severe: logs.filter((log) => log.severity?.toLowerCase() === "severe")
        .length,
      pending: logs.filter((log) => getReviewStatus(log) === "Pending").length,
      completed: logs.filter((log) => getReviewStatus(log) === "Completed")
        .length,
    };
  }, [logs]);

  const aiPrescriptionItems = useMemo(() => {
    if (!selectedLog) return [];

    return parsePrescriptionItems(
      selectedLog.prescription_suggestions ||
        selectedLog.treatment_suggestions ||
        selectedLog.recommendation
    );
  }, [selectedLog]);

  const doctorPrescriptionItems = useMemo(() => {
    if (!selectedLog) return [];

    return parsePrescriptionItems(
      selectedLog.doctor_prescription || selectedLog.prescription
    );
  }, [selectedLog]);

  return (
    <div className="staffLayout">
      <AdminNavbar />

      <div className="staffContent">
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>AI Logs</h1>
            <p className={styles.subtitle}>
              Monitor AI analysis records, severity levels, confidence scores,
              and doctor review progress.
            </p>
          </div>

          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => loadAiLogs()}
            disabled={actionLoading}
          >
            {actionLoading ? "Refreshing..." : "Refresh Logs"}
          </button>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span>Total AI Logs</span>
            <strong>{stats.total}</strong>
          </div>

          <div className={styles.statCard}>
            <span>Severe Cases</span>
            <strong>{stats.severe}</strong>
          </div>

          <div className={styles.statCard}>
            <span>Pending Review</span>
            <strong>{stats.pending}</strong>
          </div>

          <div className={styles.statCard}>
            <span>Completed</span>
            <strong>{stats.completed}</strong>
          </div>
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Search by patient, doctor, condition, or severity"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={styles.searchInput}
          />

          <select
            value={severityFilter}
            onChange={(event) =>
              setSeverityFilter(event.target.value as SeverityFilter)
            }
            className={styles.selectInput}
          >
            <option value="all">All Severity</option>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
            <option value="unspecified">Unspecified</option>
          </select>

          <select
            value={reviewFilter}
            onChange={(event) =>
              setReviewFilter(event.target.value as ReviewFilter)
            }
            className={styles.selectInput}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className={styles.tableCard}>
          {loading ? (
            <p className={styles.message}>Loading AI logs...</p>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : filteredLogs.length === 0 ? (
            <p className={styles.message}>No AI logs found.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>AI Result</th>
                  <th>Confidence</th>
                  <th>Severity</th>
                  <th>Review Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredLogs.map((log) => {
                  const reviewStatus = getReviewStatus(log);

                  return (
                    <tr key={log.id}>
                      <td>
                        <div className={styles.patientCell}>
                          <strong>{log.patient_name || "Unknown Patient"}</strong>
                          <p>{log.patient_email || "No email available"}</p>
                        </div>
                      </td>

                      <td>{log.doctor_name || "Not assigned"}</td>

                      <td>{log.condition || "No result"}</td>

                      <td>{formatConfidence(log.confidence)}</td>

                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            log.severity?.toLowerCase() === "severe"
                              ? styles.severe
                              : log.severity?.toLowerCase() === "moderate"
                              ? styles.moderate
                              : log.severity?.toLowerCase() === "mild"
                              ? styles.mild
                              : styles.neutral
                          }`}
                        >
                          {capitalizeFirst(log.severity)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            reviewStatus === "Completed"
                              ? styles.completed
                              : reviewStatus === "Reviewed"
                              ? styles.reviewed
                              : styles.pending
                          }`}
                        >
                          {reviewStatus}
                        </span>
                      </td>

                      <td>{formatDate(log.created_at)}</td>

                      <td>
                        <button
                          type="button"
                          className={styles.viewBtn}
                          onClick={() => handleView(log)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {showViewModal && selectedLog && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalCardLarge}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>AI Log Details</h2>
                  <p>
                    Admin monitoring view. Image preview is intentionally hidden.
                  </p>
                </div>

                <button
                  type="button"
                  className={styles.topCloseButton}
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedLog(null);
                  }}
                >
                  Close
                </button>
              </div>

              <div className={styles.profileSection}>
                <div className={styles.profileInitial}>
                  {(selectedLog.patient_name || "P").charAt(0).toUpperCase()}
                </div>

                <div className={styles.profileInfo}>
                  <h3>{selectedLog.patient_name || "Unknown Patient"}</h3>
                  <p>{selectedLog.patient_email || "No email available"}</p>
                </div>
              </div>

              <div className={styles.profileGrid}>
                <div>
                  <strong>Doctor:</strong>{" "}
                  {selectedLog.doctor_name || "Not assigned"}
                </div>

                <div>
                  <strong>AI Result:</strong>{" "}
                  {selectedLog.condition || "No result"}
                </div>

                <div>
                  <strong>Confidence:</strong>{" "}
                  {formatConfidence(selectedLog.confidence)}
                </div>

                <div>
                  <strong>Severity:</strong>{" "}
                  {capitalizeFirst(selectedLog.severity)}
                </div>

                <div>
                  <strong>Review Status:</strong>{" "}
                  {getReviewStatus(selectedLog)}
                </div>

                <div>
                  <strong>Created:</strong> {formatDate(selectedLog.created_at)}
                </div>
              </div>

              <div className={styles.infoBlock}>
                <h3>AI Recommendation</h3>

                <div className={styles.structuredSection}>
                  {renderPrescriptionItems(
                    aiPrescriptionItems,
                    "No AI medicine recommendation was saved for this record."
                  )}

                  <div className={styles.detailMiniBlock}>
                    <strong>Red Flags</strong>
                    {renderTextList(
                      selectedLog.red_flags,
                      "No AI red flags were saved for this record."
                    )}
                  </div>

                  <div className={styles.detailMiniBlock}>
                    <strong>Follow-up Plan</strong>
                    <p>
                      {selectedLog.follow_up_suggestions ||
                        "No AI follow-up suggestion was saved for this record."}
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.infoBlock}>
                <h3>Doctor Final Assessment</h3>

                <div className={styles.assessmentGrid}>
                  <div className={styles.detailMiniBlock}>
                    <strong>Final Diagnosis</strong>
                    <p>
                      {selectedLog.final_diagnosis ||
                        selectedLog.doctor_final_diagnosis ||
                        "No final diagnosis saved yet."}
                    </p>
                  </div>

                  <div className={styles.detailMiniBlock}>
                    <strong>Prescription</strong>
                    {renderPrescriptionItems(
                      doctorPrescriptionItems,
                      "No prescription saved yet."
                    )}
                  </div>



                  <div className={styles.detailMiniBlock}>
                    <strong>Follow-up Plan</strong>
                    <p>
                      {selectedLog.follow_up_plan ||
                        "No follow-up plan saved yet."}
                    </p>
                  </div>

                  {selectedLog.next_visit_date && (
                    <div className={styles.detailMiniBlock}>
                      <strong>Next Visit Date</strong>
                      <p>{selectedLog.next_visit_date}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedLog(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}