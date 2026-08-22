"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import PageShell from "@/app/components/portal/ui/PageShell";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import Section from "@/app/components/portal/ui/Section";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import EmptyState from "@/app/components/portal/ui/EmptyState";
import styles from "./page.module.css";

type Appointment = {
  id: number;
  doctor_name?: string | null;
  doctor?: string | null;
  date?: string | null;
  time?: string | null;
  end_time?: string | null;
  services?: string | null;
  status: string;
  cancel_reason?: string | null;
  patient_instruction?: string | null;
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

type CurrentUser = { name?: string | null };

type FollowUpDisplay = {
  appointment: Appointment;
  date: string;
  plan: string;
};

const normalizeStatus = (status?: string | null) => {
  const clean = (status || "").trim().toLowerCase();
  if (clean === "confirmed" || clean === "approved") return "Approved";
  if (clean === "pending") return "Pending";
  if (clean === "completed") return "Completed";
  if (clean === "declined") return "Declined";
  if (clean === "cancelled" || clean === "canceled") return "Cancelled";
  if (clean === "no-show" || clean === "noshow" || clean === "missed") return "Missed";
  return status?.trim() || "Unknown";
};

export default function PatientDashboard() {
  const router = useRouter();
  const [patientName, setPatientName] = useState("Patient");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const getAppointmentDateTime = (appt: Appointment) => {
    if (!appt.date) return null;
    const value = new Date(`${appt.date}T${appt.time || "00:00:00"}`);
    return Number.isNaN(value.getTime()) ? null : value;
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "To be scheduled";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const formatTime = (value?: string | null) => {
    if (!value) return "To be scheduled";
    const [hours, minutes] = value.split(":");
    const date = new Date();
    date.setHours(Number(hours), Number(minutes || "0"), 0, 0);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const getScheduleText = (appt: Appointment) => {
    if (!appt.date && !appt.time) return "Schedule to be confirmed by staff";
    const range = appt.end_time ? `${formatTime(appt.time)} to ${formatTime(appt.end_time)}` : formatTime(appt.time);
    return `${formatDate(appt.date)} • ${range}`;
  };

  const getFollowUpDate = (appt: Appointment) => appt.follow_up_date || appt.followup_date || appt.next_visit_date || "";
  const getFollowUpPlan = (appt: Appointment) => appt.follow_up_plan || appt.followup_plan || appt.follow_up || appt.follow_up_reason || appt.reason || appt.notes || "";

  const fetchDashboardData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/pages/login");
      return;
    }

    try {
      setLoading(true);
      const [userRes, appointmentRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/appointments/my`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!userRes.ok || !appointmentRes.ok) throw new Error("Unable to load dashboard");

      const user = (await userRes.json()) as CurrentUser;
      const appointmentData = (await appointmentRes.json()) as Appointment[];
      setPatientName(user.name || "Patient");
      setAppointments(Array.from(new Map(appointmentData.map((appt) => [appt.id, appt])).values()));
    } catch (error) {
      console.error("Error loading patient dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "patient") {
      router.push("/");
      return;
    }
    void fetchDashboardData();
  }, [fetchDashboardData, router]);

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return appointments
      .filter((appt) => normalizeStatus(appt.status) === "Approved")
      .filter((appt) => {
        const date = getAppointmentDateTime(appt);
        return Boolean(date && date > now);
      })
      .sort((a, b) => (getAppointmentDateTime(a)?.getTime() || 0) - (getAppointmentDateTime(b)?.getTime() || 0));
  }, [appointments]);

  const pendingAppointments = useMemo(
    () => appointments.filter((appt) => normalizeStatus(appt.status) === "Pending"),
    [appointments]
  );

  const followUps = useMemo<FollowUpDisplay[]>(() =>
    appointments
      .filter((appt) => Boolean(getFollowUpDate(appt) || getFollowUpPlan(appt)))
      .map((appointment) => ({ appointment, date: getFollowUpDate(appointment), plan: getFollowUpPlan(appointment) }))
      .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")),
    [appointments]
  );

  const recentAppointments = useMemo(() =>
    appointments
      .filter((appt) => ["Completed", "Declined", "Cancelled", "Missed"].includes(normalizeStatus(appt.status)))
      .slice(0, 5),
    [appointments]
  );

  const nextAppointment = upcomingAppointments[0] || null;
  const nextFollowUp = followUps[0] || null;
  const needsAttention = pendingAppointments.length > 0 || Boolean(nextFollowUp);

  return (
    <PageShell className={styles.page}>
      <PageHeader
        eyebrow="Patient portal"
        title={`Hello, ${patientName}`}
        description="See what is next, what needs your attention, and where you can act."
        primaryAction={<Link href="/pages/patient/book" className={styles.primaryButton}>Book appointment</Link>}
      />

      {loading ? (
        <EmptyState title="Loading your care information..." />
      ) : (
        <div className={styles.grid}>
          <Section title="What is next" description="Your closest confirmed visit or the next action to take.">
            {nextAppointment ? (
              <div className={styles.appointmentCard}>
                <div className={styles.appointmentHeader}>
                  <div>
                    <div className={styles.doctorName}>{nextAppointment.doctor_name || nextAppointment.doctor || "Assigned Doctor"}</div>
                    <div className={styles.serviceName}>{nextAppointment.services || "Consultation"}</div>
                    <div className={styles.scheduleText}>{getScheduleText(nextAppointment)}</div>
                  </div>
                  <StatusBadge tone="success">Confirmed</StatusBadge>
                </div>
                {nextAppointment.patient_instruction && <div className={styles.reasonBox}><strong>Clinic instructions:</strong> {nextAppointment.patient_instruction}</div>}
              </div>
            ) : (
              <EmptyState
                title="No upcoming appointment"
                description="When you are ready, start a booking request and choose the care you need."
                action={<Link href="/pages/patient/book" className={styles.primaryButton}>Book appointment</Link>}
              />
            )}
          </Section>

          <Section title="What requires your attention" description="Requests or follow-up care that may need a response or review.">
            {!needsAttention ? (
              <EmptyState title="Nothing needs your attention right now." description="We will surface pending requests and follow-up care here." />
            ) : (
              <div className={styles.list}>
                {pendingAppointments.slice(0, 3).map((appt) => (
                  <div key={appt.id} className={styles.row}>
                    <div className={styles.rowMain}>
                      <div className={styles.rowPrimary}>{appt.services || "Appointment request"}</div>
                      <div className={styles.rowSecondary}>{getScheduleText(appt)}</div>
                      <div className={styles.rowSecondary}>The clinic is reviewing this request.</div>
                    </div>
                    <StatusBadge tone="warning">Awaiting review</StatusBadge>
                  </div>
                ))}

                {nextFollowUp && (
                  <div className={styles.row}>
                    <div className={styles.rowMain}>
                      <div className={styles.rowPrimary}>Follow-up care</div>
                      <div className={styles.rowSecondary}>{nextFollowUp.date ? formatDate(nextFollowUp.date) : "Date to be arranged"}</div>
                      {nextFollowUp.plan && <div className={styles.rowSecondary}>{nextFollowUp.plan}</div>}
                    </div>
                    <StatusBadge tone="info">Follow-up</StatusBadge>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title="Recent care" description="A short view of your latest completed or closed appointments.">
            {recentAppointments.length === 0 ? (
              <EmptyState title="No recent appointment activity yet." />
            ) : (
              <div className={styles.list}>
                {recentAppointments.map((appt) => (
                  <div key={appt.id} className={styles.row}>
                    <div className={styles.rowMain}>
                      <div className={styles.rowPrimary}>{appt.doctor_name || appt.doctor || "Assigned Doctor"}</div>
                      <div className={styles.rowSecondary}>{appt.services || "Consultation"}</div>
                      <div className={styles.rowSecondary}>{getScheduleText(appt)}</div>
                    </div>
                    <span className={styles.statusBadge}>{normalizeStatus(appt.status)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.sectionAction}><Link href="/pages/patient/history" className={styles.secondaryButton}>View all appointments</Link></div>
          </Section>
        </div>
      )}
    </PageShell>
  );
}
