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

interface AIHistory {
  id: number;
  image_path: string;
  condition: string;
  confidence: number;
  severity: string;
  recommendation: string;
  created_at: string;
}

export default function PatientHistory() {

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [aiHistory, setAIHistory] = useState<AIHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [navCollapsed, setNavCollapsed] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  useEffect(() => {
    const handleNavToggle = (e: CustomEvent) => {
      setNavCollapsed(e.detail);
    };

    window.addEventListener("navbarToggle", handleNavToggle as EventListener);

    return () => {
      window.removeEventListener("navbarToggle", handleNavToggle as EventListener);
    };
  }, []);

  /* FETCH APPOINTMENT HISTORY */

  useEffect(() => {

    const fetchAppointments = async () => {

      try {

        const email = localStorage.getItem("user_email") || "patient@example.com";

        const res = await fetch(
          `http://127.0.0.1:8000/appointments/list?email=${email}`
        );

        if (!res.ok) throw new Error("Failed to fetch appointments");

        const data = await res.json();

        setAppointments(data);

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
        style={{
          marginLeft: navCollapsed ? "80px" : "220px",
          transition: "margin-left 0.3s ease",
          padding: "30px"
        }}
      >

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "40px"
          }}
        >


          {/* APPOINTMENT HISTORY */}

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
                    <strong>Time:</strong> {appt.time}
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

              ))

            )}

          </div>

        </div>

      </div>

    </div>
  );
}