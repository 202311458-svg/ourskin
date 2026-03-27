"use client";

import Navbar from "@/app/components/Navbar";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FaCalendarAlt, FaClock, FaCheckCircle } from "react-icons/fa";
import styles from "./dashboard.module.css";

type Appointment = {
  id: number;
  patient_name?: string;
  patient_email?: string;
  doctor_name?: string;
  doctor?: string;
  date: string;
  time: string;
  services: string;
  status: string;
  cancel_reason?: string | null;
};

type CurrentUser = {
  id: number;
  name: string;
  email: string;
  contact?: string;
};

const doctorImages: Record<string, string> = {
  "Reena Tagle, MD, DPDS": "/reena.png",
  "Gelaine Pangilinan, MD, MBA": "/gelaine.png",
  "Hans Alitin, MD, DPDS": "/hans.png",
  "Raisa Rosete, MD, MBA, DPDS": "/raisa.png",
  "Cecilia Roxas-Rosete, MD, FPDS": "/cecilia.png",
};

export default function PatientDashboard() {
  const router = useRouter();

  const [patientName, setPatientName] = useState("Patient");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/pages/login");
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        const userRes = await fetch("http://127.0.0.1:8000/users/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!userRes.ok) {
          throw new Error("Failed to fetch current user");
        }

        const userData: CurrentUser = await userRes.json();
        setPatientName(userData.name || "Patient");

        const appointmentsRes = await fetch(
          `http://127.0.0.1:8000/appointments/list?email=${encodeURIComponent(
            userData.email
          )}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!appointmentsRes.ok) {
          throw new Error("Failed to fetch appointments");
        }

        const appointmentsData: Appointment[] = await appointmentsRes.json();
        setAppointments(appointmentsData);
      } catch (error) {
        console.error("Error loading patient dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    const handleNavbarToggle = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setNavCollapsed(customEvent.detail);
    };

    window.addEventListener("navbarToggle", handleNavbarToggle);

    return () => {
      window.removeEventListener("navbarToggle", handleNavbarToggle);
    };
  }, [router]);

  const todayStr = new Date().toISOString().split("T")[0];

  const normalizeStatus = (status?: string) => (status || "").trim().toLowerCase();

  const combineDateTime = (date: string, time: string) => {
    return new Date(`${date}T${time}`);
  };

  const activeAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      const status = normalizeStatus(appt.status);
      return status !== "cancelled" && status !== "declined";
    });
  }, [appointments]);

  const approvedAppointments = useMemo(() => {
    return appointments.filter(
      (appt) => normalizeStatus(appt.status) === "approved"
    );
  }, [appointments]);

  const pendingAppointments = useMemo(() => {
    return appointments
      .filter((appt) => normalizeStatus(appt.status) === "pending")
      .sort(
        (a, b) =>
          combineDateTime(b.date, b.time).getTime() -
          combineDateTime(a.date, a.time).getTime()
      );
  }, [appointments]);

  const todayAppointments = useMemo(() => {
    return approvedAppointments.filter((appt) => appt.date === todayStr);
  }, [approvedAppointments, todayStr]);

  const upcomingAppointments = useMemo(() => {
    const now = new Date();

    return approvedAppointments
      .filter((appt) => combineDateTime(appt.date, appt.time) > now)
      .sort(
        (a, b) =>
          combineDateTime(a.date, a.time).getTime() -
          combineDateTime(b.date, b.time).getTime()
      );
  }, [approvedAppointments]);

  const completedAppointments = useMemo(() => {
    const now = new Date();

    return approvedAppointments
      .filter((appt) => combineDateTime(appt.date, appt.time) < now)
      .sort(
        (a, b) =>
          combineDateTime(b.date, b.time).getTime() -
          combineDateTime(a.date, a.time).getTime()
      );
  }, [approvedAppointments]);

  const nearestUpcomingAppointment =
    upcomingAppointments.length > 0 ? upcomingAppointments[0] : null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":");
    const tempDate = new Date();
    tempDate.setHours(Number(hours), Number(minutes), 0);

    return tempDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getDoctorImage = (doctorName?: string, fallbackDoctor?: string) => {
    const finalDoctorName = doctorName || fallbackDoctor || "";
    return doctorImages[finalDoctorName] || "/default-doctor.png";
  };

  return (
    <>
      <Navbar />

      <main
        className={`${styles.pageWrapper} ${
          navCollapsed ? styles.navCollapsed : ""
        }`}
      >
        <section className={styles.greetingSection}>
          <h1 className={styles.greetingTitle}>Hello, {patientName} 👋</h1>
          <p className={styles.greetingSubtitle}>
            {loading
              ? "Loading your appointments..."
              : `You have ${todayAppointments.length} appointment${
                  todayAppointments.length !== 1 ? "s" : ""
                } today`}
          </p>
        </section>

        <section className={styles.dashboardGrid}>
          <div className={styles.leftColumn}>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <FaCalendarAlt className={styles.summaryIcon} />
                <div>
                  <h3>Total Appointments</h3>
                  <p>{activeAppointments.length}</p>
                </div>
              </div>

              <div className={styles.summaryCard}>
                <FaClock className={styles.summaryIcon} />
                <div>
                  <h3>Upcoming</h3>
                  <p>{upcomingAppointments.length}</p>
                </div>
              </div>

              <div className={styles.summaryCard}>
                <FaCheckCircle className={styles.summaryIcon} />
                <div>
                  <h3>Pending Requests</h3>
                  <p>{pendingAppointments.length}</p>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h3>Recent Appointments</h3>

              {completedAppointments.length > 0 ? (
                <ul className={styles.appointmentList}>
                  {completedAppointments.slice(0, 5).map((appt) => (
                    <li key={appt.id} className={styles.appointmentItem}>
                      <span className={styles.appointmentDoctor}>
                        {appt.doctor_name || appt.doctor || "Unknown Doctor"}
                      </span>
                      <span className={styles.appointmentSpecialty}>
                        ({appt.services})
                      </span>
                      <span className={styles.appointmentDate}>
                        {formatDate(appt.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.reminderText}>
                  You don’t have any completed appointments yet. Book your first
                  consultation to get started.
                </p>
              )}
            </div>
          </div>

          <div className={styles.rightColumn}>
            <div className={styles.cardHighlight}>
              <h3>Upcoming Appointment</h3>

              {nearestUpcomingAppointment ? (
                <div className={styles.upcomingHighlight}>
                  <div className={styles.doctorPhotoLarge}>
                    <Image
                      src={getDoctorImage(
                        nearestUpcomingAppointment.doctor_name,
                        nearestUpcomingAppointment.doctor
                      )}
                      alt={
                        nearestUpcomingAppointment.doctor_name ||
                        nearestUpcomingAppointment.doctor ||
                        "Doctor"
                      }
                      width={150}
                      height={150}
                    />
                  </div>

                  <div className={styles.upcomingTextLarge}>
                    <h2>
                      {nearestUpcomingAppointment.doctor_name ||
                        nearestUpcomingAppointment.doctor ||
                        "Unknown Doctor"}
                    </h2>
                    <p className={styles.upcomingSpecialty}>
                      {nearestUpcomingAppointment.services}
                    </p>
                    <p className={styles.upcomingDate}>
                      {formatDate(nearestUpcomingAppointment.date)} |{" "}
                      {formatTime(nearestUpcomingAppointment.time)}
                    </p>
                    <p className={styles.upcomingNote}>
                      Status: {nearestUpcomingAppointment.status}
                    </p>
                  </div>
                </div>
              ) : (
                <p>No upcoming appointment scheduled.</p>
              )}
            </div>

            <div className={styles.card}>
              <h3>Pending Requests</h3>

              {pendingAppointments.length > 0 ? (
                <div className={styles.pendingList}>
                  {pendingAppointments.slice(0, 3).map((appt) => (
                    <div key={appt.id} className={styles.pendingCard}>
                      <div className={styles.pendingTopRow}>
                        <h4 className={styles.pendingDoctor}>
                          {appt.doctor_name || appt.doctor || "Unknown Doctor"}
                        </h4>
                        <span className={styles.pendingBadge}>Pending</span>
                      </div>

                      <p className={styles.pendingService}>
                        {appt.services || "Consultation"}
                      </p>

                      <p className={styles.pendingDateTime}>
                        {formatDate(appt.date)} • {formatTime(appt.time)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyStateText}>
                  You don’t have any pending requests right now.
                </p>
              )}

              <button
                className={styles.btnBook}
                onClick={() => router.push("/pages/patient/book")}
              >
                Book New Appointment
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}