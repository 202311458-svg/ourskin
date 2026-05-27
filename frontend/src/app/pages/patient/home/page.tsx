"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaArrowRight,
  FaCalendarAlt,
  FaFileMedical,
  FaHistory,
  FaPlusCircle,
  FaUserCircle,
} from "react-icons/fa";

import Navbar from "@/app/components/Navbar";
import PatientAnnouncements from "@/app/components/PatientAnnouncements";
import styles from "@/app/styles/patient.module.css";

type HomeAction = {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  primary?: boolean;
};

export default function PatientHomePage() {
  const router = useRouter();
  const [navCollapsed, setNavCollapsed] = useState(false);

  const actions: HomeAction[] = [
    {
      title: "Book Appointment",
      description: "Choose your service and request your preferred schedule.",
      href: "/pages/patient/book",
      icon: <FaPlusCircle />,
      primary: true,
    },
    {
      title: "Appointment History",
      description: "Review your previous and upcoming appointment records.",
      href: "/pages/patient/history",
      icon: <FaHistory />,
    },
    {
      title: "Medical Records",
      description: "Access doctor-reviewed records after completed visits.",
      href: "/pages/patient/records",
      icon: <FaFileMedical />,
    },
    {
      title: "Profile",
      description: "Keep your contact and patient information updated.",
      href: "/pages/patient/profile",
      icon: <FaUserCircle />,
    },
  ];

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role?.toLowerCase() !== "patient") {
      router.replace("/");
      return;
    }

    const handleNavbarToggle = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setNavCollapsed(Boolean(customEvent.detail));
    };

    window.addEventListener("navbarToggle", handleNavbarToggle);

    return () => {
      window.removeEventListener("navbarToggle", handleNavbarToggle);
    };
  }, [router]);

  return (
    <>
      <Navbar />

      <main
        className={`${styles.pageWrapper} ${
          navCollapsed ? styles.navCollapsed : ""
        }`}
      >
        <div className={styles.contentWrapper}>
          <section className={styles.homeHero}>
            <div className={styles.homeHeroContent}>
              <p className={styles.eyebrow}>Patient Home</p>
              <h1 className={styles.greetingTitle}>Welcome to OurSkin</h1>
              <p className={styles.greetingSubtitle}>
                View clinic announcements, manage appointments, and access your
                patient records from one clean workspace.
              </p>
            </div>

            <div className={styles.homeHeroPanel}>
              <span className={styles.homeHeroIcon}>
                <FaCalendarAlt />
              </span>
              <div>
                <p>Need a visit?</p>
                <button
                  type="button"
                  onClick={() => router.push("/pages/patient/book")}
                >
                  Book now <FaArrowRight />
                </button>
              </div>
            </div>
          </section>

          <section className={styles.homeActionGrid}>
            {actions.map((action) => (
              <button
                key={action.title}
                type="button"
                className={`${styles.homeActionCard} ${
                  action.primary ? styles.homeActionPrimary : ""
                }`}
                onClick={() => router.push(action.href)}
              >
                <span className={styles.homeActionIcon}>{action.icon}</span>

                <span className={styles.homeActionText}>
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>

                <FaArrowRight className={styles.homeActionArrow} />
              </button>
            ))}
          </section>

          <section className={styles.homeAnnouncementsPanel}>
            <PatientAnnouncements />
          </section>
        </div>
      </main>
    </>
  );
}