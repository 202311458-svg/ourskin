"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import AdminNavbar from "@/app/components/AdminNavbar"
import styles from "./ailogs.module.css"

type AiLog = {
  id: number
  appointment_id?: number | null
  diagnosis_report_id?: number | null

  patient_name?: string | null
  patient_email?: string | null
  doctor_name?: string | null

  condition?: string | null
  confidence?: number | null
  severity?: string | null

  created_at?: string | null
  reviewed_at?: string | null
  review_status?: string | null
}

type ApiErrorResponse = {
  detail?: string
  message?: string
}

type SeverityFilter = "all" | "mild" | "moderate" | "severe" | "unspecified"
type ReviewFilter = "all" | "pending" | "reviewed"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

const AI_REVIEW_ENDPOINTS = [
  `${API_BASE}/admin/ai-logs`,
  `${API_BASE}/admin/ai-logs/`,
]

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

function getApiErrorMessage(data: ApiErrorResponse | null, fallback: string) {
  if (data?.detail) return data.detail
  if (data?.message) return data.message
  return fallback
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  return fallback
}

function extractLogs(data: unknown): AiLog[] {
  if (Array.isArray(data)) return data as AiLog[]

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>

    if (Array.isArray(record.logs)) return record.logs as AiLog[]
    if (Array.isArray(record.ai_logs)) return record.ai_logs as AiLog[]
    if (Array.isArray(record.results)) return record.results as AiLog[]
    if (Array.isArray(record.data)) return record.data as AiLog[]
  }

  return []
}

function normalizeAiLog(raw: Partial<AiLog>): AiLog {
  return {
    id: Number(raw.id),

    appointment_id: raw.appointment_id ?? null,
    diagnosis_report_id: raw.diagnosis_report_id ?? null,

    patient_name: raw.patient_name || "Unknown Patient",
    patient_email: raw.patient_email || "",
    doctor_name: raw.doctor_name || "Not assigned",

    condition: raw.condition || "No AI result",
    confidence: raw.confidence ?? null,
    severity: raw.severity || "Unspecified",

    created_at: raw.created_at || null,
    reviewed_at: raw.reviewed_at || null,
    review_status: raw.review_status || "Pending",
  }
}

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase()
}

function capitalizeFirst(value?: string | null) {
  if (!value) return "N/A"

  const cleaned = value.trim()

  if (!cleaned) return "N/A"

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase()
}

function formatDate(value?: string | null) {
  if (!value) return "Not available"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return "Not available"

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return "Not available"

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatConfidence(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A"
  }

  const numericValue = Number(value)

  if (numericValue <= 1) {
    return `${Math.round(numericValue * 100)}%`
  }

  return `${Math.round(numericValue)}%`
}

function getReviewStatus(log: AiLog) {
  const status = normalizeText(log.review_status)

  if (
    status === "reviewed" ||
    status === "completed" ||
    status === "done" ||
    Boolean(log.reviewed_at) ||
    Boolean(log.diagnosis_report_id)
  ) {
    return "Reviewed"
  }

  return "Pending"
}

function getSeverityClass(severity?: string | null) {
  const value = normalizeText(severity)

  if (value === "severe") return styles.severe
  if (value === "moderate") return styles.moderate
  if (value === "mild") return styles.mild

  return styles.neutral
}

function getReviewClass(status: string) {
  if (status === "Reviewed") return styles.reviewed
  return styles.pending
}

