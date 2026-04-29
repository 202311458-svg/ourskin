"use client";

import Navbar from "@/app/components/Navbar";
import { API_BASE_URL } from "@/lib/api";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FaCalendarAlt, FaCheckCircle, FaClock } from "react-icons/fa";
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
  role?: string;
};

const doctorImages: Record<string, string> = {
  "Reena Tagle, MD, DPDS": "/reena.png",
  "Gelaine Pangilinan, MD, MBA": "/gelaine.png",
  "Hans Alitin, MD, DPDS": "/hans.png",
  "Raisa Rosete, MD, MBA, DPDS": "/raisa.png",
  "Cecilia Roxas-Rosete, MD, FPDS": "/cecilia.png",
};

const getAppointmentsArray = (data: unknown): Appointment[] => {
  if (Array.isArray(data)) return data as Appointment[];

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { appointments?: unknown }).appointments)
  ) {
    return (data as { appointments: Appointment[] }).appointments;
  }

  return [];
};

const uniqueAppointmentsById = (appointments: Appointment[]) => {
  return Array.from(
    new Map(appointments.map((appt) => [appt.id, appt])).values()
  );
};

const readJsonSafely = async (res: Response) => {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export default function PatientDashboard() {
  const router = useRouter();

  const [patientName, setPatientName] = useState("Patient");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const normalizeStatus = (status?: string) =>
    (status || "").trim().toLowerCase();

  const combineDateTime = (date: string, time: string) => {
    return new Date(`${date}T${time}`);
  };

  const getTodayLocalString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

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

  const getStatusBadgeClass = (status: string) => {
    const normalized = normalizeStatus(status);

    if (normalized === "approved") return styles.badgeApproved;
    if (normalized === "pending") return styles.badgePending;
    if (normalized === "completed") return styles.badgeCompleted;
    if (normalized === "declined" || normalized === "cancelled") {
      return styles.badgeDeclined;
    }

    return styles.badgeDefault;
  };

  const fetchDashboardData = useCallback(
    async (showLoader = true) => {
      const token = localStorage.getItem("token");

      if (!token) {
        router.push("/pages/login");
        return;
      }

      try {
        if (showLoader) {
          setLoading(true);
        }

        const userRes = await fetch(`${API_BASE_URL}/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const userData = await readJsonSafely(userRes);

        if (!userRes.ok) {
          throw new Error("Failed to fetch current user");
        }

        const currentUser = userData as CurrentUser;
        setPatientName(currentUser.name || "Patient");

        const appointmentsRes = await fetch(
          `${API_BASE_URL}/appointments/my`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const appointmentsData = await readJsonSafely(appointmentsRes);

        if (!appointmentsRes.ok) {
          throw new Error("Failed to fetch appointments");
        }

        setAppointments(
          uniqueAppointmentsById(getAppointmentsArray(appointmentsData))
        );
      } catch (error) {
        console.error("Error loading patient dashboard:", error);
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [router]
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token) {
      router.push("/pages/login");
      return;
    }

    if (role !== "patient") {
      router.push("/");
      return;
    }

    fetchDashboardData();

    const handleNavbarToggle = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setNavCollapsed(customEvent.detail);
    };

    setNavCollapsed(document.body.classList.contains("navCollapsed"));
    window.addEventListener("navbarToggle", handleNavbarToggle);

    return () => {
      window.removeEventListener("navbarToggle", handleNavbarToggle);
    };
  }, [fetchDashboardData, router]);

  useEffect(() => {
    const role = localStorage.getItem("role");

    if (role !== "patient") return;

    const refreshDashboardQuietly = () => {
      if (document.hidden) return;
      if (cancellingId !== null) return;

      fetchDashboardData(false);
    };

    const intervalId = window.setInterval(refreshDashboardQuietly, 5000);

    const handleFocus = () => {
      refreshDashboardQuietly();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshDashboardQuietly();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchDashboardData, cancellingId]);

  const todayStr = getTodayLocalString();

  const approvedAppointments = useMemo(() => {
    return uniqueAppointmentsById(appointments).filter(
      (appt) => normalizeStatus(appt.status) === "approved"
    );
  }, [appointments]);

  const pendingAppointments = useMemo(() => {
    return uniqueAppointmentsById(appointments)
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

    return uniqueAppointmentsById(appointments)
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

  const cancelAppointment = async (appointmentId: number) => {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("Your session has expired. Please log in again.");
      router.push("/pages/login");
      return;
    }

    const reason = window.prompt(
      "Please enter a reason for cancelling this appointment:"
    );

    if (!reason || !reason.trim()) {
      alert("Cancellation reason is required.");
      return;
    }

    try {
      setCancellingId(appointmentId);

      const res = await fetch(
        `${API_BASE_URL}/appointments/${appointmentId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: "Cancelled",
            cancel_reason: reason.trim(),
          }),
        }
      );

      const result = await readJsonSafely(res);

      if (!res.ok) {
        console.error("Cancel appointment failed:", {
          status: res.status,
          statusText: res.statusText,
          body: result,
        });

        alert("Failed to cancel appointment.");
        throw new Error("Failed to cancel appointment");
      }

      alert("Appointment cancelled successfully.");

      setAppointments((prev) =>
        uniqueAppointmentsById(
          prev.map((appt) =>
            appt.id === appointmentId
              ? {
                  ...appt,
                  status: "Cancelled",
                  cancel_reason: reason.trim(),
                }
              : appt
          )
        )
      );

      await fetchDashboardData(false);
    } catch (error) {
      console.error("Cancel appointment error:", error);
    } finally {
      setCancellingId(null);
    }
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
          <h1 className={styles.greetingTitle}>Hello, {patientName}</h1>

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
              <h3 className={styles.cardTitle}>Recent Appointments</h3>

              {recentAppointments.length > 0 ? (
                <div className={styles.recentAppointmentList}>
                  {recentAppointments.slice(0, 5).map((appt) => (
                    <div key={appt.id} className={styles.recentAppointmentCard}>
                      <div className={styles.recentAppointmentTop}>
                        <div>
                          <p className={styles.recentAppointmentDoctor}>
                            {appt.doctor_name ||
                              appt.doctor ||
                              "Unknown Doctor"}
                          </p>

                          <p className={styles.recentAppointmentService}>
                            {appt.services || "Consultation"}
                          </p>
                        </div>

                        <span
                          className={`${styles.statusBadge} ${getStatusBadgeClass(
                            appt.status
                          )}`}
                        >
                          {appt.status}
                        </span>
                      </div>

                      <p className={styles.recentAppointmentDate}>
                        {formatDate(appt.date)} • {formatTime(appt.time)}
                      </p>

                      {(normalizeStatus(appt.status) === "declined" ||
                        normalizeStatus(appt.status) === "cancelled") &&
                        appt.cancel_reason && (
                          <div className={styles.reasonBox}>
                            <strong>Reason:</strong> {appt.cancel_reason}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyStateText}>
                  You don’t have any completed or declined appointments yet.
                </p>
              )}
            </div>
          </div>

          <div className={styles.rightColumn}>
            <div className={styles.cardHighlight}>
              <h3 className={styles.cardTitle}>Upcoming Appointment</h3>

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
                <p className={styles.emptyStateText}>
                  No upcoming appointment scheduled.
                </p>
              )}
            </div>

            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Pending Requests</h3>

              {pendingAppointments.length > 0 ? (
                <div className={styles.pendingList}>
                  {pendingAppointments.slice(0, 3).map((appt) => {
                    const isCancelling = cancellingId === appt.id;

                    return (
                      <div key={appt.id} className={styles.pendingCard}>
                        <div className={styles.pendingTopRow}>
                          <h4 className={styles.pendingDoctor}>
                            {appt.doctor_name ||
                              appt.doctor ||
                              "Unknown Doctor"}
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
                          className={styles.cancelRequestButton}
                          disabled={isCancelling}
                        >
                          {isCancelling ? "Cancelling..." : "Cancel Request"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.emptyStateText}>
                  You don’t have any pending requests right now.
                </p>
              )}

              <button
                type="button"
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