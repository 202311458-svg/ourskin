"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import StaffNavbar from "@/app/components/StaffNavbar"
import { API_BASE_URL } from "@/lib/api"
import styles from "@/app/styles/staff.module.css"

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

const STATUS_FILTERS = [
  "All",
  "Approved",
  "Completed",
  "No-Show",
  "Declined",
  "Cancelled",
  "Pending",
] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]

const normalizeStatus = (status?: string | null) => {
  const cleanStatus = (status || "").trim().toLowerCase()

  if (cleanStatus === "pending") return "Pending"
  if (cleanStatus === "approved") return "Approved"
  if (cleanStatus === "confirmed") return "Approved"
  if (cleanStatus === "completed") return "Completed"
  if (cleanStatus === "no-show") return "No-Show"
  if (cleanStatus === "noshow") return "No-Show"
  if (cleanStatus === "missed") return "No-Show"
  if (cleanStatus === "declined") return "Declined"
  if (cleanStatus === "cancelled") return "Cancelled"
  if (cleanStatus === "canceled") return "Cancelled"

  return status?.trim() || "Unknown"
}

const getStatusClass = (status: string) => {
  const cleanStatus = normalizeStatus(status)

  if (cleanStatus === "Pending") return `${styles.badge} ${styles.statusPending}`
  if (cleanStatus === "Approved") return `${styles.badge} ${styles.statusApproved}`
  if (cleanStatus === "Completed") return `${styles.badge} ${styles.statusCompleted}`
  if (cleanStatus === "No-Show") return `${styles.badge} ${styles.statusNoShow}`
  if (cleanStatus === "Declined") return `${styles.badge} ${styles.statusDeclined}`
  if (cleanStatus === "Cancelled") return `${styles.badge} ${styles.statusCancelled}`

  return styles.badge
}

const getStatusLabel = (status?: string | null) => {
  const cleanStatus = normalizeStatus(status)

  if (cleanStatus === "No-Show") return "Missed Appointment"

  return cleanStatus
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

const getAppointmentsArray = (data: unknown): Appointment[] => {
  if (Array.isArray(data)) return data as Appointment[]

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { appointments?: unknown }).appointments)
  ) {
    return (data as { appointments: Appointment[] }).appointments
  }

  return []
}

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "No date"

  const date = new Date(`${dateString}T00:00:00`)

  if (Number.isNaN(date.getTime())) return dateString

  return date.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

const formatTime = (timeString?: string | null) => {
  if (!timeString) return ""

  const parts = timeString.split(":")
  const hour = Number(parts[0])
  const minute = Number(parts[1])

  if (Number.isNaN(hour) || Number.isNaN(minute)) return timeString

  const date = new Date()
  date.setHours(hour, minute, 0, 0)

  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  })
}

const formatTimeRange = (appt: Appointment) => {
  if (!appt.time) return "No time"

  const start = formatTime(appt.time)
  const end = appt.end_time ? formatTime(appt.end_time) : ""

  return end ? `${start} to ${end}` : start
}

const formatPatientAge = (appt: Appointment) => {
  const ageLabel = appt.patient_age_label?.trim()

  if (ageLabel) return ageLabel

  if (typeof appt.patient_age === "number") {
    const unit = appt.patient_age === 1 ? "year" : "years"
    return `${appt.patient_age} ${unit} old`
  }

  return "Not provided"
}


const getGuardianName = (appt?: Appointment | null) => {
  if (!appt) return "Not provided"

  const firstName = appt.guardian_first_name?.trim() || ""
  const lastName = appt.guardian_last_name?.trim() || ""
  const fullName = `${firstName} ${lastName}`.trim()

  return fullName || "Not provided"
}

const hasGuardianInfo = (appt?: Appointment | null) => {
  if (!appt) return false

  return Boolean(
    appt.is_minor ||
      appt.guardian_first_name ||
      appt.guardian_last_name ||
      appt.guardian_relationship ||
      appt.guardian_contact ||
      appt.guardian_email ||
      appt.guardian_consent
  )
}

const getApprovalEmailStatus = (appt?: Appointment | null) => {
  if (!appt?.approval_email_sent) return "Not sent"

  if (!appt.approval_email_sent_at) return "Sent"

  return `Sent on ${formatDateTime(appt.approval_email_sent_at)}`
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

const getDateTimeValue = (appt: Appointment) => {
  if (!appt.date || !appt.time) return 0

  const value = new Date(`${appt.date}T${appt.time}`).getTime()

  return Number.isNaN(value) ? 0 : value
}

const fetchAppointmentList = async (endpoint: string, token: string) => {
  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await readJsonSafely(res)

    if (!res.ok) {
      console.error(`${endpoint} request failed:`, {
        status: res.status,
        statusText: res.statusText,
        body: data,
      })

      return []
    }

    return getAppointmentsArray(data).map((appt) => ({
      ...appt,
      status: normalizeStatus(appt.status),
    }))
  } catch (err) {
    console.error(`${endpoint} load failed:`, err)
    return []
  }
}

