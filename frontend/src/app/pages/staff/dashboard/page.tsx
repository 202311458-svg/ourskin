"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import StaffNavbar from "@/app/components/StaffNavbar"
import { API_BASE_URL } from "@/lib/api"
import styles from "@/app/styles/staff.module.css"

type Appointment = {
  id: number
  patient_id?: number | null
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
  doctor_name?: string | null
  date?: string | null
  time?: string | null
  end_time?: string | null
  status: string
  services?: string | null
  cancel_reason?: string | null
  is_initial_evaluation_request?: boolean | null
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

type DashboardData = {
  today: Appointment[]
  requests: Appointment[]
  confirmed: Appointment[]
}

type SubmittingAction = {
  id: number
  action: "approve" | "decline"
} | null

const declineReasons = [
  "Conflict in schedule. Kindly select a new schedule.",
  "Doctor is unavailable on the selected date.",
  "Incomplete patient information. Please update your details.",
  "Requested service is not available.",
  "Duplicate appointment detected.",
  "Other",
]

const normalizeStatus = (status?: string | null) => {
  const cleanStatus = (status || "").trim().toLowerCase()

  if (cleanStatus === "pending") return "Pending"
  if (cleanStatus === "approved") return "Approved"
  if (cleanStatus === "confirmed") return "Approved"
  if (cleanStatus === "scheduled") return "Scheduled"
  if (cleanStatus === "completed") return "Completed"
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

const readJsonSafely = async (res: Response) => {
  const text = await res.text()

  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const getErrorMessage = (result: unknown, fallback: string) => {
  if (
    result &&
    typeof result === "object" &&
    "detail" in result &&
    typeof (result as { detail?: unknown }).detail === "string"
  ) {
    return (result as { detail: string }).detail
  }

  if (
    result &&
    typeof result === "object" &&
    "message" in result &&
    typeof (result as { message?: unknown }).message === "string"
  ) {
    return (result as { message: string }).message
  }

  return fallback
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

const uniqueAppointmentsById = (appointments: Appointment[]) => {
  return Array.from(
    new Map(
      appointments.map((appt) => [
        appt.id,
        {
          ...appt,
          status: normalizeStatus(appt.status),
        },
      ])
    ).values()
  )
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
  if (!appt.time) return "To be scheduled"

  const start = formatTime(appt.time)
  const end = appt.end_time ? formatTime(appt.end_time) : ""

  return end ? `${start} to ${end}` : start
}

const getDateTimeValue = (appt: Appointment) => {
  if (!appt.date || !appt.time) return Number.MAX_SAFE_INTEGER

  const value = new Date(`${appt.date}T${appt.time}`).getTime()

  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value
}

const getFollowUpTiming = (item: StaffFollowUp) => {
  const today = getTodayInputDate()
  const status = (item.status || "").trim().toLowerCase()

  if (status === "completed") return "Completed"
  if (item.follow_up_date < today) return "Overdue"
  if (item.follow_up_date === today) return "Due Today"

  return "Upcoming"
}

const fetchAppointmentList = async (endpoint: string, token: string) => {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  const result = await readJsonSafely(res)

  if (!res.ok) {
    console.error(`${endpoint} request failed:`, {
      status: res.status,
      result,
    })

    return []
  }

  return uniqueAppointmentsById(getAppointmentsArray(result))
}

const fetchFollowUpList = async (token: string) => {
  const possibleEndpoints = ["/staff/follow-ups"]

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

export default function StaffDashboard() {
  const router = useRouter()

  const [data, setData] = useState<DashboardData>({
    today: [],
    requests: [],
    confirmed: [],
  })
  const [followUps, setFollowUps] = useState<StaffFollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submittingAction, setSubmittingAction] =
    useState<SubmittingAction>(null)
  const [updatingFollowUpId, setUpdatingFollowUpId] = useState<number | null>(
    null
  )

  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineTargetId, setDeclineTargetId] = useState<number | null>(null)
  const [selectedReason, setSelectedReason] = useState("")
  const [otherReason, setOtherReason] = useState("")

  const getFollowUpBadgeClass = (item: StaffFollowUp) => {
    const timing = getFollowUpTiming(item)

    if (timing === "Completed") return styles.statusCompleted
    if (timing === "Overdue") return styles.statusDeclined
    if (timing === "Due Today") return styles.statusPending

    return styles.statusApproved
  }

  const canCompleteFollowUp = (item: StaffFollowUp) => {
    const today = getTodayInputDate()
    const status = (item.status || "").trim().toLowerCase()

    return status !== "completed" && item.follow_up_date <= today
  }

  const loadDashboard = useCallback(
    async (showLoader = true) => {
      const token = localStorage.getItem("token")

      if (!token) {
        router.push("/")
        return
      }

      if (showLoader) setLoading(true)
      setError("")

      try {
        const [todayData, requestsData, confirmedData, followUpData] =
          await Promise.all([
            fetchAppointmentList("/appointments/today", token),
            fetchAppointmentList("/appointments/requests", token),
            fetchAppointmentList("/appointments/confirmed", token),
            fetchFollowUpList(token),
          ])

        setData({
          today: uniqueAppointmentsById(todayData),
          requests: uniqueAppointmentsById(requestsData),
          confirmed: uniqueAppointmentsById(confirmedData),
        })
        setFollowUps(uniqueFollowUpsById(followUpData))
      } catch (err) {
        console.error("Dashboard load failed:", err)
        setError("Unable to load dashboard data right now.")
        setData({ today: [], requests: [], confirmed: [] })
        setFollowUps([])
      } finally {
        if (showLoader) setLoading(false)
      }
    },
    [router]
  )

  useEffect(() => {
    const role = localStorage.getItem("role")

    if (role !== "staff") {
      router.push("/")
      return
    }

    loadDashboard()
  }, [loadDashboard, router])

  useEffect(() => {
    const role = localStorage.getItem("role")

    if (role !== "staff") return

    const refreshDashboardQuietly = () => {
      if (document.hidden) return
      if (submittingAction !== null) return
      if (updatingFollowUpId !== null) return
      if (declineOpen) return

      loadDashboard(false)
    }

    const intervalId = window.setInterval(refreshDashboardQuietly, 5000)

    const handleFocus = () => refreshDashboardQuietly()
    const handleVisibilityChange = () => {
      if (!document.hidden) refreshDashboardQuietly()
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [loadDashboard, submittingAction, updatingFollowUpId, declineOpen])

  const sortedToday = useMemo(() => {
    return uniqueAppointmentsById(data.today)
      .filter((appt) => normalizeStatus(appt.status) === "Approved")
      .sort((a, b) => getDateTimeValue(a) - getDateTimeValue(b))
  }, [data.today])

  const pendingRequests = useMemo(() => {
    return uniqueAppointmentsById(data.requests)
      .filter((appt) => normalizeStatus(appt.status) === "Pending")
      .sort((a, b) => getDateTimeValue(a) - getDateTimeValue(b))
  }, [data.requests])

  const upcomingConfirmed = useMemo(() => {
    const now = Date.now()

    return uniqueAppointmentsById(data.confirmed)
      .filter((appt) => normalizeStatus(appt.status) === "Approved")
      .filter((appt) => getDateTimeValue(appt) >= now)
      .sort((a, b) => getDateTimeValue(a) - getDateTimeValue(b))
  }, [data.confirmed])

  const sortedFollowUps = useMemo(() => {
    return uniqueFollowUpsById(followUps).sort((a, b) => {
      const aCompleted = (a.status || "").toLowerCase() === "completed"
      const bCompleted = (b.status || "").toLowerCase() === "completed"

      if (aCompleted !== bCompleted) return aCompleted ? 1 : -1

      return a.follow_up_date.localeCompare(b.follow_up_date)
    })
  }, [followUps])

  const activeFollowUps = useMemo(() => {
    return sortedFollowUps.filter(
      (item) => (item.status || "").toLowerCase() !== "completed"
    )
  }, [sortedFollowUps])

  const overdueFollowUps = useMemo(() => {
    return activeFollowUps.filter((item) => getFollowUpTiming(item) === "Overdue")
  }, [activeFollowUps])

  const resetDeclineModal = () => {
    setDeclineOpen(false)
    setDeclineTargetId(null)
    setSelectedReason("")
    setOtherReason("")
  }

  const updateStatus = async (id: number, status: "Approved" | "Declined") => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    if (status === "Declined") {
      setDeclineTargetId(id)
      setDeclineOpen(true)
      return
    }

    router.push("/pages/staff/requests")
  }

  const confirmDecline = async () => {
    if (!declineTargetId) return

    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    const finalReason =
      selectedReason === "Other" ? otherReason.trim() : selectedReason

    if (!finalReason) {
      alert("Please select a reason.")
      return
    }

    try {
      setSubmittingAction({ id: declineTargetId, action: "decline" })

      const res = await fetch(
        `${API_BASE_URL}/appointments/${declineTargetId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: "Declined",
            cancel_reason: finalReason,
          }),
        }
      )

      const result = await readJsonSafely(res)

      if (!res.ok) {
        throw new Error(getErrorMessage(result, "Failed to decline appointment"))
      }

      resetDeclineModal()
      await loadDashboard(false)
    } catch (err) {
      console.error("Decline failed:", err)
      alert("Unable to decline the appointment.")
    } finally {
      setSubmittingAction(null)
    }
  }

  const completeFollowUp = async (followUpId: number) => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    try {
      setUpdatingFollowUpId(followUpId)

      const res = await fetch(`${API_BASE_URL}/staff/follow-ups/${followUpId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "Completed" }),
      })

      const result = await readJsonSafely(res)

      if (!res.ok) {
        throw new Error(getErrorMessage(result, "Unable to complete follow-up"))
      }

      await loadDashboard(false)
    } catch (err) {
      console.error("Follow-up update failed:", err)
      alert("Unable to mark this follow-up as completed.")
    } finally {
      setUpdatingFollowUpId(null)
    }
  }

  const renderAppointmentCard = (appt: Appointment, variant: "today" | "request") => {
    const isSubmitting = submittingAction?.id === appt.id
    const isInitial = Boolean(appt.is_initial_evaluation_request)

    return (
      <article key={appt.id} className={styles.requestCard}>
        <div className={styles.requestInfo}>
          <div className={styles.cardTitleRow}>
            <b>{appt.patient_name || "Patient details unavailable"}</b>
            <span className={`${styles.badge} ${styles.statusPending}`}>
              {variant === "request" ? "Needs Action" : normalizeStatus(appt.status)}
            </span>
          </div>

          <p>{appt.doctor_name || "Doctor to be assigned"}</p>

          <span>
            {formatDate(appt.date)} {appt.time ? `at ${formatTimeRange(appt)}` : ""}
          </span>

          {appt.services && <p className={styles.detailText}>Service: {appt.services}</p>}

          {isInitial && (
            <span className={`${styles.badge} ${styles.statusPending}`}>
              Initial Evaluation
            </span>
          )}
        </div>

        {variant === "request" && (
          <div className={styles.actions}>
            <button
              className={styles.acceptBtn}
              onClick={() => updateStatus(appt.id, "Approved")}
              disabled={isSubmitting}
            >
              Review and Approve
            </button>
            <button
              className={styles.declineBtn}
              onClick={() => updateStatus(appt.id, "Declined")}
              disabled={isSubmitting}
            >
              Decline
            </button>
          </div>
        )}
      </article>
    )
  }

  return (
    <div className="staffLayout">
      <StaffNavbar />

      <main className="staffContent">
        <div className={styles.staffPage}>
          <section className={styles.dashboardHeader}>
            <div>
              <span className={styles.eyebrow}>Staff Operations</span>
              <h1>Clinic Command Center</h1>
              <p className={styles.pageSubtext}>
                Track requests, today&apos;s approved visits, follow-ups, and upcoming appointment flow from one workspace.
              </p>
            </div>

            <div className={styles.headerActions}>
              <button
                className={styles.secondaryBtn}
                onClick={() => loadDashboard()}
                disabled={submittingAction !== null || updatingFollowUpId !== null}
              >
                Refresh Workspace
              </button>
            </div>
          </section>

          {loading ? (
            <div className={styles.emptyState}>Loading staff dashboard...</div>
          ) : error ? (
            <div className={styles.emptyState}>{error}</div>
          ) : (
            <>
              <section className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Pending Requests</div>
                  <div className={styles.statValue}>{pendingRequests.length}</div>
                  <div className={styles.statMeta}>Needs staff action</div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Today&apos;s Appointments</div>
                  <div className={styles.statValue}>{sortedToday.length}</div>
                  <div className={styles.statMeta}>Approved for today</div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Upcoming Confirmed</div>
                  <div className={styles.statValue}>{upcomingConfirmed.length}</div>
                  <div className={styles.statMeta}>Future approved bookings</div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Active Follow-ups</div>
                  <div className={styles.statValue}>{activeFollowUps.length}</div>
                  <div className={styles.statMeta}>{overdueFollowUps.length} overdue</div>
                </div>
              </section>

              <section className={styles.commandGrid}>
                <div className={styles.commandMain}>
                  <div className={styles.listCard}>
                    <div className={styles.listHeader}>
                      <div>
                        <h2>Today&apos;s Clinic Flow</h2>
                        <p className={styles.cardSubtext}>Approved appointments arranged by time.</p>
                      </div>
                      <span className={`${styles.badge} ${styles.statusApproved}`}>
                        {sortedToday.length} visits
                      </span>
                    </div>

                    {sortedToday.length === 0 ? (
                      <div className={styles.emptyState}>No approved appointments for today.</div>
                    ) : (
                      sortedToday.slice(0, 6).map((appt) => renderAppointmentCard(appt, "today"))
                    )}
                  </div>

                  <div className={styles.listCard}>
                    <div className={styles.listHeader}>
                      <div>
                        <h2>Pending Requests</h2>
                        <p className={styles.cardSubtext}>Prioritise patient requests that need confirmation.</p>
                      </div>
                      <span className={`${styles.badge} ${styles.statusPending}`}>
                        {pendingRequests.length} pending
                      </span>
                    </div>

                    {pendingRequests.length === 0 ? (
                      <div className={styles.emptyState}>No pending requests. The queue is clear.</div>
                    ) : (
                      pendingRequests.slice(0, 5).map((appt) => renderAppointmentCard(appt, "request"))
                    )}
                  </div>
                </div>

                <aside className={styles.commandSide}>
                  <div className={styles.listCard}>
                    <div className={styles.listHeader}>
                      <div>
                        <h2>Follow-up Watchlist</h2>
                        <p className={styles.cardSubtext}>Overdue and due-today follow-ups stay visible.</p>
                      </div>
                      <span className={`${styles.badge} ${styles.statusApproved}`}>
                        {activeFollowUps.length} active
                      </span>
                    </div>

                    {activeFollowUps.length === 0 ? (
                      <div className={styles.emptyState}>No active follow-up schedules found.</div>
                    ) : (
                      activeFollowUps.slice(0, 6).map((item) => {
                        const canComplete = canCompleteFollowUp(item)
                        const isUpdating = updatingFollowUpId === item.id

                        return (
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

                            <div className={styles.compactActions}>
                              <span className={`${styles.badge} ${getFollowUpBadgeClass(item)}`}>
                                {getFollowUpTiming(item)}
                              </span>

                              {canComplete && (
                                <button
                                  className={styles.secondaryBtn}
                                  onClick={() => completeFollowUp(item.id)}
                                  disabled={isUpdating}
                                >
                                  {isUpdating ? "Updating..." : "Complete"}
                                </button>
                              )}
                            </div>
                          </article>
                        )
                      })
                    )}
                  </div>

                  <div className={styles.quickActions}>
                    <div className={styles.quickActionCard}>
                      <h3 className={styles.quickActionTitle}>Smart queue habit</h3>
                      <p className={styles.quickActionText}>
                        Clear initial evaluation requests first because those need schedule coordination before approval.
                      </p>
                    </div>
                    <div className={styles.quickActionCard}>
                      <h3 className={styles.quickActionTitle}>Follow-up control</h3>
                      <p className={styles.quickActionText}>
                        Keep overdue follow-ups visible until completed to support the autonomous clinic workflow.
                      </p>
                    </div>
                  </div>
                </aside>
              </section>
            </>
          )}
        </div>
      </main>

      {declineOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCardSmall}>
            <div className={styles.modalHeader}>
              <h2>Decline Appointment</h2>
              <button className={styles.modalCloseBtn} onClick={resetDeclineModal}>
                ×
              </button>
            </div>

            <div className={styles.reasonList}>
              {declineReasons.map((reason) => (
                <label key={reason} className={styles.reasonOption}>
                  <input
                    type="radio"
                    name="declineReason"
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {selectedReason === "Other" && (
              <textarea
                className={styles.reasonTextarea}
                placeholder="Enter reason"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
              />
            )}

            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} onClick={resetDeclineModal}>
                Cancel
              </button>
              <button
                className={styles.declineBtn}
                onClick={confirmDecline}
                disabled={submittingAction?.action === "decline"}
              >
                {submittingAction?.action === "decline" ? "Declining..." : "Confirm Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
