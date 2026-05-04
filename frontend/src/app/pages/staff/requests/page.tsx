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
  appointment_type?: string | null
  consultation_mode?: string | null
  concern?: string | null
  is_initial_evaluation_request?: boolean | null
  cancel_reason?: string | null
  patient_instruction?: string | null
  approval_email_sent?: boolean | null
  approval_email_sent_at?: string | null
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
  schedule_id?: number | null
  doctor_id: number
  doctor_name: string
  doctor_specialty?: string | null
  service_id?: number | null
  service_name: string
  schedule_date: string
  start_time: string
  end_time: string
  consultation_mode: string
  appointment_type: string
  is_available: boolean
  unavailable_reason?: string | null
}

type AssignableDoctor = {
  id: number
  name: string
  email?: string | null
  specialty?: string | null
  profile_image?: string | null
  bio?: string | null
}

type ManualEvaluationForm = {
  doctor_id: string
  schedule_date: string
  start_time: string
  end_time: string
  consultation_mode: "In-Person" | "Online Consultation"
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
  const [assignableDoctors, setAssignableDoctors] = useState<AssignableDoctor[]>([])
  const [doctorLoading, setDoctorLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState("")
  const [manualEvaluationForm, setManualEvaluationForm] =
    useState<ManualEvaluationForm>({
      doctor_id: "",
      schedule_date: getTodayInputDate(),
      start_time: "13:00",
      end_time: "14:00",
      consultation_mode: "In-Person",
    })

  const [approvalOpen, setApprovalOpen] = useState(false)
  const [approvalTarget, setApprovalTarget] = useState<Appointment | null>(null)
  const [approvalSlot, setApprovalSlot] = useState<AssignableSlot | null>(null)
  const [approvalInstruction, setApprovalInstruction] = useState("")
  const [sendApprovalEmail, setSendApprovalEmail] = useState(true)
  const [approvalSubmitting, setApprovalSubmitting] = useState(false)

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

  const toTimeInputValue = (value?: string | null, fallback = "13:00") => {
    if (!value) return fallback

    return value.slice(0, 5)
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

  const hasAssignedSchedule = (appointment: Appointment) => {
    return Boolean(
      appointment.doctor_id &&
        appointment.date &&
        appointment.time &&
        appointment.end_time
    )
  }

  const buildDefaultApprovalInstruction = (
    appointment: Appointment,
    slot?: AssignableSlot | null
  ) => {
    const service = appointment.services || slot?.service_name || "your selected service"
    const doctor =
      slot?.doctor_name || appointment.doctor_name || "your assigned doctor"
    const scheduleDate = slot?.schedule_date || appointment.date
    const startTime = slot?.start_time || appointment.time
    const endTime = slot?.end_time || appointment.end_time
    const consultationMode =
      slot?.consultation_mode || appointment.consultation_mode || "In-Person"

    if (consultationMode === "Online Consultation") {
      return `Your appointment for ${service} has been approved. It is scheduled on ${formatDate(
        scheduleDate
      )} from ${formatTime(startTime)} to ${formatTime(
        endTime
      )} with ${doctor}. Please make sure you have a stable internet connection and are in a well-lit area during the consultation. The clinic will provide the consultation access details before your schedule. If you need to cancel or reschedule, please do this ahead of your appointment time through your patient portal.`
    }

    if (
      appointment.is_initial_evaluation_request ||
      appointment.appointment_type === "Initial Evaluation" ||
      appointment.appointment_type === "Initial Evaluation Request"
    ) {
      return `Your initial evaluation for ${service} has been approved and scheduled on ${formatDate(
        scheduleDate
      )} from ${formatTime(startTime)} to ${formatTime(
        endTime
      )} with ${doctor}. Please arrive at least 15 minutes before your appointment. The doctor will assess your concern first before confirming the next treatment or procedure plan. Please bring a valid ID and any previous prescriptions, laboratory results, or skin-related medical records if available.`
    }

    return `Your appointment for ${service} has been approved. It is scheduled on ${formatDate(
      scheduleDate
    )} from ${formatTime(startTime)} to ${formatTime(
      endTime
    )} with ${doctor}. Please arrive at least 15 minutes before your scheduled time and bring a valid ID, previous prescriptions, laboratory results, or skin-related medical records if available. If you need to cancel or reschedule, please do this ahead of your appointment time through your patient portal.`
  }

  const openApprovalModal = (
    appointment: Appointment,
    slot?: AssignableSlot | null
  ) => {
    setApprovalTarget(appointment)
    setApprovalSlot(slot || null)
    setApprovalInstruction(buildDefaultApprovalInstruction(appointment, slot))
    setSendApprovalEmail(true)
    setApprovalOpen(true)
  }

  const closeApprovalModal = () => {
    if (approvalSubmitting) return

    setApprovalOpen(false)
    setApprovalTarget(null)
    setApprovalSlot(null)
    setApprovalInstruction("")
    setSendApprovalEmail(true)
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

  const loadAssignableDoctors = async (appointment: Appointment) => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    setDoctorLoading(true)
    setScheduleError("")

    try {
      const res = await fetch(
        `${API_BASE_URL}/appointments/${appointment.id}/assignable-doctors`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      const data = await readJsonSafely(res)

      if (!res.ok) {
        throw new Error(getErrorMessage(data, "Unable to load doctors for this service."))
      }

      const doctors = Array.isArray(data) ? data : []
      setAssignableDoctors(doctors)

      if (!appointment.doctor_id && doctors.length === 1) {
        setManualEvaluationForm((current) => ({
          ...current,
          doctor_id: String((doctors[0] as AssignableDoctor).id),
        }))
      }
    } catch (err) {
      console.error("Assignable doctors load failed:", err)
      setScheduleError(
        err instanceof Error
          ? err.message
          : "Unable to load doctors for this service."
      )
      setAssignableDoctors([])
    } finally {
      setDoctorLoading(false)
    }
  }

  const openScheduleModal = async (appointment: Appointment) => {
    setScheduleTarget(appointment)
    setScheduleOpen(true)
    setScheduleError("")
    setAssignableDoctors([])
    setManualEvaluationForm({
      doctor_id: appointment.doctor_id ? String(appointment.doctor_id) : "",
      schedule_date: appointment.date || getTodayInputDate(),
      start_time: toTimeInputValue(appointment.time, "13:00"),
      end_time: toTimeInputValue(appointment.end_time, "14:00"),
      consultation_mode:
        appointment.consultation_mode === "Online Consultation"
          ? "Online Consultation"
          : "In-Person",
    })

    await loadAssignableDoctors(appointment)
  }

  const closeScheduleModal = () => {
    if (approvalSubmitting) return

    setScheduleOpen(false)
    setScheduleTarget(null)
    setAssignableDoctors([])
    setScheduleError("")
  }

  const getSelectedEvaluationDoctor = () => {
    return assignableDoctors.find(
      (doctor) => String(doctor.id) === manualEvaluationForm.doctor_id
    )
  }

  const validateManualEvaluationSchedule = () => {
    if (!scheduleTarget) return "Appointment request was not found."

    if (!manualEvaluationForm.doctor_id) {
      return "Please select a doctor for this initial evaluation."
    }

    if (!manualEvaluationForm.schedule_date) {
      return "Please select an appointment date."
    }

    if (!manualEvaluationForm.start_time || !manualEvaluationForm.end_time) {
      return "Please select the start time and end time."
    }

    const start = new Date(
      `${manualEvaluationForm.schedule_date}T${manualEvaluationForm.start_time}`
    )
    const end = new Date(
      `${manualEvaluationForm.schedule_date}T${manualEvaluationForm.end_time}`
    )

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "Please select a valid appointment date and time."
    }

    if (end <= start) {
      return "End time must be later than the start time."
    }

    if (start <= new Date()) {
      return "Past schedules cannot be assigned."
    }

    return ""
  }

  const updateStatus = async (id: number, status: "Approved" | "Declined") => {
    const target = requests.find((request) => request.id === id)

    if (!target) {
      alert("Appointment request was not found.")
      return
    }

    if (
      status === "Approved" &&
      target.is_initial_evaluation_request &&
      !hasAssignedSchedule(target)
    ) {
      await openScheduleModal(target)
      return
    }

    if (status === "Approved") {
      openApprovalModal(target)
      return
    }

    setDeclineTargetId(id)
    setDeclineOpen(true)
  }

  const prepareManualScheduleApproval = () => {
    if (!scheduleTarget) return

    const validationMessage = validateManualEvaluationSchedule()

    if (validationMessage) {
      setScheduleError(validationMessage)
      return
    }

    const selectedDoctor = getSelectedEvaluationDoctor()

    if (!selectedDoctor) {
      setScheduleError("Selected doctor was not found.")
      return
    }

    const manualSlot: AssignableSlot = {
      id: `manual-${scheduleTarget.id}`,
      slot_id: `manual-${scheduleTarget.id}`,
      schedule_id: null,
      doctor_id: selectedDoctor.id,
      doctor_name: selectedDoctor.name,
      doctor_specialty: selectedDoctor.specialty,
      service_id: scheduleTarget.service_id,
      service_name: scheduleTarget.services || "Initial Evaluation",
      schedule_date: manualEvaluationForm.schedule_date,
      start_time: manualEvaluationForm.start_time,
      end_time: manualEvaluationForm.end_time,
      consultation_mode: manualEvaluationForm.consultation_mode,
      appointment_type: "Initial Evaluation",
      is_available: true,
      unavailable_reason: null,
    }

    setScheduleError("")
    openApprovalModal(scheduleTarget, manualSlot)
  }

  const confirmApproval = async () => {
    if (!approvalTarget) return

    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    const finalInstruction = approvalInstruction.trim()

    if (!finalInstruction) {
      alert("Please provide approval instructions for the patient.")
      return
    }

    try {
      setApprovalSubmitting(true)
      setSubmittingId(approvalTarget.id)

      if (approvalSlot) {
        const assignRes = await fetch(
          `${API_BASE_URL}/appointments/${approvalTarget.id}/assign-schedule`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              schedule_id: approvalSlot.schedule_id || null,
              doctor_id: approvalSlot.doctor_id,
              schedule_date: approvalSlot.schedule_date,
              start_time: approvalSlot.start_time,
              end_time: approvalSlot.end_time,
              consultation_mode: approvalSlot.consultation_mode,
            }),
          }
        )

        const assignData = await readJsonSafely(assignRes)

        if (!assignRes.ok) {
          throw new Error(
            getErrorMessage(assignData, "Unable to assign schedule.")
          )
        }
      }

      const approveRes = await fetch(
        `${API_BASE_URL}/appointments/${approvalTarget.id}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: "Approved",
            patient_instruction: finalInstruction,
            send_email: sendApprovalEmail,
          }),
        }
      )

      const approveData = await readJsonSafely(approveRes)

      if (!approveRes.ok) {
        throw new Error(
          getErrorMessage(approveData, "Unable to approve appointment.")
        )
      }

      if (
        approveData &&
        typeof approveData === "object" &&
        "email_warning" in approveData &&
        (approveData as { email_warning?: unknown }).email_warning
      ) {
        alert(
          "Appointment approved, but the email was not sent. Please check your email settings."
        )
      }

      closeApprovalModal()
      setScheduleOpen(false)
      setScheduleTarget(null)
      setAssignableDoctors([])
      setScheduleError("")

      await loadRequests()

      if (detailsOpen && selectedAppointment?.id === approvalTarget.id) {
        await openDetails({
          ...selectedAppointment,
          status: "Approved",
          patient_instruction: finalInstruction,
        })
      }
    } catch (err) {
      console.error("Approval failed:", err)
      alert(
        err instanceof Error
          ? err.message
          : "Unable to approve the appointment."
      )
    } finally {
      setApprovalSubmitting(false)
      setSubmittingId(null)
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

                      {(req.patient_age_label || req.patient_age) && (
                        <p className={styles.detailText}>
                          Age: {req.patient_age_label || req.patient_age}
                        </p>
                      )}

                      {req.is_minor && (
                        <p className={styles.detailText}>
                          Minor patient · Guardian: {getGuardianName(req)}
                        </p>
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
              <div>
                <h2>Schedule Initial Evaluation</h2>
                <p className={styles.pageSubtext}>
                  This schedule is manually coordinated by staff and the doctor. It is not pulled from the weekly doctor schedule.
                </p>
              </div>

              <button
                className={styles.modalCloseBtn}
                onClick={closeScheduleModal}
                disabled={approvalSubmitting}
              >
                ×
              </button>
            </div>

            <div className={styles.listCard} style={{ marginTop: 14 }}>
              <div className={styles.listHeader}>
                <div>
                  <h2>{scheduleTarget.patient_name}</h2>
                  <p className={styles.pageSubtext}>
                    Requested service: {scheduleTarget.services || "Initial Evaluation"}
                  </p>
                </div>
                <span className={`${styles.badge} ${styles.statusPending}`}>
                  Staff-Coordinated
                </span>
              </div>

              {scheduleTarget.concern && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Concern</span>
                  <span className={styles.infoValue}>{scheduleTarget.concern}</span>
                </div>
              )}
            </div>

            <div className={styles.dashboardGrid} style={{ marginTop: 16 }}>
              <div className={styles.listCard}>
                <div className={styles.listHeader}>
                  <h2>Doctor</h2>
                </div>

                <label className={styles.infoLabel} htmlFor="manualDoctor">
                  Select doctor for this service
                </label>
                <select
                  id="manualDoctor"
                  value={manualEvaluationForm.doctor_id}
                  onChange={(event) =>
                    setManualEvaluationForm((current) => ({
                      ...current,
                      doctor_id: event.target.value,
                    }))
                  }
                  disabled={doctorLoading || approvalSubmitting}
                  style={{
                    width: "100%",
                    minHeight: 44,
                    borderRadius: 12,
                    border: "1px solid var(--border-color, #dbe2ea)",
                    background: "var(--input-bg, #ffffff)",
                    color: "inherit",
                    padding: "0 12px",
                    marginTop: 8,
                  }}
                >
                  <option value="">
                    {doctorLoading ? "Loading doctors..." : "Select doctor"}
                  </option>
                  {assignableDoctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}{doctor.specialty ? ` · ${doctor.specialty}` : ""}
                    </option>
                  ))}
                </select>

                {doctorLoading ? (
                  <div className={styles.emptyState} style={{ marginTop: 12 }}>
                    Loading doctors assigned to this service...
                  </div>
                ) : assignableDoctors.length === 0 ? (
                  <div className={styles.emptyState} style={{ marginTop: 12 }}>
                    No doctor is assigned to this service yet. Check the doctor-service setup first.
                  </div>
                ) : getSelectedEvaluationDoctor() ? (
                  <div className={styles.requestCard} style={{ marginTop: 12 }}>
                    <div className={styles.requestInfo}>
                      <b>{getSelectedEvaluationDoctor()?.name}</b>
                      <p>{getSelectedEvaluationDoctor()?.specialty || "Doctor"}</p>
                      {getSelectedEvaluationDoctor()?.bio && (
                        <p className={styles.detailText}>{getSelectedEvaluationDoctor()?.bio}</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className={styles.listCard}>
                <div className={styles.listHeader}>
                  <h2>Manual Schedule</h2>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  <label className={styles.infoLabel} htmlFor="manualDate">
                    Appointment Date
                  </label>
                  <input
                    id="manualDate"
                    type="date"
                    value={manualEvaluationForm.schedule_date}
                    onChange={(event) =>
                      setManualEvaluationForm((current) => ({
                        ...current,
                        schedule_date: event.target.value,
                      }))
                    }
                    min={getTodayInputDate()}
                    disabled={approvalSubmitting}
                    style={{
                      minHeight: 44,
                      borderRadius: 12,
                      border: "1px solid var(--border-color, #dbe2ea)",
                      background: "var(--input-bg, #ffffff)",
                      color: "inherit",
                      padding: "0 12px",
                    }}
                  />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className={styles.infoLabel} htmlFor="manualStart">
                        Start Time
                      </label>
                      <input
                        id="manualStart"
                        type="time"
                        value={manualEvaluationForm.start_time}
                        onChange={(event) =>
                          setManualEvaluationForm((current) => ({
                            ...current,
                            start_time: event.target.value,
                          }))
                        }
                        disabled={approvalSubmitting}
                        style={{
                          width: "100%",
                          minHeight: 44,
                          borderRadius: 12,
                          border: "1px solid var(--border-color, #dbe2ea)",
                          background: "var(--input-bg, #ffffff)",
                          color: "inherit",
                          padding: "0 12px",
                          marginTop: 8,
                        }}
                      />
                    </div>

                    <div>
                      <label className={styles.infoLabel} htmlFor="manualEnd">
                        End Time
                      </label>
                      <input
                        id="manualEnd"
                        type="time"
                        value={manualEvaluationForm.end_time}
                        onChange={(event) =>
                          setManualEvaluationForm((current) => ({
                            ...current,
                            end_time: event.target.value,
                          }))
                        }
                        disabled={approvalSubmitting}
                        style={{
                          width: "100%",
                          minHeight: 44,
                          borderRadius: 12,
                          border: "1px solid var(--border-color, #dbe2ea)",
                          background: "var(--input-bg, #ffffff)",
                          color: "inherit",
                          padding: "0 12px",
                          marginTop: 8,
                        }}
                      />
                    </div>
                  </div>

                  <label className={styles.infoLabel} htmlFor="manualMode">
                    Consultation Mode
                  </label>
                  <select
                    id="manualMode"
                    value={manualEvaluationForm.consultation_mode}
                    onChange={(event) =>
                      setManualEvaluationForm((current) => ({
                        ...current,
                        consultation_mode: event.target.value as ManualEvaluationForm["consultation_mode"],
                      }))
                    }
                    disabled={approvalSubmitting}
                    style={{
                      minHeight: 44,
                      borderRadius: 12,
                      border: "1px solid var(--border-color, #dbe2ea)",
                      background: "var(--input-bg, #ffffff)",
                      color: "inherit",
                      padding: "0 12px",
                    }}
                  >
                    <option value="In-Person">In-Person</option>
                    <option value="Online Consultation">Online Consultation</option>
                  </select>
                </div>
              </div>
            </div>

            {scheduleError && (
              <div className={styles.emptyState} style={{ marginTop: 14 }}>
                {scheduleError}
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryBtn}
                onClick={closeScheduleModal}
                disabled={approvalSubmitting}
              >
                Cancel
              </button>

              <button
                className={styles.acceptBtn}
                onClick={prepareManualScheduleApproval}
                disabled={doctorLoading || approvalSubmitting || assignableDoctors.length === 0}
              >
                Continue to Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {approvalOpen && approvalTarget && (
        <div className={styles.modalOverlay} onClick={closeApprovalModal}>
          <div
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2>Approve Appointment</h2>
                <p className={styles.pageSubtext}>
                  Review the details and send clear next-step instructions to the patient.
                </p>
              </div>

              <button
                className={styles.modalCloseBtn}
                onClick={closeApprovalModal}
                disabled={approvalSubmitting}
              >
                ×
              </button>
            </div>

            <div className={styles.dashboardGrid}>
              <div className={styles.listCard}>
                <div className={styles.listHeader}>
                  <h2>Patient Details</h2>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Patient</span>
                  <span className={styles.infoValue}>
                    {approvalTarget.patient_name || "Not provided"}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Age</span>
                  <span className={styles.infoValue}>
                    {approvalTarget.patient_age_label ||
                      approvalTarget.patient_age ||
                      "Not provided"}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Contact No.</span>
                  <span className={styles.infoValue}>
                    {approvalTarget.patient_contact || "Not provided"}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.infoValue}>
                    {approvalTarget.patient_email || "Not provided"}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Address</span>
                  <span className={styles.infoValue}>
                    {approvalTarget.patient_address || "Not provided"}
                  </span>
                </div>

                {hasGuardianInfo(approvalTarget) && (
                  <>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Minor Patient</span>
                      <span className={styles.infoValue}>
                        {approvalTarget.is_minor ? "Yes" : "No"}
                      </span>
                    </div>

                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Guardian</span>
                      <span className={styles.infoValue}>
                        {getGuardianName(approvalTarget)}
                      </span>
                    </div>

                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Relationship</span>
                      <span className={styles.infoValue}>
                        {approvalTarget.guardian_relationship || "Not provided"}
                      </span>
                    </div>

                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Guardian Contact</span>
                      <span className={styles.infoValue}>
                        {approvalTarget.guardian_contact || "Not provided"}
                      </span>
                    </div>

                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Guardian Email</span>
                      <span className={styles.infoValue}>
                        {approvalTarget.guardian_email || "Not provided"}
                      </span>
                    </div>

                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Guardian Consent</span>
                      <span className={styles.infoValue}>
                        {approvalTarget.guardian_consent ? "Provided" : "Not provided"}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className={styles.listCard}>
                <div className={styles.listHeader}>
                  <h2>Appointment Details</h2>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Service</span>
                  <span className={styles.infoValue}>
                    {approvalTarget.services ||
                      approvalSlot?.service_name ||
                      "Not provided"}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Doctor</span>
                  <span className={styles.infoValue}>
                    {approvalSlot?.doctor_name ||
                      approvalTarget.doctor_name ||
                      "To be assigned by staff"}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Schedule</span>
                  <span className={styles.infoValue}>
                    {formatDate(approvalSlot?.schedule_date || approvalTarget.date)}
                    {" · "}
                    {formatTime(approvalSlot?.start_time || approvalTarget.time)}
                    {" to "}
                    {formatTime(approvalSlot?.end_time || approvalTarget.end_time)}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Mode</span>
                  <span className={styles.infoValue}>
                    {approvalSlot?.consultation_mode ||
                      approvalTarget.consultation_mode ||
                      "In-Person"}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Concern</span>
                  <span className={styles.infoValue}>
                    {approvalTarget.concern || "Not provided"}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.listCard} style={{ marginTop: 18 }}>
              <div className={styles.listHeader}>
                <h2>Approval Instructions for Patient</h2>
              </div>

              <textarea
                value={approvalInstruction}
                onChange={(event) => setApprovalInstruction(event.target.value)}
                rows={7}
                placeholder="Write what the patient needs to do before the appointment."
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "14px",
                  border: "1px solid var(--border-color, #dbe2ea)",
                  background: "var(--input-bg, #ffffff)",
                  color: "inherit",
                  resize: "vertical",
                  fontFamily: "inherit",
                  fontSize: "14px",
                  lineHeight: 1.6,
                }}
              />

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "14px",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                <input
                  type="checkbox"
                  checked={sendApprovalEmail}
                  onChange={(event) =>
                    setSendApprovalEmail(event.target.checked)
                  }
                />
                Send this instruction to the patient by email
              </label>
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryBtn}
                onClick={closeApprovalModal}
                disabled={approvalSubmitting}
              >
                Cancel
              </button>

              <button
                className={styles.acceptBtn}
                onClick={confirmApproval}
                disabled={approvalSubmitting}
              >
                {approvalSubmitting
                  ? "Approving..."
                  : sendApprovalEmail
                    ? "Approve and Notify Patient"
                    : "Approve Appointment"}
              </button>
            </div>
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

                  {hasGuardianInfo(selectedAppointment) && (
                    <>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Minor Patient</span>
                        <span className={styles.infoValue}>
                          {selectedAppointment.is_minor ? "Yes" : "No"}
                        </span>
                      </div>

                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Guardian Name</span>
                        <span className={styles.infoValue}>
                          {getGuardianName(selectedAppointment)}
                        </span>
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

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Concern</span>
                    <span className={styles.infoValue}>
                      {selectedAppointment.concern || "Not provided"}
                    </span>
                  </div>

                  {selectedAppointment.patient_instruction && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Patient Instructions</span>
                      <span className={styles.infoValue}>
                        {selectedAppointment.patient_instruction}
                      </span>
                    </div>
                  )}

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Approval Email</span>
                    <span className={styles.infoValue}>
                      {selectedAppointment.approval_email_sent ? "Sent" : "Not sent"}
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
