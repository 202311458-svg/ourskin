"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { API_BASE_URL } from "@/lib/api"
import { printHtmlDocument } from "@/lib/printExport"
import PageShell from "@/app/components/portal/ui/PageShell"
import PageHeader from "@/app/components/portal/ui/PageHeader"
import EmptyState from "@/app/components/portal/ui/EmptyState"
import styles from "./page.module.css"

type Appointment = {
  id: number
  patient_id?: number | null
  doctor_id?: number | null
  schedule_id?: number | null
  service_id?: number | null
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
  consultation_mode?: string | null
  appointment_type?: string | null
  concern?: string | null
  is_initial_evaluation_request?: boolean | null
  cancel_reason?: string | null
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

type ViewFilter = "All" | "Today" | "Upcoming" | "Past"

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

const getTodayInputDate = () => {
  const today = new Date()
  const timezoneOffset = today.getTimezoneOffset() * 60000
  return new Date(today.getTime() - timezoneOffset).toISOString().split("T")[0]
}

const readJsonSafely = async (res: Response) => {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const getErrorMessage = (data: unknown, fallback: string) => {
  if (data && typeof data === "object" && "detail" in data && typeof (data as { detail?: unknown }).detail === "string") {
    return (data as { detail: string }).detail
  }
  if (data && typeof data === "object" && "message" in data && typeof (data as { message?: unknown }).message === "string") {
    return (data as { message: string }).message
  }
  return fallback
}

const getAppointmentsArray = (data: unknown): Appointment[] => {
  if (Array.isArray(data)) return data as Appointment[]
  if (data && typeof data === "object" && Array.isArray((data as { appointments?: unknown }).appointments)) {
    return (data as { appointments: Appointment[] }).appointments
  }
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: Appointment[] }).data
  }
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: Appointment[] }).items
  }
  return []
}

const getAppointmentObject = (data: unknown): Appointment | null => {
  if (!data || typeof data !== "object") return null
  const record = data as Record<string, unknown>
  if (record.appointment && typeof record.appointment === "object") return record.appointment as Appointment
  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) return record.data as Appointment
  return data as Appointment
}

const getAppointmentLogsArray = (data: unknown): AppointmentLog[] => {
  if (Array.isArray(data)) return data as AppointmentLog[]
  if (data && typeof data === "object" && Array.isArray((data as { logs?: unknown }).logs)) {
    return (data as { logs: AppointmentLog[] }).logs
  }
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: AppointmentLog[] }).data
  }
  return []
}

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "No date"
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  return date.toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" })
}

const formatLongDate = (dateString?: string | null) => {
  if (!dateString) return "No date"
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  return date.toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" })
}

const formatTime = (timeString?: string | null) => {
  if (!timeString) return ""
  const [hour, minute] = timeString.split(":")
  const date = new Date()
  date.setHours(Number(hour), Number(minute), 0, 0)
  if (Number.isNaN(date.getTime())) return timeString
  return date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })
}

const formatTimeRange = (appt: Appointment) => {
  if (!appt.time) return "Time unavailable"
  const start = formatTime(appt.time)
  const end = appt.end_time ? formatTime(appt.end_time) : ""
  return end ? `${start} – ${end}` : start
}

