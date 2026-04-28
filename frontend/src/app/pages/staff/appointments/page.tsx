"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import StaffNavbar from "@/app/components/StaffNavbar"
import { API_BASE_URL } from "@/lib/api";
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

export default function StaffAppointments() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

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

  const loadAppointments = useCallback(async () => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch(`${API_BASE_URL}/appointments/confirmed`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error("Failed to fetch confirmed appointments")
      }

      setAppointments(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Confirmed appointments load failed:", err)
      setError("Unable to load confirmed appointments.")
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

    loadAppointments()
  }, [loadAppointments, router])

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => getDateTimeValue(a) - getDateTimeValue(b))
  }, [appointments])

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
              <h2>Approved Bookings</h2>
              <span className={`${styles.badge} ${styles.statusApproved}`}>
                {sortedAppointments.length} confirmed
              </span>
            </div>

            {loading ? (
              <div className={styles.emptyState}>Loading confirmed appointments...</div>
            ) : error ? (
              <div className={styles.emptyState}>{error}</div>
            ) : sortedAppointments.length === 0 ? (
              <div className={styles.emptyState}>No confirmed appointments found.</div>
            ) : (
              sortedAppointments.map((appt) => (
                <div key={appt.id} className={styles.requestCard}>
                  <div className={styles.requestInfo}>
                    <b>{appt.patient_name}</b>
                    <p>{appt.doctor_name}</p>
                    <span>
                      {formatDate(appt.date)} at {formatTime(appt.time)}
                    </span>
                    {appt.services && <p className={styles.detailText}>Service: {appt.services}</p>}
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