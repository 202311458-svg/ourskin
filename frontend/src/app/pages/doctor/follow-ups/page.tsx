"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import styles from "@/app/styles/doctor.module.css";
import {
  createDoctorFollowUp,
  getDoctorFollowUps,
  updateDoctorFollowUp,
  type FollowUp,
} from "@/lib/doctor-api";

export default function DoctorFollowUpsPage() {
  const router = useRouter();
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  const [appointmentId, setAppointmentId] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const data = await getDoctorFollowUps();
      setItems(data);
    } catch (error) {
      console.error("Failed to load follow-ups:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "doctor") {
      router.push("/");
      return;
    }

    load();
  }, [router]);

  const handleCreate = async () => {
    try {
      await createDoctorFollowUp({
        appointment_id: Number(appointmentId),
        follow_up_date: followUpDate,
        reason,
        notes,
      });

      setAppointmentId("");
      setFollowUpDate("");
      setReason("");
      setNotes("");
      await load();
    } catch (error) {
      console.error("Failed to create follow-up:", error);
      alert(error instanceof Error ? error.message : "Failed to create follow-up");
    }
  };

  const handleMarkDone = async (id: number) => {
    try {
      await updateDoctorFollowUp(id, { status: "Completed" });
      await load();
    } catch (error) {
      console.error("Failed to update follow-up:", error);
    }
  };

  return (
    <>
      <DoctorNavbar />
      <main className={styles.pageWrapper}>
        <div className={styles.headerSection}>
          <h1 className={styles.pageTitle}>Follow-Ups</h1>
          <p className={styles.pageSubtitle}>
            Track scheduled reviews and create new follow-up items.
          </p>
        </div>

        <section className={styles.sectionCard} style={{ marginBottom: 24 }}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Create Follow-Up</h2>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.inputGroup}>
              <label>Appointment ID</label>
              <input
                className={styles.input}
                value={appointmentId}
                onChange={(e) => setAppointmentId(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Follow-Up Date</label>
              <input
                type="date"
                className={styles.input}
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>

            <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
              <label>Reason</label>
              <input
                className={styles.input}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
              <label>Notes</label>
              <textarea
                className={styles.textarea}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.buttonRow}>
            <button className={styles.saveButton} onClick={handleCreate}>
              Create Follow-Up
            </button>
          </div>
        </section>

        <section className={styles.sectionCard}>
          {loading ? (
            <div className={styles.emptyState}>Loading follow-ups...</div>
          ) : items.length === 0 ? (
            <div className={styles.emptyState}>No follow-ups found.</div>
          ) : (
            <div className={styles.list}>
              {items.map((item) => (
                <div key={item.id} className={styles.listItem}>
                  <div className={styles.listLeft}>
                    <div className={styles.listPrimary}>
                      Appointment #{item.appointment_id}
                    </div>
<div className={styles.listSecondary}>
  Doctor: {item.doctor_name || `Doctor ID ${item.doctor_id}`}
</div>
<div className={styles.listSecondary}>
  Date: {item.follow_up_date}
</div>
<div className={styles.listSecondary}>Reason: {item.reason}</div>
<div className={styles.listSecondary}>
  Notes: {item.notes || "No notes"}
</div>
                  </div>
                  <div className={styles.listRight}>
                    <span
                      className={`${styles.statusBadge} ${
                        item.status === "Completed"
                          ? styles.badgeCompleted
                          : styles.badgePending
                      }`}
                    >
                      {item.status}
                    </span>
                    {item.status !== "Completed" && (
                      <button
                        className={styles.actionButton}
                        onClick={() => handleMarkDone(item.id)}
                      >
                        Mark Done
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}