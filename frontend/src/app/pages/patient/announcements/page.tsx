"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import EmptyState from "@/app/components/portal/ui/EmptyState";
import {
  Announcement,
  getPatientVisibleAnnouncements,
} from "@/lib/AnnouncementsApi";
import styles from "./page.module.css";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently posted";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function PatientAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getPatientVisibleAnnouncements();
        if (!cancelled) setAnnouncements(data);
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Unable to load announcements.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageShell className={styles.page}>
      <PageHeader
        eyebrow="Clinic updates"
        title="Announcements"
        description="Read current clinic notices, service updates, health advisories, reminders, and other patient updates."
      />

      {loading ? (
        <EmptyState title="Loading announcements..." />
      ) : error ? (
        <div className={styles.error} role="alert">{error}</div>
      ) : announcements.length === 0 ? (
        <EmptyState
          title="No clinic announcements right now"
          description="Current clinic updates will appear here when staff publishes them."
        />
      ) : (
        <div className={styles.list}>
          {announcements.map((announcement) => (
            <article
              key={announcement.id}
              className={`${styles.card} ${
                announcement.priority === "Urgent" ? styles.urgent : ""
              }`}
            >
              <div className={styles.topRow}>
                <div className={styles.badges}>
                  {announcement.is_pinned && <span className={styles.pinned}>Pinned</span>}
                  <span className={styles.category}>{announcement.category}</span>
                  {announcement.priority !== "Normal" && (
                    <span className={styles.priority}>{announcement.priority}</span>
                  )}
                </div>
                <time className={styles.date}>{formatDate(announcement.created_at)}</time>
              </div>

              <h2>{announcement.title}</h2>
              <p>{announcement.message}</p>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
