"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaBrain,
  FaClipboardCheck,
  FaNotesMedical,
  FaSearch,
  FaStethoscope,
  FaTimes,
  FaUserMd,
} from "react-icons/fa";

import AdminNavbar from "@/app/components/AdminNavbar";
import PortalShell from "@/app/components/PortalShell";
import { AdminAiLog, getAdminAiLogs } from "@/lib/admin-api";
import styles from "@/app/styles/admin.module.css";

type SeverityFilter = "all" | "mild" | "moderate" | "severe" | "unspecified";
type ReviewFilter = "all" | "pending" | "reviewed" | "completed";

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function titleCase(value?: string | null) {
  const cleaned = (value || "").trim();

  if (!cleaned) return "N/A";

  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
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

function getInitials(name?: string | null) {
  const source = name || "AI";
  const parts = source.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();

  return source.charAt(0).toUpperCase();
}

function getReviewStatus(log: AdminAiLog) {
  const status = normalizeText(log.review_status);

  if (status === "completed") return "Completed";
  if (status === "reviewed") return "Reviewed";

  if (log.diagnosis_report_id || log.doctor_final_diagnosis || log.final_diagnosis) {
    return "Completed";
  }

  return "Pending Review";
}

function getSeverityClass(severity?: string | null) {
  const cleanSeverity = normalizeText(severity);

  if (cleanSeverity === "severe") return styles.aiSeveritySevere;
  if (cleanSeverity === "moderate") return styles.aiSeverityModerate;
  if (cleanSeverity === "mild") return styles.aiSeverityMild;

  return styles.aiSeverityNeutral;
}

function getReviewClass(status?: string | null) {
  const cleanStatus = normalizeText(status);

  if (cleanStatus === "completed") return styles.approved;
  if (cleanStatus === "reviewed") return styles.blueAccentBadge;

  return styles.pending;
}

function hasFinalReport(log: AdminAiLog) {
  return Boolean(
    log.diagnosis_report_id ||
      log.doctor_final_diagnosis ||
      log.final_diagnosis ||
      log.doctor_prescription ||
      log.prescription
  );
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
    review_status: raw.review_status || "Pending Review",
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

function DetailSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.detailSectionClean}>
      <div className={styles.detailSectionTitle}>
        {icon}
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  const displayValue = value === null || value === undefined || value === "" ? "N/A" : String(value);

  return (
    <div className={styles.cleanInfoRow}>
      <span>{label}</span>
      <strong className={displayValue === "N/A" ? styles.emptyValue : ""}>
        {displayValue}
      </strong>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value?: string | null }) {
  const displayValue = value?.trim() || "N/A";

  return (
    <div className={styles.cleanTextBlock}>
      <span>{label}</span>
      <p className={displayValue === "N/A" ? styles.emptyValue : ""}>{displayValue}</p>
    </div>
  );
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

    return logs
      .filter((log) => {
        const severity = normalizeText(log.severity) || "unspecified";
        const reviewStatus = normalizeText(getReviewStatus(log));

        const matchesSearch =
          !keyword ||
          normalizeText(log.patient_name).includes(keyword) ||
          normalizeText(log.patient_email).includes(keyword) ||
          normalizeText(log.doctor_name).includes(keyword) ||
          normalizeText(log.condition).includes(keyword) ||
          normalizeText(log.doctor_final_diagnosis).includes(keyword) ||
          normalizeText(log.final_diagnosis).includes(keyword) ||
          String(log.appointment_id || "").includes(keyword);

        const matchesSeverity =
          severityFilter === "all" || severity === severityFilter;

        const matchesReview =
          reviewFilter === "all" ||
          (reviewFilter === "pending" && reviewStatus.includes("pending")) ||
          (reviewFilter === "reviewed" && reviewStatus === "reviewed") ||
          (reviewFilter === "completed" && reviewStatus === "completed");

        return matchesSearch && matchesSeverity && matchesReview;
      })
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;

        return dateB - dateA;
      });
  }, [logs, search, severityFilter, reviewFilter]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      pending: logs.filter((log) => normalizeText(getReviewStatus(log)).includes("pending")).length,
      reviewed: logs.filter((log) => normalizeText(getReviewStatus(log)) === "reviewed").length,
      completed: logs.filter((log) => normalizeText(getReviewStatus(log)) === "completed").length,
      severe: logs.filter((log) => normalizeText(log.severity) === "severe").length,
    };
  }, [logs]);

  return (
    <div className="staffLayout">
      <AdminNavbar />

      <PortalShell role="admin">
      <main className={`staffContent ${styles.aiLogsPage} ${styles.visualPageFix}`}>
        <div className={styles.headerRow}>
          <div>
            <p className={styles.eyebrow}>Clinical Monitoring</p>
            <h1 className={styles.title}>AI Review Monitor</h1>
            <p className={styles.subtitle}>
              Review AI-assisted skin analysis records without duplicate fields or cluttered card layouts.
            </p>
          </div>

          <button
            type="button"
            className={styles.softActionButton}
            onClick={loadLogs}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} ${styles.pinkAccent}`}>
            <span>Total AI Logs</span>
            <strong>{stats.total}</strong>
            <p>All AI-assisted cases</p>
          </div>

          <div className={`${styles.statCard} ${styles.orangeAccent}`}>
            <span>Pending Review</span>
            <strong>{stats.pending}</strong>
            <p>Needs clinical review</p>
          </div>

          <div className={`${styles.statCard} ${styles.blueAccent}`}>
            <span>Reviewed</span>
            <strong>{stats.reviewed}</strong>
            <p>Doctor reviewed result</p>
          </div>

          <div className={`${styles.statCard} ${styles.greenAccent}`}>
            <span>Completed Reports</span>
            <strong>{stats.completed}</strong>
            <p>Linked to diagnosis</p>
          </div>

          <div className={`${styles.statCard} ${styles.pinkAccent}`}>
            <span>Severe Cases</span>
            <strong>{stats.severe}</strong>
            <p>Higher-priority cases</p>
          </div>
        </div>

        <div className={`${styles.adminToolbar} ${styles.toolbarCenteredFix}`}>
          <div className={styles.searchFieldWrap}>
            <FaSearch />
            <input
              type="text"
              placeholder="Search patient, email, doctor, condition, diagnosis, or appointment ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={styles.searchInput}
            />
          </div>

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

        <section className={`${styles.aiCasePanel} ${styles.aiCasePanelFix}`}>
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
            <div className={styles.aiCaseListClean}>
              {filteredLogs.map((log) => {
                const reviewStatus = getReviewStatus(log);
                const finalReportAvailable = hasFinalReport(log);

                return (
                  <article key={log.id} className={styles.aiCaseCardClean}>
                    <div className={styles.aiCardCleanHeader}>
                      <div className={styles.aiPatientIdentity}>
                        <div className={styles.userAvatarSmall}>
                          {getInitials(log.patient_name)}
                        </div>
                        <div>
                          <strong>{log.patient_name}</strong>
                          <span>{log.patient_email}</span>
                        </div>
                      </div>

                      <div className={styles.aiBadgeStackClean}>
                        <span className={`${styles.statusBadge} ${getReviewClass(reviewStatus)}`}>
                          {reviewStatus}
                        </span>
                        <span className={`${styles.aiSeverityBadge} ${getSeverityClass(log.severity)}`}>
                          {titleCase(log.severity)}
                        </span>
                      </div>
                    </div>

                    <div className={styles.aiCleanSummary}>
                      <div className={styles.aiCleanCondition}>
                        <FaBrain />
                        <div>
                          <span>AI Condition</span>
                          <strong>{log.condition || "No AI result"}</strong>
                        </div>
                      </div>

                      <div className={styles.aiCleanMeta}>
                        <InfoRow label="Confidence" value={formatConfidence(log.confidence)} />
                        <InfoRow label="Doctor" value={log.doctor_name || "Not assigned"} />
                        <InfoRow label="Created" value={formatDate(log.created_at)} />
                        <InfoRow
                          label="Final Report"
                          value={finalReportAvailable ? "Available" : "Awaiting report"}
                        />
                      </div>
                    </div>

                    <div className={styles.aiCleanFooter}>
                      <span className={styles.caseReference}>Case #{log.id}</span>
                      <button
                        type="button"
                        className={styles.softActionButton}
                        onClick={() => setSelectedLog(log)}
                      >
                        View Details
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
      </PortalShell>

      {selectedLog && (
        <div
          className={`${styles.modalBackdrop} ${styles.adminFocusedBackdrop}`}
          role="button"
          tabIndex={0}
          onClick={() => setSelectedLog(null)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setSelectedLog(null);
          }}
        >
          <div
            className={`${styles.modalCard} ${styles.cleanDetailModal}`}
            role="dialog"
            aria-modal="true"
            aria-label="AI log details"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.cleanModalHeader}>
              <div className={styles.profileHero}>
                <div className={styles.profileAvatar}>
                  {getInitials(selectedLog.patient_name)}
                </div>

                <div className={styles.profileHeroMain}>
                  <p className={styles.eyebrow}>AI Log Details</p>
                  <h2>{selectedLog.patient_name}</h2>
                  <p>{selectedLog.patient_email}</p>

                  <div className={styles.profileBadgeRow}>
                    <span className={`${styles.statusBadge} ${getReviewClass(getReviewStatus(selectedLog))}`}>
                      {getReviewStatus(selectedLog)}
                    </span>
                    <span className={`${styles.aiSeverityBadge} ${getSeverityClass(selectedLog.severity)}`}>
                      {titleCase(selectedLog.severity)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={styles.modalCloseRound}
                onClick={() => setSelectedLog(null)}
                aria-label="Close AI log details"
              >
                <FaTimes />
              </button>
            </div>

            <div className={styles.cleanModalBody}>
              <DetailSection icon={<FaStethoscope />} title="Case Summary">
                <div className={styles.cleanInfoGrid}>
                  <InfoRow label="Condition" value={selectedLog.condition} />
                  <InfoRow label="Confidence" value={formatConfidence(selectedLog.confidence)} />
                  <InfoRow label="Severity" value={titleCase(selectedLog.severity)} />
                  <InfoRow label="Doctor" value={selectedLog.doctor_name} />
                  <InfoRow label="Created" value={formatDate(selectedLog.created_at)} />
                  <InfoRow
                    label="Final Report"
                    value={hasFinalReport(selectedLog) ? "Available" : "Awaiting report"}
                  />
                </div>
              </DetailSection>

              <DetailSection icon={<FaNotesMedical />} title="AI Decision Support">
                <div className={styles.cleanTextStack}>
                  <TextBlock label="Key Findings" value={selectedLog.key_findings} />
                  <TextBlock label="Treatment Suggestions" value={selectedLog.treatment_suggestions} />
                  <TextBlock label="Prescription Suggestions" value={selectedLog.prescription_suggestions} />
                  <TextBlock label="Follow-up Suggestions" value={selectedLog.follow_up_suggestions} />
                  <TextBlock label="Red Flags" value={selectedLog.red_flags} />
                </div>
              </DetailSection>

              <DetailSection icon={<FaUserMd />} title="Doctor Review and Final Report">
                <div className={styles.cleanTextStack}>
                  <TextBlock label="Doctor Note" value={selectedLog.doctor_note} />
                  <TextBlock
                    label="Final Diagnosis"
                    value={selectedLog.doctor_final_diagnosis || selectedLog.final_diagnosis}
                  />
                  <TextBlock
                    label="Doctor Prescription"
                    value={selectedLog.doctor_prescription || selectedLog.prescription}
                  />
                  <TextBlock label="After-appointment Notes" value={selectedLog.after_appointment_notes || selectedLog.doctor_notes} />
                  <TextBlock label="Follow-up Plan" value={selectedLog.follow_up_plan} />
                  <InfoRow label="Next Visit Date" value={selectedLog.next_visit_date || "N/A"} />
                </div>
              </DetailSection>
            </div>

            <div className={styles.cleanModalFooter}>
              <button
                type="button"
                className={styles.softActionButton}
                onClick={() => setSelectedLog(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
