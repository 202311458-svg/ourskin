"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { API_BASE_URL } from "@/lib/api"
import PageShell from "@/app/components/portal/ui/PageShell"
import PageHeader from "@/app/components/portal/ui/PageHeader"
import EmptyState from "@/app/components/portal/ui/EmptyState"
import styles from "./page.module.css"

type Appointment = {
  id: number
  patient_name: string
  patient_email?: string | null
  patient_contact?: string | null
  patient_address?: string | null
  patient_age?: number | null
  patient_age_label?: string | null
  is_minor?: boolean | null
  guardian_first_name?: string | null
  guardian_last_name?: string | null
  guardian_relationship?: string | null
  guardian_contact?: string | null
  guardian_email?: string | null
  guardian_consent?: boolean | null
  patient_instruction?: string | null
  approval_email_sent?: boolean | null
  approval_email_sent_at?: string | null
  doctor_name?: string | null
  date?: string | null
  time?: string | null
  end_time?: string | null
  status: string
  services?: string | null
  cancel_reason?: string | null
  last_action_by_name?: string | null
  last_action_by_role?: string | null
  consultation_mode?: string | null
  appointment_type?: string | null
}

type AppointmentLog = {
  id: number
  appointment_id: number
  action: string
  performed_by_id: number | null
  performed_by_name: string
  performed_by_role: string
  reason?: string | null
  created_at: string
}

type PaginatedAppointments = {
  total: number
  page: number
  page_size: number
  items: Appointment[]
}

const STATUS_FILTERS = ["All", "Approved", "Completed", "No-Show", "Declined", "Cancelled", "Pending"] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const normalizeStatus = (status?: string | null) => {
  const clean = (status || "").trim().toLowerCase()
  if (clean === "pending") return "Pending"
  if (clean === "approved" || clean === "confirmed") return "Approved"
  if (clean === "completed") return "Completed"
  if (clean === "no-show" || clean === "noshow" || clean === "missed") return "No-Show"
  if (clean === "declined") return "Declined"
  if (clean === "cancelled" || clean === "canceled") return "Cancelled"
  return status?.trim() || "Unknown"
}

const getStatusLabel = (status?: string | null) =>
  normalizeStatus(status) === "No-Show" ? "Missed Appointment" : normalizeStatus(status)

const readJsonSafely = async (res: Response) => {
  const text = await res.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return null }
}

const parsePaginatedAppointments = (data: unknown): PaginatedAppointments => {
  if (!data || typeof data !== "object") throw new Error("Invalid appointment history response")
  const value = data as PaginatedAppointments
  if (!Array.isArray(value.items) || typeof value.total !== "number" || typeof value.page !== "number" || typeof value.page_size !== "number") {
    throw new Error("Invalid appointment history response")
  }
  return value
}

const formatDate = (value?: string | null) => {
  if (!value) return "No date"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" })
}

const formatTime = (value?: string | null) => {
  if (!value) return ""
  const [hour, minute] = value.split(":")
  const date = new Date()
  date.setHours(Number(hour), Number(minute), 0, 0)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })
}

const formatTimeRange = (appt: Appointment) => {
  if (!appt.time) return "No time"
  const start = formatTime(appt.time)
  const end = appt.end_time ? formatTime(appt.end_time) : ""
  return end ? `${start} – ${end}` : start
}