export default function StaffHistoryPage() {
  const router = useRouter()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All")

  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null)
  const [appointmentLogs, setAppointmentLogs] = useState<AppointmentLog[]>([])
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    setLoading(true)
    setError("")

    try {
      const [historyList, pendingList, approvedList] = await Promise.all([
        fetchAppointmentList("/appointments/history", token),
        fetchAppointmentList("/appointments/requests", token),
        fetchAppointmentList("/appointments/confirmed", token),
      ])

      const mergedAppointments = [
        ...historyList,
        ...pendingList,
        ...approvedList,
      ]

      const uniqueAppointments = Array.from(
        new Map(
          mergedAppointments.map((appt) => [
            appt.id,
            {
              ...appt,
              status: normalizeStatus(appt.status),
            },
          ])
        ).values()
      )

      setAppointments(uniqueAppointments)
    } catch (err) {
      console.error("Appointment records load failed:", err)
      setError("Unable to load appointment records.")
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const role = localStorage.getItem("role")

    if (role !== "staff") {
      router.push("/")
      return
    }

    loadHistory()
  }, [loadHistory, router])

  const filteredAppointments = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return [...appointments]
      .filter((appt) => {
        const searchable = [
          appt.patient_name,
          appt.doctor_name,
          appt.services,
          appt.consultation_mode,
          appt.appointment_type,
          appt.cancel_reason,
          appt.last_action_by_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()

        const matchesSearch = searchable.includes(keyword)
        const appointmentStatus = normalizeStatus(appt.status)
        const matchesStatus =
          statusFilter === "All" ? true : appointmentStatus === statusFilter

        return matchesSearch && matchesStatus
      })
      .sort((a, b) => getDateTimeValue(b) - getDateTimeValue(a))
  }, [appointments, search, statusFilter])

  const statusCounts = useMemo(() => {
    return appointments.reduce<Record<string, number>>((acc, appt) => {
      const status = normalizeStatus(appt.status)
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})
  }, [appointments])

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

      if (!appointmentRes.ok || !logsRes.ok) {
        console.error("Details request failed:", {
          appointmentStatus: appointmentRes.status,
          logsStatus: logsRes.status,
          appointmentBody: appointmentData,
          logsBody: logsData,
        })

        throw new Error("Failed to fetch appointment details")
      }

      setSelectedAppointment({
        ...(appointmentData as Appointment),
        status: normalizeStatus((appointmentData as Appointment).status),
      })

      setAppointmentLogs(Array.isArray(logsData) ? logsData : [])
    } catch (openError) {
      console.error("Failed to open details:", openError)
      setSelectedAppointment(null)
      setAppointmentLogs([])
      setDetailsOpen(false)
      alert("Unable to load appointment details.")
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
    <div className="staffLayout">
      <StaffNavbar />

      <main className="staffContent">
        <div className={styles.staffPage}>
          <section className={styles.dashboardHeader}>
            <div>
              <span className={styles.eyebrow}>Audit-Friendly View</span>
              <h1>Appointment History</h1>
              <p className={styles.pageSubtext}>
                Review appointment records, status changes, decline reasons, and action history in one searchable workspace.
              </p>
            </div>

            <div className={styles.headerActions}>
              <button className={styles.secondaryBtn} onClick={loadHistory}>
                Refresh Records
              </button>
            </div>
          </section>

          <section className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total Records</div>
              <div className={styles.statValue}>{appointments.length}</div>
              <div className={styles.statMeta}>Merged from request, confirmed, and history data</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Approved</div>
              <div className={styles.statValue}>{statusCounts.Approved || 0}</div>
              <div className={styles.statMeta}>Confirmed appointment records</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Completed</div>
              <div className={styles.statValue}>{statusCounts.Completed || 0}</div>
              <div className={styles.statMeta}>Finished clinic visits</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Missed</div>
              <div className={styles.statValue}>{statusCounts["No-Show"] || 0}</div>
              <div className={styles.statMeta}>Patients who did not attend</div>
            </div>
          </section>

          <section className={styles.listCard}>
            <div className={styles.listHeader}>
              <div>
                <h2>Appointment Records</h2>
                <p className={styles.cardSubtext}>Use search and status filters to trace what happened quickly.</p>
              </div>
              <span className={styles.metaText}>{filteredAppointments.length} records</span>
            </div>

            <div className={styles.searchRow}>
              <input
                type="text"
                placeholder="Search patient, doctor, service, reason, or staff name"
                className={styles.searchInput}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className={styles.filterRow}>
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  className={`${styles.filterChip} ${
                    statusFilter === status ? styles.filterChipActive : ""
                  }`}
                  onClick={() => setStatusFilter(status)}
                >
                  {status}
                </button>
              ))}
            </div>

            {loading ? (
              <div className={styles.emptyState}>Loading appointment records...</div>
            ) : error ? (
              <div className={styles.emptyState}>{error}</div>
            ) : filteredAppointments.length === 0 ? (
              <div className={styles.emptyState}>No appointment records found.</div>
            ) : (
              filteredAppointments.map((appt) => {
                const cleanStatus = normalizeStatus(appt.status)

                return (
                  <article key={appt.id} className={styles.requestCard}>
                    <div className={styles.requestInfo}>
                      <div className={styles.cardTitleRow}>
                        <b>{appt.patient_name}</b>
                        <span className={getStatusClass(cleanStatus)}>{getStatusLabel(cleanStatus)}</span>
                      </div>

                      <p>{appt.doctor_name || "Doctor unavailable"}</p>

                      <span>
                        {formatDate(appt.date)} at {formatTimeRange(appt)}
                      </span>

                      <div className={styles.metaPills}>
                        {appt.services && <span>{appt.services}</span>}
                        {appt.consultation_mode && <span>{appt.consultation_mode}</span>}
                        {appt.appointment_type && <span>{appt.appointment_type}</span>}
                      </div>

                      {appt.cancel_reason && (
                        <p className={styles.detailText}>Reason: {appt.cancel_reason}</p>
                      )}

                      {appt.last_action_by_name && (
                        <p className={styles.metaText}>
                          Last action by {appt.last_action_by_name}
                          {appt.last_action_by_role ? `, ${appt.last_action_by_role}` : ""}
                        </p>
                      )}
                    </div>

                    <div className={styles.actions}>
                      <button
                        className={styles.secondaryBtn}
                        onClick={() => openDetails(appt)}
                      >
                        View Timeline
                      </button>
                    </div>
                  </article>
                )
              })
            )}
          </section>
        </div>
      </main>

      {detailsOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h2>Appointment Timeline</h2>
              <button className={styles.modalCloseBtn} onClick={closeDetails}>
                ×
              </button>
            </div>

            {detailsLoading ? (
              <div className={styles.emptyState}>Loading appointment timeline...</div>
            ) : selectedAppointment ? (
              <div className={styles.modalGrid}>
                <section className={styles.detailPanel}>
                  <h3>Patient Details</h3>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Patient Name</span>
                    <span className={styles.infoValue}>{selectedAppointment.patient_name || "Not provided"}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Age</span>
                    <span className={styles.infoValue}>{formatPatientAge(selectedAppointment)}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Address</span>
                    <span className={styles.infoValue}>{selectedAppointment.patient_address || "Not provided"}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Contact No.</span>
                    <span className={styles.infoValue}>{selectedAppointment.patient_contact || "Not provided"}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Email</span>
                    <span className={styles.infoValue}>{selectedAppointment.patient_email || "Not provided"}</span>
                  </div>

                  {selectedAppointment.is_minor && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Minor Patient</span>
                      <span className={styles.infoValue}>Yes</span>
                    </div>
                  )}

                  {hasGuardianInfo(selectedAppointment) && (
                    <>
                      <h3>Guardian Details</h3>

                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Guardian Name</span>
                        <span className={styles.infoValue}>{getGuardianName(selectedAppointment)}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Relationship</span>
                        <span className={styles.infoValue}>
                          {selectedAppointment.guardian_relationship || "Not provided"}
                        </span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Guardian Contact</span>
                        <span className={styles.infoValue}>
                          {selectedAppointment.guardian_contact || "Not provided"}
                        </span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Guardian Email</span>
                        <span className={styles.infoValue}>
                          {selectedAppointment.guardian_email || "Not provided"}
                        </span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Guardian Consent</span>
                        <span className={styles.infoValue}>
                          {selectedAppointment.guardian_consent ? "Provided" : "Not provided"}
                        </span>
                      </div>
                    </>
                  )}

                  <h3>Record Summary</h3>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Doctor</span>
                    <span className={styles.infoValue}>{selectedAppointment.doctor_name || "Doctor unavailable"}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Service</span>
                    <span className={styles.infoValue}>{selectedAppointment.services || "Not specified"}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Schedule</span>
                    <span className={styles.infoValue}>
                      {formatDate(selectedAppointment.date)} at {formatTimeRange(selectedAppointment)}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Status</span>
                    <span className={styles.infoValue}>{getStatusLabel(selectedAppointment.status)}</span>
                  </div>
                  {selectedAppointment.cancel_reason && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Reason</span>
                      <span className={styles.infoValue}>{selectedAppointment.cancel_reason}</span>
                    </div>
                  )}
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Patient Instructions</span>
                    <span className={styles.infoValue}>
                      {selectedAppointment.patient_instruction || "Not provided"}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Approval Email</span>
                    <span className={styles.infoValue}>{getApprovalEmailStatus(selectedAppointment)}</span>
                  </div>
                </section>

                <section className={styles.detailPanel}>
                  <h3>Activity Timeline</h3>
                  {appointmentLogs.length === 0 ? (
                    <div className={styles.emptyState}>No action logs found.</div>
                  ) : (
                    <div className={styles.timelineList}>
                      {appointmentLogs.map((log) => (
                        <div key={log.id} className={styles.timelineItem}>
                          <b>{log.action}</b>
                          <span>
                            {log.performed_by_name || "System"} · {log.performed_by_role || "Role unavailable"}
                          </span>
                          <p>{formatDateTime(log.created_at)}</p>
                          {log.reason && <small>{log.reason}</small>}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className={styles.emptyState}>No appointment selected.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
