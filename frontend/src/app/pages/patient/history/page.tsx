"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { API_BASE_URL } from "@/lib/api";
import styles from "./history.module.css";

interface Appointment {
  id: number;
  doctor_name: string;
  date: string;
  time: string;
  services: string;
  status: string;
  cancel_reason?: string | null;
}

export default function PatientHistory() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [navCollapsed, setNavCollapsed] = useState(false);

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

  const formatDate = (dateString: string) => {
    if (!dateString) return "No date";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return "No time";

    const date = new Date(`1970-01-01T${timeString}`);

    if (Number.isNaN(date.getTime())) return timeString;

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getStatusClass = (status: string) => {
    const normalized = status?.toLowerCase();

    if (normalized === "completed") return styles.statusCompleted;
    if (normalized === "approved") return styles.statusApproved;
    if (normalized === "pending") return styles.statusPending;
    if (normalized === "cancelled" || normalized === "declined") {
      return styles.statusCancelled;
    }

    return styles.statusDefault;
  };

  useEffect(() => {
    const handleNavToggle = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setNavCollapsed(customEvent.detail);
    };

    window.addEventListener("navbarToggle", handleNavToggle);

    return () => {
      window.removeEventListener("navbarToggle", handleNavToggle);
    };
  }, []);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("No token found");
        }

        const appointmentsRes = await fetch(
          `${API_BASE_URL}/appointments/my`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!appointmentsRes.ok) {
          const rawAppointments = await appointmentsRes.text();

          console.error("Appointments request failed:", {
            status: appointmentsRes.status,
            statusText: appointmentsRes.statusText,
            body: rawAppointments,
          });

          throw new Error("Failed to fetch appointments");
        }

        const appointmentsData = await appointmentsRes.json();
        setAppointments(normalizeAppointments(appointmentsData));
      } catch (error) {
        console.error("Failed to fetch appointment history:", error);
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, []);

  return (
    <div className={`${navCollapsed ? "nav-collapsed" : "nav-active"}`}>
      <Navbar />

      <main
        className={styles.historyContainer}
        style={{
          marginLeft: navCollapsed ? "80px" : "220px",
        }}
      >
        <section className={styles.contentWrapper}>
          <div className={styles.headerRow}>
            <div>
              <p className={styles.eyebrow}>Patient Portal</p>
              <h1 className={styles.h1}>Appointment History</h1>

              <p className={styles.subtitle}>
                View your past and current appointments, including booking
                status, schedule details, and cancellation notes.
              </p>
            </div>

            <Link href="/pages/patient/records" className={styles.primaryButton}>
              View Medical Records
            </Link>
          </div>

          {loading ? (
            <div className={styles.emptyState}>
              <h2>Loading appointments...</h2>
              <p>Please wait while your appointment history is being loaded.</p>
            </div>
          ) : appointments.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>No appointments found</h2>
              <p>
                Your appointment history will appear here once you have booked
                an appointment.
              </p>
            </div>
          ) : (
            <div className={styles.cards}>
              {appointments.map((appt) => (
                <article key={appt.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div>
                      <h2>Dr. {appt.doctor_name || "Assigned Doctor"}</h2>
                      <p className={styles.serviceText}>
                        {appt.services || "Consultation"}
                      </p>
                    </div>

                    <span
                      className={`${styles.statusBadge} ${getStatusClass(
                        appt.status
                      )}`}
                    >
                      {appt.status}
                    </span>
                  </div>

                  <div className={styles.detailsGrid}>
                    <div className={styles.detailBox}>
                      <p className={styles.detailLabel}>Date</p>
                      <p className={styles.detailValue}>
                        {formatDate(appt.date)}
                      </p>
                    </div>

                    <div className={styles.detailBox}>
                      <p className={styles.detailLabel}>Time</p>
                      <p className={styles.detailValue}>
                        {formatTime(appt.time)}
                      </p>
                    </div>

                    <div className={styles.detailBox}>
                      <p className={styles.detailLabel}>Service</p>
                      <p className={styles.detailValue}>
                        {appt.services || "Not specified"}
                      </p>
                    </div>
                  </div>

                  {(appt.status === "Declined" ||
                    appt.status === "Cancelled") &&
                    appt.cancel_reason && (
                      <div className={styles.noticeBox}>
                        <strong>Reason:</strong> {appt.cancel_reason}
                      </div>
                    )}

                  {appt.status === "Completed" && (
                    <div className={styles.noticeBox}>
                      This appointment has been completed. The doctor’s
                      consultation record can be viewed in{" "}
                      <Link
                        href="/pages/patient/records"
                        className={styles.inlineLink}
                      >
                        Medical Records
                      </Link>
                      .
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}