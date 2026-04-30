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

const getTodayInputDate = () => {
  const today = new Date()
  const timezoneOffset = today.getTimezoneOffset() * 60000

  return new Date(today.getTime() - timezoneOffset).toISOString().split("T")[0]
}

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

export default function StaffAppointments() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [followUps, setFollowUps] = useState<StaffFollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "No date"

    const date = new Date(`${dateString}T00:00:00`)

    if (Number.isNaN(date.getTime())) return dateString

    return date.toLocaleDateString("en-US", {
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

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const getDateTimeValue = (appt: Appointment) => {
    return new Date(`${appt.date}T${appt.time}`).getTime()
  }

  const getFollowUpTiming = (item: StaffFollowUp) => {
    const today = getTodayInputDate()
    const status = (item.status || "").trim().toLowerCase()

    if (status === "completed") return "Completed"
    if (item.follow_up_date < today) return "Overdue"
    if (item.follow_up_date === today) return "Due Today"

    return "Upcoming"
  }

  const getFollowUpBadgeClass = (item: StaffFollowUp) => {
    const timing = getFollowUpTiming(item)

    if (timing === "Completed") return styles.statusCompleted
    if (timing === "Overdue") return styles.statusDeclined
    if (timing === "Due Today") return styles.statusPending

    return styles.statusApproved
  }

  const fetchFollowUpList = async (token: string) => {
    const possibleEndpoints = [
      "/staff/follow-ups",
      "/doctor/follow-ups",
      "/follow-ups",
    ]

    for (const endpoint of possibleEndpoints) {
      try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        const result = await readJsonSafely(res)

        if (res.ok) {
          return uniqueFollowUpsById(getFollowUpsArray(result))
        }
      } catch (err) {
        console.error(`${endpoint} follow-up request failed:`, err)
      }
    }

    return []
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

      const appointmentData = await appointmentsRes.json()

      if (!appointmentsRes.ok) {
        throw new Error("Failed to fetch confirmed appointments")
      }

      setAppointments(Array.isArray(appointmentData) ? appointmentData : [])
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
    return [...appointments].sort(
      (a, b) => getDateTimeValue(a) - getDateTimeValue(b)
    )
  }, [appointments])

  const sortedFollowUps = useMemo(() => {
    return uniqueFollowUpsById(followUps).sort((a, b) => {
      const aCompleted = (a.status || "").toLowerCase() === "completed"
      const bCompleted = (b.status || "").toLowerCase() === "completed"

      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1
      }

      return a.follow_up_date.localeCompare(b.follow_up_date)
    })
  }, [followUps])

  return (
    <div className="staffLayout">
      <StaffNavbar />

      <div className="staffContent">
        <div className={styles.staffPage}>
          <div className={styles.dashboardHeader}>
            <div>
              <h1>Confirmed Appointments</h1>
              <p className={styles.pageSubtext}>
                Review all approved bookings and upcoming appointment flow.
              </p>
            </div>

            <button className={styles.secondaryBtn} onClick={loadAppointments}>
              Refresh
            </button>
          </div>

          <div className={styles.listCard}>
            <div className={styles.listHeader}>
              <h2>Follow-up Schedule</h2>
              <span className={`${styles.badge} ${styles.statusApproved}`}>
                {sortedFollowUps.length} scheduled
              </span>
            </div>

            {loading ? (
              <div className={styles.emptyState}>
                Loading follow-up schedule...
              </div>
            ) : sortedFollowUps.length === 0 ? (
              <div className={styles.emptyState}>
                No follow-up schedules found.
              </div>
            ) : (
              sortedFollowUps.map((item) => (
                <div key={item.id} className={styles.requestCard}>
                  <div className={styles.requestInfo}>
                    <b>
                      {item.patient_name ||
                        (item.patient_id
                          ? `Patient #${item.patient_id}`
                          : "Patient details unavailable")}
                    </b>

                    <p>{item.doctor_name || "Assigned doctor"}</p>

                    <span>
                      Follow-up Schedule: {formatDate(item.follow_up_date)}
                    </span>

                    {(item.appointment_date || item.appointment_time) && (
                      <p className={styles.detailText}>
                        Related Visit:{" "}
                        {item.appointment_date
                          ? formatDate(item.appointment_date)
                          : "No date"}{" "}
                        {item.appointment_time
                          ? `at ${formatTime(item.appointment_time)}`
                          : ""}
                      </p>
                    )}
                  </div>

                  <span
                    className={`${styles.badge} ${getFollowUpBadgeClass(item)}`}
                  >
                    {getFollowUpTiming(item)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div style={{ height: "18px" }} />

          <div className={styles.listCard}>
            <div className={styles.listHeader}>
              <h2>Approved Bookings</h2>
              <span className={`${styles.badge} ${styles.statusApproved}`}>
                {sortedAppointments.length} confirmed
              </span>
            </div>

            {loading ? (
              <div className={styles.emptyState}>
                Loading confirmed appointments...
              </div>
            ) : error ? (
              <div className={styles.emptyState}>{error}</div>
            ) : sortedAppointments.length === 0 ? (
              <div className={styles.emptyState}>
                No confirmed appointments found.
              </div>
            ) : (
              sortedAppointments.map((appt) => (
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
                  </div>

                  <span className={`${styles.badge} ${styles.statusApproved}`}>
                    {appt.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}