const formatDateTime = (dateTimeString?: string | null) => {
  if (!dateTimeString) return "No timestamp"
  const date = new Date(dateTimeString)
  if (Number.isNaN(date.getTime())) return dateTimeString
  return date.toLocaleString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
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

const hasGuardianInfo = (appt?: Appointment | null) =>
  Boolean(
    appt &&
      (appt.is_minor ||
        appt.guardian_first_name ||
        appt.guardian_last_name ||
        appt.guardian_relationship ||
        appt.guardian_contact ||
        appt.guardian_email ||
        appt.guardian_consent)
  )

const getApprovalEmailStatus = (appt?: Appointment | null) => {
  if (!appt?.approval_email_sent) return "Not sent"
  return appt.approval_email_sent_at ? `Sent on ${formatDateTime(appt.approval_email_sent_at)}` : "Sent"
}

const getDateTimeValue = (appt: Appointment) => {
  if (!appt.date || !appt.time) return Number.MAX_SAFE_INTEGER
  const value = new Date(`${appt.date}T${appt.time}`).getTime()
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value
}

const getAppointmentEndDateTimeValue = (appt: Appointment) => {
  if (!appt.date || (!appt.end_time && !appt.time)) return Number.MAX_SAFE_INTEGER
  const value = new Date(`${appt.date}T${appt.end_time || appt.time}`).getTime()
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value
}

const canMarkNoShow = (appt: Appointment) =>
  normalizeStatus(appt.status) === "Approved" && getAppointmentEndDateTimeValue(appt) <= Date.now()

const getAppointmentStatusClass = (status?: string | null) => {
  const clean = normalizeStatus(status)
  if (clean === "Approved") return styles.statusApproved
  if (clean === "Completed") return styles.statusCompleted
  if (clean === "No-Show" || clean === "Declined") return styles.statusDeclined
  if (clean === "Cancelled") return styles.statusCancelled
  return styles.statusPending
}

export default function StaffAppointments() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<ViewFilter>("All")
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [appointmentLogs, setAppointmentLogs] = useState<AppointmentLog[]>([])
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [noShowTarget, setNoShowTarget] = useState<Appointment | null>(null)
  const [noShowReason, setNoShowReason] = useState("Patient did not attend the scheduled appointment.")
  const [noShowError, setNoShowError] = useState("")
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)

  const loadAppointments = useCallback(async () => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/")
      return
    }

    setLoading(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE_URL}/appointments/confirmed`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await readJsonSafely(res)
      if (!res.ok) throw new Error(getErrorMessage(data, "Failed to fetch confirmed appointments"))
      setAppointments(getAppointmentsArray(data).map((appt) => ({ ...appt, status: normalizeStatus(appt.status) })))
    } catch (err) {
      console.error("Confirmed appointments load failed:", err)
      setError(err instanceof Error ? err.message : "Unable to load confirmed appointments.")
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (localStorage.getItem("role") !== "staff") {
      router.push("/")
      return
    }
    loadAppointments()
  }, [loadAppointments, router])

  const sortedAppointments = useMemo(
    () => [...appointments].sort((a, b) => getDateTimeValue(a) - getDateTimeValue(b)),
    [appointments]
  )

  const approvedAppointments = useMemo(
    () => sortedAppointments.filter((appt) => normalizeStatus(appt.status) === "Approved"),
    [sortedAppointments]
  )

  const filteredAppointments = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const now = Date.now()
    const today = getTodayInputDate()

    return sortedAppointments.filter((appt) => {
      const inView =
        filter === "Today"
          ? appt.date === today
          : filter === "Upcoming"
            ? getDateTimeValue(appt) >= now
            : filter === "Past"
              ? getDateTimeValue(appt) < now
              : true

      const matches = [
        appt.patient_name,
        appt.patient_email,
        appt.patient_contact,
        appt.doctor_name,
        appt.services,
        appt.consultation_mode,
        appt.appointment_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword)

      return inView && matches
    })
  }, [filter, search, sortedAppointments])

  const handlePrintApprovedAppointments = () => {
    const printableRows = approvedAppointments.map((appt, index) => [
      index + 1,
      formatLongDate(appt.date),
      formatTimeRange(appt),
      appt.patient_name || "Not provided",
      appt.patient_contact || "Not provided",
      appt.patient_email || "Not provided",
      appt.doctor_name || "Assigned doctor unavailable",
      appt.services || "No service listed",
      appt.consultation_mode || "Not provided",
      getStatusLabel(appt.status),
    ])

    printHtmlDocument({
      title: "OurSkin Appointments",
      subtitle: "Approved appointments currently loaded in the staff appointment board.",
      headers: ["#", "Date", "Time", "Patient", "Contact", "Email", "Doctor", "Service", "Mode", "Status"],
      rows: printableRows,
      emptyMessage: "No approved appointments found.",
      orientation: "landscape",
    })
  }

  const openDetails = async (appointment: Appointment) => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/")
      return
    }

    try {
      setDetailsLoading(true)
      setDetailsOpen(true)
      const [appointmentRes, logsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/appointments/${appointment.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/appointments/${appointment.id}/logs`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])
      const appointmentData = await readJsonSafely(appointmentRes)
      const logsData = await readJsonSafely(logsRes)
      if (!appointmentRes.ok || !logsRes.ok) throw new Error("Failed to fetch appointment details")

      const loadedAppointment = getAppointmentObject(appointmentData)
      if (!loadedAppointment) throw new Error("Appointment details were not found")

      setSelectedAppointment({ ...loadedAppointment, status: normalizeStatus(loadedAppointment.status) })
      setAppointmentLogs(getAppointmentLogsArray(logsData))
    } catch (err) {
      console.error("Failed to open appointment details:", err)
      setSelectedAppointment(null)
      setAppointmentLogs([])
      setDetailsOpen(false)
      setError("Unable to load appointment details.")
    } finally {
      setDetailsLoading(false)
    }
  }

  const closeDetails = () => {
    setDetailsOpen(false)
    setSelectedAppointment(null)
    setAppointmentLogs([])
  }

  const openNoShowDialog = (appointment: Appointment) => {
    if (!canMarkNoShow(appointment)) return
    setNoShowTarget(appointment)
    setNoShowReason("Patient did not attend the scheduled appointment.")
    setNoShowError("")
  }

  const closeNoShowDialog = () => {
    if (actionLoadingId !== null) return
    setNoShowTarget(null)
    setNoShowReason("")
    setNoShowError("")
  }

  const markAsNoShow = async () => {
    if (!noShowTarget) return
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/")
      return
    }

    const cleanReason = noShowReason.trim()
    if (!cleanReason) {
      setNoShowError("Provide a reason before marking this appointment as missed.")
      return
    }

    setNoShowError("")
    try {
      setActionLoadingId(noShowTarget.id)
      const res = await fetch(`${API_BASE_URL}/appointments/${noShowTarget.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "No-Show", cancel_reason: cleanReason }),
      })
      const result = await readJsonSafely(res)
      if (!res.ok) throw new Error(getErrorMessage(result, "Unable to mark appointment as no-show."))

      setAppointments((prev) => prev.filter((item) => item.id !== noShowTarget.id))
      if (selectedAppointment?.id === noShowTarget.id) closeDetails()
      setNoShowTarget(null)
      setNoShowReason("")
    } catch (err) {
      console.error("No-show update failed:", err)
      setNoShowError(err instanceof Error ? err.message : "Unable to mark appointment as no-show.")
    } finally {
      setActionLoadingId(null)
    }
  }

  const filters: ViewFilter[] = ["All", "Today", "Upcoming", "Past"]

  return (
    <PageShell className={styles.staffPage}>
      <PageHeader
        eyebrow="Appointments"
        title="Confirmed appointments"
        description="Search and manage approved clinic appointments. Follow-ups are handled separately in the Follow-Ups workspace."
        primaryAction={
          <div className={styles.headerActions}>
            <button className={styles.secondaryBtn} onClick={handlePrintApprovedAppointments} disabled={loading || approvedAppointments.length === 0}>
              Export
            </button>
            <button className={styles.secondaryBtn} onClick={loadAppointments} disabled={loading}>
              Refresh
            </button>
          </div>
        }
      />

      <section className={styles.workspace} aria-label="Confirmed appointments">
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <span className={styles.srOnly}>Search appointments</span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search patient, doctor, service, or mode"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <div className={styles.filterRow} aria-label="Appointment date filters">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                className={`${styles.filterChip} ${filter === item ? styles.filterChipActive : ""}`}
                onClick={() => setFilter(item)}
                aria-pressed={filter === item}
              >
                {item}
              </button>
            ))}
          </div>

          <span className={styles.resultCount}>{filteredAppointments.length} shown</span>
        </div>

        {loading ? (
          <EmptyState title="Loading confirmed appointments..." />
        ) : error ? (
          <div className={styles.errorBanner} role="alert">{error}</div>
        ) : filteredAppointments.length === 0 ? (
          <EmptyState title="No confirmed appointments found" description="Try another date filter or search term." />
        ) : (
          <div className={styles.appointmentTable} role="table" aria-label="Confirmed appointment list">
            <div className={styles.tableHeader} role="row">
              <span role="columnheader">Date</span>
              <span role="columnheader">Time</span>
              <span role="columnheader">Patient</span>
              <span role="columnheader">Doctor</span>
              <span role="columnheader">Service</span>
              <span role="columnheader">Status</span>
              <span role="columnheader" className={styles.actionHeader}>Actions</span>
            </div>

            {filteredAppointments.map((appt) => (
              <div key={appt.id} className={styles.tableRow} role="row">
                <div className={styles.tableCell} role="cell" data-label="Date">
                  <strong>{formatDate(appt.date)}</strong>
                </div>
                <div className={styles.tableCell} role="cell" data-label="Time">
                  {formatTimeRange(appt)}
                </div>
                <div className={styles.tableCell} role="cell" data-label="Patient">
                  <strong>{appt.patient_name || "Patient unavailable"}</strong>
                  {appt.is_minor && <small>Minor patient</small>}
                </div>
                <div className={styles.tableCell} role="cell" data-label="Doctor">
                  {appt.doctor_name || "Assigned doctor unavailable"}
                </div>
                <div className={styles.tableCell} role="cell" data-label="Service">
                  <strong>{appt.services || "Not specified"}</strong>
                  {appt.consultation_mode && <small>{appt.consultation_mode}</small>}
                </div>
                <div className={styles.tableCell} role="cell" data-label="Status">
                  <span className={`${styles.badge} ${getAppointmentStatusClass(appt.status)}`}>
                    {getStatusLabel(appt.status)}
                  </span>
                </div>
                <div className={`${styles.tableCell} ${styles.rowActions}`} role="cell" data-label="Actions">
                  {canMarkNoShow(appt) && (
                    <button
                      className={styles.dangerTextBtn}
                      type="button"
                      onClick={() => openNoShowDialog(appt)}
                    >
                      Mark no-show
                    </button>
                  )}
                  <button className={styles.secondaryBtn} type="button" onClick={() => openDetails(appt)}>
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {detailsOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="appointment-details-title">
          <div className={`${styles.modalCard} ${styles.detailsModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h2 id="appointment-details-title">Appointment details</h2>
                <p>Patient, booking, and activity information for this visit.</p>
              </div>
              <button className={styles.modalCloseBtn} type="button" onClick={closeDetails} aria-label="Close appointment details">
                ×
              </button>
            </div>

            {detailsLoading ? (
              <EmptyState title="Loading appointment details..." />
            ) : selectedAppointment ? (
              <div className={styles.modalGrid}>
                <section className={styles.detailPanel}>
                  <h3>Patient and booking</h3>
                  <InfoRow label="Patient" value={selectedAppointment.patient_name || "Not provided"} />
                  <InfoRow label="Age" value={formatPatientAge(selectedAppointment)} />
                  <InfoRow label="Contact" value={selectedAppointment.patient_contact || "Not provided"} />
                  <InfoRow label="Email" value={selectedAppointment.patient_email || "Not provided"} />
                  <InfoRow label="Address" value={selectedAppointment.patient_address || "Not provided"} />

                  {hasGuardianInfo(selectedAppointment) && (
                    <>
                      <div className={styles.detailDivider} />
                      <h3>Guardian information</h3>
                      <InfoRow label="Guardian" value={getGuardianName(selectedAppointment)} />
                      <InfoRow label="Relationship" value={selectedAppointment.guardian_relationship || "Not provided"} />
                      <InfoRow label="Contact" value={selectedAppointment.guardian_contact || "Not provided"} />
                      <InfoRow label="Email" value={selectedAppointment.guardian_email || "Not provided"} />
                      <InfoRow label="Consent" value={selectedAppointment.guardian_consent ? "Provided" : "Not provided"} />
                    </>
                  )}

                  <div className={styles.detailDivider} />
                  <h3>Appointment</h3>
                  <InfoRow label="Doctor" value={selectedAppointment.doctor_name || "Doctor unavailable"} />
                  <InfoRow label="Service" value={selectedAppointment.services || "Not specified"} />
                  <InfoRow label="Schedule" value={`${formatLongDate(selectedAppointment.date)} · ${formatTimeRange(selectedAppointment)}`} />
                  <InfoRow label="Mode" value={selectedAppointment.consultation_mode || "Not provided"} />
                  <InfoRow label="Type" value={selectedAppointment.appointment_type || "Not provided"} />
                  <InfoRow label="Status" value={getStatusLabel(selectedAppointment.status)} />
                  <InfoRow label="Concern" value={selectedAppointment.concern || "Not provided"} />
                  <InfoRow label="Patient instructions" value={selectedAppointment.patient_instruction || "Not provided"} />
                  <InfoRow label="Approval email" value={getApprovalEmailStatus(selectedAppointment)} />
                </section>

                <section className={styles.detailPanel}>
                  <h3>Appointment timeline</h3>
                  {appointmentLogs.length === 0 ? (
                    <EmptyState title="No activity logs found" />
                  ) : (
                    <div className={styles.timelineList}>
                      {appointmentLogs.map((log) => (
                        <article key={log.id} className={styles.timelineItem}>
                          <div>
                            <strong>{log.action}</strong>
                            <span>
                              {log.performed_by_name || "System"}
                              {log.performed_by_role ? ` · ${log.performed_by_role}` : ""}
                            </span>
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
              <EmptyState title="Appointment details unavailable" />
            )}
          </div>
        </div>
      )}

      {noShowTarget && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="no-show-title">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div>
                <h2 id="no-show-title">Mark appointment as no-show</h2>
                <p>{noShowTarget.patient_name} · {formatLongDate(noShowTarget.date)} · {formatTimeRange(noShowTarget)}</p>
              </div>
              <button className={styles.modalCloseBtn} type="button" onClick={closeNoShowDialog} aria-label="Close no-show dialog">
                ×
              </button>
            </div>

            <div className={styles.dialogBody}>
              <p className={styles.dialogNote}>This moves the appointment out of the active board and records it in appointment history.</p>
              <label className={styles.field}>
                <span>Reason</span>
                <textarea
                  value={noShowReason}
                  onChange={(event) => setNoShowReason(event.target.value)}
                  rows={4}
                  disabled={actionLoadingId === noShowTarget.id}
                />
              </label>
              {noShowError && <div className={styles.errorBanner} role="alert">{noShowError}</div>}
            </div>

            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} type="button" onClick={closeNoShowDialog} disabled={actionLoadingId === noShowTarget.id}>
                Cancel
              </button>
              <button className={styles.dangerBtn} type="button" onClick={markAsNoShow} disabled={actionLoadingId === noShowTarget.id}>
                {actionLoadingId === noShowTarget.id ? "Updating..." : "Confirm no-show"}
              </button>
            </div>
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
