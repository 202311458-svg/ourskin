"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import StaffNavbar from "@/app/components/StaffNavbar"
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

export default function StaffDashboard() {
  const router = useRouter()

  const [data, setData] = useState<DashboardData>({
    today: [],
    requests: [],
    confirmed: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submittingId, setSubmittingId] = useState<number | null>(null)

  // DECLINE MODAL STATES (ADDED ONLY)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineTargetId, setDeclineTargetId] = useState<number | null>(null)
  const [selectedReason, setSelectedReason] = useState("")
  const [otherReason, setOtherReason] = useState("")

  const declineReasons = [
    "Conflict in schedule. Kindly select a new schedule.",
    "Doctor is unavailable on the selected date.",
    "Incomplete patient information. Please update your details.",
    "Requested service is not available.",
    "Duplicate appointment detected.",
    "Other",
  ]

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

  const loadDashboard = useCallback(async () => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    setLoading(true)
    setError("")

    try {
      const [todayRes, requestsRes, confirmedRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/appointments/today", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("http://127.0.0.1:8000/appointments/requests", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("http://127.0.0.1:8000/appointments/confirmed", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const [todayData, requestsData, confirmedData] = await Promise.all([
        todayRes.json(),
        requestsRes.json(),
        confirmedRes.json(),
      ])

      if (!todayRes.ok || !requestsRes.ok || !confirmedRes.ok) {
        throw new Error("Failed to load dashboard data")
      }

      setData({
        today: Array.isArray(todayData) ? todayData : [],
        requests: Array.isArray(requestsData) ? requestsData : [],
        confirmed: Array.isArray(confirmedData) ? confirmedData : [],
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
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const role = localStorage.getItem("role")

    if (role !== "staff") {
      router.push("/")
      return
    }

    loadDashboard()
  }, [loadDashboard, router])

  const sortedToday = useMemo(() => {
    return [...data.today].sort((a, b) => getDateTimeValue(a) - getDateTimeValue(b))
  }, [data.today])

  const pendingRequests = useMemo(() => {
    return [...data.requests].sort((a, b) => getDateTimeValue(a) - getDateTimeValue(b))
  }, [data.requests])

  const upcomingConfirmed = useMemo(() => {
    const now = Date.now()

    return [...data.confirmed]
      .filter((appt) => getDateTimeValue(appt) >= now)
      .sort((a, b) => getDateTimeValue(a) - getDateTimeValue(b))
  }, [data.confirmed])

  // MODIFIED ONLY FOR DECLINE FLOW (approval untouched)
  const updateStatus = async (id: number, status: "Approved" | "Declined") => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    // OPEN MODAL INSTEAD OF PROMPT
    if (status === "Declined") {
      setDeclineTargetId(id)
      setDeclineOpen(true)
      return
    }

    const payload = { status: "Approved" }

    try {
      setSubmittingId(id)

      const res = await fetch(`http://127.0.0.1:8000/appointments/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.detail || "Failed to update appointment")
      }

      await loadDashboard()
    } catch (err) {
      console.error("Status update failed:", err)
      alert("Unable to update the appointment status.")
    } finally {
      setSubmittingId(null)
    }
  }

  // DECLINE CONFIRM ACTION (ADDED ONLY)
  const confirmDecline = async () => {
    if (!declineTargetId) return

    const token = localStorage.getItem("token")

    const finalReason =
      selectedReason === "Other" ? otherReason.trim() : selectedReason

    if (!finalReason) {
      alert("Please select a reason.")
      return
    }

    try {
      setSubmittingId(declineTargetId)

      const res = await fetch(
        `http://127.0.0.1:8000/appointments/${declineTargetId}/status`,
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

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.detail || "Failed to update appointment")
      }

      setDeclineOpen(false)
      setDeclineTargetId(null)
      setSelectedReason("")
      setOtherReason("")

      await loadDashboard()
    } catch (err) {
      console.error(err)
      alert("Unable to update the appointment status.")
    } finally {
      setSubmittingId(null)
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
                Manage today’s clinic flow, pending requests, and upcoming confirmed appointments.
              </p>
            </div>

            <button className={styles.secondaryBtn} onClick={loadDashboard}>
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
                  <div className={styles.statValue}>{pendingRequests.length}</div>
                  <div className={styles.statMeta}>Needs staff action</div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Today’s Appointments</div>
                  <div className={styles.statValue}>{sortedToday.length}</div>
                  <div className={styles.statMeta}>Approved for today</div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Confirmed Upcoming</div>
                  <div className={styles.statValue}>{upcomingConfirmed.length}</div>
                  <div className={styles.statMeta}>Future approved bookings</div>
                </div>
              </div>

              <div style={{ height: "18px" }} />

              <div className={styles.dashboardGrid}>
                <div className={styles.listCard}>
                  <div className={styles.listHeader}>
                    <h2>Today’s Schedule</h2>
                    <span className={`${styles.badge} ${styles.statusApproved}`}>
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
                            <p className={styles.detailText}>Service: {appt.services}</p>
                          )}
                        </div>

                        <span className={`${styles.badge} ${styles.statusApproved}`}>
                          {appt.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className={styles.listCard}>
                  <div className={styles.listHeader}>
                    <h2>Needs Action</h2>
                    <span className={`${styles.badge} ${styles.statusPending}`}>
                      {pendingRequests.length} pending
                    </span>
                  </div>

                  {pendingRequests.length === 0 ? (
                    <div className={styles.emptyState}>No pending requests right now.</div>
                  ) : (
                    pendingRequests.slice(0, 5).map((req) => (
                      <div key={req.id} className={styles.requestCard}>
                        <div className={styles.requestInfo}>
                          <b>{req.patient_name}</b>
                          <p>{req.doctor_name}</p>
                          <span>
                            {formatDate(req.date)} at {formatTime(req.time)}
                          </span>
                          {req.services && (
                            <p className={styles.detailText}>Service: {req.services}</p>
                          )}
                          <span className={`${styles.badge} ${styles.statusPending}`}>
                            {req.status}
                          </span>
                        </div>

                        <div className={styles.actions}>
                          <button
                            className={styles.acceptBtn}
                            onClick={() => updateStatus(req.id, "Approved")}
                            disabled={submittingId === req.id}
                          >
                            {submittingId === req.id ? "Saving..." : "Approve"}
                          </button>

                          <button
                            className={styles.declineBtn}
                            onClick={() => updateStatus(req.id, "Declined")}
                            disabled={submittingId === req.id}
                          >
                            {submittingId === req.id ? "Saving..." : "Decline"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ height: "18px" }} />

              <div className={styles.listCard}>
                <div className={styles.listHeader}>
                  <h2>Upcoming Confirmed Appointments</h2>
                  <span className={`${styles.badge} ${styles.statusApproved}`}>
                    {upcomingConfirmed.length} upcoming
                  </span>
                </div>

                {upcomingConfirmed.length === 0 ? (
                  <div className={styles.emptyState}>No upcoming confirmed appointments.</div>
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
                          <p className={styles.detailText}>Service: {appt.services}</p>
                        )}
                      </div>

                      <span className={`${styles.badge} ${styles.statusApproved}`}>
                        {appt.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* DECLINE MODAL (ADDED ONLY) */}
      {declineOpen && (
        <div className={styles.modalOverlay} onClick={() => setDeclineOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Decline Appointment</h2>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setDeclineOpen(false)}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {declineReasons.map((r) => (
                <button
                key={r}
                className={
                  selectedReason === r
                    ? `${styles.acceptBtn}`
                    : `${styles.secondaryBtn}`
                }
                onClick={() => setSelectedReason(r)}
              >
                {r}
              </button>
              ))}

              {selectedReason === "Other" && (
                <textarea
                  placeholder="Enter reason..."
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  style={{
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    resize: "none",
                  }}
                />
              )}
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
              <button className={styles.declineBtn} onClick={confirmDecline}>
                Confirm
              </button>
              <button
                className={styles.secondaryBtn}
                onClick={() => setDeclineOpen(false)}
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