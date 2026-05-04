"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import StaffNavbar from "@/app/components/StaffNavbar"
import { API_BASE_URL } from "@/lib/api"
import { printHtmlDocument } from "@/lib/printExport"
import styles from "@/app/styles/staff.module.css"

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

type StaffFollowUp = {
  id: number
  patient_id?: number | null
  patient_name?: string | null
  patient_email?: string | null
  doctor_name?: string | null
  appointment_id?: number | null
  appointment_services?: string | null
  appointment_date?: string | null
  appointment_time?: string | null
  follow_up_date: string
  status?: string | null
}

type ViewFilter = "All" | "Today" | "Upcoming" | "Past"

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

const getTodayInputDate = () => {
  const today = new Date()
  const timezoneOffset = today.getTimezoneOffset() * 60000

  return new Date(today.getTime() - timezoneOffset).toISOString().split("T")[0]
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

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { data?: unknown }).data)
  ) {
    return (data as { data: Appointment[] }).data
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { items?: unknown }).items)
  ) {
    return (data as { items: Appointment[] }).items
  }

  return []
}

const getAppointmentObject = (data: unknown): Appointment | null => {
  if (!data || typeof data !== "object") return null

  const record = data as Record<string, unknown>

  if (record.appointment && typeof record.appointment === "object") {
    return record.appointment as Appointment
  }

  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
    return record.data as Appointment
  }

  return data as Appointment
}

const getFollowUpsArray = (data: unknown): StaffFollowUp[] => {
  if (Array.isArray(data)) return data as StaffFollowUp[]

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { follow_ups?: unknown }).follow_ups)
  ) {
    return (data as { follow_ups: StaffFollowUp[] }).follow_ups
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { followUps?: unknown }).followUps)
  ) {
    return (data as { followUps: StaffFollowUp[] }).followUps
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { data?: unknown }).data)
  ) {
    return (data as { data: StaffFollowUp[] }).data
  }

  return []
}

const getAppointmentLogsArray = (data: unknown): AppointmentLog[] => {
  if (Array.isArray(data)) return data as AppointmentLog[]

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { logs?: unknown }).logs)
  ) {
    return (data as { logs: AppointmentLog[] }).logs
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { data?: unknown }).data)
  ) {
    return (data as { data: AppointmentLog[] }).data
  }

  return []
}

const uniqueFollowUpsById = (followUps: StaffFollowUp[]) => {
  return Array.from(
    new Map(
      followUps.map((item) => [
        item.id,
        {
          ...item,
          status: normalizeStatus(item.status),
        },
      ])
    ).values()
  )
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
  if (
    data &&
    typeof data === "object" &&
    "detail" in data &&
    typeof (data as { detail?: unknown }).detail === "string"
  ) {
    return (data as { detail: string }).detail
  }

  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof (data as { message?: unknown }).message === "string"
  ) {
    return (data as { message: string }).message
  }

  return fallback
}

const getStatusLabel = (status?: string | null) => {
  const cleanStatus = normalizeStatus(status)

  if (cleanStatus === "No-Show") return "Missed Appointment"

  return cleanStatus
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
  if (!appt.time) return "Time unavailable"

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
  if (!appt.date || !appt.time) return Number.MAX_SAFE_INTEGER

  const value = new Date(`${appt.date}T${appt.time}`).getTime()

  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value
}

const getAppointmentEndDateTimeValue = (appt: Appointment) => {
  if (!appt.date || (!appt.end_time && !appt.time)) return Number.MAX_SAFE_INTEGER

  const timeValue = appt.end_time || appt.time
  const value = new Date(`${appt.date}T${timeValue}`).getTime()

  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value
}

const canMarkNoShow = (appt: Appointment) => {
  if (normalizeStatus(appt.status) !== "Approved") return false

  return getAppointmentEndDateTimeValue(appt) <= Date.now()
}

const getAppointmentStatusClass = (status?: string | null) => {
  const cleanStatus = normalizeStatus(status)

  if (cleanStatus === "Pending") return styles.statusPending
  if (cleanStatus === "Approved") return styles.statusApproved
  if (cleanStatus === "Completed") return styles.statusCompleted
  if (cleanStatus === "No-Show") return styles.statusNoShow
  if (cleanStatus === "Declined") return styles.statusDeclined
  if (cleanStatus === "Cancelled") return styles.statusCancelled

  return styles.statusPending
}

const getFollowUpTiming = (item: StaffFollowUp) => {
  const today = getTodayInputDate()
  const status = (item.status || "").trim().toLowerCase()

  if (status === "completed") return "Completed"
  if (item.follow_up_date < today) return "Overdue"
  if (item.follow_up_date === today) return "Due Today"

  return "Upcoming"
}

