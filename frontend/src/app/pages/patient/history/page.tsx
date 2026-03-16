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

const PATIENT_EMAIL = "patient@example.com";

export default function PatientHistory() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [aiHistory, setAIHistory] = useState<AIHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const formatDate = (dateString: string) => {
  const date = new Date(dateString)

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })
}
  useEffect(() => {
    const handleNavToggle = (e: CustomEvent) => {
      setNavCollapsed(e.detail);
    };
    window.addEventListener("navbarToggle", handleNavToggle as EventListener);

    return () => {
      window.removeEventListener("navbarToggle", handleNavToggle as EventListener);
    };
  }, []);

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

  useEffect(() => {
    const fetchAIHistory = async () => {
      try {
        const token = localStorage.getItem("token");

        const res = await fetch("http://127.0.0.1:8000/ai/history", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error("Failed to fetch AI history");

        const data = await res.json();
        setAIHistory(data);
      } catch (err) {
        console.error("Failed to fetch AI history:", err);
      }
    };

    fetchAIHistory();
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

          {/* AI HISTORY PANEL */}
          <div style={{ flex: 1 }}>
            <h1>AI Skin Analysis History</h1>

            {aiHistory.length === 0 ? (
              <p>No AI analysis records found.</p>
            ) : (
              aiHistory.map((item) => (
                <div key={item.id} className={styles.card}>

                  <img
                    src={`http://127.0.0.1:8000${item.image_path}`}
                    alt="Skin analysis"
                    style={{
                      width: "100%",
                      maxHeight: "200px",
                      objectFit: "cover",
                      borderRadius: "6px",
                      marginBottom: "10px",
                    }}
                  />

<p style={{fontSize:"13px",color:"#777"}}>
<strong>Date:</strong> {formatDate(item.created_at)}
</p>

<p><strong>Condition:</strong> {item.condition}</p>

<p>
<strong>Confidence:</strong> {(item.confidence * 100).toFixed(0)}%
</p>

<p><strong>Severity:</strong> {item.severity}</p>

<p>
<strong>Recommendation:</strong> {item.recommendation}
</p>

                </div>
              ))
            )}
          </div>


          {/* APPOINTMENT PANEL */}
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

        <p style={{fontSize:"13px",color:"#777"}}>
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