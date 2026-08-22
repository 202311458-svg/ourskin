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
  patient_id?: number | null;
  patient_name: string;
  patient_email?: string | null;
  patient_contact?: string | null;
  patient_address?: string | null;
  patient_age?: number | null;
  patient_age_label?: string | null;
  is_minor?: boolean | null;
  guardian_first_name?: string | null;
  guardian_last_name?: string | null;
  guardian_relationship?: string | null;
  guardian_contact?: string | null;
  guardian_email?: string | null;
  guardian_consent?: boolean | null;
  doctor_name?: string | null;
  date?: string | null;
  time?: string | null;
  end_time?: string | null;
  status: string;
  services?: string | null;
  appointment_type?: string | null;
  cancel_reason?: string | null;
  is_initial_evaluation_request?: boolean | null;
};

type StaffFollowUp = {
  id: number;
  patient_id?: number | null;
  patient_name?: string | null;
  patient_email?: string | null;
  doctor_name?: string | null;
  appointment_id?: number | null;
  appointment_services?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  follow_up_date: string;
  status?: string | null;
};

type DashboardData = {
  today: Appointment[];
  requests: Appointment[];
  confirmed: Appointment[];
};

const normalizeStatus = (status?: string | null) => {
  const cleanStatus = (status || "").trim().toLowerCase();

  if (cleanStatus === "pending") return "Pending";
  if (cleanStatus === "approved" || cleanStatus === "confirmed") return "Approved";
  if (cleanStatus === "scheduled") return "Scheduled";
  if (cleanStatus === "completed") return "Completed";
  if (cleanStatus === "declined") return "Declined";
  if (cleanStatus === "cancelled" || cleanStatus === "canceled") return "Cancelled";

  return status?.trim() || "Unknown";
};

const getTodayInputDate = () => {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - timezoneOffset).toISOString().split("T")[0];
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

const getErrorMessage = (result: unknown, fallback: string) => {
  if (
    result &&
    typeof result === "object" &&
    "detail" in result &&
    typeof (result as { detail?: unknown }).detail === "string"
  ) {
    return (result as { detail: string }).detail;
  }

  if (
    result &&
    typeof result === "object" &&
    "message" in result &&
    typeof (result as { message?: unknown }).message === "string"
  ) {
    return (result as { message: string }).message;
  }

  return fallback;
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

const getFollowUpsArray = (data: unknown): StaffFollowUp[] => {
  if (Array.isArray(data)) return data as StaffFollowUp[];
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { follow_ups?: unknown }).follow_ups)
  ) {
    return (data as { follow_ups: StaffFollowUp[] }).follow_ups;
  }
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { followUps?: unknown }).followUps)
  ) {
    return (data as { followUps: StaffFollowUp[] }).followUps;
  }
  return [];
};

const uniqueAppointmentsById = (appointments: Appointment[]) =>
  Array.from(
    new Map(
      appointments.map((appt) => [
        appt.id,
        { ...appt, status: normalizeStatus(appt.status) },
      ])
    ).values()
  );

const uniqueFollowUpsById = (followUps: StaffFollowUp[]) =>
  Array.from(
    new Map(
      followUps.map((item) => [
        item.id,
        { ...item, status: normalizeStatus(item.status) },
      ])
    ).values()
  );

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "No date";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatTime = (timeString?: string | null) => {
  if (!timeString) return "";
  const parts = timeString.split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return timeString;

  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
};

const formatTimeRange = (appt: Appointment) => {
  if (!appt.time) return "To be scheduled";
  const start = formatTime(appt.time);
  const end = appt.end_time ? formatTime(appt.end_time) : "";
  return end ? `${start} to ${end}` : start;
};

const getDateTimeValue = (appt: Appointment) => {
  if (!appt.date || !appt.time) return Number.MAX_SAFE_INTEGER;
  const value = new Date(`${appt.date}T${appt.time}`).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
};

