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
  if (cleanStatus === "completed") return "Completed"
  if (cleanStatus === "declined") return "Declined"
  if (cleanStatus === "cancelled") return "Cancelled"
  if (cleanStatus === "canceled") return "Cancelled"

  return status?.trim() || "Unknown"
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

  return fallback
}

export default function StaffDashboard() {
  const router = useRouter()

  const [data, setData] = useState<DashboardData>({
    today: [],
    requests: [],
    confirmed: [],
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submittingAction, setSubmittingAction] =
    useState<SubmittingAction>(null)

  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineTargetId, setDeclineTargetId] = useState<number | null>(null)
  const [selectedReason, setSelectedReason] = useState("")
  const [otherReason, setOtherReason] = useState("")

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

  const getDateTimeValue = (appt: Appointment) => {
    return new Date(`${appt.date}T${appt.time}`).getTime()
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

  const loadDashboard = useCallback(
    async (showLoader = true) => {
      const token = localStorage.getItem("token")

      if (!token) {
        router.push("/")
        return
      }

      if (showLoader) {
        setLoading(true)
      }

      setError("")

      try {
        const [todayData, requestsData, confirmedData] = await Promise.all([
          fetchAppointmentList("/appointments/today", token),
          fetchAppointmentList("/appointments/requests", token),
          fetchAppointmentList("/appointments/confirmed", token),
        ])

        setData({
          today: uniqueAppointmentsById(todayData),
          requests: uniqueAppointmentsById(requestsData),
          confirmed: uniqueAppointmentsById(confirmedData),
        })
      } catch (err) {
        console.error("Dashboard load failed:", err)
        setError("Unable to load dashboard data right now.")
        setData({
          today: [],
          requests: [],
          confirmed: [],
        })
      } finally {
        if (showLoader) {
          setLoading(false)
        }
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
      if (declineOpen) return

      loadDashboard(false)
    }

    const intervalId = window.setInterval(refreshDashboardQuietly, 3000)

    const handleFocus = () => {
      refreshDashboardQuietly()
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshDashboardQuietly()
      }
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [loadDashboard, submittingAction, declineOpen])

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

    try {
      setSubmittingAction({ id, action: "approve" })

      const res = await fetch(`${API_BASE_URL}/appointments/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "Approved" }),
      })

      const result = await readJsonSafely(res)

      if (!res.ok) {
        throw new Error(
          getErrorMessage(result, "Failed to approve appointment")
        )
      }

      const approvedAppointment = data.requests.find((appt) => appt.id === id)

      setData((prev) => ({
        today: uniqueAppointmentsById(prev.today),
        requests: uniqueAppointmentsById(
          prev.requests.filter((appt) => appt.id !== id)
        ),
        confirmed: approvedAppointment
          ? uniqueAppointmentsById([
              ...prev.confirmed,
              {
                ...approvedAppointment,
                status: "Approved",
              },
            ])
          : uniqueAppointmentsById(prev.confirmed),
      }))

      await loadDashboard(false)
    } catch (err) {
      console.error("Approval failed:", err)
      alert("Unable to approve the appointment.")
    } finally {
      setSubmittingAction(null)
    }
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
        throw new Error(
          getErrorMessage(result, "Failed to decline appointment")
        )
      }

      const declinedId = declineTargetId

      setData((prev) => ({
        today: uniqueAppointmentsById(prev.today),
        requests: uniqueAppointmentsById(
          prev.requests.filter((appt) => appt.id !== declinedId)
        ),
        confirmed: uniqueAppointmentsById(prev.confirmed),
      }))

      resetDeclineModal()

      await loadDashboard(false)
    } catch (err) {
      console.error("Decline failed:", err)
      alert("Unable to decline the appointment.")
    } finally {
      setSubmittingAction(null)
    }
  }

  return (
    <div className="staffLayout">
      <StaffNavbar />

      <div className="staffContent">
        <div className={styles.staffPage}>
          <div className={styles.dashboardHeader}>
            <div>
              <h1>Dashboard</h1>
              <p className={styles.pageSubtext}>
                Manage today’s clinic flow, pending requests, and upcoming
                confirmed appointments.
              </p>
            </div>

            <button
              className={styles.secondaryBtn}
              onClick={() => loadDashboard()}
              disabled={submittingAction !== null}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className={styles.emptyState}>Loading dashboard...</div>
          ) : error ? (
            <div className={styles.emptyState}>{error}</div>
          ) : (
            <>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Pending Requests</div>
                  <div className={styles.statValue}>
                    {pendingRequests.length}
                  </div>
                  <div className={styles.statMeta}>Needs staff action</div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Today’s Appointments</div>
                  <div className={styles.statValue}>{sortedToday.length}</div>
                  <div className={styles.statMeta}>Approved for today</div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Confirmed Upcoming</div>
                  <div className={styles.statValue}>
                    {upcomingConfirmed.length}
                  </div>
                  <div className={styles.statMeta}>
                    Future approved bookings
                  </div>
                </div>
              </div>

              <div style={{ height: "18px" }} />

              <div className={styles.dashboardGrid}>
                <div className={styles.listCard}>
                  <div className={styles.listHeader}>
                    <h2>Today’s Schedule</h2>
                    <span
                      className={`${styles.badge} ${styles.statusApproved}`}
                    >
                      {sortedToday.length} today
                    </span>
                  </div>

                  {sortedToday.length === 0 ? (
                    <div className={styles.emptyState}>
                      No approved appointments scheduled for today.
                    </div>
                  ) : (
                    sortedToday.map((appt) => (
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

                        <span
                          className={`${styles.badge} ${styles.statusApproved}`}
                        >
                          {normalizeStatus(appt.status)}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className={styles.listCard}>
                  <div className={styles.listHeader}>
                    <h2>Needs Action</h2>
                    <span
                      className={`${styles.badge} ${styles.statusPending}`}
                    >
                      {pendingRequests.length} Pending
                    </span>
                  </div>

                  {pendingRequests.length === 0 ? (
                    <div className={styles.emptyState}>
                      No pending requests right now.
                    </div>
                  ) : (
                    pendingRequests.slice(0, 5).map((req) => {
                      const isSubmittingThis =
                        submittingAction?.id === req.id

                      const isApproving =
                        isSubmittingThis &&
                        submittingAction?.action === "approve"

                      const isDeclining =
                        isSubmittingThis &&
                        submittingAction?.action === "decline"

                      return (
                        <div key={req.id} className={styles.requestCard}>
                          <div className={styles.requestInfo}>
                            <b>{req.patient_name}</b>
                            <p>{req.doctor_name}</p>
                            <span>
                              {formatDate(req.date)} at {formatTime(req.time)}
                            </span>

                            {req.services && (
                              <p className={styles.detailText}>
                                Service: {req.services}
                              </p>
                            )}

                            <span
                              className={`${styles.badge} ${styles.statusPending}`}
                            >
                              {normalizeStatus(req.status)}
                            </span>
                          </div>

                          <div className={styles.actions}>
                            <button
                              className={styles.acceptBtn}
                              onClick={() => updateStatus(req.id, "Approved")}
                              disabled={isSubmittingThis}
                            >
                              {isApproving ? "Approving..." : "Approve"}
                            </button>

                            <button
                              className={styles.declineBtn}
                              onClick={() => updateStatus(req.id, "Declined")}
                              disabled={isSubmittingThis}
                            >
                              {isDeclining ? "Declining..." : "Decline"}
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div style={{ height: "18px" }} />

              <div className={styles.listCard}>
                <div className={styles.listHeader}>
                  <h2>Upcoming Confirmed Appointments</h2>
                  <span
                    className={`${styles.badge} ${styles.statusApproved}`}
                  >
                    {upcomingConfirmed.length} Upcoming
                  </span>
                </div>

                {upcomingConfirmed.length === 0 ? (
                  <div className={styles.emptyState}>
                    No upcoming confirmed appointments.
                  </div>
                ) : (
                  upcomingConfirmed.slice(0, 6).map((appt) => (
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

                      <span
                        className={`${styles.badge} ${styles.statusApproved}`}
                      >
                        {normalizeStatus(appt.status)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {declineOpen && (
        <div className={styles.modalOverlay} onClick={resetDeclineModal}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2>Decline Appointment</h2>
              <button
                className={styles.modalCloseBtn}
                onClick={resetDeclineModal}
                disabled={submittingAction !== null}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {declineReasons.map((reason) => (
                <button
                  key={reason}
                  className={
                    selectedReason === reason
                      ? styles.acceptBtn
                      : styles.secondaryBtn
                  }
                  onClick={() => setSelectedReason(reason)}
                  disabled={submittingAction !== null}
                >
                  {reason}
                </button>
              ))}

              {selectedReason === "Other" && (
                <textarea
                  placeholder="Enter reason..."
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  disabled={submittingAction !== null}
                  style={{
                    padding: "12px",
                    minHeight: "90px",
                    borderRadius: "12px",
                    border: "1px solid var(--border-color, #dbe2ea)",
                    resize: "none",
                    fontFamily: "inherit",
                  }}
                />
              )}
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                className={styles.declineBtn}
                onClick={confirmDecline}
                disabled={submittingAction !== null}
              >
                {submittingAction?.action === "decline"
                  ? "Declining..."
                  : "Confirm"}
              </button>

              <button
                className={styles.secondaryBtn}
                onClick={resetDeclineModal}
                disabled={submittingAction !== null}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}