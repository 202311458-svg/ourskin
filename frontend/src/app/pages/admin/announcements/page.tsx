"use client"

import AdminNavbar from "@/app/components/AdminNavbar"
import AnnouncementManager from "@/app/components/AnnouncementManager"
import styles from "@/app/styles/admin.module.css"

export default function AdminAnnouncementsPage() {
  return (
    <div className="staffLayout">
      <AdminNavbar />

      <main className={`staffContent ${styles.pageWrapper}`}>
        <AnnouncementManager roleLabel="Admin" />
      </main>
    </div>
  )
}