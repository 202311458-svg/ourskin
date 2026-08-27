"use client";

import AnnouncementManager from "@/app/components/AnnouncementManager";
import styles from "./page.module.css";

export default function AdminAnnouncementsPage() {
  return (
    <main className={styles.pageWrapper}>
      <AnnouncementManager roleLabel="Admin" />
    </main>
  );
}
