"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import styles from "@/app/styles/doctor.module.css";
import {
  getDoctorFollowUps,
  updateDoctorFollowUp,
  type FollowUp,
} from "@/lib/doctor-api";

type FollowUpStatusFilter = "All" | "Due" | "Upcoming" | "Completed";

type DisplayFollowUp = FollowUp & {
  patient_name?: string | null;
  patient_email?: string | null;
  appointment_services?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
};

const getTodayInputDate = () => {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;

  return new Date(today.getTime() - timezoneOffset).toISOString().split("T")[0];
};

const formatReadableDate = (value?: string | null) => {
  if (!value) return "No date";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatReadableTime = (value?: string | null) => {
  if (!value) return "";

  const parts = value.split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
};

const getFollowUpTiming = (item: DisplayFollowUp) => {
  const today = getTodayInputDate();
  const status = (item.status || "").trim().toLowerCase();

  if (status === "completed") return "Completed";
  if (item.follow_up_date < today) return "Overdue";
  if (item.follow_up_date === today) return "Due Today";

  return "Upcoming";
};

const canCompleteFollowUp = (item: DisplayFollowUp) => {
  const today = getTodayInputDate();
  const status = (item.status || "").trim().toLowerCase();

  return status !== "completed" && item.follow_up_date <= today;
};

const getTimingStyle = (timing: string) => {
  switch (timing) {
    case "Completed":
      return {
        background: "rgba(34, 197, 94, 0.12)",
        color: "#22c55e",
        border: "1px solid rgba(34, 197, 94, 0.28)",
      };

    case "Overdue":
      return {
        background: "rgba(248, 113, 113, 0.12)",
        color: "#f87171",
        border: "1px solid rgba(248, 113, 113, 0.28)",
      };

    case "Due Today":
      return {
        background: "rgba(251, 191, 36, 0.14)",
        color: "#fbbf24",
        border: "1px solid rgba(251, 191, 36, 0.28)",
      };

    default:
      return {
        background: "rgba(236, 72, 153, 0.12)",
        color: "#f472b6",
        border: "1px solid rgba(236, 72, 153, 0.28)",
      };
  }
};

export default function DoctorFollowUpsPage() {
  const router = useRouter();

  const [items, setItems] = useState<DisplayFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FollowUpStatusFilter>("All");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const data = await getDoctorFollowUps();
      setItems(Array.isArray(data) ? (data as DisplayFollowUp[]) : []);
    } catch (error) {
      console.error("Failed to load follow-ups:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to load follow-up schedule."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "doctor") {
      router.push("/");
      return;
    }

    load();
  }, [router, load]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aCompleted = (a.status || "").toLowerCase() === "completed";
      const bCompleted = (b.status || "").toLowerCase() === "completed";

      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }

      return a.follow_up_date.localeCompare(b.follow_up_date);
    });
  }, [items]);

  const dueItems = useMemo(() => {
    const today = getTodayInputDate();

    return sortedItems.filter(
      (item) =>
        (item.status || "").toLowerCase() !== "completed" &&
        item.follow_up_date <= today
    );
  }, [sortedItems]);

  const upcomingItems = useMemo(() => {
    const today = getTodayInputDate();

    return sortedItems.filter(
      (item) =>
        (item.status || "").toLowerCase() !== "completed" &&
        item.follow_up_date > today
    );
  }, [sortedItems]);

  const completedItems = useMemo(() => {
    return sortedItems.filter(
      (item) => (item.status || "").toLowerCase() === "completed"
    );
  }, [sortedItems]);

  const filteredItems = useMemo(() => {
    switch (activeFilter) {
      case "Due":
        return dueItems;

      case "Upcoming":
        return upcomingItems;

      case "Completed":
        return completedItems;

      default:
        return sortedItems;
    }
  }, [activeFilter, completedItems, dueItems, sortedItems, upcomingItems]);

  const handleMarkDone = async (id: number) => {
    try {
      const selectedFollowUp = items.find((item) => item.id === id);

      if (!selectedFollowUp) {
        alert("Follow-up record not found.");
        return;
      }

      if (!canCompleteFollowUp(selectedFollowUp)) {
        alert(
          "This follow-up can only be marked completed on or after the scheduled date."
        );
        return;
      }

      setUpdatingId(id);

      await updateDoctorFollowUp(id, { status: "Completed" });
      await load();
    } catch (error) {
      console.error("Failed to update follow-up:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to update follow-up status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const filterButtons: {
    label: string;
    value: FollowUpStatusFilter;
    count: number;
  }[] = [
    {
      label: "All",
      value: "All",
      count: sortedItems.length,
    },
    {
      label: "Due",
      value: "Due",
      count: dueItems.length,
    },
    {
      label: "Upcoming",
      value: "Upcoming",
      count: upcomingItems.length,
    },
    {
      label: "Completed",
      value: "Completed",
      count: completedItems.length,
    },
  ];

  return (
    <>
      <DoctorNavbar />

      <main className={styles.pageWrapper}>
        <div className={styles.headerSection}>
          <div>
            <h1 className={styles.pageTitle}>Follow-Ups</h1>
            <p className={styles.pageSubtitle}>
              View follow-up schedules created from completed diagnosis reports.
            </p>
          </div>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => router.push("/pages/doctor/ai-analysis")}
          >
            Go to AI Analysis
          </button>
        </div>

        <section
          className={styles.sectionCard}
          style={{
            marginBottom: 24,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 16,
          }}
        >
          <div
            style={{
              padding: "18px",
              borderRadius: 18,
              background: "rgba(236, 72, 153, 0.12)",
              border: "1px solid rgba(236, 72, 153, 0.22)",
            }}
          >
            <p className={styles.listSecondary}>Total Follow-Ups</p>
            <h2 style={{ margin: "8px 0 0", fontSize: 30 }}>
              {sortedItems.length}
            </h2>
          </div>

          <div
            style={{
              padding: "18px",
              borderRadius: 18,
              background: "rgba(251, 191, 36, 0.12)",
              border: "1px solid rgba(251, 191, 36, 0.22)",
            }}
          >
            <p className={styles.listSecondary}>Due / Overdue</p>
            <h2 style={{ margin: "8px 0 0", fontSize: 30 }}>
              {dueItems.length}
            </h2>
          </div>

          <div
            style={{
              padding: "18px",
              borderRadius: 18,
              background: "rgba(59, 130, 246, 0.12)",
              border: "1px solid rgba(59, 130, 246, 0.22)",
            }}
          >
            <p className={styles.listSecondary}>Upcoming</p>
            <h2 style={{ margin: "8px 0 0", fontSize: 30 }}>
              {upcomingItems.length}
            </h2>
          </div>

          <div
            style={{
              padding: "18px",
              borderRadius: 18,
              background: "rgba(34, 197, 94, 0.12)",
              border: "1px solid rgba(34, 197, 94, 0.22)",
            }}
          >
            <p className={styles.listSecondary}>Completed</p>
            <h2 style={{ margin: "8px 0 0", fontSize: 30 }}>
              {completedItems.length}
            </h2>
          </div>
        </section>

        <section className={styles.sectionCard}>
          <div
            className={styles.sectionHeader}
            style={{
              alignItems: "center",
              gap: 16,
            }}
          >
            <div>
              <h2 className={styles.sectionTitle}>Follow-Up Schedule</h2>
              <p className={styles.pageSubtitle} style={{ marginTop: 4 }}>
                These records are created from the optional follow-up section in
                the doctor assessment workflow.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 20,
            }}
          >
            {filterButtons.map((button) => {
              const active = activeFilter === button.value;

              return (
                <button
                  key={button.value}
                  type="button"
                  onClick={() => setActiveFilter(button.value)}
                  style={{
                    border: active
                      ? "1px solid rgba(236, 72, 153, 0.65)"
                      : "1px solid rgba(148, 163, 184, 0.22)",
                    background: active
                      ? "rgba(236, 72, 153, 0.18)"
                      : "rgba(255, 255, 255, 0.04)",
                    color: active ? "#f472b6" : "inherit",
                    borderRadius: 999,
                    padding: "10px 14px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {button.label} ({button.count})
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className={styles.emptyState}>Loading follow-up schedule...</div>
          ) : filteredItems.length === 0 ? (
            <div
              className={styles.emptyState}
              style={{
                padding: 32,
                borderRadius: 18,
                border: "1px dashed rgba(148, 163, 184, 0.35)",
              }}
            >
              <strong>No follow-ups to show.</strong>
              <p style={{ marginTop: 8 }}>
                Follow-ups will appear here when a doctor schedules one while
                saving a diagnosis report.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 16,
              }}
            >
              {filteredItems.map((item) => {
                const timing = getFollowUpTiming(item);
                const timingStyle = getTimingStyle(timing);
                const isCompleted =
                  (item.status || "").toLowerCase() === "completed";
                const isCompletable = canCompleteFollowUp(item);

                return (
                  <article
                    key={item.id}
                    style={{
                      border: "1px solid rgba(148, 163, 184, 0.22)",
                      borderRadius: 20,
                      padding: 20,
                      background:
                        "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))",
                      boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "#f472b6",
                          }}
                        >
                          Follow-Up Date
                        </p>

                        <h3
                          style={{
                            margin: "6px 0 0",
                            fontSize: 22,
                            lineHeight: 1.25,
                          }}
                        >
                          {formatReadableDate(item.follow_up_date)}
                        </h3>
                      </div>

                      <span
                        style={{
                          ...timingStyle,
                          borderRadius: 999,
                          padding: "8px 12px",
                          fontSize: 12,
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {timing}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div>
                        <p className={styles.listSecondary}>Patient</p>
                        <strong>
                          {item.patient_name ||
                            (item.patient_id
                              ? `Patient #${item.patient_id}`
                              : "Patient details unavailable")}
                        </strong>

                        {item.patient_email && (
                          <p className={styles.listSecondary}>
                            {item.patient_email}
                          </p>
                        )}
                      </div>

                      <div>
                        <p className={styles.listSecondary}>Related Visit</p>
                        <strong>
                          {item.appointment_services ||
                            `Appointment #${item.appointment_id}`}
                        </strong>

                        {(item.appointment_date || item.appointment_time) && (
                          <p className={styles.listSecondary}>
                            {item.appointment_date
                              ? formatReadableDate(item.appointment_date)
                              : "No date"}{" "}
                            {item.appointment_time
                              ? `at ${formatReadableTime(item.appointment_time)}`
                              : ""}
                          </p>
                        )}
                      </div>

                      <div>
                        <p className={styles.listSecondary}>Reason</p>
                        <strong>
                          {item.reason || "Follow-up consultation"}
                        </strong>
                      </div>

                      <div>
                        <p className={styles.listSecondary}>Notes</p>
                        <p style={{ margin: 0 }}>
                          {item.notes || "No additional notes provided."}
                        </p>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        paddingTop: 12,
                        borderTop: "1px solid rgba(148, 163, 184, 0.18)",
                      }}
                    >
                      <span className={styles.listSecondary}>
                        Doctor: {item.doctor_name || "Assigned doctor"}
                      </span>

                      {!isCompleted &&
                        (isCompletable ? (
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => handleMarkDone(item.id)}
                            disabled={updatingId === item.id}
                          >
                            {updatingId === item.id
                              ? "Updating..."
                              : "Mark Completed"}
                          </button>
                        ) : (
                          <span
                            style={{
                              padding: "9px 12px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 800,
                              color: "#94a3b8",
                              border: "1px solid rgba(148, 163, 184, 0.25)",
                              background: "rgba(148, 163, 184, 0.08)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Available on {formatReadableDate(item.follow_up_date)}
                          </span>
                        ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}