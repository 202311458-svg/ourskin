"use client";

import { apiFetch } from "@/lib/api";
import { FormEvent, useEffect, useState } from "react";

type User = {
  id: number;
  name: string;
  email: string;
  contact?: string | null;
};

type Feedback = {
  kind: "error" | "success";
  message: string;
} | null;

export default function ProfileContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      try {
        const data = await apiFetch<User>("/users/me");
        if (!cancelled) setUser(data);
      } catch (error) {
        console.error("Profile fetch error:", error);
        if (!cancelled) {
          setFeedback({ kind: "error", message: "Unable to load your profile right now." });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setFeedback({ kind: "error", message: "Please fill in all password fields." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({ kind: "error", message: "New password and confirmation do not match." });
      return;
    }

    try {
      setSaving(true);
      const data = await apiFetch<{ message?: string }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      setFeedback({
        kind: "success",
        message: data?.message || "Password updated successfully.",
      });
      setShowPasswordForm(false);
      resetPasswordForm();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Password update failed.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="pageWrapper" aria-busy={loading}>
      <h1>Account Profile &amp; Security</h1>
      <p>Review your account details and update your password securely.</p>

      {feedback && (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          style={{
            padding: "12px 14px",
            borderRadius: "10px",
            margin: "16px 0",
            border: "1px solid currentColor",
          }}
        >
          {feedback.message}
        </p>
      )}

      {loading ? (
        <p role="status">Loading profile…</p>
      ) : !user ? (
        <p>Unable to load profile.</p>
      ) : (
        <section className="profileCard" aria-labelledby="account-details-heading">
          <h2 id="account-details-heading">Account details</h2>
          <dl>
            <div>
              <dt><strong>Name</strong></dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt><strong>Email</strong></dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt><strong>Phone</strong></dt>
              <dd>{user.contact || "Not provided"}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setShowPasswordForm((value) => !value);
              if (showPasswordForm) resetPasswordForm();
            }}
            className="mainBtn"
            aria-expanded={showPasswordForm}
            aria-controls="password-change-form"
            style={{ marginTop: "15px" }}
          >
            {showPasswordForm ? "Cancel password change" : "Change password"}
          </button>

          {showPasswordForm && (
            <form
              id="password-change-form"
              onSubmit={changePassword}
              style={{ marginTop: "20px", maxWidth: "520px" }}
            >
              <label htmlFor="current-password"><strong>Current password</strong></label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="formInput"
                disabled={saving}
              />

              <label htmlFor="new-password"><strong>New password</strong></label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="formInput"
                disabled={saving}
              />

              <label htmlFor="confirm-password"><strong>Confirm new password</strong></label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="formInput"
                disabled={saving}
              />

              <button
                type="submit"
                className="mainBtn"
                style={{ marginTop: "15px" }}
                disabled={saving}
              >
                {saving ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
