"use client"

import AnnouncementManager from "@/app/components/AnnouncementManager"
import DoctorNavbar from "@/app/components/DoctorNavbar"
import styles from "@/app/styles/doctor.module.css"

export default function DoctorAnnouncementsPage() {
  return (
    <>
      <DoctorNavbar />

      <div className={styles.pageWrapper}>
        <AnnouncementManager roleLabel="Doctor" />
      </div>
    </>
  )
}