"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import StaffNavbar from "@/app/components/StaffNavbar"
import { API_BASE_URL } from "@/lib/api"
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
  doctor_name?: string | null
  date?: string | null
  time?: string | null
  end_time?: string | null
  status: string
  services?: string | null
  appointment_type?: string | null
  consultation_mode?: string | null
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

type AssignableSlot = {
  id: string
  slot_id: string
  schedule_id: number
  doctor_id: number
  doctor_name: string
  doctor_specialty?: string | null
  service_id: number
  service_name: string
  schedule_date: string
  start_time: string
  end_time: string
  consultation_mode: string
  appointment_type: string
  is_available: boolean
  unavailable_reason?: string | null
}

const declineReasons = [
  "Conflict in schedule. Kindly select a new schedule.",
  "Doctor is unavailable on the selected date.",
  "Incomplete patient information. Please update your details.",
  "Requested service is not available.",
  "Duplicate appointment detected.",
  "Other",
]

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

export default function AppointmentRequests() {
  const router = useRouter()

  const [requests, setRequests] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submittingId, setSubmittingId] = useState<number | null>(null)

  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null)
  const [appointmentLogs, setAppointmentLogs] = useState<AppointmentLog[]>([])
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineTargetId, setDeclineTargetId] = useState<number | null>(null)
  const [selectedReason, setSelectedReason] = useState("")
  const [otherReason, setOtherReason] = useState("")

  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleTarget, setScheduleTarget] = useState<Appointment | null>(null)
  const [assignableSlots, setAssignableSlots] = useState<AssignableSlot[]>([])
  const [slotLoading, setSlotLoading] = useState(false)
  const [slotError, setSlotError] = useState("")
  const [assignmentWeekStart, setAssignmentWeekStart] =
    useState(getTodayInputDate())
  const [assigningSlotId, setAssigningSlotId] = useState<string | null>(null)

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "To be scheduled"

    const date = new Date(`${dateString}T00:00:00`)

    if (Number.isNaN(date.getTime())) return dateString

    return date.toLocaleDateString("en-AU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return "No timestamp"

    const date = new Date(dateString)

    if (Number.isNaN(date.getTime())) return dateString

    return date.toLocaleString("en-AU", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const formatTime = (timeString?: string | null) => {
    if (!timeString) return ""

    const [hour, minute] = timeString.split(":")
    const date = new Date()

    date.setHours(Number(hour), Number(minute), 0, 0)

    if (Number.isNaN(date.getTime())) return timeString

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

  const formatSlotTimeRange = (slot: AssignableSlot) => {
    return `${formatTime(slot.start_time)} to ${formatTime(slot.end_time)}`
  }

  const hasAssignedSchedule = (appointment: Appointment) => {
    return Boolean(
      appointment.schedule_id &&
        appointment.doctor_id &&
        appointment.date &&
        appointment.time &&
        appointment.end_time
    )
  }

  const getDateTimeValue = (appt: Appointment) => {
    if (!appt.date || !appt.time) return Number.MAX_SAFE_INTEGER

    const value = new Date(`${appt.date}T${appt.time}`).getTime()

    return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value
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
      const res = await fetch(`${API_BASE_URL}/appointments/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await readJsonSafely(res)

      if (!res.ok) {
        throw new Error(getErrorMessage(data, "Failed to fetch requests"))
      }

      setRequests(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Requests load failed:", err)
      setError(
        err instanceof Error ? err.message : "Unable to load appointment requests."
      )
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const token = localStorage.getItem("token")
    const role = localStorage.getItem("role")

    if (!token || role !== "staff") {
      router.push("/")
      return
    }

    loadRequests()
  }, [loadRequests, router])

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => getDateTimeValue(a) - getDateTimeValue(b))
  }, [requests])

  const openScheduleModal = async (appointment: Appointment) => {
    setScheduleTarget(appointment)
    setScheduleOpen(true)
    setSlotError("")
    setAssignableSlots([])
    setAssignmentWeekStart(getTodayInputDate())

    await loadAssignableSlots(appointment, getTodayInputDate())
  }

  const closeScheduleModal = () => {
    if (assigningSlotId) return

    setScheduleOpen(false)
    setScheduleTarget(null)
    setAssignableSlots([])
    setSlotError("")
    setAssigningSlotId(null)
  }

  const loadAssignableSlots = async (
    appointment = scheduleTarget,
    weekStart = assignmentWeekStart
  ) => {
    if (!appointment) return

    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    setSlotLoading(true)
    setSlotError("")

    try {
      const params = new URLSearchParams()

      if (weekStart) {
        params.set("week_start", weekStart)
      }

      const res = await fetch(
        `${API_BASE_URL}/appointments/${appointment.id}/assignable-slots?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      const data = await readJsonSafely(res)

      if (!res.ok) {
        throw new Error(getErrorMessage(data, "Unable to load available slots."))
      }

      setAssignableSlots(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Assignable slots load failed:", err)
      setSlotError(
        err instanceof Error ? err.message : "Unable to load available slots."
      )
      setAssignableSlots([])
    } finally {
      setSlotLoading(false)
    }
  }

  const updateStatus = async (id: number, status: "Approved" | "Declined") => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    const target = requests.find((request) => request.id === id)

    if (
      status === "Approved" &&
      target?.is_initial_evaluation_request &&
      !hasAssignedSchedule(target)
    ) {
      await openScheduleModal(target)
      return
    }

    if (status === "Declined") {
      setDeclineTargetId(id)
      setDeclineOpen(true)
      return
    }

    try {
      setSubmittingId(id)

      const res = await fetch(`${API_BASE_URL}/appointments/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      })

      const data = await readJsonSafely(res)

      if (!res.ok) {
        throw new Error(getErrorMessage(data, "Failed to update appointment"))
      }

      await loadRequests()

      if (detailsOpen && selectedAppointment?.id === id) {
        await openDetails({ ...selectedAppointment, status })
      }
    } catch (err) {
      console.error("Status update failed:", err)
      alert(err instanceof Error ? err.message : "Unable to update the appointment status.")
    } finally {
      setSubmittingId(null)
    }
  }

  const assignAndApprove = async (slot: AssignableSlot) => {
    if (!scheduleTarget) return

    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    try {
      setAssigningSlotId(slot.slot_id)

      const assignRes = await fetch(
        `${API_BASE_URL}/appointments/${scheduleTarget.id}/assign-schedule`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            schedule_id: slot.schedule_id,
            start_time: slot.start_time,
            end_time: slot.end_time,
          }),
        }
      )

      const assignData = await readJsonSafely(assignRes)

      if (!assignRes.ok) {
        throw new Error(getErrorMessage(assignData, "Unable to assign schedule."))
      }

      const approveRes = await fetch(
        `${API_BASE_URL}/appointments/${scheduleTarget.id}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "Approved" }),
        }
      )

      const approveData = await readJsonSafely(approveRes)

      if (!approveRes.ok) {
        throw new Error(getErrorMessage(approveData, "Schedule assigned, but approval failed."))
      }

      setScheduleOpen(false)
      setScheduleTarget(null)
      setAssignableSlots([])
      setSlotError("")
      await loadRequests()
    } catch (err) {
      console.error("Schedule assignment failed:", err)
      alert(err instanceof Error ? err.message : "Unable to assign and approve appointment.")
    } finally {
      setAssigningSlotId(null)
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
      alert("Please select or enter a reason.")
      return
    }

    try {
      setSubmittingId(declineTargetId)

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

      const data = await readJsonSafely(res)

      if (!res.ok) {
        throw new Error(getErrorMessage(data, "Failed to decline appointment"))
      }

      setDeclineOpen(false)
      setSelectedReason("")
      setOtherReason("")
      setDeclineTargetId(null)

      await loadRequests()
    } catch (err) {
      console.error("Status update failed:", err)
      alert(err instanceof Error ? err.message : "Unable to update the appointment status.")
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

      setSelectedAppointment(appointmentData as Appointment)
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

      <div className="staffContent">
        <div className={styles.staffPage}>
          <div className={styles.dashboardHeader}>
            <div>
              <h1>Appointment Requests</h1>
              <p className={styles.pageSubtext}>
                Review regular bookings and assign schedules for initial evaluation requests.
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
              sortedRequests.map((req) => {
                const isInitialEvaluation = Boolean(req.is_initial_evaluation_request)
                const assigned = hasAssignedSchedule(req)
                const isSubmitting = submittingId === req.id

                return (
                  <div key={req.id} className={styles.requestCard}>
                    <div className={styles.requestInfo}>
                      <b>{req.patient_name}</b>
                      <p>{req.doctor_name || "To be assigned by staff"}</p>

                      <span>
                        {formatDate(req.date)} {req.time ? `at ${formatTimeRange(req)}` : ""}
                      </span>

                      {req.services && (
                        <p className={styles.detailText}>Service: {req.services}</p>
                      )}

                      {req.patient_age_label && (
                        <p className={styles.detailText}>Age: {req.patient_age_label}</p>
                      )}

                      {req.concern && (
                        <p className={styles.detailText}>Concern: {req.concern}</p>
                      )}

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        <span className={`${styles.badge} ${styles.statusPending}`}>
                          {normalizeStatus(req.status)}
                        </span>

                        {isInitialEvaluation && (
                          <span className={`${styles.badge} ${assigned ? styles.statusApproved : styles.statusPending}`}>
                            {assigned ? "Evaluation Scheduled" : "Needs Staff Scheduling"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={styles.actions}>
                      <button
                        className={styles.secondaryBtn}
                        onClick={() => openDetails(req)}
                        disabled={isSubmitting}
                      >
                        View Details
                      </button>

                      {isInitialEvaluation && !assigned && (
                        <button
                          className={styles.acceptBtn}
                          onClick={() => openScheduleModal(req)}
                          disabled={isSubmitting}
                        >
                          Schedule Evaluation
                        </button>
                      )}

                      {isInitialEvaluation && assigned && (
                        <button
                          className={styles.secondaryBtn}
                          onClick={() => openScheduleModal(req)}
                          disabled={isSubmitting}
                        >
                          Change Schedule
                        </button>
                      )}

                      <button
                        className={styles.acceptBtn}
                        onClick={() => updateStatus(req.id, "Approved")}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Saving..." : isInitialEvaluation && !assigned ? "Assign First" : "Approve"}
                      </button>

                      <button
                        className={styles.declineBtn}
                        onClick={() => updateStatus(req.id, "Declined")}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Saving..." : "Decline"}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {scheduleOpen && scheduleTarget && (
        <div className={styles.modalOverlay} onClick={closeScheduleModal}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Schedule Initial Evaluation</h2>
              <button
                className={styles.modalCloseBtn}
                onClick={closeScheduleModal}
                disabled={Boolean(assigningSlotId)}
              >
                ×
              </button>
            </div>

            <p className={styles.pageSubtext}>
              {scheduleTarget.patient_name} requested {scheduleTarget.services || "a service"}.
              Select an available doctor schedule, then the system will approve the request.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "14px 0" }}>
              <input
                type="date"
                value={assignmentWeekStart}
                onChange={(event) => setAssignmentWeekStart(event.target.value)}
                style={{
                  minHeight: 42,
                  borderRadius: 12,
                  border: "1px solid var(--border-color, #dbe2ea)",
                  padding: "0 12px",
                }}
              />

              <button
                className={styles.secondaryBtn}
                onClick={() => loadAssignableSlots(scheduleTarget, assignmentWeekStart)}
                disabled={slotLoading || Boolean(assigningSlotId)}
              >
                {slotLoading ? "Loading..." : "Load Week Slots"}
              </button>
            </div>

            {slotError && <div className={styles.emptyState}>{slotError}</div>}

            {slotLoading ? (
              <div className={styles.emptyState}>Loading available evaluation slots...</div>
            ) : assignableSlots.length === 0 ? (
              <div className={styles.emptyState}>
                No available slots found for this week. Create a doctor schedule for this service first.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10, maxHeight: "440px", overflowY: "auto" }}>
                {assignableSlots.map((slot) => {
                  const disabled = !slot.is_available || Boolean(assigningSlotId)
                  const isAssigning = assigningSlotId === slot.slot_id

                  return (
                    <div key={slot.slot_id} className={styles.requestCard}>
                      <div className={styles.requestInfo}>
                        <b>{slot.doctor_name}</b>
                        <p>{slot.doctor_specialty || slot.consultation_mode}</p>
                        <span>
                          {formatDate(slot.schedule_date)} at {formatSlotTimeRange(slot)}
                        </span>
                        <p className={styles.detailText}>{slot.service_name}</p>
                        {!slot.is_available && (
                          <p className={styles.detailText}>{slot.unavailable_reason || "Unavailable"}</p>
                        )}
                      </div>

                      <div className={styles.actions}>
                        <button
                          className={slot.is_available ? styles.acceptBtn : styles.secondaryBtn}
                          onClick={() => assignAndApprove(slot)}
                          disabled={disabled}
                        >
                          {isAssigning ? "Assigning..." : slot.is_available ? "Assign & Approve" : "Unavailable"}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {declineOpen && (
        <div className={styles.modalOverlay} onClick={() => setDeclineOpen(false)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
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
                  placeholder="Enter reason..."
                  value={otherReason}
                  onChange={(event) => setOtherReason(event.target.value)}
                  style={{
                    padding: "10px",
                    minHeight: 90,
                    borderRadius: "10px",
                    border: "1px solid var(--border-color, #dbe2ea)",
                    resize: "none",
                    fontFamily: "inherit",
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
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
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
                    <h2>Request Info</h2>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Patient</span>
                    <span className={styles.infoValue}>{selectedAppointment.patient_name}</span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Doctor</span>
                    <span className={styles.infoValue}>
                      {selectedAppointment.doctor_name || "To be assigned by staff"}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Date</span>
                    <span className={styles.infoValue}>{formatDate(selectedAppointment.date)}</span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Time</span>
                    <span className={styles.infoValue}>{formatTimeRange(selectedAppointment)}</span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Service</span>
                    <span className={styles.infoValue}>
                      {selectedAppointment.services || "Not available"}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Appointment Type</span>
                    <span className={styles.infoValue}>
                      {selectedAppointment.appointment_type || "Regular"}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Patient Age</span>
                    <span className={styles.infoValue}>
                      {selectedAppointment.patient_age_label || selectedAppointment.patient_age || "Not provided"}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Contact</span>
                    <span className={styles.infoValue}>
                      {selectedAppointment.patient_contact || "Not provided"}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Address</span>
                    <span className={styles.infoValue}>
                      {selectedAppointment.patient_address || "Not provided"}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Concern</span>
                    <span className={styles.infoValue}>
                      {selectedAppointment.concern || "Not provided"}
                    </span>
                  </div>
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
                          <span>{formatDateTime(log.created_at)}</span>
                          {log.reason && <p className={styles.detailText}>{log.reason}</p>}
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
