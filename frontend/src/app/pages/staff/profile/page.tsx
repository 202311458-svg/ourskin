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

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [updatingPassword, setUpdatingPassword] = useState(false)

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

  const resetPasswordForm = () => {
    setShowPasswordForm(false)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("Please fill in all password fields.")
      return
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.")
      return
    }

    const token = localStorage.getItem("token")

    if (!token) {
      alert("You are not logged in.")
      router.push("/")
      return
    }

    setUpdatingPassword(true)

    try {
      const res = await fetch("http://127.0.0.1:8000/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || "Password update failed")
      }

      alert("Password updated successfully.")
      resetPasswordForm()
    } catch (err) {
      console.error("Password change failed:", err)
      alert(err instanceof Error ? err.message : "Password update failed")
    } finally {
      setUpdatingPassword(false)
    }
  }

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
            <>
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

              <div className={styles.listCard} style={{ marginTop: "20px" }}>
                <div className={styles.listHeader}>
                  <h2>Security</h2>
                </div>

                {!showPasswordForm ? (
                  <button
                    className={styles.secondaryBtn}
                    onClick={() => setShowPasswordForm(true)}
                  >
                    Change Password
                  </button>
                ) : (
                  <div style={{ marginTop: "10px" }}>
                    <div style={{ display: "grid", gap: "14px" }}>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontWeight: 600,
                            marginBottom: "6px",
                          }}
                        >
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            borderRadius: "10px",
                            border: "1px solid #d1d5db",
                            outline: "none",
                          }}
                        />
                      </div>

                      <div>
                        <label
                          style={{
                            display: "block",
                            fontWeight: 600,
                            marginBottom: "6px",
                          }}
                        >
                          New Password
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            borderRadius: "10px",
                            border: "1px solid #d1d5db",
                            outline: "none",
                          }}
                        />
                      </div>

                      <div>
                        <label
                          style={{
                            display: "block",
                            fontWeight: 600,
                            marginBottom: "6px",
                          }}
                        >
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            borderRadius: "10px",
                            border: "1px solid #d1d5db",
                            outline: "none",
                          }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        marginTop: "16px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className={styles.secondaryBtn}
                        onClick={handleChangePassword}
                        disabled={updatingPassword}
                      >
                        {updatingPassword ? "Updating..." : "Update Password"}
                      </button>

                      <button
                        className={styles.secondaryBtn}
                        onClick={resetPasswordForm}
                        type="button"
                        style={{
                          background: "#e5e7eb",
                          color: "#111827",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}