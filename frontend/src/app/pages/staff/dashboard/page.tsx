"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaArrowRight,
  FaBullhorn,
  FaCalendarDay,
  FaClipboardList,
  FaClock,
} from "react-icons/fa";
import { apiRequest, getSession } from "@/lib/api";
import { getAnnouncements, type Announcement } from "@/lib/AnnouncementsApi";
import PageShell from "@/app/components/portal/ui/PageShell";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import styles from "./page.module.css";

type Appointment = {
  id: number;
  patient_id?: number | null;
  patient_name: string;
  doctor_name?: string | null;
  date?: string | null;
  time?: string | null;
  end_time?: string | null;
  status: string;
  services?: string | null;
  appointment_type?: string | null;
  is_initial_evaluation_request?: boolean | null;
};

type StaffFollowUp = {
  id: number;
  patient_id?: number | null;
  patient_name?: string | null;
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

type DataKey = "today" | "requests" | "followUps" | "announcements";
type LoadIssues = Partial<Record<DataKey, string>>;

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

const CLINIC_TIME_ZONE = process.env.NEXT_PUBLIC_CLINIC_TIMEZONE?.trim() || "Asia/Manila";

const normalizeStatus = (status?: string | null) => {
  const cleanStatus = (status || "").trim().toLowerCase();

  if (cleanStatus === "pending") return "Pending";
  if (cleanStatus === "approved" || cleanStatus === "confirmed") return "Approved";
  if (cleanStatus === "scheduled") return "Scheduled";
  if (cleanStatus === "checked in" || cleanStatus === "checked_in") return "Checked in";
  if (cleanStatus === "in progress" || cleanStatus === "in_progress") return "In progress";
  if (cleanStatus === "completed") return "Completed";
  if (cleanStatus === "declined") return "Declined";
  if (cleanStatus === "cancelled" || cleanStatus === "canceled") return "Cancelled";

  return status?.trim() || "Unknown";
};

const getStatusTone = (status?: string | null): BadgeTone => {
  const normalized = normalizeStatus(status);
  if (normalized === "Completed") return "success";
  if (normalized === "Cancelled" || normalized === "Declined") return "danger";
  if (normalized === "Pending") return "warning";
  if (["Approved", "Scheduled", "Checked in", "In progress"].includes(normalized)) return "info";
  return "neutral";
};

const getClinicDateKey = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const getGreeting = () => {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CLINIC_TIME_ZONE,
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date())
  );

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const formatClinicDate = () =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: CLINIC_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

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
  if (!dateString) return "Date unavailable";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatTime = (timeString?: string | null) => {
  if (!timeString) return "";
  const [hourValue, minuteValue] = timeString.split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return timeString;

  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
};

const formatTimeRange = (appt: Appointment) => {
  if (!appt.time) return "To be scheduled";
  const start = formatTime(appt.time);
  const end = appt.end_time ? formatTime(appt.end_time) : "";
  return end ? `${start}–${end}` : start;
};

const getDateTimeValue = (appt: Appointment) => {
  if (!appt.date || !appt.time) return Number.MAX_SAFE_INTEGER;
  const value = new Date(`${appt.date}T${appt.time}`).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
};

