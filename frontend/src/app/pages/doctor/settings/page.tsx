"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import styles from "@/app/styles/doctor.module.css";
import {
  getDoctorSettings,
  updateDoctorSettings,
  type DoctorSettings,
} from "@/lib/doctor-api";

export default function DoctorSettingsPage() {
  const router = useRouter();

  const [form, setForm] = useState<DoctorSettings | null>(null);
  const [originalForm, setOriginalForm] = useState<DoctorSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "doctor") {
      router.push("/");
      return;
    }

    const load = async () => {
      try {
        const data = await getDoctorSettings();
        setForm(data);
        setOriginalForm(data);
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const updateField = (key: keyof DoctorSettings, value: string) => {
    if (!form) return;
    setForm({ ...form, [key]: value });
  };

  const handleEditProfile = () => {
    setIsEditingProfile(true);
  };

  const handleCancelEdit = () => {
    if (originalForm) {
      setForm(originalForm);
    }
    setIsEditingProfile(false);
  };

  const handleSave = async () => {
    if (!form) return;

    try {
      await updateDoctorSettings({
        name: form.name,
        contact: form.contact,
        profile_image: form.profile_image,
        specialty: form.specialty,
        availability: form.availability,
      });

      setOriginalForm(form);
      setIsEditingProfile(false);
      alert("Profile updated successfully");
    } catch (error) {
      console.error("Failed to update settings:", error);
      alert(error instanceof Error ? error.message : "Failed to update settings");
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    const token = localStorage.getItem("token");

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
      });

      const data = await res.json();

      if (res.ok) {
        alert("Password updated successfully");
        setShowPasswordForm(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        alert(data.detail || "Password update failed");
      }
    } catch (error) {
      console.error("Failed to change password:", error);
      alert("Something went wrong while changing password");
    }
  };

  const cancelPasswordChange = () => {
    setShowPasswordForm(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <>
      <DoctorNavbar />

      <main className={styles.pageWrapper}>
        <div className={styles.settingsContainer}>
          <div className={styles.headerSection}>
            <h1 className={styles.pageTitle}>Settings</h1>
            <p className={styles.pageSubtitle}>
              Update your doctor profile and account details.
            </p>
          </div>

          <section className={`${styles.sectionCard} ${styles.compactSettingsCard}`}>
            {loading || !form ? (
              <div className={styles.emptyState}>Loading settings...</div>
            ) : (
              <>
                <div className={`${styles.formGrid} ${styles.compactFormGrid}`}>
                  <div className={styles.inputGroup}>
                    <label>Full Name</label>
                    <input
                      className={`${styles.input} ${
                        !isEditingProfile ? styles.readOnlyInput : ""
                      }`}
                      value={form.name || ""}
                      readOnly={!isEditingProfile}
                      onChange={(e) => updateField("name", e.target.value)}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Email</label>
                    <input
                      className={`${styles.input} ${styles.readOnlyInput}`}
                      value={form.email || ""}
                      disabled
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Contact</label>
                    <input
                      className={`${styles.input} ${
                        !isEditingProfile ? styles.readOnlyInput : ""
                      }`}
                      value={form.contact || ""}
                      readOnly={!isEditingProfile}
                      onChange={(e) => updateField("contact", e.target.value)}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Profile Image URL</label>
                    <input
                      className={`${styles.input} ${
                        !isEditingProfile ? styles.readOnlyInput : ""
                      }`}
                      value={form.profile_image || ""}
                      readOnly={!isEditingProfile}
                      onChange={(e) => updateField("profile_image", e.target.value)}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Specialty</label>
                    <input
                      className={`${styles.input} ${
                        !isEditingProfile ? styles.readOnlyInput : ""
                      }`}
                      value={form.specialty || ""}
                      readOnly={!isEditingProfile}
                      onChange={(e) => updateField("specialty", e.target.value)}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Availability</label>
                    <input
                      className={`${styles.input} ${
                        !isEditingProfile ? styles.readOnlyInput : ""
                      }`}
                      value={form.availability || ""}
                      readOnly={!isEditingProfile}
                      onChange={(e) => updateField("availability", e.target.value)}
                    />
                  </div>
                </div>

                <div className={`${styles.buttonRow} ${styles.compactActions}`}>
                  {!isEditingProfile ? (
                    <button className={styles.saveButton} onClick={handleEditProfile}>
                      Edit Profile
                    </button>
                  ) : (
                    <>
                      <button className={styles.saveButton} onClick={handleSave}>
                        Save Changes
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>

                <div className={styles.securityBlock}>
                  {!showPasswordForm ? (
                    <button
                      className={styles.saveButton}
                      onClick={() => setShowPasswordForm(true)}
                    >
                      Change Password
                    </button>
                  ) : (
                    <>
                      <div className={`${styles.formGrid} ${styles.compactFormGrid}`}>
                        <div className={styles.inputGroup}>
                          <label>Current Password</label>
                          <input
                            type="password"
                            className={styles.input}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                          />
                        </div>

                        <div className={styles.inputGroup}>
                          <label>New Password</label>
                          <input
                            type="password"
                            className={styles.input}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                          />
                        </div>

                        <div className={styles.inputGroup}>
                          <label>Confirm New Password</label>
                          <input
                            type="password"
                            className={styles.input}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className={`${styles.buttonRow} ${styles.compactActions}`}>
                        <button className={styles.saveButton} onClick={handleChangePassword}>
                          Update Password
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={cancelPasswordChange}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

