"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import StaffNavbar from "@/app/components/StaffNavbar"
import { API_BASE_URL } from "@/lib/api";
import styles from "@/app/styles/profile.module.css"

type StaffProfile = {
  id?: number
  name?: string
  email?: string
  role?: string
  status?: string
  contact?: string | null
  created_at?: string
  photo?: string | null
  profile_image?: string | null
}

export default function StaffProfilePage() {
  const router = useRouter()

  const [profile, setProfile] = useState<StaffProfile | null>(null)
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
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || "Failed to fetch profile")
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

  const profileImage = profile?.photo || profile?.profile_image || null
  const displayName = profile?.name || "Staff User"
  const firstLetter = displayName.charAt(0).toUpperCase()

  return (
    <>
      <StaffNavbar />

      <main className={`${styles.page} ${collapsed ? styles.collapsed : ""}`}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>Staff Profile</h1>
            <p>View your account details and manage your login security</p>
          </div>

          {loading ? (
            <p>Loading...</p>
          ) : error ? (
            <p>{error}</p>
          ) : !profile ? (
            <p>Unable to load profile</p>
          ) : (
            <div className={styles.grid}>
              <div className={styles.cardLarge}>
                <div className={styles.profileHeader}>
                  <div className={styles.photoWrapper}>
                    {profileImage ? (
                      <img
                        src={profileImage}
                        className={styles.profilePhoto}
                        alt="Staff profile"
                      />
                    ) : (
                      <div className={styles.avatar}>{firstLetter}</div>
                    )}
                  </div>

                  <div>
                    <h2>{displayName}</h2>
                    <p className={styles.subText}>
                      {profile.role ? `${profile.role} Account` : "Staff Account"}
                    </p>
                  </div>
                </div>

                <div className={styles.divider}></div>

                <div className={styles.infoBlock}>
                  <div className={styles.infoRow}>
                    <span>Email</span>
                    <span>{profile.email || "Not available"}</span>
                  </div>

                  <div className={styles.infoRow}>
                    <span>Contact</span>
                    <span>{profile.contact || "Not provided"}</span>
                  </div>

                  <div className={styles.infoRow}>
                    <span>Status</span>
                    <span>{profile.status || "Not available"}</span>
                  </div>


                </div>

                <button className={styles.primaryBtn} onClick={loadProfile}>
                  Refresh Profile
                </button>
              </div>

              <div className={styles.card}>
                <h3>Security</h3>
                <p className={styles.smallText}>
                  Update your password to keep your staff account protected.
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