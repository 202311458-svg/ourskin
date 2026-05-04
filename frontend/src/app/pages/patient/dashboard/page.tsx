"use client";

import Navbar from "@/app/components/Navbar";
import { API_BASE_URL } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaNotesMedical,
} from "react-icons/fa";
import styles from "@/app/styles/patient.module.css";

type Appointment = {
  id: number;
  patient_name?: string | null;
  patient_email?: string | null;
  doctor_name?: string | null;
  doctor?: string | null;
  date?: string | null;
  time?: string | null;
  end_time?: string | null;
  services?: string | null;
  status: string;
  cancel_reason?: string | null;
  appointment_type?: string | null;
  consultation_mode?: string | null;
  concern?: string | null;
  patient_instruction?: string | null;
  approval_email_sent?: boolean | null;
  approval_email_sent_at?: string | null;

  // Follow-up / diagnosis report fields that may come from /appointments/my
  next_visit_date?: string | null;
  follow_up_date?: string | null;
  followup_date?: string | null;
  follow_up_plan?: string | null;
  followup_plan?: string | null;
  follow_up?: string | null;
  follow_up_reason?: string | null;
  reason?: string | null;
  notes?: string | null;
};

type CurrentUser = {
  id: number;
  name: string;
  email: string;
  contact?: string;
  role?: string;
};