const getFollowUpTiming = (item: StaffFollowUp, today: string) => {
  const status = (item.status || "").trim().toLowerCase();
  if (status === "completed") return "Completed";
  if (item.follow_up_date < today) return "Overdue";
  if (item.follow_up_date === today) return "Due today";
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

const fetchAppointmentList = async (endpoint: string) => {
  const res = await apiRequest(endpoint, { cache: "no-store" });
  const result = await readJsonSafely(res);

  if (!res.ok) {
    const fallback = res.status === 403
      ? "You do not have permission to view this appointment data."
      : `Unable to load ${endpoint.replace("/appointments/", "")} appointments.`;
    throw new Error(getErrorMessage(result, fallback));
  }

  return uniqueAppointmentsById(getAppointmentsArray(result));
};

const fetchFollowUpList = async () => {
  const res = await apiRequest("/staff/follow-ups", { cache: "no-store" });
  const result = await readJsonSafely(res);

  if (!res.ok) {
    const fallback = res.status === 403
      ? "You do not have permission to view follow-ups."
      : "Unable to load follow-ups.";
    throw new Error(getErrorMessage(result, fallback));
  }

  return uniqueFollowUpsById(getFollowUpsArray(result));
};

const issueMessage = (reason: unknown, fallback: string) =>
  reason instanceof Error && reason.message ? reason.message : fallback;

const isActiveImportantAnnouncement = (announcement: Announcement) => {
  if (announcement.status !== "Published") return false;
  if (!["Important", "Urgent"].includes(announcement.priority)) return false;

  const now = Date.now();
  if (announcement.starts_at) {
    const startsAt = new Date(announcement.starts_at).getTime();
    if (!Number.isNaN(startsAt) && startsAt > now) return false;
  }
  if (announcement.expires_at) {
    const expiresAt = new Date(announcement.expires_at).getTime();
    if (!Number.isNaN(expiresAt) && expiresAt < now) return false;
  }
  return true;
};

export default function StaffDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>({ today: [], requests: [], confirmed: [] });
  const [followUps, setFollowUps] = useState<StaffFollowUp[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [staffFirstName, setStaffFirstName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadIssues, setLoadIssues] = useState<LoadIssues>({});

  const clinicToday = useMemo(() => getClinicDateKey(), []);

  const loadDashboard = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);

      const [todayResult, requestsResult, confirmedResult, followUpsResult, announcementsResult] =
        await Promise.allSettled([
          fetchAppointmentList("/appointments/today"),
          fetchAppointmentList("/appointments/requests"),
          fetchAppointmentList("/appointments/confirmed"),
          fetchFollowUpList(),
          getAnnouncements(),
        ] as const);

      const issues: LoadIssues = {};

      setData((previous) => ({
        today: todayResult.status === "fulfilled" ? todayResult.value : previous.today,
        requests: requestsResult.status === "fulfilled" ? requestsResult.value : previous.requests,
        confirmed: confirmedResult.status === "fulfilled" ? confirmedResult.value : previous.confirmed,
      }));

      if (followUpsResult.status === "fulfilled") setFollowUps(followUpsResult.value);
      if (announcementsResult.status === "fulfilled") setAnnouncements(announcementsResult.value);

      if (todayResult.status === "rejected") {
        issues.today = issueMessage(todayResult.reason, "Today's clinic data is unavailable.");
      }
      if (requestsResult.status === "rejected") {
        issues.requests = issueMessage(requestsResult.reason, "Appointment requests are unavailable.");
      }
      if (confirmedResult.status === "rejected") {
        console.error("Confirmed appointment data refresh failed:", confirmedResult.reason);
      }
      if (followUpsResult.status === "rejected") {
        issues.followUps = issueMessage(followUpsResult.reason, "Follow-up data is unavailable.");
      }
      if (announcementsResult.status === "rejected") {
        issues.announcements = issueMessage(announcementsResult.reason, "Announcements are unavailable.");
      }

      setLoadIssues(issues);
      if (showLoader) setLoading(false);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    const prepare = async () => {
      const role = localStorage.getItem("role");
      if (role !== "staff") {
        router.push("/");
        return;
      }

      try {
        const session = await getSession();
        if (!cancelled && session?.role === "staff" && session.name) {
          setStaffFirstName(session.name.trim().split(/\s+/)[0] || "");
        }
      } catch {
        // PortalFrame remains the authoritative session guard; a missing display name is non-blocking here.
      }

      if (!cancelled) await loadDashboard();
    };

    void prepare();
    return () => {
      cancelled = true;
    };
  }, [loadDashboard, router]);

  useEffect(() => {
    const refreshDashboardQuietly = () => {
      if (document.hidden) return;
      void loadDashboard(false);
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
  }, [loadDashboard]);

  const todayAppointments = useMemo(() => {
    return uniqueAppointmentsById(data.today)
      .filter((appt) => !["Pending", "Declined"].includes(normalizeStatus(appt.status)))
      .sort((a, b) => {
        const aStatus = normalizeStatus(a.status);
        const bStatus = normalizeStatus(b.status);
        const aCompleted = ["Completed", "Cancelled"].includes(aStatus);
        const bCompleted = ["Completed", "Cancelled"].includes(bStatus);
        if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

        return getDateTimeValue(a) - getDateTimeValue(b);
      });
  }, [data.today]);

  const pendingRequests = useMemo(
    () =>
      uniqueAppointmentsById(data.requests)
        .filter((appt) => normalizeStatus(appt.status) === "Pending")
        .sort((a, b) => getDateTimeValue(a) - getDateTimeValue(b)),
    [data.requests]
  );

  const activeFollowUps = useMemo(
    () =>
      uniqueFollowUpsById(followUps).filter(
        (item) => (item.status || "").trim().toLowerCase() !== "completed"
      ),
    [followUps]
  );

  const overdueFollowUps = useMemo(
    () => activeFollowUps
      .filter((item) => getFollowUpTiming(item, clinicToday) === "Overdue")
      .sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date)),
    [activeFollowUps, clinicToday]
  );

  const dueTodayFollowUps = useMemo(
    () => activeFollowUps.filter((item) => getFollowUpTiming(item, clinicToday) === "Due today"),
    [activeFollowUps, clinicToday]
  );

  const actionableFollowUpCount = overdueFollowUps.length + dueTodayFollowUps.length;
  const actionQueueCount = pendingRequests.length + actionableFollowUpCount;
  const visibleOverdueFollowUps = overdueFollowUps.slice(0, 8);
  const dueSlots = Math.max(0, 8 - visibleOverdueFollowUps.length);
  const visibleDueTodayFollowUps = dueTodayFollowUps.slice(0, dueSlots);
  const requestSlots = Math.max(0, 8 - visibleOverdueFollowUps.length - visibleDueTodayFollowUps.length);
  const visiblePendingRequests = pendingRequests.slice(0, requestSlots);
  const actionQueueUnavailable = Boolean(loadIssues.requests || loadIssues.followUps);

  const importantAnnouncement = useMemo(() => {
    const priorityWeight = (priority: Announcement["priority"]) => priority === "Urgent" ? 2 : priority === "Important" ? 1 : 0;
    return announcements
      .filter(isActiveImportantAnnouncement)
      .sort((a, b) => {
        const priorityDifference = priorityWeight(b.priority) - priorityWeight(a.priority);
        if (priorityDifference !== 0) return priorityDifference;
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      })[0] || null;
  }, [announcements]);

  const greeting = `${getGreeting()}${staffFirstName ? `, ${staffFirstName}` : ""}`;
  const hasAnyLoadIssue = Object.keys(loadIssues).length > 0;

  return (
    <PageShell className={styles.page}>
      <header className={styles.welcome}>
        <div>
          <h1>{greeting}</h1>
          <p className={styles.welcomeLead}>Here&apos;s what needs attention today.</p>
        </div>
        <time className={styles.clinicDate} dateTime={clinicToday}>{formatClinicDate()}</time>
      </header>

      {hasAnyLoadIssue && !loading && (
        <div className={styles.dataNotice} role="status">
          Some dashboard data could not be refreshed. Unavailable sections are marked below rather than shown as zero.
        </div>
      )}

      <nav className={styles.summaryGrid} aria-label="Clinic workload shortcuts" aria-busy={loading}>
        <Link
          className={`${styles.summaryItem} ${!loading && !loadIssues.requests && pendingRequests.length > 0 ? styles.summaryWarning : ""}`}
          href="/pages/staff/requests"
          aria-label={loadIssues.requests ? "Appointment requests unavailable" : `${pendingRequests.length} appointment request${pendingRequests.length === 1 ? "" : "s"} awaiting review`}
        >
          <span className={styles.summaryIcon} aria-hidden="true"><FaClipboardList /></span>
          <span className={styles.summaryCopy}>
            <strong>{loading ? "…" : loadIssues.requests ? "—" : pendingRequests.length}</strong>
            <span>Requests awaiting review</span>
            <small>{loadIssues.requests ? "Data unavailable" : "Review requests"}</small>
          </span>
          <FaArrowRight className={styles.summaryArrow} aria-hidden="true" />
        </Link>

        <Link
          className={`${styles.summaryItem} ${!loading && !loadIssues.today && todayAppointments.length > 0 ? styles.summaryInfo : ""}`}
          href="/pages/staff/appointments"
          aria-label={loadIssues.today ? "Today's appointments unavailable" : `${todayAppointments.length} visit${todayAppointments.length === 1 ? "" : "s"} today`}
        >
          <span className={styles.summaryIcon} aria-hidden="true"><FaCalendarDay /></span>
          <span className={styles.summaryCopy}>
            <strong>{loading ? "…" : loadIssues.today ? "—" : todayAppointments.length}</strong>
            <span>Visits today</span>
            <small>{loadIssues.today ? "Data unavailable" : "Open appointments"}</small>
          </span>
          <FaArrowRight className={styles.summaryArrow} aria-hidden="true" />
        </Link>

        <Link
          className={`${styles.summaryItem} ${!loading && !loadIssues.followUps && actionableFollowUpCount > 0 ? styles.summaryDanger : ""}`}
          href="/pages/staff/follow-ups"
          aria-label={loadIssues.followUps ? "Follow-up actions unavailable" : `${actionableFollowUpCount} follow-up${actionableFollowUpCount === 1 ? "" : "s"} requiring action`}
        >
          <span className={styles.summaryIcon} aria-hidden="true"><FaClock /></span>
          <span className={styles.summaryCopy}>
            <strong>{loading ? "…" : loadIssues.followUps ? "—" : actionableFollowUpCount}</strong>
            <span>Follow-ups requiring action</span>
            <small>{loadIssues.followUps ? "Data unavailable" : "Open follow-ups"}</small>
          </span>
          <FaArrowRight className={styles.summaryArrow} aria-hidden="true" />
        </Link>
      </nav>

      <section className={`${styles.workspaceSection} ${styles.todaySection}`} aria-labelledby="today-clinic-title" aria-busy={loading}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="today-clinic-title">Today&apos;s Clinic</h2>
            <p>{loading ? "Loading today's schedule…" : loadIssues.today ? "Schedule data is currently unavailable." : `${todayAppointments.length} visit${todayAppointments.length === 1 ? "" : "s"} scheduled for ${formatClinicDate()}.`}</p>
          </div>
          <Link className={styles.sectionLink} href="/pages/staff/appointments">View full schedule <FaArrowRight aria-hidden="true" /></Link>
        </div>

        {loading ? (
          <div className={styles.skeletonList} aria-label="Loading today's clinic">
            {[0, 1, 2].map((item) => <div className={styles.skeletonRow} key={item} />)}
          </div>
        ) : loadIssues.today ? (
          <div className={styles.inlineError} role="alert">
            <strong>Today&apos;s clinic is unavailable.</strong>
            <span>{loadIssues.today}</span>
          </div>
        ) : todayAppointments.length === 0 ? (
          <div className={styles.emptyState}>
            <div>
              <strong>No appointments scheduled for today.</strong>
              <span>The clinic schedule is clear for the current date.</span>
            </div>
            <Link href="/pages/staff/appointments">View upcoming appointments</Link>
          </div>
        ) : (
          <div className={styles.scheduleList} role="list">
            {todayAppointments.slice(0, 5).map((appt) => (
              <article className={styles.scheduleRow} key={appt.id} role="listitem">
                <div className={styles.timeBlock}>
                  <strong>{formatTime(appt.time) || "TBD"}</strong>
                  {appt.end_time && <span>to {formatTime(appt.end_time)}</span>}
                </div>
                <div className={styles.patientBlock}>
                  <strong>{appt.patient_name || "Patient details unavailable"}</strong>
                  <span>{getRequestDescriptor(appt)}</span>
                </div>
                <div className={styles.providerBlock}>
                  <span className={styles.mobileLabel}>Provider</span>
                  <strong>{appt.doctor_name || "Doctor not assigned"}</strong>
                </div>
                <div className={styles.statusBlock}>
                  <StatusBadge tone={getStatusTone(appt.status)}>{normalizeStatus(appt.status)}</StatusBadge>
                </div>
                <Link
                  className={styles.rowLink}
                  href={`/pages/staff/appointments?appointment=${appt.id}`}
                  aria-label={`Open appointment for ${appt.patient_name || "patient"}`}
                >
                  Open <FaArrowRight aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={`${styles.workspaceSection} ${styles.actionSection}`} aria-labelledby="action-queue-title" aria-busy={loading}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="action-queue-title">Action Queue</h2>
            <p>{loading ? "Loading work that needs attention…" : actionQueueUnavailable ? "Some action data is currently unavailable." : `${actionQueueCount} item${actionQueueCount === 1 ? "" : "s"} require attention.`}</p>
          </div>
          <div className={styles.sectionLinks}>
            <Link className={styles.sectionLink} href="/pages/staff/follow-ups">Follow-ups</Link>
            <Link className={styles.sectionLink} href="/pages/staff/requests">Appointment requests</Link>
          </div>
        </div>

        {loading ? (
          <div className={styles.skeletonList} aria-label="Loading action queue">
            {[0, 1, 2].map((item) => <div className={styles.skeletonRow} key={item} />)}
          </div>
        ) : (
          <div className={styles.actionList}>
            {loadIssues.followUps && (
              <div className={styles.inlineError} role="alert">
                <strong>Follow-up actions are unavailable.</strong>
                <span>{loadIssues.followUps}</span>
              </div>
            )}
            {loadIssues.requests && (
              <div className={styles.inlineError} role="alert">
                <strong>Appointment requests are unavailable.</strong>
                <span>{loadIssues.requests}</span>
              </div>
            )}

            {!loadIssues.followUps && visibleOverdueFollowUps.map((item) => (
              <article className={`${styles.actionRow} ${styles.overdueRow}`} key={`follow-up-${item.id}`}>
                <div className={styles.actionCategory}>Follow-up</div>
                <div className={styles.actionMain}>
                  <strong>{item.patient_name || (item.patient_id ? `Patient #${item.patient_id}` : "Patient details unavailable")}</strong>
                  <span>{item.appointment_services || "Follow-up care"}</span>
                  <small>{item.doctor_name ? `Assigned to ${item.doctor_name}` : "Assigned staff unavailable"}</small>
                </div>
                <div className={styles.actionTiming}>
                  <StatusBadge tone="danger">Overdue</StatusBadge>
                  <span>Due {formatDate(item.follow_up_date)}</span>
                </div>
                <Link
                  className={styles.rowLink}
                  href={`/pages/staff/follow-ups?followUp=${item.id}`}
                  aria-label={`Open overdue follow-up for ${item.patient_name || "patient"}`}
                >
                  Open follow-up <FaArrowRight aria-hidden="true" />
                </Link>
              </article>
            ))}

            {!loadIssues.followUps && visibleDueTodayFollowUps.map((item) => (
              <article className={`${styles.actionRow} ${styles.dueRow}`} key={`follow-up-${item.id}`}>
                <div className={styles.actionCategory}>Follow-up</div>
                <div className={styles.actionMain}>
                  <strong>{item.patient_name || (item.patient_id ? `Patient #${item.patient_id}` : "Patient details unavailable")}</strong>
                  <span>{item.appointment_services || "Follow-up care"}</span>
                  <small>{item.doctor_name ? `Assigned to ${item.doctor_name}` : "Assigned staff unavailable"}</small>
                </div>
                <div className={styles.actionTiming}>
                  <StatusBadge tone="warning">Due today</StatusBadge>
                  <span>{formatDate(item.follow_up_date)}</span>
                </div>
                <Link
                  className={styles.rowLink}
                  href={`/pages/staff/follow-ups?followUp=${item.id}`}
                  aria-label={`Open follow-up due today for ${item.patient_name || "patient"}`}
                >
                  Open follow-up <FaArrowRight aria-hidden="true" />
                </Link>
              </article>
            ))}

            {!loadIssues.requests && visiblePendingRequests.map((appt) => (
              <article className={styles.actionRow} key={`request-${appt.id}`}>
                <div className={styles.actionCategory}>Appointment request</div>
                <div className={styles.actionMain}>
                  <strong>{appt.patient_name || "Patient details unavailable"}</strong>
                  <span>{getRequestDescriptor(appt)}</span>
                  <small>{getRequestAssignmentLine(appt)}</small>
                </div>
                <div className={styles.actionTiming}>
                  <StatusBadge tone="warning">Pending review</StatusBadge>
                </div>
                <Link
                  className={styles.rowLink}
                  href={`/pages/staff/requests?request=${appt.id}`}
                  aria-label={`Review appointment request for ${appt.patient_name || "patient"}`}
                >
                  Review request <FaArrowRight aria-hidden="true" />
                </Link>
              </article>
            ))}

            {!actionQueueUnavailable && actionQueueCount === 0 && (
              <div className={styles.successState}>
                <strong>You&apos;re all caught up</strong>
                <span>No appointment requests or follow-ups currently require action.</span>
              </div>
            )}
          </div>
        )}
      </section>

      {!loading && !loadIssues.announcements && importantAnnouncement && (
        <aside className={styles.announcementStrip} aria-label="Important clinic announcement">
          <span className={styles.announcementIcon} aria-hidden="true"><FaBullhorn /></span>
          <div className={styles.announcementCopy}>
            <span>Important clinic update</span>
            <strong>{importantAnnouncement.title}</strong>
            <small>{importantAnnouncement.category} · {importantAnnouncement.priority}</small>
          </div>
          <Link href="/pages/staff/announcements">View announcement <FaArrowRight aria-hidden="true" /></Link>
        </aside>
      )}
    </PageShell>
  );
}
