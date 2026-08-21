"use client"

import AnnouncementManager from "@/app/components/AnnouncementManager"
import styles from "./page.module.css";

export default function StaffAnnouncementsPage() {
  return (
    <div className="staffLayout">
      <main className="staffContent">
        <div className={styles.staffPage}>
          <AnnouncementManager roleLabel="Staff" />
        </div>
      </main>
    </div>
  )
}