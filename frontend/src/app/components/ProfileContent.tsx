"use client";

import { useEffect, useState } from "react";

type User = {
  id: number;
  name: string;
  email: string;
  contact: string;
};

export default function ProfileContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          alert("No token found. Please log in again.");
          return;
        }

        const res = await fetch("http://127.0.0.1:8000/users/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch profile");
        }

        const data = await res.json();
        setUser(data);
      } catch (error) {
        console.error("Profile fetch error:", error);
        alert("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
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
        alert("Password updated successfully.");

        setShowPasswordForm(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        alert(data.detail || "Password update failed.");
      }
    } catch (error) {
      console.error("Change password error:", error);
      alert("Something went wrong while updating password.");
    }
  };

  return (
    <main className="pageWrapper">
      {loading ? (
        <p>Loading profile...</p>
      ) : !user ? (
        <p>Unable to load profile.</p>
      ) : (
        <>
          <h1>Account Profile</h1>

          <div className="profileCard">
            <p><b>Name:</b> {user.name}</p>
            <p><b>Email:</b> {user.email}</p>
            <p><b>Phone:</b> {user.contact || "N/A"}</p>

            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="mainBtn"
              style={{ marginTop: "15px" }}
            >
              {showPasswordForm ? "Cancel" : "Change Password"}
            </button>

            {showPasswordForm && (
              <div style={{ marginTop: "20px" }}>
                <input
                  type="password"
                  placeholder="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="formInput"
                />

                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="formInput"
                />

                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="formInput"
                />

                <button
                  onClick={changePassword}
                  className="mainBtn"
                  style={{ marginTop: "15px" }}
                >
                  Update Password
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}