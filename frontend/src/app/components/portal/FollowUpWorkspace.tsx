"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import Section from "@/app/components/portal/ui/Section";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import EmptyState from "@/app/components/portal/ui/EmptyState";
import styles from "./FollowUpWorkspace.module.css";

type Role = "admin" | "staff" | "doctor";
type Filter = "attention" | "today" | "upcoming" | "completed" | "all";
type Item = {
  id: number;
  appointment_id: number;
  patient_id?: number | null;
  patient_name?: string | null;
  patient_email?: string | null;
  doctor_name?: string | null;
  appointment_services?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  follow_up_date: string;
  reason?: string | null;
  notes?: string | null;
  status?: string | null;
};

const localToday = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const stateOf = (x: Item) => {
  const st = (x.status || "Scheduled").toLowerCase();
  if (st === "completed") return "Completed";
  if (st.includes("cancel")) return "Cancelled";
  if (x.follow_up_date < localToday()) return "Overdue";
  if (x.follow_up_date === localToday()) return "Due today";
  return "Upcoming";
};

const date = (v?: string | null) =>
  v
    ? new Date(`${v}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not available";

export default function FollowUpWorkspace({ role }: { role: Role }) {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<Filter>("attention");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const list = role === "doctor" ? "/doctor/follow-ups" : "/staff/follow-ups";

  const load = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError("");

      const body = await apiFetch<Item[]>(list);
      setItems(Array.isArray(body) ? body : []);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load follow-ups.");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden && updating === null) void load(false);
    }, 30000);

    const onFocus = () => {
      if (updating === null) void load(false);
    };

    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [load, updating]);

  const counts = useMemo(
    () => ({
      attention: items.filter((x) => ["Overdue", "Due today"].includes(stateOf(x))).length,
      today: items.filter((x) => stateOf(x) === "Due today").length,
      upcoming: items.filter((x) => stateOf(x) === "Upcoming").length,
      completed: items.filter((x) => stateOf(x) === "Completed").length,
    }),
    [items]
  );

  const visible = useMemo(
    () =>
      items
        .filter((x) => {
          const v = stateOf(x);
          if (filter === "all") return true;
          if (filter === "attention") return ["Overdue", "Due today"].includes(v);
          if (filter === "today") return v === "Due today";
          if (filter === "upcoming") return v === "Upcoming";
          return v === "Completed";
        })
        .filter((x) => {
          const q = query.toLowerCase().trim();
          return (
            !q ||
            [x.patient_name, x.patient_email, x.doctor_name, x.reason, x.appointment_services, x.appointment_id].some((v) =>
              String(v || "").toLowerCase().includes(q)
            )
          );
        })
        .sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date)),
    [filter, items, query]
  );

  const complete = async (x: Item) => {
    const endpoint = role === "doctor" ? `/doctor/follow-ups/${x.id}` : `/staff/follow-ups/${x.id}`;

    try {
      setUpdating(x.id);
      setError("");

      await apiFetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      });

      await load(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete follow-up.");
    } finally {
      setUpdating(null);
    }
  };

  const filters: [Filter, string][] = [
    ["attention", `Needs attention ${counts.attention}`],
    ["today", `Due today ${counts.today}`],
    ["upcoming", `Upcoming ${counts.upcoming}`],
    ["completed", `Completed ${counts.completed}`],
    ["all", `All ${items.length}`],
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Follow-ups"
        description={role === "doctor" ? "Manage follow-up care for patients assigned to you." : "Resolve due follow-ups and keep upcoming care visible."}
      />

      {error && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.toolbar}>
        <div className={styles.toolbarMain}>
          <div className={styles.filters} aria-label="Follow-up filters">
            {filters.map(([v, l]) => (
              <button key={v} type="button" className={filter === v ? styles.active : ""} onClick={() => setFilter(v)} aria-pressed={filter === v}>
                {l}
              </button>
            ))}
          </div>
          <input className={styles.search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search follow-ups" aria-label="Search follow-ups" />
        </div>
        <div className={styles.toolbarMeta}>
          <span>{visible.length} shown</span>
          {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
        </div>
      </div>

      <Section>
        {loading ? (
          <EmptyState title="Loading follow-ups…" />
        ) : visible.length === 0 ? (
          <EmptyState title="No follow-ups match this view." />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Related visit</th>
                  {role !== "doctor" && <th>Doctor</th>}
                  <th>Due</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((x) => {
                  const v = stateOf(x);
                  const can = ["Overdue", "Due today"].includes(v);

                  return (
                    <tr key={x.id}>
                      <td data-label="Patient">
                        <span className={styles.primary}>{x.patient_name || `Patient #${x.patient_id || "—"}`}</span>
                        {x.patient_email && <span className={styles.secondary}>{x.patient_email}</span>}
                      </td>
                      <td data-label="Related visit">
                        <span className={styles.primary}>{x.appointment_services || `Appointment #${x.appointment_id}`}</span>
                        {x.appointment_date && <span className={styles.secondary}>{date(x.appointment_date)}</span>}
                      </td>
                      {role !== "doctor" && <td data-label="Doctor"><span className={styles.secondary}>{x.doctor_name || "Not available"}</span></td>}
                      <td data-label="Due"><span className={styles.secondary}>{date(x.follow_up_date)}</span></td>
                      <td data-label="Reason"><span className={styles.secondary}>{x.reason || "—"}</span></td>
                      <td data-label="Status">
                        <StatusBadge tone={v === "Overdue" ? "danger" : v === "Due today" ? "warning" : v === "Upcoming" ? "info" : v === "Completed" ? "success" : "neutral"}>{v}</StatusBadge>
                      </td>
                      <td data-label="Action">
                        {can && (
                          <button type="button" className={styles.primaryButton} onClick={() => complete(x)} disabled={updating === x.id}>
                            {updating === x.id ? "Updating..." : "Complete"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
