"use client"

import PatientAnnouncements from "@/app/components/PatientAnnouncements"
import sharedStyles from "./page.module.css";

export default function DoctorAnnouncementsPage() {
  return (
    <>
      <div className={sharedStyles.pageWrapper}>
        <PatientAnnouncements />
      </div>
    </>
  )
}