"use client";

import Navbar from "@/app/components/Navbar";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FaCalendarAlt, FaClock, FaCheckCircle } from "react-icons/fa";
import styles from "./dashboard.module.css";

export default function PatientDashboard() {
  const router = useRouter();
  const [patientName, setPatientName] = useState("");
  const [navCollapsed, setNavCollapsed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("http://127.0.0.1:8000/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setPatientName(data.name));

    const handleNavbarToggle = (e: any) => setNavCollapsed(e.detail);
    window.addEventListener("navbarToggle", handleNavbarToggle);
    return () => window.removeEventListener("navbarToggle", handleNavbarToggle);
  }, []);

  const latestAppointments = [
    { doctor: "Dr. Cecilia Roxas-Rosete", specialty: "Lead Dermatologist", date: "2026-03-16" },
    { doctor: "Dr. Raisa Rosete", specialty: "Dermatologist", date: "2026-03-16" },
    { doctor: "Dr. Reinier Rosete", specialty: "Cosmetic Surgeon", date: "2025-10-10" },
  ];

  const upcomingAppointment = {
    doctor: "Dr. Cecilia Roxas-Rosete",
    specialty: "Lead Dermatologist",
    date: "2026-03-16",
    time: "2:30 PM",
    note: "Follow-up on previous consultation",
    photo: "/cecilia.png",
  };

  // Filter appointments for today
  const today = new Date().toISOString().split("T")[0];
  const upcomingAppointmentsToday = latestAppointments.filter(appt => appt.date >= today);

  return (
    <>
      <Navbar />
      <main className={`${styles.pageWrapper} ${navCollapsed ? styles.navCollapsed : ""}`}>

        {/* GREETING */}
        <section className={styles.greetingSection}>
          <h1 className={styles.greetingTitle}>
            Hello, {patientName || "Patient"} 👋
          </h1>
          <p className={styles.greetingSubtitle}>
            You have {upcomingAppointmentsToday.length} appointment{upcomingAppointmentsToday.length !== 1 ? "s" : ""} today
          </p>
        </section>

        {/* DASHBOARD GRID */}
        <section className={styles.dashboardGrid}>

          {/* LEFT COLUMN */}
          <div className={styles.leftColumn}>

            {/* Summary Cards */}
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <FaCalendarAlt className={styles.summaryIcon} />
                <div>
                  <h3>Total Appointments</h3>
                  <p>{latestAppointments.length + 1}</p>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <FaClock className={styles.summaryIcon} />
                <div>
                  <h3>Upcoming</h3>
                  <p>{upcomingAppointmentsToday.length}</p>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <FaCheckCircle className={styles.summaryIcon} />
                <div>
                  <h3>Completed</h3>
                  <p>{latestAppointments.length}</p>
                </div>
              </div>
            </div>

            {/* Latest Appointments */}
            <div className={styles.card}>
              <h3>Recent Appointments</h3>
              <ul className={styles.appointmentList}>
                {latestAppointments
                  .filter(appt => appt.date < today)
                  .map((appt, idx) => (
                    <li key={idx} className={styles.appointmentItem}>
                      <span className={styles.appointmentDoctor}>{appt.doctor}</span>
                      <span className={styles.appointmentSpecialty}>({appt.specialty})</span>
                      <span className={styles.appointmentDate}>{appt.date}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className={styles.rightColumn}>

            {/* Upcoming Appointment Highlight */}
            <div className={styles.cardHighlight}>
              <h3>Upcoming Appointment</h3>
              <div className={styles.upcomingHighlight}>
                <div className={styles.doctorPhotoLarge}>
                  <Image
                    src={upcomingAppointment.photo}
                    alt={upcomingAppointment.doctor}
                    width={150}
                    height={150}
                  />
                </div>
                <div className={styles.upcomingTextLarge}>
                  <h2>{upcomingAppointment.doctor}</h2>
                  <p className={styles.upcomingSpecialty}>{upcomingAppointment.specialty}</p>
                  <p className={styles.upcomingDate}>{upcomingAppointment.date} | {upcomingAppointment.time}</p>
                  <p className={styles.upcomingNote}>{upcomingAppointment.note}</p>
                </div>
              </div>
            </div>

            {/* Reminder */}
            <div className={styles.card}>
              <h3>Appointment Reminder</h3>
              <p className={styles.reminderText}>
                Don&apos;t forget your upcoming appointment with {upcomingAppointment.doctor}!
              </p>
              <button className={styles.btnBook} onClick={() => router.push("/pages/patient/book")}>
                Book New Appointment
              </button>
            </div>

          </div>

        </section>
      </main>
    </>
  );
}