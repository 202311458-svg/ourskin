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

        const appointmentsRes = await fetch("http://127.0.0.1:8000/appointments/my", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

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

const recentAppointments = useMemo(() => {
  const now = new Date();

  return appointments
    .filter((appt) => {
      const status = normalizeStatus(appt.status);
      const appointmentDateTime = combineDateTime(appt.date, appt.time);

      return (
        status === "completed" ||
        status === "declined" ||
        status === "cancelled" ||
        (status === "approved" && appointmentDateTime < now)
      );
    })
    .sort(
      (a, b) =>
        combineDateTime(b.date, b.time).getTime() -
        combineDateTime(a.date, a.time).getTime()
    );
}, [appointments]);

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


const cancelAppointment = async (appointmentId: number) => {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Your session has expired. Please log in again.");
    return;
  }

  const reason = window.prompt("Please enter a reason for cancelling this appointment:");

  if (!reason || !reason.trim()) {
    alert("Cancellation reason is required.");
    return;
  }

  try {
    const res = await fetch(`http://127.0.0.1:8000/appointments/${appointmentId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: "Cancelled",
        cancel_reason: reason.trim(),
      }),
    });

    if (!res.ok) {
      const raw = await res.text();

      console.error("Cancel appointment failed status:", res.status);
      console.error("Cancel appointment failed statusText:", res.statusText);
      console.error("Cancel appointment failed body:", raw);

      alert(`Cancel failed: ${res.status} ${raw}`);
      throw new Error("Failed to cancel appointment");
    }

    alert("Appointment cancelled successfully.");

    setAppointments((prev) =>
      prev.map((appt) =>
        appt.id === appointmentId
          ? { ...appt, status: "Cancelled", cancel_reason: reason.trim() }
          : appt
      )
    );
  } catch (error) {
    console.error("Cancel appointment error:", error);
    alert("Failed to cancel appointment.");
  }
};
  

  const getStatusBadgeStyle = (status: string) => {
    const normalized = normalizeStatus(status);

    if (normalized === "approved") {
      return {
        backgroundColor: "#e8f7ee",
        color: "#1f7a45",
      };
    }

    if (normalized === "pending") {
      return {
        backgroundColor: "#fff4e5",
        color: "#b86b00",
      };
    }

    if (normalized === "declined" || normalized === "cancelled") {
      return {
        backgroundColor: "#fdecec",
        color: "#b42318",
      };
    }

    if (normalized === "completed") {
      return {
        backgroundColor: "#eef4ff",
        color: "#1d4ed8",
      };
    }

    return {
      backgroundColor: "#f2f4f7",
      color: "#344054",
    };
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
                  <p>{appointments.length}</p>
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
              <h3 style={{ marginBottom: "16px" }}>Recent Appointments</h3>

              {recentAppointments.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {recentAppointments.slice(0, 5).map((appt) => (
                    <div
                      key={appt.id}
                      style={{
                        border: "1px solid #ececec",
                        borderRadius: "14px",
                        padding: "14px 16px",
                        background: "#fff",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "12px",
                          flexWrap: "wrap",
                          marginBottom: "8px",
                        }}
                      >
                        <div>
                          <p
                            style={{
                              fontSize: "18px",
                              fontWeight: 700,
                              margin: 0,
                              color: "#1f2937",
                            }}
                          >
                            {appt.doctor_name || appt.doctor || "Unknown Doctor"}
                          </p>

                          <p
                            style={{
                              fontSize: "14px",
                              margin: "4px 0 0 0",
                              color: "#667085",
                            }}
                          >
                            {appt.services}
                          </p>
                        </div>

                        <span
                          style={{
                            ...getStatusBadgeStyle(appt.status),
                            padding: "6px 10px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: 700,
                            textTransform: "capitalize",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {appt.status}
                        </span>
                      </div>

                      <p
                        style={{
                          margin: "0 0 6px 0",
                          fontSize: "14px",
                          color: "#475467",
                        }}
                      >
                        {formatDate(appt.date)} • {formatTime(appt.time)}
                      </p>

                      {(normalizeStatus(appt.status) === "declined" ||
                        normalizeStatus(appt.status) === "cancelled") &&
                        appt.cancel_reason && (
                          <div
                            style={{
                              marginTop: "10px",
                              padding: "10px 12px",
                              borderRadius: "10px",
                              background: "#fff5f5",
                              border: "1px solid #ffd6d6",
                              fontSize: "13px",
                              color: "#7a271a",
                              lineHeight: 1.5,
                            }}
                          >
                            <strong>Reason:</strong> {appt.cancel_reason}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.reminderText}>
                  You don’t have any completed or declined appointments yet.
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

        <button
          type="button"
          onClick={() => cancelAppointment(appt.id)}
          style={{
            marginTop: "10px",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#b42318",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Cancel Request
        </button>
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