"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import EmptyState from "@/app/components/portal/ui/EmptyState";
import styles from "./page.module.css";

type Appointment = {
  id: number;
  doctor_name?: string | null;
  doctor?: string | null;
  date?: string | null;
  time?: string | null;
  services?: string | null;
  status?: string | null;
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

const normalizeAppointments = (data: unknown): Appointment[] => {
  if (Array.isArray(data)) return data as Appointment[];
  if (
    data &&
    typeof data === "object" &&
    "appointments" in data &&
    Array.isArray((data as { appointments: unknown }).appointments)
  ) {
    return (data as { appointments: Appointment[] }).appointments;
  }
  return [];
};

const getFollowUpDate = (appt: Appointment) =>
  appt.follow_up_date || appt.followup_date || appt.next_visit_date || "";

const getFollowUpPlan = (appt: Appointment) =>
  appt.follow_up_plan ||
  appt.followup_plan ||
  appt.follow_up ||
  appt.follow_up_reason ||
  appt.reason ||
  appt.notes ||
  "";

const formatDate = (value?: string | null) => {
  if (!value) return "Date to be arranged";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const getTimingLabel = (value?: string | null) => {
  if (!value) return "Needs scheduling";
  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (value < todayValue) return "Follow-up date passed";
  if (value === todayValue) return "Due today";
  return "Upcoming";
};

export default function PatientFollowUps() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowUps = useCallback(async () => {
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

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/appointments/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error("Failed to load follow-ups");

      const unique = Array.from(
        new Map(normalizeAppointments(data).map((appt) => [appt.id, appt])).values()
      );
      setAppointments(unique);
    } catch (error) {
      console.error("Failed to fetch patient follow-ups:", error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchFollowUps();
  }, [fetchFollowUps]);

  const followUps = useMemo(() => {
    return appointments
      .filter((appt) => Boolean(getFollowUpDate(appt) || getFollowUpPlan(appt)))
      .sort((a, b) => {
        const aDate = getFollowUpDate(a) || "9999-12-31";
        const bDate = getFollowUpDate(b) || "9999-12-31";
        return aDate.localeCompare(bDate);
      });
  }, [appointments]);

  return (
    <PageShell className={styles.page}>
      <PageHeader
        eyebrow="Patient portal"
        title="Follow-Ups"
        description="Review only the care steps that require a return visit, reassessment, or clinic follow-up."
      />

      {loading ? (
        <EmptyState title="Loading follow-up care..." />
      ) : followUps.length === 0 ? (
        <EmptyState
          title="No follow-up care scheduled"
          description="When your doctor adds a follow-up plan or next-visit date, it will appear here."
        />
      ) : (
        <div className={styles.list}>
          {followUps.map((appt) => {
            const date = getFollowUpDate(appt);
            const plan = getFollowUpPlan(appt);
            return (
              <article key={appt.id} className={styles.item}>
                <div className={styles.dateBlock}>
                  <span>{getTimingLabel(date)}</span>
                  <strong>{formatDate(date)}</strong>
                </div>

                <div className={styles.careBlock}>
                  <strong>{appt.services || "Consultation follow-up"}</strong>
                  <span>Dr. {appt.doctor_name || appt.doctor || "Assigned Doctor"}</span>
                </div>

                <div className={styles.planBlock}>
                  <span>Care plan</span>
                  <p>{plan || "The clinic will provide follow-up instructions."}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
