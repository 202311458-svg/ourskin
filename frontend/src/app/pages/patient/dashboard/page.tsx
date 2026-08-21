"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import PageShell from "@/app/components/portal/ui/PageShell"
import PageHeader from "@/app/components/portal/ui/PageHeader";
import Section from "@/app/components/portal/ui/Section";
import StatCard from "@/app/components/portal/ui/StatCard";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import EmptyState from "@/app/components/portal/ui/EmptyState";
import styles from "./page.module.css";

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

const normalizeStatus = (status?: string | null) => {
  const cleanStatus = (status || "").trim().toLowerCase();

  if (cleanStatus === "pending") return "Pending";
  if (cleanStatus === "approved") return "Approved";
  if (cleanStatus === "confirmed") return "Approved";
  if (cleanStatus === "completed") return "Completed";
  if (cleanStatus === "declined") return "Declined";
  if (cleanStatus === "cancelled" || cleanStatus === "canceled") return "Cancelled";
  if (cleanStatus === "no-show" || cleanStatus === "noshow" || cleanStatus === "missed") return "No-Show";

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

  const getFollowUpDate = (appt: Appointment) => {
    return appt.follow_up_date || appt.followup_date || appt.next_visit_date || null;
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
    if (["Declined", "Cancelled", "No-Show"].includes(normalized)) {
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

        const userData = await userRes.json();

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

        const appointmentsData = (await appointmentsRes.json()) as Appointment[];

        if (!appointmentsRes.ok) {
          throw new Error("Failed to fetch appointments");
        }

        const unique: Appointment[] = Array.from(
          new Map(appointmentsData.map((appt: Appointment) => [appt.id, appt])).values()
        );

        setAppointments(unique);
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
  }, [fetchDashboardData, router]);

  const todayStr = getTodayLocalString();

  const approvedAppointments = useMemo(() => {
    return appointments.filter(
      (appt) => normalizeStatus(appt.status) === "Approved"
    );
  }, [appointments]);

  const pendingAppointments = useMemo(() => {
    return appointments
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
    return appointments
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

    return appointments
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

      const result = await res.json();

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
        prev.map((appt) =>
          appt.id === appointmentId
            ? {
                ...appt,
                status: "Cancelled",
                cancel_reason: reason.trim(),
              }
            : appt
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
          <div className={styles.emailSent}>Email notification was sent by the clinic.</div>
        )}
      </div>
    );
  };

  return (
    <PageShell className={styles.page}>
      <PageHeader
        eyebrow="Patient overview"
        title="Your care summary"
        description={`Hello, ${patientName}. This view brings together your upcoming care, any pending requests, and recent activity.`}
      />

      {loading ? (
        <EmptyState title="Loading your appointments..." />
      ) : (
        <>
          <div className={styles.stats}>
            <StatCard label="Upcoming visits" value={upcomingAppointments.length} hint="Approved future appointments" tone="info" />
            <StatCard label="Follow-ups" value={followUps.length} hint="Planned care steps" tone="default" />
            <StatCard label="Pending requests" value={pendingAppointments.length} hint="Awaiting confirmation" tone={pendingAppointments.length > 0 ? "warning" : "default"} />
          </div>

          <div className={styles.grid}>
            {nearestUpcomingAppointment && (
              <Section
                title="Next appointment"
                description="Your confirmed visit and the details that matter most."
              >
                <div className={styles.appointmentCard}>
                  <div className={styles.appointmentHeader}>
                    <div>
                      <div className={styles.doctorName}>
                        {nearestUpcomingAppointment.doctor_name ||
                          nearestUpcomingAppointment.doctor ||
                          "Assigned Doctor"}
                      </div>
                      <div className={styles.serviceName}>
                        {nearestUpcomingAppointment.services}
                      </div>
                      <div className={styles.scheduleText}>
                        {getScheduleText(nearestUpcomingAppointment)}
                      </div>
                      <div className={styles.statusRow}>
                        Status: {getStatusLabel(nearestUpcomingAppointment.status)}
                      </div>
                    </div>
                    <StatusBadge tone="success">
                      {getStatusLabel(nearestUpcomingAppointment.status)}
                    </StatusBadge>
                  </div>
                  {renderInstructionBox(nearestUpcomingAppointment)}
                </div>
              </Section>
            )}

            {nearestFollowUp && (
              <Section
                title="Follow-up plan"
                description="The next follow-up appointment or care step that has been arranged."
              >
                <div className={styles.appointmentCard}>
                  <div className={styles.appointmentHeader}>
                    <div>
                      <div className={styles.doctorName}>
                        {nearestFollowUp.appointment.doctor_name ||
                          nearestFollowUp.appointment.doctor ||
                          "Assigned Doctor"}
                      </div>
                      <div className={styles.serviceName}>
                        {nearestFollowUp.appointment.services || "Consultation"}
                      </div>
                      <div className={styles.scheduleText}>
                        {nearestFollowUp.date
                          ? formatDate(nearestFollowUp.date)
                          : "Follow-up date not specified"}
                      </div>
                      <div className={styles.statusRow}>
                        {getFollowUpTiming(nearestFollowUp.date)}
                      </div>
                      {nearestFollowUp.plan && (
                        <div className={styles.reasonBox}>{nearestFollowUp.plan}</div>
                      )}
                    </div>
                    <StatusBadge tone="info">
                      {getFollowUpTiming(nearestFollowUp.date)}
                    </StatusBadge>
                  </div>
                </div>
              </Section>
            )}

            {pendingAppointments.length > 0 && (
              <Section
                title="Pending requests"
                description="Appointments still waiting for staff confirmation."
              >
                <div className={styles.list}>
                  {pendingAppointments.slice(0, 3).map((appt) => {
                    const isCancelling = cancellingId === appt.id;

                    return (
                      <div key={appt.id} className={styles.row}>
                        <div className={styles.rowMain}>
                          <div className={styles.rowPrimary}>
                            {appt.doctor_name ||
                              appt.doctor ||
                              "Doctor to be assigned"}
                          </div>
                          <div className={styles.rowSecondary}>
                            {appt.services || "Consultation"}
                          </div>
                          <div className={styles.rowSecondary}>
                            {getScheduleText(appt)}
                          </div>
                        </div>

                        <div className={styles.rowActions}>
                          <StatusBadge tone="warning">Pending</StatusBadge>
                          <button
                            type="button"
                            onClick={() => cancelAppointment(appt.id)}
                            className={styles.dangerButton}
                            disabled={isCancelling}
                          >
                            {isCancelling ? "Cancelling..." : "Cancel Request"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            <Section
              title="Recent activity"
              description="Your completed, cancelled, or missed appointments."
            >
              {recentAppointments.length > 0 ? (
                <div className={styles.list}>
                  {recentAppointments.slice(0, 5).map((appt) => {
                    const followUpDate = getFollowUpDate(appt);
                    const followUpPlan = getFollowUpPlan(appt);
                    const cleanStatus = normalizeStatus(appt.status);

                    return (
                      <div key={appt.id} className={styles.row}>
                        <div className={styles.rowMain}>
                          <div className={styles.rowPrimary}>
                            {appt.doctor_name ||
                              appt.doctor ||
                              "Assigned Doctor"}
                          </div>
                          <div className={styles.rowSecondary}>
                            {appt.services || "Consultation"}
                          </div>
                          <div className={styles.rowSecondary}>
                            {getScheduleText(appt)}
                          </div>
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

                        <div className={styles.rowActions}>
                          <span className={getStatusBadgeClass(appt.status)}>
                            {getStatusLabel(cleanStatus)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="You don't have any completed, cancelled, or missed appointments yet." />
              )}
            </Section>
          </div>
        </>
      )}
    </PageShell>
  );
}
