"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import EmptyState from "@/app/components/portal/ui/EmptyState";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import Section from "@/app/components/portal/ui/Section";
import StatCard from "@/app/components/portal/ui/StatCard";
import { changeAdminPassword, getAdminProfile, updateAdminProfile, type AdminProfile } from "@/lib/admin-phase8-api";
import styles from "./page.module.css";

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [sessionInvalidated, setSessionInvalidated] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFeedback(null);
    try {
      const data = await getAdminProfile();
      setProfile(data); setName(data.name || ""); setContact(data.contact || "");
    } catch (reason) { setFeedback({ tone: "error", text: reason instanceof Error ? reason.message : "Unable to load profile." }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { setFeedback({ tone: "error", text: "Name is required." }); return; }
    setSaving(true); setFeedback(null);
    try {
      const result = await updateAdminProfile({ name: name.trim(), contact: contact.trim() || null });
      setProfile(result.user); setName(result.user.name); setContact(result.user.contact || "");
      setFeedback({ tone: "success", text: result.message });
    } catch (reason) { setFeedback({ tone: "error", text: reason instanceof Error ? reason.message : "Unable to save profile." }); }
    finally { setSaving(false); }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault(); setFeedback(null);
    if (!currentPassword || !newPassword || !confirmPassword) { setFeedback({ tone: "error", text: "Fill in all password fields." }); return; }
    if (newPassword !== confirmPassword) { setFeedback({ tone: "error", text: "New password and confirmation do not match." }); return; }
    setPasswordSaving(true);
    try {
      const result = await changeAdminPassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setSessionInvalidated(true);
      setFeedback({ tone: "success", text: result.message || "Password updated. For security, sign in again with your new password." });
    } catch (reason) { setFeedback({ tone: "error", text: reason instanceof Error ? reason.message : "Unable to update password." }); }
    finally { setPasswordSaving(false); }
  };

  return (
    <PageShell>
      <PageHeader eyebrow="Administrator account" title="Profile & Security" description="Maintain your administrator contact information and account credentials." />
      {feedback ? <div className={feedback.tone === "error" ? styles.errorMessage : styles.successMessage} role={feedback.tone === "error" ? "alert" : "status"}>{feedback.text}</div> : null}
      {loading ? <EmptyState title="Loading profile…" /> : !profile ? <EmptyState title="Unable to load profile" description="Refresh the page to try again." /> : (
        <>
          <AdminStatsGrid compact>
            <StatCard label="Role" value="Admin" hint="Administrator access" tone="info" />
            <StatCard label="Status" value={profile.status || "Active"} hint="Current account access" tone={profile.status === "Active" ? "success" : "warning"} />
            <StatCard label="Email verification" value={profile.is_verified ? "Verified" : "Unverified"} hint={profile.email} tone={profile.is_verified ? "success" : "warning"} />
            <StatCard label="Account created" value={formatDate(profile.created_at)} hint={profile.department || "Administration"} />
          </AdminStatsGrid>
          <div className={styles.grid}>
            <Section title="Profile details" description="Email, role, and account status are controlled by the account system and cannot be changed here.">
              <form className={styles.form} onSubmit={saveProfile}>
                <label><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} disabled={saving || sessionInvalidated} /></label>
                <label><span>Contact number</span><input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Optional" disabled={saving || sessionInvalidated} /></label>
                <label><span>Email</span><input value={profile.email} disabled /></label>
                <label><span>Department</span><input value={profile.department || "Administration"} disabled /></label>
                <div className={styles.actions}><AdminActionButton tone="primary" type="submit" disabled={saving || sessionInvalidated}>{saving ? "Saving…" : "Save profile"}</AdminActionButton></div>
              </form>
            </Section>
            <Section title="Password" description="Changing your password invalidates existing authenticated sessions.">
              {sessionInvalidated ? (
                <div className={styles.sessionNotice}><strong>Password changed</strong><p>Your previous session credentials are no longer valid. Return to the sign-in screen and use your new password.</p><AdminActionButton tone="primary" onClick={() => window.location.assign("/")}>Return to sign in</AdminActionButton></div>
              ) : (
                <form className={styles.form} onSubmit={changePassword}>
                  <label><span>Current password</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={passwordSaving} /></label>
                  <label><span>New password</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={passwordSaving} /></label>
                  <label><span>Confirm new password</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={passwordSaving} /></label>
                  <div className={styles.actions}><AdminActionButton tone="primary" type="submit" disabled={passwordSaving}>{passwordSaving ? "Updating…" : "Update password"}</AdminActionButton></div>
                </form>
              )}
            </Section>
          </div>
        </>
      )}
    </PageShell>
  );
}