const fetchFollowUpList = async (token: string) => {
  try {
    const res = await fetch(`${API_BASE_URL}/staff/follow-ups`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const result = await readJsonSafely(res)

    if (!res.ok) {
      console.error("/staff/follow-ups request failed:", {
        status: res.status,
        result,
      })

      return []
    }

    return uniqueFollowUpsById(getFollowUpsArray(result))
  } catch (err) {
    console.error("/staff/follow-ups request failed:", err)
    return []
  }
}

export default function StaffAppointments() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [followUps, setFollowUps] = useState<StaffFollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<ViewFilter>("All")
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null)
  const [appointmentLogs, setAppointmentLogs] = useState<AppointmentLog[]>([])
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)

  const getFollowUpBadgeClass = (item: StaffFollowUp) => {
    const timing = getFollowUpTiming(item)

    if (timing === "Completed") return styles.statusCompleted
    if (timing === "Overdue") return styles.statusDeclined
    if (timing === "Due Today") return styles.statusPending

    return styles.statusApproved
  }

  const loadAppointments = useCallback(async () => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    setLoading(true)
    setError("")

    try {
      const [appointmentsRes, followUpData] = await Promise.all([
        fetch(`${API_BASE_URL}/appointments/confirmed`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetchFollowUpList(token),
      ])

      const appointmentData = await readJsonSafely(appointmentsRes)

      if (!appointmentsRes.ok) {
        throw new Error("Failed to fetch confirmed appointments")
      }

      setAppointments(getAppointmentsArray(appointmentData))
      setFollowUps(uniqueFollowUpsById(followUpData))
    } catch (err) {
      console.error("Confirmed appointments load failed:", err)
      setError("Unable to load confirmed appointments.")
      setAppointments([])
      setFollowUps([])
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

    loadAppointments()
  }, [loadAppointments, router])

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => getDateTimeValue(a) - getDateTimeValue(b))
  }, [appointments])

  const approvedAppointments = useMemo(() => {
    return sortedAppointments.filter((appt) => normalizeStatus(appt.status) === "Approved")
  }, [sortedAppointments])

  const todayAppointments = useMemo(() => {
    const today = getTodayInputDate()
    return sortedAppointments.filter((appt) => appt.date === today)
  }, [sortedAppointments])

  const upcomingAppointments = useMemo(() => {
    const now = Date.now()
    return sortedAppointments.filter((appt) => getDateTimeValue(appt) >= now)
  }, [sortedAppointments])

  const sortedFollowUps = useMemo(() => {
    return uniqueFollowUpsById(followUps).sort((a, b) => {
      const aCompleted = (a.status || "").toLowerCase() === "completed"
      const bCompleted = (b.status || "").toLowerCase() === "completed"

      if (aCompleted !== bCompleted) return aCompleted ? 1 : -1

      return a.follow_up_date.localeCompare(b.follow_up_date)
    })
  }, [followUps])

  const filteredAppointments = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return sortedAppointments.filter((appt) => {
      const targetSet =
        filter === "Today"
          ? appt.date === getTodayInputDate()
          : filter === "Upcoming"
            ? getDateTimeValue(appt) >= Date.now()
            : filter === "Past"
              ? getDateTimeValue(appt) < Date.now()
              : true

      const textMatch = [
        appt.patient_name,
        appt.patient_email,
        appt.patient_contact,
        appt.patient_address,
        appt.doctor_name,
        appt.services,
        appt.consultation_mode,
        appt.appointment_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword)

      return targetSet && textMatch
    })
  }, [filter, search, sortedAppointments])

  const handlePrintApprovedAppointments = () => {
    const printableRows = approvedAppointments.map((appt, index) => {
      const guardianDetails = appt.is_minor
        ? `Minor. Guardian: ${getGuardianName(appt)}. Relationship: ${
            appt.guardian_relationship || "Not provided"
          }. Contact: ${appt.guardian_contact || "Not provided"}. Email: ${
            appt.guardian_email || "Not provided"
          }.`
        : "No"

      return [
        index + 1,
        formatDate(appt.date),
        formatTimeRange(appt),
        appt.patient_name || "Not provided",
        appt.patient_contact || "Not provided",
        appt.patient_email || "Not provided",
        appt.patient_address || "Not provided",
        formatPatientAge(appt),
        guardianDetails,
        appt.doctor_name || "Assigned doctor unavailable",
        appt.services || "No service listed",
        appt.consultation_mode || "Not provided",
      ]
    })

    printHtmlDocument({
      title: "OurSkin Approved Appointments",
      subtitle: "All approved appointments currently loaded in the staff confirmed appointments board.",
      headers: [
        "#",
        "Date",
        "Time",
        "Patient",
        "Contact No.",
        "Email",
        "Address",
        "Age",
        "Minor / Guardian Info",
        "Doctor",
        "Service",
        "Mode",
      ],
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

      if (!appointmentRes.ok || !logsRes.ok) {
        throw new Error("Failed to fetch appointment details")
      }

      const loadedAppointment = getAppointmentObject(appointmentData)

      if (!loadedAppointment) {
        throw new Error("Appointment details were not found")
      }

      setSelectedAppointment({
        ...loadedAppointment,
        status: normalizeStatus(loadedAppointment.status),
      })
      setAppointmentLogs(getAppointmentLogsArray(logsData))
    } catch (err) {
      console.error("Failed to open appointment details:", err)
      setSelectedAppointment(null)
      setAppointmentLogs([])
      setDetailsOpen(false)
      alert("Unable to load appointment details.")
    } finally {
      setDetailsLoading(false)
    }
  }

  const markAsNoShow = async (appointment: Appointment) => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    if (!canMarkNoShow(appointment)) {
      alert("This appointment can only be marked as no-show after the scheduled time has passed.")
      return
    }

    const confirmed = window.confirm(
      `Mark ${appointment.patient_name} as a missed appointment? This will move the record to appointment history.`
    )

    if (!confirmed) return

    const reason = window.prompt(
      "Reason for no-show record:",
      "Patient did not attend the scheduled appointment."
    )

    const cleanReason = reason?.trim()

    if (!cleanReason) {
      alert("Please provide a reason before marking this appointment as no-show.")
      return
    }

    try {
      setActionLoadingId(appointment.id)

      const res = await fetch(`${API_BASE_URL}/appointments/${appointment.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: "No-Show",
          cancel_reason: cleanReason,
        }),
      })

      const result = await readJsonSafely(res)

      if (!res.ok) {
        throw new Error(getErrorMessage(result, "Unable to mark appointment as no-show."))
      }

      setAppointments((prev) => prev.filter((item) => item.id !== appointment.id))

      if (selectedAppointment?.id === appointment.id) {
        closeDetails()
      }

      alert("Appointment marked as missed and moved to history.")
    } catch (err) {
      console.error("No-show update failed:", err)
      alert(err instanceof Error ? err.message : "Unable to mark appointment as no-show.")
    } finally {
      setActionLoadingId(null)
    }
  }

  const closeDetails = () => {
    setDetailsOpen(false)
    setSelectedAppointment(null)
    setAppointmentLogs([])
  }

  const filters: ViewFilter[] = ["All", "Today", "Upcoming", "Past"]

  return (
    <div className="staffLayout">
      <StaffNavbar />

      <main className="staffContent">
        <div className={styles.staffPage}>
          <section className={styles.dashboardHeader}>
            <div>
              <span className={styles.eyebrow}>Approved Flow</span>
              <h1>Confirmed Appointments</h1>
              <p className={styles.pageSubtext}>
                Monitor approved bookings, active follow-up schedules, and the clinic&apos;s upcoming patient flow.
              </p>
            </div>

            <div className={styles.headerActions}>
              <button
                className={styles.secondaryBtn}
                onClick={handlePrintApprovedAppointments}
                disabled={loading || approvedAppointments.length === 0}
              >
                Export
              </button>

              <button className={styles.secondaryBtn} onClick={loadAppointments}>
                Refresh
              </button>
            </div>
          </section>

          <section className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Confirmed</div>
              <div className={styles.statValue}>{approvedAppointments.length}</div>
              <div className={styles.statMeta}>Approved bookings</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Today</div>
              <div className={styles.statValue}>{todayAppointments.length}</div>
              <div className={styles.statMeta}>Clinic visits today</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Upcoming</div>
              <div className={styles.statValue}>{upcomingAppointments.length}</div>
              <div className={styles.statMeta}>Still ahead</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Follow-ups</div>
              <div className={styles.statValue}>{sortedFollowUps.length}</div>
              <div className={styles.statMeta}>Linked schedules</div>
            </div>
          </section>

          <section className={styles.commandGrid}>
            <div className={styles.commandMain}>
              <div className={styles.listCard}>
                <div className={styles.listHeader}>
                  <div>
                    <h2>Approved Booking Board</h2>
                    <p className={styles.cardSubtext}>Search and filter confirmed bookings without losing clinic context.</p>
                  </div>
                  <span className={`${styles.badge} ${styles.statusApproved}`}>
                    {filteredAppointments.length} shown
                  </span>
                </div>

                <div className={styles.searchRow}>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search patient, doctor, service, or mode"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <div className={styles.filterRow}>
                  {filters.map((item) => (
                    <button
                      key={item}
                      className={`${styles.filterChip} ${
                        filter === item ? styles.filterChipActive : ""
                      }`}
                      onClick={() => setFilter(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                {loading ? (
                  <div className={styles.emptyState}>Loading confirmed appointments...</div>
                ) : error ? (
                  <div className={styles.emptyState}>{error}</div>
                ) : filteredAppointments.length === 0 ? (
                  <div className={styles.emptyState}>No confirmed appointments found.</div>
                ) : (
                  filteredAppointments.map((appt) => (
                    <article key={appt.id} className={styles.requestCard}>
                      <div className={styles.requestInfo}>
                        <div className={styles.cardTitleRow}>
                          <b>{appt.patient_name}</b>
                          <span className={`${styles.badge} ${getAppointmentStatusClass(appt.status)}`}>
                            {getStatusLabel(appt.status)}
                          </span>
                        </div>

                        <p>{appt.doctor_name || "Assigned doctor unavailable"}</p>

                        <span>
                          {formatDate(appt.date)} at {formatTimeRange(appt)}
                        </span>

                        <div className={styles.metaPills}>
                          {appt.services && <span>{appt.services}</span>}
                          {appt.consultation_mode && <span>{appt.consultation_mode}</span>}
                          {appt.appointment_type && <span>{appt.appointment_type}</span>}
                          <span>Age: {formatPatientAge(appt)}</span>
                          {appt.is_minor && <span>Minor patient</span>}
                        </div>
                      </div>

                      <div className={styles.actions}>
                        {canMarkNoShow(appt) && (
                          <button
                            className={styles.declineBtn}
                            onClick={() => markAsNoShow(appt)}
                            disabled={actionLoadingId === appt.id}
                          >
                            {actionLoadingId === appt.id ? "Updating..." : "Mark as No-Show"}
                          </button>
                        )}

                        <button
                          className={styles.secondaryBtn}
                          onClick={() => openDetails(appt)}
                        >
                          View Details
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <aside className={styles.commandSide}>
              <div className={styles.listCard}>
                <div className={styles.listHeader}>
                  <div>
                    <h2>Follow-up Schedule</h2>
                    <p className={styles.cardSubtext}>Keep post-visit continuity visible to staff.</p>
                  </div>
                  <span className={`${styles.badge} ${styles.statusApproved}`}>
                    {sortedFollowUps.length} scheduled
                  </span>
                </div>

                {loading ? (
                  <div className={styles.emptyState}>Loading follow-up schedule...</div>
                ) : sortedFollowUps.length === 0 ? (
                  <div className={styles.emptyState}>No follow-up schedules found.</div>
                ) : (
                  sortedFollowUps.slice(0, 8).map((item) => (
                    <article key={item.id} className={styles.compactItem}>
                      <div>
                        <b>
                          {item.patient_name ||
                            (item.patient_id
                              ? `Patient #${item.patient_id}`
                              : "Patient details unavailable")}
                        </b>
                        <span>{item.doctor_name || "Assigned doctor"}</span>
                        <p>{formatDate(item.follow_up_date)}</p>
                      </div>

                      <span className={`${styles.badge} ${getFollowUpBadgeClass(item)}`}>
                        {getFollowUpTiming(item)}
                      </span>
                    </article>
                  ))
                )}
              </div>

              <div className={styles.quickActions}>
                <div className={styles.quickActionCard}>
                  <h3 className={styles.quickActionTitle}>Daily handoff</h3>
                  <p className={styles.quickActionText}>
                    Print approved appointments before clinic operations begin so staff have a physical backup list.
                  </p>
                </div>

                <div className={styles.quickActionCard}>
                  <h3 className={styles.quickActionTitle}>Operational tip</h3>
                  <p className={styles.quickActionText}>
                    Use this page as the daily handoff view for confirmed patient flow and follow-up continuity.
                  </p>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </main>

      {detailsOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h2>Appointment Details</h2>
              <button className={styles.modalCloseBtn} onClick={closeDetails}>
                ×
              </button>
            </div>

            {detailsLoading ? (
              <div className={styles.emptyState}>Loading appointment details...</div>
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

                  <h3>Booking Details</h3>
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
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Concern</span>
                    <span className={styles.infoValue}>{selectedAppointment.concern || "Not provided"}</span>
                  </div>
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
                  <h3>Appointment Timeline</h3>

                  {appointmentLogs.length === 0 ? (
                    <div className={styles.emptyState}>No activity logs found for this appointment.</div>
                  ) : (
                    <div className={styles.timelineList}>
                      {appointmentLogs.map((log) => (
                        <article key={log.id} className={styles.timelineItem}>
                          <div>
                            <b>{log.action}</b>
                            <span>
                              {log.performed_by_name || "System"}
                              {log.performed_by_role ? `, ${log.performed_by_role}` : ""}
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
              <div className={styles.emptyState}>Appointment details unavailable.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
