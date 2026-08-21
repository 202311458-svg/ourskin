"use client"

import PortalShell from "@/app/components/PortalShell"
import AnnouncementManager from "@/app/components/AnnouncementManager"
import styles from "./page.module.css";

export default function AdminAnnouncementsPage() {
  return (
    <div className="staffLayout">
      <PortalShell role="admin">
      <main className={styles.pageWrapper}>
        <AnnouncementManager roleLabel="Admin" />
      </main>
      </PortalShell>
    </div>
  )
}