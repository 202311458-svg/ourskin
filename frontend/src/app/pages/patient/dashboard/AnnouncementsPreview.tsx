"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Section from "@/app/components/portal/ui/Section";
import {
  Announcement,
  getPatientVisibleAnnouncements,
} from "@/lib/AnnouncementsApi";
import styles from "./page.module.css";

export default function AnnouncementsPreview() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    let cancelled = false;

    getPatientVisibleAnnouncements()
      .then((data) => {
        if (!cancelled) setItems(data.slice(0, 2));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <Section
      title="Clinic announcements"
      description="Current notices and updates from the clinic."
      action={<Link href="/pages/patient/announcements" className={styles.textLink}>View all</Link>}
    >
      <div className={styles.announcementList}>
        {items.map((item) => (
          <Link
            href="/pages/patient/announcements"
            key={item.id}
            className={styles.announcementItem}
          >
            <div className={styles.announcementMeta}>
              <span>{item.category}</span>
              {item.is_pinned && <span>Pinned</span>}
              {item.priority !== "Normal" && <span>{item.priority}</span>}
            </div>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
          </Link>
        ))}
      </div>
    </Section>
  );
}
