"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import sharedStyles from "@/app/styles/doctor-shared.module.css";
import followUpStyles from "@/app/styles/doctor-follow-ups.module.css";
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

const getTimingClass = (timing: string) => {
  switch (timing) {
    case "Completed":
      return followUpStyles.followUpTimingCompleted;

    case "Overdue":
      return followUpStyles.followUpTimingOverdue;

    case "Due Today":
      return followUpStyles.followUpTimingDue;

    default:
      return followUpStyles.followUpTimingUpcoming;
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

      <main className={sharedStyles.pageWrapper}>
        <div className={sharedStyles.headerSection}>
          <div>
            <h1 className={sharedStyles.pageTitle}>Follow-Ups</h1>
            <p className={sharedStyles.pageSubtitle}>
              View follow-up schedules created from completed diagnosis reports.
            </p>
          </div>

          <button
            type="button"
            className={sharedStyles.secondaryButton}
            onClick={() => router.push("/pages/doctor/ai-analysis")}
          >
            Go to AI Analysis
          </button>
        </div>

        <section className={`${sharedStyles.sectionCard} ${sharedStyles.statsGrid}`}>
          <div className={`${sharedStyles.statCard} ${sharedStyles.statCardPink}`}>
            <p className={sharedStyles.listSecondary}>Total Follow-Ups</p>
            <h2>{sortedItems.length}</h2>
          </div>

          <div className={`${sharedStyles.statCard} ${followUpStyles.statCardYellow}`}>
            <p className={sharedStyles.listSecondary}>Due / Overdue</p>
            <h2>{dueItems.length}</h2>
          </div>

          <div className={`${sharedStyles.statCard} ${sharedStyles.statCardBlue}`}>
            <p className={sharedStyles.listSecondary}>Upcoming</p>
            <h2>{upcomingItems.length}</h2>
          </div>

          <div className={`${sharedStyles.statCard} ${sharedStyles.statCardGreen}`}>
            <p className={sharedStyles.listSecondary}>Completed</p>
            <h2>{completedItems.length}</h2>
          </div>
        </section>

        <section className={sharedStyles.sectionCard}>
          <div className={`${sharedStyles.sectionHeader} ${followUpStyles.sectionHeaderCentered}`}>
            <div>
              <h2 className={sharedStyles.sectionTitle}>Follow-Up Schedule</h2>
              <p className={`${sharedStyles.pageSubtitle} ${sharedStyles.pageSubtitleSpaced}`}>
                These records are created from the optional follow-up section in
                the doctor assessment workflow.
              </p>
            </div>
          </div>

          <div className={followUpStyles.followUpFilters}>
            {filterButtons.map((button) => {
              const active = activeFilter === button.value;

              return (
                <button
                  key={button.value}
                  type="button"
                  onClick={() => setActiveFilter(button.value)}
                  className={`${followUpStyles.followUpFilterButton} ${
                    active ? followUpStyles.followUpFilterButtonActive : ""
                  }`}
                >
                  {button.label} ({button.count})
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className={sharedStyles.emptyState}>Loading follow-up schedule...</div>
          ) : filteredItems.length === 0 ? (
            <div className={`${sharedStyles.emptyState} ${followUpStyles.followUpEmptyState}`}>
              <strong>No follow-ups to show.</strong>
              <p className={followUpStyles.followUpEmptyText}>
                Follow-ups will appear here when a doctor schedules one while
                saving a diagnosis report.
              </p>
            </div>
          ) : (
            <div className={followUpStyles.followUpCards}>
              {filteredItems.map((item) => {
                const timing = getFollowUpTiming(item);
                const timingClass = getTimingClass(timing);
                const isCompleted =
                  (item.status || "").toLowerCase() === "completed";
                const isCompletable = canCompleteFollowUp(item);

                return (
                  <article key={item.id} className={followUpStyles.followUpCard}>
                    <div className={followUpStyles.followUpCardHeader}>
                      <div>
                        <p className={followUpStyles.followUpEyebrow}>
                          Follow-Up Date
                        </p>

                        <h3 className={followUpStyles.followUpDate}>
                          {formatReadableDate(item.follow_up_date)}
                        </h3>
                      </div>

                      <span className={`${followUpStyles.followUpTimingBadge} ${timingClass}`}>
                        {timing}
                      </span>
                    </div>

                    <div className={followUpStyles.followUpDetails}>
                      <div>
                        <p className={sharedStyles.listSecondary}>Patient</p>
                        <strong>
                          {item.patient_name ||
                            (item.patient_id
                              ? `Patient #${item.patient_id}`
                              : "Patient details unavailable")}
                        </strong>

                        {item.patient_email && (
                          <p className={sharedStyles.listSecondary}>
                            {item.patient_email}
                          </p>
                        )}
                      </div>

                      <div>
                        <p className={sharedStyles.listSecondary}>Related Visit</p>
                        <strong>
                          {item.appointment_services ||
                            `Appointment #${item.appointment_id}`}
                        </strong>

                        {(item.appointment_date || item.appointment_time) && (
                          <p className={sharedStyles.listSecondary}>
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
                        <p className={sharedStyles.listSecondary}>Reason</p>
                        <strong>
                          {item.reason || "Follow-up consultation"}
                        </strong>
                      </div>

                      <div>
                        <p className={sharedStyles.listSecondary}>Notes</p>
                        <p className={followUpStyles.followUpNotes}>
                          {item.notes || "No additional notes provided."}
                        </p>
                      </div>
                    </div>

                    <div className={followUpStyles.followUpCardFooter}>
                      <span className={sharedStyles.listSecondary}>
                        Doctor: {item.doctor_name || "Assigned doctor"}
                      </span>

                      {!isCompleted &&
                        (isCompletable ? (
                          <button
                            type="button"
                            className={sharedStyles.actionButton}
                            onClick={() => handleMarkDone(item.id)}
                            disabled={updatingId === item.id}
                          >
                            {updatingId === item.id
                              ? "Updating..."
                              : "Mark Completed"}
                          </button>
                        ) : (
                          <span className={sharedStyles.availabilityBadge}>
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