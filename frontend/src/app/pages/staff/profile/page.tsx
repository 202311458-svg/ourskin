"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import PageShell from "@/app/components/portal/ui/PageShell";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import Section from "@/app/components/portal/ui/Section";
import styles from "@/app/styles/profile.module.css";

type StaffProfile = {
  id?: number;
  name?: string | null;
  email?: string | null;
  contact?: string | null;
  phone?: string | null;
  phone_number?: string | null;
};

export default function StaffProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const loadProfile = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || data?.message || "Unable to load profile.");
      }
      setProfile(data);
    } catch (err) {
      console.error("Failed to load staff profile:", err);
      setError(err instanceof Error ? err.message : "Unable to load staff profile details.");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    if (!token || role !== "staff") {
      router.push("/");
      return;
    }
    loadProfile();
  }, [loadProfile, router]);

  const resetPasswordForm = () => {
    setShowPasswordForm(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setPasswordError("");
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Complete all password fields.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setPasswordError("Your session has expired. Please sign in again.");
      router.push("/");
      return;
    }

    setUpdatingPassword(true);

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
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || data?.message || "Password update failed.");
      }

      resetPasswordForm();
      setPasswordMessage("Password updated successfully.");
    } catch (err) {
      console.error("Password change failed:", err);
      setPasswordError(err instanceof Error ? err.message : "Password update failed.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const display = (value?: string | null) => value?.trim() || "Not provided";
  const displayName = profile?.name?.trim() || "Staff User";
  const phoneNumber = profile?.contact || profile?.phone || profile?.phone_number || "Not provided";

  return (
    <PageShell className={styles.page}>
      <PageHeader
        eyebrow="Staff portal"
        title="Profile"
        description="Review your registered staff information and manage account security."
      />

      {loading ? (
        <div className={styles.state}>Loading profile...</div>
      ) : error ? (
        <div className={styles.state} role="alert">
          <div>{error}</div>
          <div className={styles.stateActions}>
            <button className={styles.primaryBtn} type="button" onClick={loadProfile}>Try again</button>
          </div>
        </div>
      ) : !profile ? (
        <div className={styles.state}>Unable to load profile.</div>
      ) : (
        <div className={styles.profileGrid}>
          <Section
            title="Staff information"
            description="These details are used by the clinic to identify your staff account."
          >
            <div className={styles.identityRow}>
              <div className={styles.avatar}>{displayName.charAt(0).toUpperCase()}</div>
              <div>
                <h2>{displayName}</h2>
                <p>Registered staff profile</p>
              </div>
            </div>

            <div className={styles.infoGrid}>
              <InfoItem label="Full name" value={display(profile.name)} />
              <InfoItem label="Email" value={display(profile.email)} />
              <InfoItem label="Contact number" value={phoneNumber} />
            </div>

            <div className={styles.supportNote}>
              <strong>Need to correct something?</strong>
              <span>Contact an administrator so registered staff information can be updated safely.</span>
            </div>
          </Section>

          <Section title="Security" description="Change your password without changing your registered staff details.">
            {passwordMessage && <div className={styles.successMessage} role="status">{passwordMessage}</div>}
            {passwordError && <div className={styles.errorMessage} role="alert">{passwordError}</div>}

            {!showPasswordForm ? (
              <button className={styles.primaryBtn} type="button" onClick={() => setShowPasswordForm(true)}>
                Change password
              </button>
            ) : (
              <div className={styles.form}>
                <PasswordField
                  label="Current password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  visible={showCurrent}
                  onToggle={() => setShowCurrent(!showCurrent)}
                  autoComplete="current-password"
                />
                <PasswordField
                  label="New password"
                  value={newPassword}
                  onChange={setNewPassword}
                  visible={showNew}
                  onToggle={() => setShowNew(!showNew)}
                  autoComplete="new-password"
                  hint="Use at least 8 characters."
                />
                <PasswordField
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  visible={showConfirm}
                  onToggle={() => setShowConfirm(!showConfirm)}
                  autoComplete="new-password"
                />

                <div className={styles.formActions}>
                  <button className={styles.secondaryBtn} type="button" onClick={resetPasswordForm} disabled={updatingPassword}>
                    Cancel
                  </button>
                  <button className={styles.primaryBtn} type="button" onClick={handleChangePassword} disabled={updatingPassword}>
                    {updatingPassword ? "Updating..." : "Update password"}
                  </button>
                </div>
              </div>
            )}
          </Section>
        </div>
      )}
    </PageShell>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.inputGroup}>
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
        />
        <button type="button" onClick={onToggle}>
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint && <small>{hint}</small>}
    </label>
  );
}
