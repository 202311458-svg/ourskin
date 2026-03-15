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

const PATIENT_EMAIL = "patient@example.com";

export default function PatientHistory() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [navCollapsed, setNavCollapsed] = useState(false);

  // Listen for navbar toggle events
  useEffect(() => {
    const handleNavToggle = (e: CustomEvent) => {
      setNavCollapsed(e.detail);
    };
    window.addEventListener("navbarToggle", handleNavToggle as EventListener);

    return () => {
      window.removeEventListener("navbarToggle", handleNavToggle as EventListener);
    };
  }, []);

  // Fetch appointments from backend
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/appointments/list/?email=${PATIENT_EMAIL}`
        );
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setAppointments(data.reverse());
      } catch (err) {
        console.error("Failed to fetch appointments:", err);
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
        className={styles.historyContainer}
        style={{
          marginLeft: navCollapsed ? "80px" : "220px",
          transition: "margin-left 0.3s ease"
        }}
      >
        <h1>My Appointments</h1>

        {loading ? (
          <p>Loading...</p>
        ) : appointments.length === 0 ? (
          <p>No appointments found.</p>
        ) : (
          <div className={styles.cards}>
            {appointments.map((appt) => (
              <div key={appt.id} className={styles.card}>
                <h2>Dr. {appt.doctor_name}</h2>
                <p>
                  <strong>Date:</strong> {appt.date} <strong>Time:</strong>{" "}
                  {appt.time}
                </p>
                <p>
                  <strong>Services:</strong> {appt.services}
                </p>
                <p>
                  <strong>Status:</strong> {appt.status}
                  {appt.status === "Cancelled" && appt.cancel_reason
                    ? ` (Reason: ${appt.cancel_reason})`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}