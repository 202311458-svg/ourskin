"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaBullhorn,
  FaCalendarAlt,
  FaFileMedical,
  FaHistory,
  FaInfoCircle,
  FaNotesMedical,
  FaPlusCircle,
  FaShieldAlt,
  FaMagic,
  FaUserCircle,
} from "react-icons/fa";

import Navbar from "@/app/components/Navbar";
import PatientAnnouncements from "@/app/components/PatientAnnouncements";
import styles from "@/app/styles/patient.module.css";

type Promo = {
  title: string;
  description: string;
};

const promos: Promo[] = [
  {
    title: "Skin Consultation",
    description:
      "Book a consultation to receive a professional assessment and personalised skin care guidance.",
  },
  {
    title: "Acne Care Support",
    description:
      "Get proper skin evaluation and treatment planning for acne-related concerns.",
  },
];

export default function PatientHomePage() {
  const router = useRouter();
  const [navCollapsed, setNavCollapsed] = useState(false);

  useEffect(() => {
    const updateCollapsedState = () => {
      setNavCollapsed(document.body.classList.contains("navCollapsed"));
    };

    updateCollapsedState();

    const handleNavbarToggle = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setNavCollapsed(Boolean(customEvent.detail));
    };

    window.addEventListener("navbarToggle", handleNavbarToggle);

    return () => {
      window.removeEventListener("navbarToggle", handleNavbarToggle);
    };
  }, []);

  return (
    <>
      <Navbar />

      <main
        className={`${styles.pageWrapper} ${
          navCollapsed ? styles.navCollapsed : ""
        }`}
      >
        <div className={styles.contentWrapper}>
          <section className={styles.greetingSection}>
            <p className={styles.eyebrow}>OurSkin Patient Portal</p>
            <h1 className={styles.greetingTitle}>Welcome to OurSkin</h1>
            <p className={styles.greetingSubtitle}>
              Your personal space for clinic updates, appointment reminders,
              service information, and quick access to your dermatology care.
            </p>
          </section>

          <section className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <div className={styles.summaryIcon}>
                <FaBullhorn />
              </div>
              <div>
                <h3>Announcements</h3>
                <p>Clinic updates</p>
              </div>
            </article>

            <article className={styles.summaryCard}>
              <div className={styles.summaryIcon}>
                <FaMagic />
              </div>
              <div>
                <h3>Promos</h3>
                <p>Featured services</p>
              </div>
            </article>

            <article className={styles.summaryCard}>
              <div className={styles.summaryIcon}>
                <FaShieldAlt />
              </div>
              <div>
                <h3>Care Guide</h3>
                <p>Before your visit</p>
              </div>
            </article>
          </section>

          <section className={styles.dashboardGrid}>
            <div className={styles.leftColumn}>
              <PatientAnnouncements />

              <section className={styles.card}>
                <p className={styles.eyebrow}>Featured Services</p>
                <h2 className={styles.cardTitle}>Promos and Care Highlights</h2>

                <div className={styles.recentAppointmentList}>
                  {promos.map((promo) => (
                    <article
                      key={promo.title}
                      className={styles.recentAppointmentCard}
                    >
                      <div className={styles.recentAppointmentTop}>
                        <div>
                          <h3 className={styles.recentAppointmentDoctor}>
                            {promo.title}
                          </h3>
                          <p className={styles.recentAppointmentService}>
                            {promo.description}
                          </p>
                        </div>

                        <span className={styles.badgePending}>Featured</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className={styles.card}>
                <p className={styles.eyebrow}>About the Clinic</p>
                <h2 className={styles.cardTitle}>About OurSkin</h2>

                <p className={styles.emptyStateText}>
                  OurSkin Dermatology Center provides dermatology consultations,
                  skin care support, appointment management, and patient record
                  access through a secure digital portal. This page keeps you
                  updated before you move to your dashboard, bookings, or medical
                  records.
                </p>

                <div className={styles.noticeBox}>
                  <strong>Friendly reminder:</strong> Medical information shown
                  in your portal is based on your completed appointments and
                  doctor-reviewed records.
                </div>
              </section>
            </div>

            <aside className={styles.rightColumn}>
              <section className={styles.cardHighlight}>
                <p className={styles.eyebrow}>Quick Actions</p>
                <h2 className={styles.cardTitle}>What would you like to do?</h2>

                <div className={styles.recentAppointmentList}>
                  <button
                    type="button"
                    className={styles.btnBook}
                    onClick={() => router.push("/pages/patient/book")}
                  >
                    <FaPlusCircle /> Book Appointment
                  </button>

                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => router.push("/pages/patient/records")}
                  >
                    <FaNotesMedical /> View Medical Records
                  </button>

                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => router.push("/pages/patient/history")}
                  >
                    <FaHistory /> View Appointment History
                  </button>

                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => router.push("/pages/patient/profile")}
                  >
                    <FaUserCircle /> Update Profile
                  </button>
                </div>
              </section>

              <section className={styles.card}>
                <p className={styles.eyebrow}>Before Your Visit</p>
                <h2 className={styles.cardTitle}>Patient Reminders</h2>

                <div className={styles.recordFields}>
                  <div className={styles.recordField}>
                    <p className={styles.recordLabel}>
                      <FaCalendarAlt /> Schedule
                    </p>
                    <p className={styles.recordValue}>
                      Check your confirmed appointment date and time before
                      visiting the clinic.
                    </p>
                  </div>

                  <div className={styles.recordField}>
                    <p className={styles.recordLabel}>
                      <FaFileMedical /> Records
                    </p>
                    <p className={styles.recordValue}>
                      Review your medical records after completed appointments
                      and doctor assessment.
                    </p>
                  </div>

                  <div className={styles.recordField}>
                    <p className={styles.recordLabel}>
                      <FaInfoCircle /> Preparation
                    </p>
                    <p className={styles.recordValue}>
                      Prepare any concern, symptom, or skin care product details
                      you want to discuss during your appointment.
                    </p>
                  </div>
                </div>
              </section>
            </aside>
          </section>
        </div>
      </main>
    </>
  );
}