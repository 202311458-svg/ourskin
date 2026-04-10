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
  const [loading, setLoading] = useState(true);

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

  const handleSave = async () => {
    if (!form) return;

    try {
      await updateDoctorSettings({
        name: form.name,
        contact: form.contact,
        profile_image: form.profile_image,
        specialty: form.specialty,
        availability: form.availability,
        bio: form.bio,
      });

      alert("Settings updated successfully");
    } catch (error) {
      console.error("Failed to update settings:", error);
      alert(error instanceof Error ? error.message : "Failed to update settings");
    }
  };

  return (
    <>
      <DoctorNavbar />
      <main className={styles.pageWrapper}>
        <div className={styles.headerSection}>
          <h1 className={styles.pageTitle}>Settings</h1>
          <p className={styles.pageSubtitle}>
            Update your doctor profile and account details.
          </p>
        </div>

        <section className={styles.sectionCard}>
          {loading || !form ? (
            <div className={styles.emptyState}>Loading settings...</div>
          ) : (
            <>
              <div className={styles.formGrid}>
                <div className={styles.inputGroup}>
                  <label>Full Name</label>
                  <input
                    className={styles.input}
                    value={form.name || ""}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Email</label>
                  <input className={styles.input} value={form.email || ""} disabled />
                </div>

                <div className={styles.inputGroup}>
                  <label>Contact</label>
                  <input
                    className={styles.input}
                    value={form.contact || ""}
                    onChange={(e) => updateField("contact", e.target.value)}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Profile Image URL</label>
                  <input
                    className={styles.input}
                    value={form.profile_image || ""}
                    onChange={(e) => updateField("profile_image", e.target.value)}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Specialty</label>
                  <input
                    className={styles.input}
                    value={form.specialty || ""}
                    onChange={(e) => updateField("specialty", e.target.value)}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Availability</label>
                  <input
                    className={styles.input}
                    value={form.availability || ""}
                    onChange={(e) => updateField("availability", e.target.value)}
                  />
                </div>

                <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                  <label>Bio</label>
                  <textarea
                    className={styles.textarea}
                    value={form.bio || ""}
                    onChange={(e) => updateField("bio", e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.buttonRow}>
                <button className={styles.saveButton} onClick={handleSave}>
                  Save Changes
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}