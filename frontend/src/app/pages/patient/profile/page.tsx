"use client";

import { useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";
import styles from "@/app/styles/profile.module.css";

type User = {
  name: string;
  email: string;
  contact: string;
  nickname?: string;
  photo?: string;
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [collapsed, setCollapsed] = useState(false);

  const [editMode, setEditMode] = useState(false);

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");

    fetch("http://127.0.0.1:8000/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setUser(data);
        setName(data.name);
        setNickname(data.nickname || "");
        setPhoto(data.photo || null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const sync = () => {
      setCollapsed(document.body.classList.contains("navCollapsed"));
    };

    sync();
    window.addEventListener("sidebarChange", sync);

    return () => window.removeEventListener("sidebarChange", sync);
  }, []);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    const token = localStorage.getItem("token");

    await fetch("http://127.0.0.1:8000/users/update-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        nickname,
        photo,
      }),
    });

    setEditMode(false);
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    const token = localStorage.getItem("token");

    await fetch("http://127.0.0.1:8000/auth/change-password", {
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

    setShowPasswordForm(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <>
      <Navbar />

      <main className={`${styles.page} ${collapsed ? styles.collapsed : ""}`}>
        <div className={styles.container}>

          {/* HEADER */}
          <div className={styles.header}>
            <h1>Account Profile</h1>
            <p>Manage your identity and preferences</p>
          </div>

          {loading ? (
            <p>Loading...</p>
          ) : !user ? (
            <p>Unable to load profile</p>
          ) : (
            <div className={styles.grid}>

              {/* PROFILE CARD */}
              <div className={styles.cardLarge}>

                {/* PHOTO + NAME */}
                <div className={styles.profileHeader}>

                  <div className={styles.photoWrapper}>
                    {photo ? (
                      <img src={photo} className={styles.profilePhoto} />
                    ) : (
                      <div className={styles.avatar}>
                        {name.charAt(0)}
                      </div>
                    )}

                    {editMode && (
                      <input type="file" onChange={handlePhoto} />
                    )}
                  </div>

                  <div>
                    {editMode ? (
                      <>
                        <input
                          className={styles.editInput}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Full name"
                        />

                        <input
                          className={styles.editInput}
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          placeholder="Nickname (how doctors call you)"
                        />
                      </>
                    ) : (
                      <>
                        <h2>{name}</h2>
                        <p className={styles.subText}>
                          {nickname ? `Called: ${nickname}` : "No nickname set"}
                        </p>
                      </>
                    )}
                  </div>

                </div>

                <div className={styles.divider}></div>

                <div className={styles.infoBlock}>
                  <div className={styles.infoRow}>
                    <span>Email</span>
                    <span>{user.email}</span>
                  </div>

                  <div className={styles.infoRow}>
                    <span>Contact</span>
                    <span>{user.contact || "Not provided"}</span>
                  </div>
                </div>

                <button
                  className={styles.primaryBtn}
                  onClick={() => (editMode ? saveProfile() : setEditMode(true))}
                >
                  {editMode ? "Save Changes" : "Edit Profile"}
                </button>

              </div>

              {/* SECURITY CARD */}
              <div className={styles.card}>
                <h3>Security</h3>
                <p className={styles.smallText}>
                  Update your password anytime
                </p>

                <button
                  className={styles.primaryBtn}
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                >
                  Change Password
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
                      <button onClick={() => setShowCurrent(!showCurrent)}>
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
                      <button onClick={() => setShowNew(!showNew)}>
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
                      <button onClick={() => setShowConfirm(!showConfirm)}>
                        {showConfirm ? "Hide" : "Show"}
                      </button>
                    </div>

                    <button className={styles.primaryBtn} onClick={changePassword}>
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