const getFollowUpTiming = (item: StaffFollowUp) => {
  const today = getTodayInputDate();
  const status = (item.status || "").trim().toLowerCase();
  if (status === "completed") return "Completed";
  if (item.follow_up_date < today) return "Overdue";
  if (item.follow_up_date === today) return "Due Today";
  return "Upcoming";
};

const getRequestDescriptor = (appt: Appointment) => {
  const service = appt.services?.trim() || "Service not specified";
  const rawType = appt.is_initial_evaluation_request
    ? "Initial evaluation"
    : appt.appointment_type?.trim();
  const requestType =
    rawType?.toLowerCase() === "initial evaluation request"
      ? "Initial evaluation"
      : rawType;

  return requestType ? `${requestType} · ${service}` : service;
};

const getRequestAssignmentLine = (appt: Appointment) => {
  const doctor = appt.doctor_name?.trim() || "";
  const hasSchedule = Boolean(appt.date && appt.time);

  if (!doctor && !hasSchedule) return "Doctor and schedule not yet assigned";
  if (!doctor) return "Doctor not yet assigned";
  if (!hasSchedule) return "Schedule not yet assigned";
  return `${doctor} · ${formatDate(appt.date)} · ${formatTimeRange(appt)}`;
};

const fetchAppointmentList = async (endpoint: string, token: string) => {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await readJsonSafely(res);

  if (!res.ok) {
    console.error(`${endpoint} request failed:`, { status: res.status, result });
    return [];
  }

  return uniqueAppointmentsById(getAppointmentsArray(result));
};

