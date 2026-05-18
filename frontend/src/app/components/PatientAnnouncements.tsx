"use client";

import { useEffect, useState } from "react";
import {
  Announcement,
  getPatientVisibleAnnouncements,
} from "@/lib/AnnouncementsApi";
import styles from "@/app/styles/PatientAnnouncements.module.css";

function formatDate(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function PatientAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnnouncements() {
      try {
        const data = await getPatientVisibleAnnouncements();
        setAnnouncements(data);
      } catch (error) {
        console.error("Failed to load patient announcements:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAnnouncements();
  }, []);

  if (loading) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Clinic Updates</p>
            <h2>Latest Announcements</h2>
          </div>
        </div>

        <div className={styles.loadingCard}>Loading clinic updates...</div>
      </section>
    );
  }

  if (announcements.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Clinic Updates</p>
            <h2>Latest Announcements</h2>
          </div>
        </div>

        <div className={styles.emptyCard}>
          No new clinic announcements at the moment.
        </div>
      </section>
    );
  }

  const urgentAnnouncements = announcements.filter(
    (announcement) => announcement.priority === "Urgent"
  );

  const regularAnnouncements = announcements.filter(
    (announcement) => announcement.priority !== "Urgent"
  );

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Clinic Updates</p>
          <h2>Latest Announcements</h2>
        </div>

        <span className={styles.countBadge}>
          {announcements.length} active
        </span>
      </div>

      {urgentAnnouncements.length > 0 && (
        <div className={styles.urgentStack}>
          {urgentAnnouncements.map((announcement) => (
            <article key={announcement.id} className={styles.urgentCard}>
              <div>
                <span className={styles.urgentLabel}>Urgent Advisory</span>
                <h3>{announcement.title}</h3>
                <p>{announcement.message}</p>
              </div>

              {formatDate(announcement.expires_at) && (
                <span className={styles.expiryText}>
                  Until {formatDate(announcement.expires_at)}
                </span>
              )}
            </article>
          ))}
        </div>
      )}

      <div className={styles.cardGrid}>
        {regularAnnouncements.map((announcement) => (
          <article
            key={announcement.id}
            className={`${styles.announcementCard} ${
              announcement.priority === "Important" ? styles.importantCard : ""
            }`}
          >
            <div className={styles.cardTop}>
              <span className={styles.categoryBadge}>
                {announcement.category}
              </span>

              <span
                className={`${styles.priorityBadge} ${
                  announcement.priority === "Important"
                    ? styles.priorityImportant
                    : styles.priorityNormal
                }`}
              >
                {announcement.priority}
              </span>
            </div>

            <h3>{announcement.title}</h3>
            <p>{announcement.message}</p>

            <div className={styles.cardFooter}>
              <span>Posted {formatDate(announcement.created_at)}</span>

              {formatDate(announcement.expires_at) && (
                <span>Until {formatDate(announcement.expires_at)}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}