const formatDateTime = (value?: string | null) => {
  if (!value) return "No timestamp"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en-AU", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

const formatPatientAge = (appt: Appointment) => {
  if (appt.patient_age_label?.trim()) return appt.patient_age_label.trim()
  if (typeof appt.patient_age === "number") return `${appt.patient_age} ${appt.patient_age === 1 ? "year" : "years"} old`
  return "Not provided"
}

const getGuardianName = (appt?: Appointment | null) => {
  if (!appt) return "Not provided"
  return `${appt.guardian_first_name?.trim() || ""} ${appt.guardian_last_name?.trim() || ""}`.trim() || "Not provided"
}

const hasGuardianInfo = (appt?: Appointment | null) => Boolean(
  appt && (appt.is_minor || appt.guardian_first_name || appt.guardian_last_name || appt.guardian_relationship || appt.guardian_contact || appt.guardian_email || appt.guardian_consent)
)

const getStatusClass = (status?: string | null) => {
  const clean = normalizeStatus(status)
  if (clean === "Approved") return styles.statusApproved
  if (clean === "Completed") return styles.statusCompleted
  if (clean === "No-Show" || clean === "Declined") return styles.statusDeclined
  if (clean === "Cancelled") return styles.statusCancelled
  return styles.statusPending
}

export default function StaffHistoryPage() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 25
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All")
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [appointmentLogs, setAppointmentLogs] = useState<AppointmentLog[]>([])
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadHistory = useCallback(async (requestedPage = page) => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/")
      return
    }

    setLoading(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE_URL}/appointments/history?page=${requestedPage}&page_size=${pageSize}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await readJsonSafely(res)
      if (!res.ok) throw new Error("Unable to load appointment history")
      const history = parsePaginatedAppointments(body)
      setAppointments(history.items.map((appt) => ({ ...appt, status: normalizeStatus(appt.status) })))
      setTotal(history.total)
      setPage(history.page)
      setLastUpdated(new Date())
    } catch (err) {
      console.error("Appointment history load failed:", err)
      setError(err instanceof Error ? err.message : "Unable to load appointment history.")
      setAppointments([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, router])

  useEffect(() => {
    if (localStorage.getItem("role") !== "staff") {
      router.push("/")
      return
    }
    void loadHistory(page)
  }, [loadHistory, page, router])

  const filteredAppointments = useMemo(() => {
    const q = search.trim().toLowerCase()
    return appointments.filter((appt) => {
      const matchesStatus = statusFilter === "All" || normalizeStatus(appt.status) === statusFilter
      const matchesSearch = !q || [
        appt.patient_name,
        appt.doctor_name,
        appt.services,
        appt.consultation_mode,
        appt.appointment_type,
        appt.cancel_reason,
        appt.last_action_by_name,
      ].filter(Boolean).join(" ").toLowerCase().includes(q)
      return matchesStatus && matchesSearch
    })
  }, [appointments, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const openDetails = async (appointment: Appointment) => {
    const token = localStorage.getItem("token")
    if (!token) return router.push("/")

    try {
      setDetailsLoading(true)
      setDetailsOpen(true)
      const [appointmentRes, logsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/appointments/${appointment.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/appointments/${appointment.id}/logs`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const appointmentData = await readJsonSafely(appointmentRes)
      const logsData = await readJsonSafely(logsRes)
      if (!appointmentRes.ok || !logsRes.ok) throw new Error("Unable to load appointment details")
      setSelectedAppointment({ ...(appointmentData as Appointment), status: normalizeStatus((appointmentData as Appointment).status) })
      setAppointmentLogs(Array.isArray(logsData) ? logsData : [])
    } catch (err) {
      console.error("History details failed:", err)
      setDetailsOpen(false)
      setError(err instanceof Error ? err.message : "Unable to load appointment details.")
    } finally {
      setDetailsLoading(false)
    }
  }

  const closeDetails = () => {
    setDetailsOpen(false)
    setSelectedAppointment(null)
    setAppointmentLogs([])
  }

  return (
    <PageShell className={styles.staffPage}>
      <PageHeader
        title="Appointment history"
        description="Search completed and closed appointment records with their final status and staff activity."
      />

      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Search this page by patient, doctor, service, reason, or staff"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search appointment history"
          />

          <div className={styles.filterRow} aria-label="History status filters">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                className={`${styles.filterChip} ${statusFilter === status ? styles.filterChipActive : ""}`}
                onClick={() => setStatusFilter(status)}
                aria-pressed={statusFilter === status}
              >
                {status}
              </button>
            ))}
          </div>

          <div className={styles.resultMeta}>
            <span>{filteredAppointments.length} shown · {total} total</span>
            {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
          </div>
        </div>

        {loading ? (
          <EmptyState title="Loading appointment history..." />
        ) : error ? (
          <div className={styles.errorBanner} role="alert">{error}</div>
        ) : filteredAppointments.length === 0 ? (
          <EmptyState title="No appointment records match this view" />
        ) : (
          <div className={styles.historyTable} role="table" aria-label="Appointment history records">
            <div className={styles.tableHeader} role="row">
              <span role="columnheader">Date</span>
              <span role="columnheader">Patient</span>
              <span role="columnheader">Doctor</span>
              <span role="columnheader">Service</span>
              <span role="columnheader">Final status</span>
              <span role="columnheader">Last action</span>
              <span role="columnheader">Details</span>
            </div>

            {filteredAppointments.map((appt) => (
              <div className={styles.tableRow} role="row" key={appt.id}>
                <div className={styles.tableCell} role="cell" data-label="Date">
                  <strong>{formatDate(appt.date)}</strong>
                  <small>{formatTimeRange(appt)}</small>
                </div>
                <div className={styles.tableCell} role="cell" data-label="Patient">
                  <strong>{appt.patient_name || "Patient unavailable"}</strong>
                  {appt.patient_email && <small>{appt.patient_email}</small>}
                </div>
                <div className={styles.tableCell} role="cell" data-label="Doctor">{appt.doctor_name || "Not available"}</div>
                <div className={styles.tableCell} role="cell" data-label="Service">
                  <strong>{appt.services || "Not specified"}</strong>
                  {appt.consultation_mode && <small>{appt.consultation_mode}</small>}
                </div>
                <div className={styles.tableCell} role="cell" data-label="Final status">
                  <span className={`${styles.badge} ${getStatusClass(appt.status)}`}>{getStatusLabel(appt.status)}</span>
                </div>
                <div className={styles.tableCell} role="cell" data-label="Last action">
                  <strong>{appt.last_action_by_name || "System"}</strong>
                  {appt.last_action_by_role && <small>{appt.last_action_by_role}</small>}
                  {appt.cancel_reason && <small>{appt.cancel_reason}</small>}
                </div>
                <div className={`${styles.tableCell} ${styles.actionCell}`} role="cell" data-label="Details">
                  <button className={styles.secondaryBtn} type="button" onClick={() => openDetails(appt)}>Details</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.pagination}>
          <span>Page {page} of {totalPages}</span>
          <div>
            <button className={styles.secondaryBtn} type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
            <button className={styles.secondaryBtn} type="button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
          </div>
        </div>
      </section>

      {detailsOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="history-details-title">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div>
                <h2 id="history-details-title">Appointment record</h2>
                <p>Patient, booking, and recorded activity for this appointment.</p>
              </div>
              <button className={styles.modalCloseBtn} type="button" onClick={closeDetails} aria-label="Close appointment details">×</button>
            </div>

            {detailsLoading ? (
              <EmptyState title="Loading appointment details..." />
            ) : selectedAppointment ? (
              <div className={styles.modalGrid}>
                <section className={styles.detailPanel}>
                  <h3>Record details</h3>
                  <InfoRow label="Patient" value={selectedAppointment.patient_name || "Not provided"} />
                  <InfoRow label="Age" value={formatPatientAge(selectedAppointment)} />
                  <InfoRow label="Contact" value={selectedAppointment.patient_contact || "Not provided"} />
                  <InfoRow label="Email" value={selectedAppointment.patient_email || "Not provided"} />
                  <InfoRow label="Doctor" value={selectedAppointment.doctor_name || "Not available"} />
                  <InfoRow label="Service" value={selectedAppointment.services || "Not specified"} />
                  <InfoRow label="Schedule" value={`${formatDate(selectedAppointment.date)} · ${formatTimeRange(selectedAppointment)}`} />
                  <InfoRow label="Status" value={getStatusLabel(selectedAppointment.status)} />
                  <InfoRow label="Reason" value={selectedAppointment.cancel_reason || "Not provided"} />
                  {hasGuardianInfo(selectedAppointment) && (
                    <>
                      <div className={styles.detailDivider} />
                      <h3>Guardian</h3>
                      <InfoRow label="Name" value={getGuardianName(selectedAppointment)} />
                      <InfoRow label="Relationship" value={selectedAppointment.guardian_relationship || "Not provided"} />
                      <InfoRow label="Contact" value={selectedAppointment.guardian_contact || "Not provided"} />
                    </>
                  )}
                </section>

                <section className={styles.detailPanel}>
                  <h3>Activity</h3>
                  {appointmentLogs.length === 0 ? (
                    <EmptyState title="No activity logs found" />
                  ) : (
                    <div className={styles.timelineList}>
                      {appointmentLogs.map((log) => (
                        <article className={styles.timelineItem} key={log.id}>
                          <div>
                            <strong>{log.action}</strong>
                            <span>{log.performed_by_name || "System"}{log.performed_by_role ? ` · ${log.performed_by_role}` : ""}</span>
                            {log.reason && <p>{log.reason}</p>}
                          </div>
                          <small>{formatDateTime(log.created_at)}</small>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <EmptyState title="Appointment record unavailable" />
            )}
          </div>
        </div>
      )}
    </PageShell>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </div>
  )
}