type FollowUpDisplay = {
  appointment: Appointment;
  date: string;
  plan: string;
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

const normalizeStatus = (status?: string | null) => {
  const cleanStatus = (status || "").trim().toLowerCase();

  if (cleanStatus === "pending") return "Pending";
  if (cleanStatus === "approved") return "Approved";
  if (cleanStatus === "confirmed") return "Approved";
  if (cleanStatus === "completed") return "Completed";
  if (cleanStatus === "declined") return "Declined";
  if (cleanStatus === "cancelled") return "Cancelled";
  if (cleanStatus === "canceled") return "Cancelled";
  if (cleanStatus === "no-show") return "No-Show";
  if (cleanStatus === "noshow") return "No-Show";
  if (cleanStatus === "missed") return "No-Show";

  return status?.trim() || "Unknown";
};

const getStatusLabel = (status?: string | null) => {
  const normalized = normalizeStatus(status);

  if (normalized === "No-Show") return "Missed Appointment";

  return normalized;
};

export default function PatientDashboard() {
  const router = useRouter();

  const [patientName, setPatientName] = useState("Patient");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const getTodayLocalString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const getAppointmentDateTime = (appt: Appointment) => {
    if (!appt.date) return null;

    const value = new Date(`${appt.date}T${appt.time || "00:00:00"}`);

    if (Number.isNaN(value.getTime())) return null;

    return value;
  };

  const getDateTimeValue = (appt: Appointment) => {
    return getAppointmentDateTime(appt)?.getTime() || 0;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "To be scheduled";

    const date = new Date(`${dateStr}T00:00:00`);

    if (Number.isNaN(date.getTime())) return dateStr;

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return "To be scheduled";

    const [hours, minutes] = timeStr.split(":");
    const tempDate = new Date();

    tempDate.setHours(Number(hours), Number(minutes || "0"), 0);

    if (Number.isNaN(tempDate.getTime())) return timeStr;

    return tempDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatTimeRange = (appt: Appointment) => {
    if (!appt.time && !appt.end_time) return "To be scheduled";

    if (appt.time && appt.end_time) {
      return `${formatTime(appt.time)} to ${formatTime(appt.end_time)}`;
    }

    return formatTime(appt.time);
  };

  const getScheduleText = (appt: Appointment) => {
    if (!appt.date && !appt.time) return "Schedule to be confirmed by staff";

    return `${formatDate(appt.date)} • ${formatTimeRange(appt)}`;
  };

  const getDoctorImage = (doctorName?: string | null, fallbackDoctor?: string | null) => {
    const finalDoctorName = doctorName || fallbackDoctor || "";
    return doctorImages[finalDoctorName] || "/default-doctor.png";
  };

  const getFollowUpDate = (appt: Appointment) => {
    return (
      appt.follow_up_date ||
      appt.followup_date ||
      appt.next_visit_date ||
      null
    );
  };

  const getFollowUpPlan = (appt: Appointment) => {
    return (
      appt.follow_up_plan ||
      appt.followup_plan ||
      appt.follow_up ||
      appt.follow_up_reason ||
      appt.reason ||
      appt.notes ||
      ""
    );
  };

  const hasFollowUp = (appt: Appointment) => {
    return Boolean(getFollowUpDate(appt) || getFollowUpPlan(appt));
  };

  const getFollowUpTiming = (followUpDate?: string | null) => {
    if (!followUpDate) return "Follow-up scheduled";

    const today = getTodayLocalString();

    if (followUpDate < today) return "Follow-up date passed";
    if (followUpDate === today) return "Due today";

    return "Upcoming follow-up";
  };

  const getStatusBadgeClass = (status: string) => {
    const normalized = normalizeStatus(status);

    if (normalized === "Approved") return styles.badgeApproved;
    if (normalized === "Pending") return styles.badgePending;
    if (normalized === "Completed") return styles.badgeCompleted;
    if (
      normalized === "Declined" ||
      normalized === "Cancelled" ||
      normalized === "No-Show"
    ) {
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
      (appt) => normalizeStatus(appt.status) === "Approved"
    );
  }, [appointments]);

  const pendingAppointments = useMemo(() => {
    return uniqueAppointmentsById(appointments)
      .filter((appt) => normalizeStatus(appt.status) === "Pending")
      .sort((a, b) => getDateTimeValue(b) - getDateTimeValue(a));
  }, [appointments]);

  const todayAppointments = useMemo(() => {
    return approvedAppointments.filter((appt) => appt.date === todayStr);
  }, [approvedAppointments, todayStr]);

  const upcomingAppointments = useMemo(() => {
    const now = new Date();

    return approvedAppointments
      .filter((appt) => {
        const dateTime = getAppointmentDateTime(appt);
        return Boolean(dateTime && dateTime > now);
      })
      .sort((a, b) => getDateTimeValue(a) - getDateTimeValue(b));
  }, [approvedAppointments]);

  const followUps = useMemo<FollowUpDisplay[]>(() => {
    return uniqueAppointmentsById(appointments)
      .filter(hasFollowUp)
      .map((appt) => ({
        appointment: appt,
        date: getFollowUpDate(appt) || "",
        plan: getFollowUpPlan(appt),
      }))
      .sort((a, b) => {
        if (!a.date && !b.date) return b.appointment.id - a.appointment.id;
        if (!a.date) return 1;
        if (!b.date) return -1;

        return a.date.localeCompare(b.date);
      });
  }, [appointments]);

  const nearestFollowUp = followUps.length > 0 ? followUps[0] : null;

  const recentAppointments = useMemo(() => {
    const now = new Date();

    return uniqueAppointmentsById(appointments)
      .filter((appt) => {
        const status = normalizeStatus(appt.status);
        const appointmentDateTime = getAppointmentDateTime(appt);

        return (
          status === "Completed" ||
          status === "Declined" ||
          status === "Cancelled" ||
          status === "No-Show" ||
          (status === "Approved" && Boolean(appointmentDateTime && appointmentDateTime < now))
        );
      })
      .sort((a, b) => getDateTimeValue(b) - getDateTimeValue(a));
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

  const renderInstructionBox = (appt: Appointment) => {
    if (!appt.patient_instruction) return null;

    return (
      <div className={styles.reasonBox}>
        <strong>Appointment Instructions:</strong> {appt.patient_instruction}
        {appt.approval_email_sent && (
          <div style={{ marginTop: "8px", fontSize: "13px", opacity: 0.9 }}>
            Email notification was sent by the clinic.
          </div>
        )}
      </div>
    );
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
            <div
              className={styles.summaryGrid}
              style={{
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              }}
            >
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
                <FaNotesMedical className={styles.summaryIcon} />
                <div>
                  <h3>Follow-Ups</h3>
                  <p>{followUps.length}</p>
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
                  {recentAppointments.slice(0, 5).map((appt) => {
                    const followUpDate = getFollowUpDate(appt);
                    const followUpPlan = getFollowUpPlan(appt);
                    const cleanStatus = normalizeStatus(appt.status);

                    return (
                      <div
                        key={appt.id}
                        className={styles.recentAppointmentCard}
                      >
                        <div className={styles.recentAppointmentTop}>
                          <div>
                            <p className={styles.recentAppointmentDoctor}>
                              {appt.doctor_name ||
                                appt.doctor ||
                                "Assigned Doctor"}
                            </p>

                            <p className={styles.recentAppointmentService}>
                              {appt.services || "Consultation"}
                            </p>
                          </div>

                          <span
                            className={`${styles.statusBadge} ${getStatusBadgeClass(
                              cleanStatus
                            )}`}
                          >
                            {getStatusLabel(cleanStatus)}
                          </span>
                        </div>

                        <p className={styles.recentAppointmentDate}>
                          {getScheduleText(appt)}
                        </p>

                        {(followUpDate || followUpPlan) && (
                          <div className={styles.reasonBox}>
                            <strong>Follow-up:</strong>{" "}
                            {followUpDate
                              ? formatDate(followUpDate)
                              : "Date not specified"}
                            {followUpPlan ? ` • ${followUpPlan}` : ""}
                          </div>
                        )}

                        {(cleanStatus === "Declined" ||
                          cleanStatus === "Cancelled" ||
                          cleanStatus === "No-Show") &&
                          appt.cancel_reason && (
                            <div className={styles.reasonBox}>
                              <strong>Reason:</strong> {appt.cancel_reason}
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.emptyStateText}>
                  You don’t have any completed, cancelled, or missed appointments yet.
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
                        "Assigned Doctor"}
                    </h2>

                    <p className={styles.upcomingSpecialty}>
                      {nearestUpcomingAppointment.services}
                    </p>

                    <p className={styles.upcomingDate}>
                      {getScheduleText(nearestUpcomingAppointment)}
                    </p>

                    <p className={styles.upcomingNote}>
                      Status: {getStatusLabel(nearestUpcomingAppointment.status)}
                    </p>

                    {renderInstructionBox(nearestUpcomingAppointment)}
                  </div>
                </div>
              ) : (
                <p className={styles.emptyStateText}>
                  No upcoming appointment scheduled.
                </p>
              )}
            </div>

            <div className={styles.cardHighlight}>
              <h3 className={styles.cardTitle}>Scheduled Follow-Up</h3>

              {nearestFollowUp ? (
                <div className={styles.upcomingHighlight}>
                  <div className={styles.upcomingTextLarge}>
                    <h2>
                      {nearestFollowUp.appointment.doctor_name ||
                        nearestFollowUp.appointment.doctor ||
                        "Assigned Doctor"}
                    </h2>

                    <p className={styles.upcomingSpecialty}>
                      {nearestFollowUp.appointment.services || "Consultation"}
                    </p>

                    <p className={styles.upcomingDate}>
                      {nearestFollowUp.date
                        ? formatDate(nearestFollowUp.date)
                        : "Follow-up date not specified"}
                    </p>

                    <p className={styles.upcomingNote}>
                      {getFollowUpTiming(nearestFollowUp.date)}
                    </p>

                    {nearestFollowUp.plan && (
                      <p className={styles.upcomingNote}>
                        {nearestFollowUp.plan}
                      </p>
                    )}

                    <button
                      type="button"
                      className={styles.btnBook}
                      onClick={() => router.push("/pages/patient/history")}
                    >
                      View Appointment History
                    </button>
                  </div>
                </div>
              ) : (
                <p className={styles.emptyStateText}>
                  No follow-up schedule yet.
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
                              "Doctor to be assigned"}
                          </h4>

                          <span className={styles.pendingBadge}>Pending</span>
                        </div>

                        <p className={styles.pendingService}>
                          {appt.services || "Consultation"}
                        </p>

                        <p className={styles.pendingDateTime}>
                          {getScheduleText(appt)}
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