const fetchFollowUpList = async (token: string) => {
  try {
    const res = await fetch(`${API_BASE_URL}/staff/follow-ups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await readJsonSafely(res);
    if (res.ok) return uniqueFollowUpsById(getFollowUpsArray(result));
  } catch (err) {
    console.error("/staff/follow-ups request failed:", err);
  }
  return [];
};

export default function StaffDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>({ today: [], requests: [], confirmed: [] });
  const [followUps, setFollowUps] = useState<StaffFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingFollowUpId, setUpdatingFollowUpId] = useState<number | null>(null);

  const loadDashboard = useCallback(
    async (showLoader = true) => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/");
        return;
      }

      if (showLoader) setLoading(true);
      setError("");

      try {
        const [todayData, requestsData, confirmedData, followUpData] = await Promise.all([
          fetchAppointmentList("/appointments/today", token),
          fetchAppointmentList("/appointments/requests", token),
          fetchAppointmentList("/appointments/confirmed", token),
          fetchFollowUpList(token),
        ]);

        setData({
          today: uniqueAppointmentsById(todayData),
          requests: uniqueAppointmentsById(requestsData),
          confirmed: uniqueAppointmentsById(confirmedData),
        });
        setFollowUps(uniqueFollowUpsById(followUpData));
      } catch (err) {
        console.error("Dashboard load failed:", err);
        setError("Unable to load dashboard data right now.");
        setData({ today: [], requests: [], confirmed: [] });
        setFollowUps([]);
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "staff") {
      router.push("/");
      return;
    }
    loadDashboard();
  }, [loadDashboard, router]);

  useEffect(() => {
    const refreshDashboardQuietly = () => {
      if (document.hidden || updatingFollowUpId !== null) return;
      loadDashboard(false);
    };

    const intervalId = window.setInterval(refreshDashboardQuietly, 5000);
    const handleFocus = () => refreshDashboardQuietly();
    const handleVisibilityChange = () => {
      if (!document.hidden) refreshDashboardQuietly();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadDashboard, updatingFollowUpId]);

  const sortedToday = useMemo(
    () =>
      uniqueAppointmentsById(data.today)
        .filter((appt) => normalizeStatus(appt.status) === "Approved")
        .sort((a, b) => getDateTimeValue(a) - getDateTimeValue(b)),
    [data.today]
  );

  const pendingRequests = useMemo(
    () =>
      uniqueAppointmentsById(data.requests)
        .filter((appt) => normalizeStatus(appt.status) === "Pending")
        .sort((a, b) => getDateTimeValue(a) - getDateTimeValue(b)),
    [data.requests]
  );

  const sortedFollowUps = useMemo(
    () =>
      uniqueFollowUpsById(followUps).sort((a, b) => {
        const aCompleted = (a.status || "").toLowerCase() === "completed";
        const bCompleted = (b.status || "").toLowerCase() === "completed";
        if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
        return a.follow_up_date.localeCompare(b.follow_up_date);
      }),
    [followUps]
  );

  const activeFollowUps = useMemo(
    () => sortedFollowUps.filter((item) => (item.status || "").toLowerCase() !== "completed"),
    [sortedFollowUps]
  );

  const overdueFollowUps = useMemo(
    () => activeFollowUps.filter((item) => getFollowUpTiming(item) === "Overdue"),
    [activeFollowUps]
  );

  const dueTodayFollowUps = useMemo(
    () => activeFollowUps.filter((item) => getFollowUpTiming(item) === "Due Today"),
    [activeFollowUps]
  );

  const actionableFollowUps = useMemo(
    () => activeFollowUps.filter((item) => ["Overdue", "Due Today"].includes(getFollowUpTiming(item))),
    [activeFollowUps]
  );

  const canCompleteFollowUp = (item: StaffFollowUp) => {
    const today = getTodayInputDate();
    return (item.status || "").trim().toLowerCase() !== "completed" && item.follow_up_date <= today;
  };

  const completeFollowUp = async (followUpId: number) => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }

    setActionError("");
    try {
      setUpdatingFollowUpId(followUpId);
      const res = await fetch(`${API_BASE_URL}/staff/follow-ups/${followUpId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "Completed" }),
      });
      const result = await readJsonSafely(res);
      if (!res.ok) {
        throw new Error(getErrorMessage(result, "Unable to complete follow-up"));
      }
      await loadDashboard(false);
    } catch (err) {
      console.error("Follow-up update failed:", err);
      setActionError(err instanceof Error ? err.message : "Unable to mark this follow-up as completed.");
    } finally {
      setUpdatingFollowUpId(null);
    }
  };

  const renderAppointmentRow = (appt: Appointment, variant: "today" | "request") => {
    if (variant === "request") {
      return (
        <div key={appt.id} className={`${styles.row} ${styles.requestRow}`}>
          <div className={styles.rowMain}>
            <div className={styles.rowPrimary}>{appt.patient_name || "Patient details unavailable"}</div>
            <div className={styles.rowSecondary}>{getRequestDescriptor(appt)}</div>
            <div className={styles.rowMeta}>{getRequestAssignmentLine(appt)}</div>
          </div>

          <div className={styles.rowActions}>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => router.push("/pages/staff/requests")}
              aria-label={`Review appointment request for ${appt.patient_name || "patient"}`}
            >
              Review
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={appt.id} className={styles.row}>
        <div className={styles.rowMain}>
          <div className={styles.rowPrimary}>{appt.patient_name || "Patient details unavailable"}</div>
          <div className={styles.rowSecondary}>
            <span>{appt.services || "Service not specified"}</span>
            <span className={styles.separator}>•</span>
            <span>{appt.doctor_name || "Doctor unavailable"}</span>
          </div>
          <div className={styles.rowMeta}>
            {formatDate(appt.date)} {appt.time ? `• ${formatTimeRange(appt)}` : ""}
          </div>
        </div>

        <div className={styles.rowActions}>
          <StatusBadge tone="success">{normalizeStatus(appt.status)}</StatusBadge>
        </div>
      </div>
    );
  };

  return (
    <PageShell className={styles.page}>
      <PageHeader
        eyebrow="Staff overview"
        title="Clinic operations"
        description="See what needs staff attention now, review today's approved visits, and keep follow-ups moving."
      />

      {loading ? (
        <EmptyState title="Loading dashboard..." />
      ) : error ? (
        <EmptyState title={error} />
      ) : (
        <>
          <div className={styles.summaryBar} aria-label="Clinic workload summary">
            <div className={styles.summaryItem}>
              <span>Pending requests</span>
              <strong>{pendingRequests.length}</strong>
            </div>
            <div className={styles.summaryItem}>
              <span>Today's visits</span>
              <strong>{sortedToday.length}</strong>
            </div>
            <div className={styles.summaryItem}>
              <span>Follow-ups due</span>
              <strong>{overdueFollowUps.length + dueTodayFollowUps.length}</strong>
            </div>
          </div>

          {actionError && <div className={styles.actionError} role="alert">{actionError}</div>}

          <div className={styles.dashboardGrid}>
            <div className={styles.attentionColumn}>
              <Section
                title="Needs attention"
                description="Appointment requests awaiting staff review."
                action={
                  <div className={styles.sectionActions}>
                    <StatusBadge tone="warning">{pendingRequests.length} pending</StatusBadge>
                    <Link className={styles.workspaceLink} href="/pages/staff/requests">View all requests</Link>
                  </div>
                }
              >
                {pendingRequests.length === 0 ? (
                  <div className={styles.compactEmpty}>No appointment requests awaiting review.</div>
                ) : (
                  <div className={styles.list}>
                    {pendingRequests.slice(0, 5).map((appt) => renderAppointmentRow(appt, "request"))}
                  </div>
                )}
              </Section>
            </div>

            <div className={styles.todayColumn}>
              <Section
                title="Today's clinic"
                description="Approved visits in scheduled order."
                action={
                  <div className={styles.sectionActions}>
                    {sortedToday.length > 0 && <StatusBadge tone="success">{sortedToday.length} visits</StatusBadge>}
                    <Link className={styles.workspaceLink} href="/pages/staff/appointments">View today's appointments</Link>
                  </div>
                }
              >
                {sortedToday.length === 0 ? (
                  <div className={styles.compactEmpty}>No appointments scheduled today.</div>
                ) : (
                  <div className={styles.list}>
                    {sortedToday.slice(0, 6).map((appt) => renderAppointmentRow(appt, "today"))}
                  </div>
                )}
              </Section>
            </div>

            <div className={styles.followUpColumn}>
              <Section
                title="Follow-ups requiring action"
                description="Overdue and due-today follow-ups requiring staff action."
                action={
                  <div className={styles.sectionActions}>
                    {actionableFollowUps.length > 0 && <StatusBadge tone="info">{actionableFollowUps.length} requiring action</StatusBadge>}
                    <Link className={styles.workspaceLink} href="/pages/staff/follow-ups">View follow-ups</Link>
                  </div>
                }
              >
                {actionableFollowUps.length === 0 ? (
                  <div className={styles.compactEmpty}>No follow-ups currently require action.</div>
                ) : (
                  <div className={styles.list}>
                    {actionableFollowUps.slice(0, 6).map((item) => {
                      const timing = getFollowUpTiming(item);
                      const canComplete = canCompleteFollowUp(item);
                      const isUpdating = updatingFollowUpId === item.id;

                      return (
                        <div key={item.id} className={styles.row}>
                          <div className={styles.rowMain}>
                            <div className={styles.rowPrimary}>
                              {item.patient_name || (item.patient_id ? `Patient #${item.patient_id}` : "Patient details unavailable")}
                            </div>
                            <div className={styles.rowSecondary}>
                              <span>{item.doctor_name || "Assigned doctor"}</span>
                              <span className={styles.separator}>•</span>
                              <span>{formatDate(item.follow_up_date)}</span>
                            </div>
                          </div>

                          <div className={styles.rowActions}>
                            <StatusBadge tone={timing === "Overdue" ? "danger" : "warning"}>{timing}</StatusBadge>
                            {canComplete && (
                              <button
                                className={styles.primaryButton}
                                type="button"
                                onClick={() => completeFollowUp(item.id)}
                                disabled={isUpdating}
                              >
                                {isUpdating ? "Updating..." : "Complete"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
