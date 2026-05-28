"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";
import { AdminAiLog, getAdminAiLogs } from "@/lib/admin-api";
import styles from "@/app/styles/admin.module.css";

type SeverityFilter = "all" | "mild" | "moderate" | "severe" | "unspecified";
type ReviewFilter = "all" | "pending" | "reviewed" | "completed";

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function capitalizeFirst(value?: string | null) {
  if (!value) return "N/A";

  const cleaned = value.trim();

  if (!cleaned) return "N/A";

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatConfidence(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }

  if (value <= 1) return `${Math.round(value * 100)}%`;

  return `${Math.round(value)}%`;
}

function getSeverityClass(severity?: string | null) {
  const cleanSeverity = normalizeText(severity);

  if (cleanSeverity === "severe") return styles.cancelled;
  if (cleanSeverity === "moderate") return styles.pending;
  if (cleanSeverity === "mild") return styles.approved;

  return styles.neutral;
}

function getReviewClass(status?: string | null) {
  const cleanStatus = normalizeText(status);

  if (cleanStatus === "completed" || cleanStatus === "reviewed") {
    return styles.approved;
  }

  return styles.pending;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function normalizeAiLog(raw: Partial<AdminAiLog>): AdminAiLog {
  return {
    id: Number(raw.id),
    user_id: raw.user_id ?? null,
    appointment_id: raw.appointment_id ?? null,
    diagnosis_report_id: raw.diagnosis_report_id ?? null,

    patient_name: raw.patient_name || "Unknown Patient",
    patient_email: raw.patient_email || "No email available",
    doctor_name: raw.doctor_name || "Not assigned",

    condition: raw.condition || "No AI result",
    confidence: raw.confidence ?? null,
    severity: raw.severity || "Unspecified",
    recommendation: raw.recommendation || "",

    possible_conditions: raw.possible_conditions || "",
    key_findings: raw.key_findings || "",
    treatment_suggestions: raw.treatment_suggestions || "",
    prescription_suggestions: raw.prescription_suggestions || "",
    follow_up_suggestions: raw.follow_up_suggestions || "",
    red_flags: raw.red_flags || "",

    doctor_note: raw.doctor_note || "",
    review_status: raw.review_status || "Pending",
    reviewed_at: raw.reviewed_at || null,

    final_diagnosis: raw.final_diagnosis || raw.doctor_final_diagnosis || "",
    doctor_final_diagnosis: raw.doctor_final_diagnosis || raw.final_diagnosis || "",
    doctor_prescription: raw.doctor_prescription || raw.prescription || "",
    prescription: raw.prescription || raw.doctor_prescription || "",
    doctor_notes: raw.doctor_notes || raw.after_appointment_notes || "",
    after_appointment_notes: raw.after_appointment_notes || raw.doctor_notes || "",
    follow_up_plan: raw.follow_up_plan || "",
    next_visit_date: raw.next_visit_date || null,

    created_at: raw.created_at || null,
  };
}

export default function AdminAiLogsPage() {
  const router = useRouter();

  const [logs, setLogs] = useState<AdminAiLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AdminAiLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");

  const loadLogs = useCallback(async () => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "admin") {
      router.push("/");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await getAdminAiLogs();
      setLogs(Array.isArray(data) ? data.map(normalizeAiLog) : []);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, "Unable to load AI logs."));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return logs.filter((log) => {
      const severity = normalizeText(log.severity);
      const reviewStatus = normalizeText(log.review_status);

      const matchesSearch =
        !keyword ||
        (log.patient_name || "").toLowerCase().includes(keyword) ||
        (log.patient_email || "").toLowerCase().includes(keyword) ||
        (log.doctor_name || "").toLowerCase().includes(keyword) ||
        (log.condition || "").toLowerCase().includes(keyword) ||
        (log.doctor_final_diagnosis || "").toLowerCase().includes(keyword) ||
        String(log.appointment_id || "").includes(keyword);

      const matchesSeverity =
        severityFilter === "all" || severity === severityFilter;

      const matchesReview =
        reviewFilter === "all" ||
        (reviewFilter === "pending" &&
          !["reviewed", "completed"].includes(reviewStatus)) ||
        (reviewFilter === "reviewed" && reviewStatus === "reviewed") ||
        (reviewFilter === "completed" && reviewStatus === "completed");

      return matchesSearch && matchesSeverity && matchesReview;
    });
  }, [logs, search, severityFilter, reviewFilter]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      pending: logs.filter((log) => {
        const status = normalizeText(log.review_status);
        return !["reviewed", "completed"].includes(status);
      }).length,
      reviewed: logs.filter(
        (log) => normalizeText(log.review_status) === "reviewed"
      ).length,
      completed: logs.filter(
        (log) => normalizeText(log.review_status) === "completed"
      ).length,
      severe: logs.filter((log) => normalizeText(log.severity) === "severe")
        .length,
    };
  }, [logs]);

  return (
    <div className="staffLayout">
      <AdminNavbar />

      <main className={`staffContent ${styles.aiLogsPage}`}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>AI Review Monitor</h1>
            <p className={styles.subtitle}>
              Monitor AI-assisted skin analysis records, doctor review status,
              and final diagnosis completion.
            </p>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span>Total AI Logs</span>
            <strong>{stats.total}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.orangeAccent}`}>
            <span>Pending Review</span>
            <strong>{stats.pending}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.blueAccent}`}>
            <span>Reviewed</span>
            <strong>{stats.reviewed}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.greenAccent}`}>
            <span>Completed Reports</span>
            <strong>{stats.completed}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.pinkAccent}`}>
            <span>Severe Cases</span>
            <strong>{stats.severe}</strong>
          </div>
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Search by patient, email, doctor, condition, diagnosis, or appointment ID"
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
            <option value="all">All Review Status</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <section className={styles.tableCard}>
          {loading ? (
            <p className={styles.message}>Loading AI logs...</p>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : filteredLogs.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No AI logs found</h3>
              <p>Try adjusting your filters or search keyword.</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Condition</th>
                  <th>Severity</th>
                  <th>Confidence</th>
                  <th>Review</th>
                  <th>Final Diagnosis</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <strong>{log.patient_name}</strong>
                      <span>{log.patient_email}</span>
                    </td>

                    <td>{log.doctor_name}</td>

                    <td>{log.condition}</td>

                    <td>
                      <span
                        className={`${styles.statusBadge} ${getSeverityClass(
                          log.severity
                        )}`}
                      >
                        {capitalizeFirst(log.severity)}
                      </span>
                    </td>

                    <td>{formatConfidence(log.confidence)}</td>

                    <td>
                      <span
                        className={`${styles.statusBadge} ${getReviewClass(
                          log.review_status
                        )}`}
                      >
                        {capitalizeFirst(log.review_status)}
                      </span>
                    </td>

                    <td>
                      {log.doctor_final_diagnosis ||
                      log.final_diagnosis ||
                      log.diagnosis_report_id
                        ? "Available"
                        : "Not yet available"}
                    </td>

                    <td>{formatDate(log.created_at)}</td>

                    <td>
                      <button
                        type="button"
                        className={styles.secondaryAction}
                        onClick={() => setSelectedLog(log)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {selectedLog && (
          <div className={styles.modalBackdrop}>
            <div className={`${styles.modalCard} ${styles.modalLarge}`}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>AI Log Details</h2>
                  <p>
                    Read-only admin view of AI result, clinical decision support,
                    and doctor completion status.
                  </p>
                </div>

                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={() => setSelectedLog(null)}
                >
                  ×
                </button>
              </div>

              <div className={styles.modalBody}>
                <section className={styles.detailSection}>
                  <h3>Patient and Appointment</h3>

                  <div className={styles.detailGrid}>
                    <div>
                      <span>Patient</span>
                      <strong>{selectedLog.patient_name}</strong>
                    </div>

                    <div>
                      <span>Email</span>
                      <strong>{selectedLog.patient_email}</strong>
                    </div>

                    <div>
                      <span>Doctor</span>
                      <strong>{selectedLog.doctor_name}</strong>
                    </div>

                    <div>
                      <span>Appointment ID</span>
                      <strong>{selectedLog.appointment_id || "N/A"}</strong>
                    </div>

                    <div>
                      <span>Diagnosis Report ID</span>
                      <strong>{selectedLog.diagnosis_report_id || "N/A"}</strong>
                    </div>

                    <div>
                      <span>Created</span>
                      <strong>{formatDate(selectedLog.created_at)}</strong>
                    </div>
                  </div>
                </section>

                <section className={styles.detailSection}>
                  <h3>AI Result</h3>

                  <div className={styles.detailGrid}>
                    <div>
                      <span>Condition</span>
                      <strong>{selectedLog.condition}</strong>
                    </div>

                    <div>
                      <span>Confidence</span>
                      <strong>{formatConfidence(selectedLog.confidence)}</strong>
                    </div>

                    <div>
                      <span>Severity</span>
                      <strong>{capitalizeFirst(selectedLog.severity)}</strong>
                    </div>

                    <div>
                      <span>Review Status</span>
                      <strong>{capitalizeFirst(selectedLog.review_status)}</strong>
                    </div>

                    <div>
                      <span>Reviewed At</span>
                      <strong>{formatDate(selectedLog.reviewed_at)}</strong>
                    </div>
                  </div>

                  {selectedLog.recommendation ? (
                    <p className={styles.compactMeta}>
                      <strong>Recommendation:</strong>{" "}
                      {selectedLog.recommendation}
                    </p>
                  ) : null}
                </section>

                <section className={styles.detailSection}>
                  <h3>AI Decision Support</h3>

                  <p className={styles.compactMeta}>
                    <strong>Possible Conditions:</strong>{" "}
                    {selectedLog.possible_conditions || "N/A"}
                  </p>

                  <p className={styles.compactMeta}>
                    <strong>Key Findings:</strong>{" "}
                    {selectedLog.key_findings || "N/A"}
                  </p>

                  <p className={styles.compactMeta}>
                    <strong>Treatment Suggestions:</strong>{" "}
                    {selectedLog.treatment_suggestions || "N/A"}
                  </p>

                  <p className={styles.compactMeta}>
                    <strong>Prescription Suggestions:</strong>{" "}
                    {selectedLog.prescription_suggestions || "N/A"}
                  </p>

                  <p className={styles.compactMeta}>
                    <strong>Follow-up Suggestions:</strong>{" "}
                    {selectedLog.follow_up_suggestions || "N/A"}
                  </p>

                  <p className={styles.compactMeta}>
                    <strong>Red Flags:</strong> {selectedLog.red_flags || "N/A"}
                  </p>
                </section>

                <section className={styles.detailSection}>
                  <h3>Doctor Review and Final Report</h3>

                  <p className={styles.compactMeta}>
                    <strong>Doctor Note:</strong>{" "}
                    {selectedLog.doctor_note || "N/A"}
                  </p>

                  <p className={styles.compactMeta}>
                    <strong>Final Diagnosis:</strong>{" "}
                    {selectedLog.doctor_final_diagnosis ||
                      selectedLog.final_diagnosis ||
                      "N/A"}
                  </p>

                  <p className={styles.compactMeta}>
                    <strong>Doctor Prescription:</strong>{" "}
                    {selectedLog.doctor_prescription ||
                      selectedLog.prescription ||
                      "N/A"}
                  </p>

                  <p className={styles.compactMeta}>
                    <strong>After-appointment Notes:</strong>{" "}
                    {selectedLog.after_appointment_notes ||
                      selectedLog.doctor_notes ||
                      "N/A"}
                  </p>

                  <p className={styles.compactMeta}>
                    <strong>Follow-up Plan:</strong>{" "}
                    {selectedLog.follow_up_plan || "N/A"}
                  </p>

                  <p className={styles.compactMeta}>
                    <strong>Next Visit Date:</strong>{" "}
                    {selectedLog.next_visit_date || "N/A"}
                  </p>
                </section>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={() => setSelectedLog(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}