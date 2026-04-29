"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import StaffNavbar from "@/app/components/StaffNavbar"
import { API_BASE_URL } from "@/lib/api"
import styles from "@/app/styles/staff.module.css"

type Appointment = {
  id: number
  patient_name: string
  doctor_name: string
  date: string
  time: string
  status: string
  services?: string | null
  cancel_reason?: string | null
  last_action_by_name?: string | null
  last_action_by_role?: string | null
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
  if (cleanStatus === "declined") return "Declined"
  if (cleanStatus === "cancelled") return "Cancelled"
  if (cleanStatus === "canceled") return "Cancelled"

  return status?.trim() || "Unknown"
}

const getDateTimeValue = (appt: Appointment) => {
  return new Date(`${appt.date}T${appt.time}`).getTime()
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatTime = (timeString: string) => {
    const date = new Date(`1970-01-01T${timeString}`)

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString)

    return `${date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })} at ${date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })}`
  }

  const getStatusClass = (status: string) => {
    const cleanStatus = normalizeStatus(status)

    if (cleanStatus === "Pending") {
      return `${styles.badge} ${styles.statusPending}`
    }

    if (cleanStatus === "Approved") {
      return `${styles.badge} ${styles.statusApproved}`
    }

    if (cleanStatus === "Completed") {
      return `${styles.badge} ${styles.statusCompleted}`
    }

    if (cleanStatus === "Declined") {
      return `${styles.badge} ${styles.statusDeclined}`
    }

    if (cleanStatus === "Cancelled") {
      return `${styles.badge} ${styles.statusCancelled}`
    }

    return styles.badge
  }

  const fetchAppointmentList = async (endpoint: string, token: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await res.json().catch(() => [])

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
        const patientName = appt.patient_name || ""
        const doctorName = appt.doctor_name || ""
        const services = appt.services || ""

        const matchesSearch =
          patientName.toLowerCase().includes(keyword) ||
          doctorName.toLowerCase().includes(keyword) ||
          services.toLowerCase().includes(keyword)

        const appointmentStatus = normalizeStatus(appt.status)

        const matchesStatus =
          statusFilter === "All" ? true : appointmentStatus === statusFilter

        return matchesSearch && matchesStatus
      })
      .sort((a, b) => getDateTimeValue(b) - getDateTimeValue(a))
  }, [appointments, search, statusFilter])

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

      const appointmentData = await appointmentRes.json()
      const logsData = await logsRes.json()

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
        ...appointmentData,
        status: normalizeStatus(appointmentData.status),
      })

      setAppointmentLogs(Array.isArray(logsData) ? logsData : [])
    } catch (error) {
      console.error("Failed to open details:", error)
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

      <div className="staffContent">
        <div className={styles.staffPage}>
          <div className={styles.dashboardHeader}>
            <div>
              <h1>Appointment History</h1>
              <p className={styles.pageSubtext}>
                Review appointment records, statuses, and action history.
              </p>
            </div>

            <button className={styles.secondaryBtn} onClick={loadHistory}>
              Refresh
            </button>
          </div>

          <div className={styles.searchRow}>
            <input
              type="text"
              placeholder="Search patient, doctor, or service"
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

          <div className={styles.listCard}>
            <div className={styles.listHeader}>
              <h2>Appointment Records</h2>
              <span className={styles.metaText}>
                {filteredAppointments.length} records
              </span>
            </div>

            {loading ? (
              <div className={styles.emptyState}>
                Loading appointment records...
              </div>
            ) : error ? (
              <div className={styles.emptyState}>{error}</div>
            ) : filteredAppointments.length === 0 ? (
              <div className={styles.emptyState}>
                No appointment records found.
              </div>
            ) : (
              filteredAppointments.map((appt) => {
                const cleanStatus = normalizeStatus(appt.status)

                return (
                  <div key={appt.id} className={styles.requestCard}>
                    <div className={styles.requestInfo}>
                      <b>{appt.patient_name}</b>
                      <p>{appt.doctor_name}</p>
                      <span>
                        {formatDate(appt.date)} at {formatTime(appt.time)}
                      </span>

                      {appt.services && (
                        <p className={styles.detailText}>
                          Service: {appt.services}
                        </p>
                      )}

                      {appt.cancel_reason && (
                        <p className={styles.detailText}>
                          Reason: {appt.cancel_reason}
                        </p>
                      )}

                      {appt.last_action_by_name && (
                        <p className={styles.detailText}>
                          {cleanStatus} by {appt.last_action_by_name},{" "}
                          {appt.last_action_by_role}
                        </p>
                      )}
                    </div>

                    <div className={styles.actions}>
                      <span className={getStatusClass(cleanStatus)}>
                        {cleanStatus}
                      </span>

                      <button
                        className={styles.secondaryBtn}
                        onClick={() => openDetails(appt)}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {detailsOpen && (
        <div className={styles.modalOverlay} onClick={closeDetails}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Appointment Details</h2>
              <button className={styles.modalCloseBtn} onClick={closeDetails}>
                ×
              </button>
            </div>

            {detailsLoading || !selectedAppointment ? (
              <div className={styles.emptyState}>Loading details...</div>
            ) : (
              <div className={styles.dashboardGrid}>
                <div className={styles.listCard}>
                  <div className={styles.listHeader}>
                    <h2>Appointment Info</h2>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Patient</span>
                    <span className={styles.infoValue}>
                      {selectedAppointment.patient_name}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Doctor</span>
                    <span className={styles.infoValue}>
                      {selectedAppointment.doctor_name}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Date</span>
                    <span className={styles.infoValue}>
                      {formatDate(selectedAppointment.date)}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Time</span>
                    <span className={styles.infoValue}>
                      {formatTime(selectedAppointment.time)}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Service</span>
                    <span className={styles.infoValue}>
                      {selectedAppointment.services || "Not available"}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Status</span>
                    <span className={styles.infoValue}>
                      {normalizeStatus(selectedAppointment.status)}
                    </span>
                  </div>

                  {selectedAppointment.cancel_reason && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Reason</span>
                      <span className={styles.infoValue}>
                        {selectedAppointment.cancel_reason}
                      </span>
                    </div>
                  )}
                </div>

                <div className={styles.listCard}>
                  <div className={styles.listHeader}>
                    <h2>Activity History</h2>
                  </div>

                  {appointmentLogs.length === 0 ? (
                    <div className={styles.emptyState}>
                      No activity history yet.
                    </div>
                  ) : (
                    appointmentLogs.map((log) => (
                      <div key={log.id} className={styles.requestCard}>
                        <div className={styles.requestInfo}>
                          <b>{log.action}</b>
                          <p>
                            {log.performed_by_name}, {log.performed_by_role}
                          </p>
                          <span>{formatDateTime(log.created_at)}</span>

                          {log.reason && (
                            <p className={styles.detailText}>
                              Reason: {log.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}