"use client";

import { useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";

type User = {
  id: number;
  name: string;
  email: string;
  contact: string;
};

export default function ProfilePage() {

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    fetch("http://127.0.0.1:8000/users/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setUser(data);
      });
  }, []);

  const changePassword = async () => {

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match")
      return
    }

    const token = localStorage.getItem("token")

    const res = await fetch("http://127.0.0.1:8000/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword
      })
    })

    const data = await res.json()

    if (res.ok) {
      alert("Password updated successfully")

      setShowPasswordForm(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } else {
      alert(data.detail || "Password update failed")
    }
  }

  return (
    <>
      <Navbar />

      <main className="pageWrapper">
        {!user ? (
          <p>Loading profile...</p>
        ) : (
          <>
            <h1>Account Profile</h1>

<div className="profileCard">

  <p><b>Name:</b> {user.name}</p>
  <p><b>Email:</b> {user.email}</p>
  <p><b>Phone:</b> {user.contact}</p>

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
    </>
  );
}