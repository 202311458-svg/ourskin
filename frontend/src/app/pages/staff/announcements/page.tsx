"use client"

import AnnouncementManager from "@/app/components/AnnouncementManager"
import StaffNavbar from "@/app/components/StaffNavbar"
import styles from "@/app/styles/staff.module.css"

export default function StaffAnnouncementsPage() {
  return (
    <div className="staffLayout">
      <StaffNavbar />

      <main className="staffContent">
        <div className={styles.staffPage}>
          <AnnouncementManager roleLabel="Staff" />
        </div>
      </main>
    </div>
  )
}