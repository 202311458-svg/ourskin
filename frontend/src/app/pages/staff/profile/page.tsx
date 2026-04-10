"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import StaffNavbar from "@/app/components/StaffNavbar"
import styles from "@/app/styles/staff.module.css"

type StaffProfile = {
  id?: number
  name?: string
  email?: string
  role?: string
  status?: string
  contact?: string | null
  created_at?: string
}

export default function StaffProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<StaffProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not available"

    const date = new Date(dateString)

    if (Number.isNaN(date.getTime())) return "Not available"

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const loadProfile = useCallback(async () => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch("http://127.0.0.1:8000/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error("Failed to fetch profile")
      }

      setProfile(data)
    } catch (err) {
      console.error("Profile load failed:", err)
      setError("Unable to load profile details.")
      setProfile(null)
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

    loadProfile()
  }, [loadProfile, router])

  return (
    <div className="staffLayout">
      <StaffNavbar />

      <div className="staffContent">
        <div className={styles.staffPage}>
          <div className={styles.dashboardHeader}>
            <div>
              <h1>Profile</h1>
              <p className={styles.pageSubtext}>
                View your staff account details and portal access information.
              </p>
            </div>

            <button className={styles.secondaryBtn} onClick={loadProfile}>
              Refresh
            </button>
          </div>

          {loading ? (
            <div className={styles.emptyState}>Loading profile...</div>
          ) : error ? (
            <div className={styles.emptyState}>{error}</div>
          ) : !profile ? (
            <div className={styles.emptyState}>No profile details found.</div>
          ) : (
            <div className={styles.dashboardGrid}>
              <div className={styles.listCard}>
                <div className={styles.listHeader}>
                  <h2>Account Information</h2>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Full Name</span>
                  <span className={styles.infoValue}>{profile.name || "Not available"}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.infoValue}>{profile.email || "Not available"}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Contact</span>
                  <span className={styles.infoValue}>
                    {profile.contact || "Not available"}
                  </span>
                </div>
              </div>

              <div className={styles.listCard}>
                <div className={styles.listHeader}>
                  <h2>Portal Access</h2>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Role</span>
                  <span className={styles.infoValue}>{profile.role || "Not available"}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Status</span>
                  <span className={styles.infoValue}>{profile.status || "Not available"}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Member Since</span>
                  <span className={styles.infoValue}>
                    {formatDate(profile.created_at)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}