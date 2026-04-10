"use client";

import { useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";
import styles from "./history.module.css";

interface Appointment {
  id: number;
  doctor_name: string;
  date: string;
  time: string;
  services: string;
  status: string;
  cancel_reason?: string;
}

export default function PatientHistory() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [navCollapsed, setNavCollapsed] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    const date = new Date(`1970-01-01T${timeString}`);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
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

        const appointmentsRes = await fetch("http://127.0.0.1:8000/appointments/my", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

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
        setAppointments(appointmentsData);
      } catch (error) {
        console.error("Failed to fetch appointment history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, []);

  return (
    <div className={`${navCollapsed ? "nav-collapsed" : "nav-active"}`}>
      <Navbar />

      <div
        style={{
          marginLeft: navCollapsed ? "80px" : "220px",
          transition: "margin-left 0.3s ease",
          padding: "30px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "40px",
          }}
        >
          <div style={{ flex: 1 }}>
            <h1>Appointment History</h1>

            {loading ? (
              <p>Loading...</p>
            ) : appointments.length === 0 ? (
              <p>No appointments found.</p>
            ) : (
              appointments.map((appt) => (
                <div key={appt.id} className={styles.card}>
                  <h2>Dr. {appt.doctor_name}</h2>

                  <p style={{ fontSize: "13px", color: "#777" }}>
                    <strong>Date:</strong> {formatDate(appt.date)}
                  </p>

                  <p>
                    <strong>Time:</strong> {formatTime(appt.time)}
                  </p>

                  <p>
                    <strong>Services:</strong> {appt.services}
                  </p>

                  <p>
                    <strong>Status:</strong> {appt.status}
{(appt.status === "Declined" || appt.status === "Cancelled") && appt.cancel_reason
  ? ` (Reason: ${appt.cancel_reason})`
  : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}