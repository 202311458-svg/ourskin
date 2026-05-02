"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { API_BASE_URL } from "@/lib/api";
import styles from "@/app/styles/profile.module.css";

type User = {
  id?: number;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  contact?: string | null;
  contact_number?: string | null;
  date_of_birth?: string | null;
  birthdate?: string | null;
  dob?: string | null;
  is_minor?: boolean | null;

  guardian_first_name?: string | null;
  guardian_last_name?: string | null;
  guardian_relationship?: string | null;
  relationship_to_patient?: string | null;
  guardian_contact?: string | null;
  guardian_contact_number?: string | null;
  guardian_email?: string | null;
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const getDisplayValue = (value?: string | null) => {
    if (!value || value.trim() === "") return "Not provided";
    return value;
  };

  const getFirstName = (data: User | null) => {
    if (!data) return "Not provided";

    if (data.first_name) return data.first_name;

    if (data.name) {
      const parts = data.name.trim().split(" ");
      return parts[0] || "Not provided";
    }

    return "Not provided";
  };

  const getLastName = (data: User | null) => {
    if (!data) return "Not provided";

    if (data.last_name) return data.last_name;

    if (data.name) {
      const parts = data.name.trim().split(" ");
      return parts.slice(1).join(" ") || "Not provided";
    }

    return "Not provided";
  };

  const getFullName = (data: User | null) => {
    if (!data) return "Patient";

    const firstName = getFirstName(data);
    const lastName = getLastName(data);

    if (data.name) return data.name;
    if (firstName !== "Not provided" || lastName !== "Not provided") {
      return `${firstName !== "Not provided" ? firstName : ""} ${
        lastName !== "Not provided" ? lastName : ""
      }`.trim();
    }

    return "Patient";
  };

  const getBirthDate = (data: User | null) => {
    if (!data) return null;

    return data.date_of_birth || data.birthdate || data.dob || null;
  };

  const formatBirthDate = (dateValue?: string | null) => {
    if (!dateValue) return "Not provided";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "Not provided";
    }

    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const calculateAgeLabel = (dateValue?: string | null) => {
    if (!dateValue) return "Not provided";

    const birthDate = new Date(dateValue);

    if (Number.isNaN(birthDate.getTime())) {
      return "Not provided";
    }

    const today = new Date();

    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();

    const dayDiff = today.getDate() - birthDate.getDate();

    if (dayDiff < 0) {
      months -= 1;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    if (years <= 0) {
      return `${months} month${months === 1 ? "" : "s"} old`;
    }

    return `${years} year${years === 1 ? "" : "s"} old`;
  };

  const calculateIsMinor = (dateValue?: string | null) => {
    if (!dateValue) return false;

    const birthDate = new Date(dateValue);

    if (Number.isNaN(birthDate.getTime())) {
      return false;
    }

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age -= 1;
    }

    return age < 18;
  };

  const hasGuardianInfo = (data: User | null) => {
    if (!data) return false;

    return Boolean(
      data.guardian_first_name ||
        data.guardian_last_name ||
        data.guardian_relationship ||
        data.relationship_to_patient ||
        data.guardian_contact ||
        data.guardian_contact_number ||
        data.guardian_email
    );
  };

  const birthDate = useMemo(() => getBirthDate(user), [user]);

  const isMinor = useMemo(() => {
    if (!user) return false;

    return Boolean(user.is_minor) || calculateIsMinor(birthDate) || hasGuardianInfo(user);
  }, [user, birthDate]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${API_BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to load profile");
        }

        return res.json();
      })
      .then((data: User) => {
        setUser(data);
      })
      .catch((error) => {
        console.error(error);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const sync = () => {
      setCollapsed(document.body.classList.contains("navCollapsed"));
    };

    sync();
    window.addEventListener("navbarToggle", sync);

    return () => window.removeEventListener("navbarToggle", sync);
  }, []);

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("Please complete all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
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

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Failed to update password.");
      }

      alert("Password updated successfully.");

      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update password.");
    }
  };

  return (
    <>
      <Navbar />

      <main className={`${styles.page} ${collapsed ? styles.collapsed : ""}`}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>Account Profile</h1>
            <p>View your registered patient information and account security.</p>
          </div>

          {loading ? (
            <p className={styles.loadingText}>Loading profile...</p>
          ) : !user ? (
            <p className={styles.loadingText}>Unable to load profile.</p>
          ) : (
            <div className={styles.grid}>
              <div className={styles.cardLarge}>
                <div className={styles.profileHeader}>
                  <div className={styles.avatar}>
                    {getFullName(user).charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <h2>{getFullName(user)}</h2>
                    <p className={styles.subText}>
                      Patient profile information is currently read-only.
                    </p>
                  </div>
                </div>

                <div className={styles.divider}></div>

                <div className={styles.sectionBlock}>
                  <div className={styles.sectionTitleRow}>
                    <h3>Patient Information</h3>
                    <span className={styles.readOnlyBadge}>Read Only</span>
                  </div>

                  <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}>
                      <span>First Name</span>
                      <strong>{getFirstName(user)}</strong>
                    </div>

                    <div className={styles.detailItem}>
                      <span>Last Name</span>
                      <strong>{getLastName(user)}</strong>
                    </div>

                    <div className={styles.detailItem}>
                      <span>Date of Birth</span>
                      <strong>{formatBirthDate(birthDate)}</strong>
                    </div>

                    <div className={styles.detailItem}>
                      <span>Age</span>
                      <strong>{calculateAgeLabel(birthDate)}</strong>
                    </div>

                    <div className={styles.detailItem}>
                      <span>Contact Number</span>
                      <strong>
                        {getDisplayValue(user.contact_number || user.contact)}
                      </strong>
                    </div>

                    <div className={styles.detailItem}>
                      <span>Email Address</span>
                      <strong>{getDisplayValue(user.email)}</strong>
                    </div>
                  </div>
                </div>

                {isMinor && (
                  <>
                    <div className={styles.divider}></div>

                    <div className={styles.sectionBlock}>
                      <div className={styles.sectionTitleRow}>
                        <h3>Guardian Information</h3>
                        <span className={styles.guardianBadge}>Minor Patient</span>
                      </div>

                      <p className={styles.smallText}>
                        Guardian details are shown because this account is registered
                        for a patient below 18 years old.
                      </p>

                      <div className={styles.detailsGrid}>
                        <div className={styles.detailItem}>
                          <span>Guardian First Name</span>
                          <strong>
                            {getDisplayValue(user.guardian_first_name)}
                          </strong>
                        </div>

                        <div className={styles.detailItem}>
                          <span>Guardian Last Name</span>
                          <strong>
                            {getDisplayValue(user.guardian_last_name)}
                          </strong>
                        </div>

                        <div className={styles.detailItem}>
                          <span>Relationship to Patient</span>
                          <strong>
                            {getDisplayValue(
                              user.guardian_relationship ||
                                user.relationship_to_patient
                            )}
                          </strong>
                        </div>

                        <div className={styles.detailItem}>
                          <span>Guardian Contact Number</span>
                          <strong>
                            {getDisplayValue(
                              user.guardian_contact_number ||
                                user.guardian_contact
                            )}
                          </strong>
                        </div>

                        <div className={styles.detailItem}>
                          <span>Guardian Email</span>
                          <strong>{getDisplayValue(user.guardian_email)}</strong>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className={styles.card}>
                <h3>Security</h3>
                <p className={styles.smallText}>
                  You can update your password without changing your registered
                  patient information.
                </p>

                <button
                  className={styles.primaryBtn}
                  type="button"
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                >
                  {showPasswordForm ? "Cancel Password Change" : "Change Password"}
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

                      <button type="button" onClick={() => setShowNew(!showNew)}>
                        {showNew ? "Hide" : "Show"}
                      </button>
                    </div>

                    <div className={styles.inputGroup}>
                      <input
                        type={showConfirm ? "text" : "password"}
                        placeholder="Confirm Password"
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
                      type="button"
                      onClick={changePassword}
                    >
                      Update Password
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}