export default function AdminAiReviewMonitorPage() {
  const router = useRouter()

  const [logs, setLogs] = useState<AiLog[]>([])
  const [selectedLog, setSelectedLog] = useState<AiLog | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all")
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all")

  const [collapsed, setCollapsed] = useState(false)

  const loadLogs = useCallback(async () => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    setLoading(true)
    setError("")

    try {
      let lastError = "Unable to load AI review records."

      for (const endpoint of AI_REVIEW_ENDPOINTS) {
        const res = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await safeJson<unknown>(res)

        if (res.ok) {
          const normalizedLogs = extractLogs(data)
            .map(normalizeAiLog)
            .filter((item) => Number.isFinite(item.id))

          setLogs(normalizedLogs)
          return
        }

        const apiError = getApiErrorMessage(
          data as ApiErrorResponse | null,
          lastError
        )

        lastError = apiError

        if (res.status === 401 || res.status === 403) {
          throw new Error(apiError)
        }
      }

      throw new Error(lastError)
    } catch (err) {
      console.error("AI Review Monitor load failed:", err)
      setError(getErrorMessage(err, "Unable to load AI review records."))
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const token = localStorage.getItem("token")
    const role = localStorage.getItem("role")

    if (!token || role !== "admin") {
      router.push("/")
      return
    }

    loadLogs()
  }, [loadLogs, router])

  useEffect(() => {
    const sync = () => {
      setCollapsed(document.body.classList.contains("navCollapsed"))
    }

    sync()
    window.addEventListener("navbarToggle", sync)

    return () => window.removeEventListener("navbarToggle", sync)
  }, [])

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return logs
      .filter((log) => {
        const severityValue = normalizeText(log.severity) || "unspecified"
        const reviewStatus = getReviewStatus(log).toLowerCase()

        const matchesSearch =
          !keyword ||
          log.patient_name?.toLowerCase().includes(keyword) ||
          log.patient_email?.toLowerCase().includes(keyword) ||
          log.doctor_name?.toLowerCase().includes(keyword) ||
          log.condition?.toLowerCase().includes(keyword) ||
          log.severity?.toLowerCase().includes(keyword)

        const matchesSeverity =
          severityFilter === "all" || severityValue === severityFilter

        const matchesReview =
          reviewFilter === "all" || reviewStatus === reviewFilter

        return matchesSearch && matchesSeverity && matchesReview
      })
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0

        return dateB - dateA
      })
  }, [logs, search, severityFilter, reviewFilter])

  const summary = useMemo(() => {
    const total = logs.length

    const reviewed = logs.filter((log) => getReviewStatus(log) === "Reviewed")
      .length

    const pending = total - reviewed

    const severe = logs.filter(
      (log) => normalizeText(log.severity) === "severe"
    ).length

    return {
      total,
      reviewed,
      pending,
      severe,
    }
  }, [logs])

  const pageStyle = {
    minHeight: "100vh",
    marginLeft: collapsed ? "90px" : "240px",
    padding: "32px",
    transition: "margin-left 0.3s ease",
  }

  const containerStyle = {
    width: "100%",
    maxWidth: "1500px",
    margin: "0 auto",
  }

  return (
    <>
      <AdminNavbar />

      <main style={pageStyle}>
        <div style={containerStyle}>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.title}>AI Review Monitor</h1>
              <p className={styles.subtitle}>
                Track AI skin analysis results, severity levels, and doctor
                review status without exposing restricted medical details.
              </p>
            </div>

            <button
              className={styles.refreshButton}
              onClick={loadLogs}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span>Total AI Records</span>
              <strong>{summary.total}</strong>
            </div>

            <div className={styles.statCard}>
              <span>Reviewed</span>
              <strong>{summary.reviewed}</strong>
            </div>

            <div className={styles.statCard}>
              <span>Pending Review</span>
              <strong>{summary.pending}</strong>
            </div>

            <div className={styles.statCard}>
              <span>Severe Cases</span>
              <strong>{summary.severe}</strong>
            </div>
          </div>

          <div className={styles.filtersRow}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search patient, doctor, condition, or severity"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className={styles.selectInput}
              value={severityFilter}
              onChange={(e) =>
                setSeverityFilter(e.target.value as SeverityFilter)
              }
            >
              <option value="all">All Severity</option>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
              <option value="unspecified">Unspecified</option>
            </select>

            <select
              className={styles.selectInput}
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value as ReviewFilter)}
            >
              <option value="all">All Review Status</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>

          <section className={styles.tableCard}>
            {loading ? (
              <div className={styles.message}>Loading AI review records...</div>
            ) : error ? (
              <div className={styles.error}>{error}</div>
            ) : filteredLogs.length === 0 ? (
              <div className={styles.message}>No AI review records found.</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Assigned Doctor</th>
                    <th>AI Detected Condition</th>
                    <th>Severity Level</th>
                    <th>AI Confidence</th>
                    <th>Doctor Review Status</th>
                    <th>Analysis Date</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredLogs.map((log) => {
                    const reviewStatus = getReviewStatus(log)

                    return (
                      <tr key={log.id}>
                        <td>
                          <div className={styles.patientCell}>
                            <strong>{log.patient_name || "Unknown Patient"}</strong>
                            <p>{log.patient_email || "No email available"}</p>
                          </div>
                        </td>

                        <td>{log.doctor_name || "Not assigned"}</td>

                        <td>{log.condition || "No AI result"}</td>

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
                              reviewStatus
                            )}`}
                          >
                            {reviewStatus}
                          </span>
                        </td>

                        <td>{formatDate(log.created_at)}</td>

                        <td>
                          <button
                            className={styles.viewBtn}
                            onClick={() => setSelectedLog(log)}
                          >
                            View Summary
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </main>

      {selectedLog && (
        <div
          className={styles.modalOverlay}
          role="button"
          tabIndex={0}
          onClick={() => setSelectedLog(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSelectedLog(null)
          }}
        >
          <div
            className={styles.modalCardLarge}
            role="dialog"
            aria-modal="true"
            aria-label="AI review summary"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2>AI Review Summary</h2>
                <p>
                  Admin monitoring view only. Full doctor diagnosis,
                  prescriptions, and clinical notes are restricted.
                </p>
              </div>

              <button
                className={styles.topCloseButton}
                onClick={() => setSelectedLog(null)}
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
                <strong>Assigned Doctor</strong>
                <p>{selectedLog.doctor_name || "Not assigned"}</p>
              </div>

              <div>
                <strong>Doctor Review Status</strong>
                <p>{getReviewStatus(selectedLog)}</p>
              </div>

              <div>
                <strong>Analysis Date</strong>
                <p>{formatDateTime(selectedLog.created_at)}</p>
              </div>

              <div>
                <strong>Reviewed Date</strong>
                <p>{formatDateTime(selectedLog.reviewed_at)}</p>
              </div>
            </div>

            <div className={styles.infoBlock}>
              <h3>AI Analysis Summary</h3>

              <div className={styles.assessmentGrid}>
                <div className={styles.detailMiniBlock}>
                  <strong>AI Detected Condition</strong>
                  <p>{selectedLog.condition || "No AI result"}</p>
                </div>

                <div className={styles.detailMiniBlock}>
                  <strong>Severity Level</strong>
                  <p>{capitalizeFirst(selectedLog.severity)}</p>
                </div>

                <div className={styles.detailMiniBlock}>
                  <strong>AI Confidence</strong>
                  <p>{formatConfidence(selectedLog.confidence)}</p>
                </div>

                <div className={styles.detailMiniBlock}>
                  <strong>Admin Access Note</strong>
                  <p>
                    This page only monitors AI activity and doctor review status.
                    Full diagnosis, prescriptions, and clinical notes remain
                    restricted to the assigned doctor and the patient.
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button onClick={() => setSelectedLog(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}