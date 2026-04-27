"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DoctorNavbar from "@/app/components/DoctorNavbar"
import styles from "@/app/styles/profile.module.css"
import { getDoctorSettings, type DoctorSettings } from "@/lib/doctor-api"

export default function DoctorSettingsPage() {
  const router = useRouter()

  const [form, setForm] = useState<DoctorSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [collapsed, setCollapsed] = useState(false)

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [updatingPassword, setUpdatingPassword] = useState(false)

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const data = await getDoctorSettings()
      setForm(data)
    } catch (err) {
      console.error("Failed to load doctor profile:", err)
      setError("Unable to load doctor profile details.")
      setForm(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem("token")
    const role = localStorage.getItem("role")

    if (!token || role !== "doctor") {
      router.push("/")
      return
    }

    loadProfile()
  }, [loadProfile, router])

  useEffect(() => {
    const sync = () => {
      setCollapsed(document.body.classList.contains("navCollapsed"))
    }

    sync()
    window.addEventListener("navbarToggle", sync)

    return () => window.removeEventListener("navbarToggle", sync)
  }, [])

  const resetPasswordForm = () => {
    setShowPasswordForm(false)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setShowCurrent(false)
    setShowNew(false)
    setShowConfirm(false)
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
        throw new Error(data.detail || "Password update failed.")
      }

      alert("Password updated successfully.")
      resetPasswordForm()
    } catch (err) {
      console.error("Password change failed:", err)
      alert(err instanceof Error ? err.message : "Password update failed.")
    } finally {
      setUpdatingPassword(false)
    }
  }

  const displayName = form?.name || "Doctor User"
  const firstLetter = displayName.charAt(0).toUpperCase()
  const profileImage = form?.profile_image || null

  return (
    <>
      <DoctorNavbar />

      <main className={`${styles.page} ${collapsed ? styles.collapsed : ""}`}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>Doctor Profile</h1>
            <p>View your account details and manage your login security</p>
          </div>

          {loading ? (
            <p>Loading...</p>
          ) : error ? (
            <p>{error}</p>
          ) : !form ? (
            <p>Unable to load profile.</p>
          ) : (
            <div className={styles.grid}>
              <div className={styles.cardLarge}>
                <div className={styles.profileHeader}>
                  <div className={styles.photoWrapper}>
                    {profileImage ? (
                      <img
                        src={profileImage}
                        className={styles.profilePhoto}
                        alt="Doctor profile"
                      />
                    ) : (
                      <div className={styles.avatar}>{firstLetter}</div>
                    )}
                  </div>

                  <div>
                    <h2>{displayName}</h2>
                    <p className={styles.subText}>Doctor Account</p>
                  </div>
                </div>

                <div className={styles.divider}></div>

                <div className={styles.infoBlock}>
                  <div className={styles.infoRow}>
                    <span>Full Name</span>
                    <span>{form.name || "Not available"}</span>
                  </div>

                  <div className={styles.infoRow}>
                    <span>Email</span>
                    <span>{form.email || "Not available"}</span>
                  </div>

                  <div className={styles.infoRow}>
                    <span>Contact</span>
                    <span>{form.contact || "Not provided"}</span>
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <h3>Security</h3>
                <p className={styles.smallText}>
                  Update your password to keep your doctor account protected.
                </p>

                <button
                  className={styles.primaryBtn}
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                >
                  {showPasswordForm ? "Hide Password Form" : "Change Password"}
                </button>

                {showPasswordForm && (
                  <div className={styles.form}>
                    <div className={styles.inputGroup}>
                      <input
                        type={showCurrent ? "text" : "password"}
                        placeholder="Current Password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />

                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                      >
                        {showCurrent ? "Hide" : "Show"}
                      </button>
                    </div>

                    <div className={styles.inputGroup}>
                      <input
                        type={showNew ? "text" : "password"}
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />

                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                      >
                        {showNew ? "Hide" : "Show"}
                      </button>
                    </div>

                    <div className={styles.inputGroup}>
                      <input
                        type={showConfirm ? "text" : "password"}
                        placeholder="Confirm New Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />

                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                      >
                        {showConfirm ? "Hide" : "Show"}
                      </button>
                    </div>

                    <button
                      className={styles.primaryBtn}
                      onClick={handleChangePassword}
                      disabled={updatingPassword}
                    >
                      {updatingPassword ? "Updating..." : "Update Password"}
                    </button>

                    <button
                      className={styles.primaryBtn}
                      type="button"
                      onClick={resetPasswordForm}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}