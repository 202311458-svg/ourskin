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

export default function AppointmentRequests() {
  const router = useRouter()

  const [requests, setRequests] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submittingId, setSubmittingId] = useState<number | null>(null)

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [appointmentLogs, setAppointmentLogs] = useState<AppointmentLog[]>([])
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)

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

  const loadRequests = useCallback(async () => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch("http://127.0.0.1:8000/appointments/requests", {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || "Failed to fetch requests")
      }

      setRequests(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Requests load failed:", err)
      setError("Unable to load appointment requests.")
      setRequests([])
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

    loadRequests()
  }, [loadRequests, router])

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => getDateTimeValue(a) - getDateTimeValue(b))
  }, [requests])

  const updateStatus = async (id: number, status: "Approved" | "Declined") => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    let payload: { status: "Approved" | "Declined"; cancel_reason?: string }

    if (status === "Declined") {
      setDeclineTargetId(id)
      setDeclineOpen(true)
      return
    } else {
      payload = {
        status: "Approved",
      }
    }

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

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || "Failed to update appointment")
      }

      await loadRequests()

      if (detailsOpen && selectedAppointment?.id === id) {
        await openDetails({ ...selectedAppointment, status })
      }
    } catch (err) {
      console.error("Status update failed:", err)
      alert("Unable to update the appointment status.")
    } finally {
      setSubmittingId(null)
    }
  }

  const confirmDecline = async () => {
    if (!declineTargetId) return

    const token = localStorage.getItem("token")

    const finalReason =
      selectedReason === "Other"
        ? otherReason.trim()
        : selectedReason

    if (!finalReason) {
      alert("Please select or enter a reason.")
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

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || "Failed to update appointment")
      }

      setDeclineOpen(false)
      setSelectedReason("")
      setOtherReason("")
      setDeclineTargetId(null)

      await loadRequests()
    } catch (err) {
      console.error("Status update failed:", err)
      alert("Unable to update the appointment status.")
    } finally {
      setSubmittingId(null)
    }
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
        fetch(`http://127.0.0.1:8000/appointments/${appointment.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://127.0.0.1:8000/appointments/${appointment.id}/logs`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const appointmentData = await appointmentRes.json()
      const logsData = await logsRes.json()

      if (!appointmentRes.ok || !logsRes.ok) {
        throw new Error("Failed to fetch appointment details")
      }

      setSelectedAppointment(appointmentData)
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
              <h1>Appointment Requests</h1>
              <p className={styles.pageSubtext}>
                Review pending requests and approve or decline them.
              </p>
            </div>

            <button className={styles.secondaryBtn} onClick={loadRequests}>
              Refresh
            </button>
          </div>

          <div className={styles.listCard}>
            <div className={styles.listHeader}>
              <h2>Pending Requests</h2>
              <span className={`${styles.badge} ${styles.statusPending}`}>
                {sortedRequests.length} pending
              </span>
            </div>

            {loading ? (
              <div className={styles.emptyState}>Loading appointment requests...</div>
            ) : error ? (
              <div className={styles.emptyState}>{error}</div>
            ) : sortedRequests.length === 0 ? (
              <div className={styles.emptyState}>No pending appointment requests.</div>
            ) : (
              sortedRequests.map((req) => (
                <div key={req.id} className={styles.requestCard}>
                  <div className={styles.requestInfo}>
                    <b>{req.patient_name}</b>
                    <p>{req.doctor_name}</p>
                    <span>
                      {formatDate(req.date)} at {formatTime(req.time)}
                    </span>
                    {req.services && <p className={styles.detailText}>Service: {req.services}</p>}
                    <span className={`${styles.badge} ${styles.statusPending}`}>
                      {req.status}
                    </span>
                  </div>

                  <div className={styles.actions}>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => openDetails(req)}
                    >
                      View Details
                    </button>

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
      </div>

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

            <p className={styles.pageSubtext}>Select a reason for declining.</p>

            <div style={{ marginTop: 15, display: "flex", flexDirection: "column", gap: 10 }}>
              {declineReasons.map((reason) => (
                <button
                  key={reason}
                  className={`${styles.filterChip} ${
                    selectedReason === reason ? styles.filterChipActive : ""
                  }`}
                  onClick={() => setSelectedReason(reason)}
                >
                  {reason}
                </button>
              ))}

              {selectedReason === "Other" && (
                <textarea
                  placeholder="Enter custom reason..."
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

            <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
              <button className={styles.declineBtn} onClick={confirmDecline}>
                Confirm Decline
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

      {detailsOpen && (
        <div className={styles.modalOverlay} onClick={closeDetails}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Appointment Details</h2>
              <button
                className={styles.modalCloseBtn}
                onClick={closeDetails}
              >
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
                    <span className={styles.infoValue}>{selectedAppointment.patient_name}</span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Doctor</span>
                    <span className={styles.infoValue}>{selectedAppointment.doctor_name}</span>
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
                    <span className={styles.infoValue}>{selectedAppointment.status}</span>
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
                    <div className={styles.emptyState}>No activity history yet.</div>
                  ) : (
                    appointmentLogs.map((log) => (
                      <div key={log.id} className={styles.requestCard}>
                        <div className={styles.requestInfo}>
                          <b>{log.action}</b>
                          <p>
                            {log.performed_by_name}, {log.performed_by_role}
                          </p>
                          <span>
                            {new Date(log.created_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}{" "}
                            at{" "}
                            {new Date(log.created_at).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </span>
                          {log.reason && (
                            <p className={styles.detailText}>Reason: {log.reason}</p>
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