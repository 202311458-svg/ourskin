"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import PageShell from "@/app/components/portal/ui/PageShell";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import Section from "@/app/components/portal/ui/Section";
import styles from "@/app/styles/profile.module.css";

type User = {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  contact?: string | null;
  date_of_birth?: string | null;
  is_minor?: boolean | null;
  address?: string | null;
  guardian_first_name?: string | null;
  guardian_last_name?: string | null;
  guardian_relationship?: string | null;
  guardian_contact?: string | null;
  guardian_email?: string | null;
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const display = (value?: string | null) => value?.trim() || "Not provided";
  const firstName = user?.first_name || user?.name?.trim().split(" ")[0] || "Not provided";
  const lastName = user?.last_name || user?.name?.trim().split(" ").slice(1).join(" ") || "Not provided";
  const fullName = user?.name || `${firstName} ${lastName}`.replace(/Not provided/g, "").trim() || "Patient";

  const birthDate = useMemo(() => {
    if (!user?.date_of_birth) return null;
    const value = new Date(user.date_of_birth);
    return Number.isNaN(value.getTime()) ? null : value;
  }, [user?.date_of_birth]);

  const ageLabel = useMemo(() => {
    if (!birthDate) return "Not provided";
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    const birthdayPassed = today.getMonth() > birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
    if (!birthdayPassed) years -= 1;
    return `${years} ${years === 1 ? "year" : "years"} old`;
  }, [birthDate]);

  const formattedBirthDate = birthDate?.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }) || "Not provided";

  useEffect(() => {
    fetch(`${API_BASE_URL}/users/me`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load profile");
        return res.json();
      })
      .then((data: User) => setUser(data))
      .catch((error) => {
        console.error(error);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const changePassword = async () => {
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

    try {
      const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Failed to update password.");
      }

      setPasswordMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Failed to update password.");
    }
  };

  return (
    <PageShell className={styles.page}>
      <PageHeader
        eyebrow="Patient portal"
        title="Profile"
        description="Review your registered patient information and manage account security."
      />

      {loading ? (
        <div className={styles.state}>Loading profile...</div>
      ) : !user ? (
        <div className={styles.state}>Unable to load profile.</div>
      ) : (
        <div className={styles.profileGrid}>
          <Section title="Patient information" description="These details are used by the clinic to identify your patient record.">
            <div className={styles.identityRow}>
              <div className={styles.avatar}>{fullName.charAt(0).toUpperCase()}</div>
              <div>
                <h2>{fullName}</h2>
                <p>Registered patient profile</p>
              </div>
            </div>

            <div className={styles.infoGrid}>
              <InfoItem label="First name" value={firstName} />
              <InfoItem label="Last name" value={lastName} />
              <InfoItem label="Date of birth" value={formattedBirthDate} meta={ageLabel} />
              <InfoItem label="Email" value={display(user.email)} />
              <InfoItem label="Contact number" value={display(user.contact)} />
              <InfoItem label="Address" value={display(user.address)} wide />
            </div>

            <div className={styles.supportNote}>
              <strong>Need to correct something?</strong>
              <span>Contact the clinic so staff can update registered patient information safely.</span>
            </div>

            {user.is_minor && (
              <div className={styles.guardianSection}>
                <div className={styles.sectionHeading}>
                  <div>
                    <h3>Guardian information</h3>
                    <p>Shown because this profile is registered for a minor patient.</p>
                  </div>
                  <span className={styles.badge}>Minor patient</span>
                </div>
                <div className={styles.infoGrid}>
                  <InfoItem label="Guardian first name" value={display(user.guardian_first_name)} />
                  <InfoItem label="Guardian last name" value={display(user.guardian_last_name)} />
                  <InfoItem label="Relationship" value={display(user.guardian_relationship)} />
                  <InfoItem label="Guardian contact" value={display(user.guardian_contact)} />
                  <InfoItem label="Guardian email" value={display(user.guardian_email)} wide />
                </div>
              </div>
            )}
          </Section>

          <Section title="Security" description="Change your password without changing your registered patient details.">
            {passwordMessage && <div className={styles.successMessage} role="status">{passwordMessage}</div>}
            {passwordError && <div className={styles.errorMessage} role="alert">{passwordError}</div>}

            {!showPasswordForm ? (
              <button className={styles.primaryBtn} type="button" onClick={() => setShowPasswordForm(true)}>Change password</button>
            ) : (
              <div className={styles.form}>
                <PasswordField label="Current password" value={currentPassword} onChange={setCurrentPassword} visible={showCurrent} onToggle={() => setShowCurrent(!showCurrent)} />
                <PasswordField label="New password" value={newPassword} onChange={setNewPassword} visible={showNew} onToggle={() => setShowNew(!showNew)} hint="Use at least 8 characters." />
                <PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} visible={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
                <div className={styles.formActions}>
                  <button className={styles.secondaryBtn} type="button" onClick={() => { setShowPasswordForm(false); setPasswordError(""); }}>Cancel</button>
                  <button className={styles.primaryBtn} type="button" onClick={changePassword}>Update password</button>
                </div>
              </div>
            )}
          </Section>
        </div>
      )}
    </PageShell>
  );
}

function InfoItem({ label, value, meta, wide = false }: { label: string; value: string; meta?: string; wide?: boolean }) {
  return (
    <div className={`${styles.infoItem} ${wide ? styles.infoItemWide : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {meta && <small>{meta}</small>}
    </div>
  );
}

function PasswordField({ label, value, onChange, visible, onToggle, hint }: { label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void; hint?: string }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.inputGroup}>
        <input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={label === "Current password" ? "current-password" : "new-password"} />
        <button type="button" onClick={onToggle}>{visible ? "Hide" : "Show"}</button>
      </div>
      {hint && <small>{hint}</small>}
    </label>
  );
}
