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

import PatientAnnouncements from "@/app/components/PatientAnnouncements";
import PatientOnboarding from "@/app/components/PatientOnboarding";
import styles from "./page.module.css";

type HomeAction = {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  primary?: boolean;
  targetId?: string;
};

type OnboardingStep = {
  title: string;
  description: string;
  targetId?: string;
};

export default function PatientHomePage() {
  const router = useRouter();
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const onboardingSteps: OnboardingStep[] = [
    {
      title: "Welcome to your homepage",
      description:
        "This is your patient homepage. From here you can access announcements, book visits, and jump straight into your clinic tools.",
      targetId: "patient-tour-home",
    },
    {
      title: "This is your dashboard",
      description:
        "Use the Dashboard button to see upcoming appointments, follow-ups, and quick clinic updates.",
      targetId: "patient-tour-dashboard",
    },
    {
      title: "Quick booking",
      description:
        "Click Book Appointment in the sidebar to request a new visit with your preferred service.",
      targetId: "patient-tour-book",
    },
    {
      title: "Appointment history",
      description:
        "Use the Appointment History button to review past visits, approvals, and visit status.",
      targetId: "patient-tour-history",
    },
    {
      title: "Medical records",
      description:
        "Open Medical Records to review doctor notes, completed reports, and follow-up details.",
      targetId: "patient-tour-records",
    },
    {
      title: "Your profile",
      description:
        "Keep your profile information updated so the clinic has your latest contact and skin details.",
      targetId: "patient-tour-profile",
    },
  ];

  const actions: HomeAction[] = [
    {
      title: "Book Appointment",
      description: "Choose your service and request your preferred schedule.",
      href: "/pages/patient/book",
      icon: <FaPlusCircle />,
      primary: true,
      targetId: "patient-tour-book-appointment",
    },
    {
      title: "Appointment History",
      description: "Review your previous and upcoming appointment records.",
      href: "/pages/patient/history",
      icon: <FaHistory />,
      targetId: "patient-tour-appointment-history",
    },
    {
      title: "Medical Records",
      description: "Access doctor-reviewed records after completed visits.",
      href: "/pages/patient/records",
      icon: <FaFileMedical />,
      targetId: "patient-tour-medical-records",
    },
    {
      title: "Profile",
      description: "Keep your contact and patient information updated.",
      href: "/pages/patient/profile",
      icon: <FaUserCircle />,
      targetId: "patient-tour-profile",
    },
  ];

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role?.toLowerCase() !== "patient") {
      router.replace("/");
      return;
    }

    const completedOnboarding =
      localStorage.getItem("patientOnboardingCompleted") === "true";

    let onboardingTimer: number | undefined;

    if (!completedOnboarding) {
      onboardingTimer = window.setTimeout(() => {
        setShowOnboarding(true);
      }, 0);
    }

    const handleNavbarToggle = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setNavCollapsed(Boolean(customEvent.detail));
    };

    window.addEventListener("navbarToggle", handleNavbarToggle);

    return () => {
      if (onboardingTimer !== undefined) {
        window.clearTimeout(onboardingTimer);
      }

      window.removeEventListener("navbarToggle", handleNavbarToggle);
    };
  }, [router]);

  return (
    <>
      <main
        className={`${styles.pageWrapper} ${
          navCollapsed ? styles.navCollapsed : ""
        }`}
      >
        <div className={styles.contentWrapper}>
          <section id="patient-tour-home" className={styles.homeHero}>
            <div className={styles.homeHeroContent}>
              <p className={styles.eyebrow}>Patient Home</p>
              <h1 className={styles.greetingTitle}>Welcome to OurSkin</h1>
              <p className={styles.greetingSubtitle}>
                View clinic announcements, manage appointments, and access your
                patient records from one clean workspace.
              </p>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setShowOnboarding(true)}
              >
                Show patient tutorial
              </button>
            </div>

            <div className={styles.homeHeroPanel}>
              <span className={styles.homeHeroIcon}>
                <FaCalendarAlt />
              </span>

              <div>
                <p>Need a visit?</p>

                <button
                  id="patient-tour-book-now"
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
                id={action.targetId}
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

      <PatientOnboarding
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        steps={onboardingSteps}
      />
    </>
  );
}