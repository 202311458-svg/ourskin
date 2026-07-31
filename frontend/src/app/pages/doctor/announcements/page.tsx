"use client"

import AnnouncementManager from "@/app/components/AnnouncementManager"
import DoctorNavbar from "@/app/components/DoctorNavbar"
import sharedStyles from "@/app/styles/doctor-shared.module.css"

export default function DoctorAnnouncementsPage() {
  return (
    <>
      <DoctorNavbar />

      <div className={sharedStyles.pageWrapper}>
        <AnnouncementManager roleLabel="Doctor" />
      </div>
    </>
  )
}