"use client"

import AdminNavbar from "@/app/components/AdminNavbar"
import PortalShell from "@/app/components/PortalShell"
import AnnouncementManager from "@/app/components/AnnouncementManager"
import styles from "@/app/styles/admin.module.css"

export default function AdminAnnouncementsPage() {
  return (
    <div className="staffLayout">
      <AdminNavbar />

      <PortalShell role="admin">
      <main className={styles.pageWrapper}>
        <AnnouncementManager roleLabel="Admin" />
      </main>
      </PortalShell>
    </div>
  )
}