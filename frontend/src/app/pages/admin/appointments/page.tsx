"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";
import styles from "@/app/styles/staff.module.css";

type Appointment = {
  id: number;
  patient_name: string;
  patient_email: string;
  doctor_name: string;
  date: string;
  time: string;
  services: string;
  status: string;
  cancel_reason: string | null;
};

export default function AdminAppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

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
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "admin") {
      router.push("/");
      return;
    }

    fetch("http://127.0.0.1:8000/admin/appointments", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch appointments");
        }
        return res.json();
      })
      .then((data) => {
        setAppointments(data);
      })
      .catch((err) => {
        console.error("Appointments fetch error:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  return (
    <div className="staffLayout">
      <AdminNavbar />

      <div className="staffContent">
        <div className={styles.dashboardHeader}>
          <h1>Appointments</h1>
        </div>

        <div className={styles.card}>
          {loading ? (
            <p>Loading appointments...</p>
          ) : appointments.length === 0 ? (
            <p>No appointments found.</p>
          ) : (
            appointments.map((appt) => (
              <div key={appt.id} className={styles.requestCard}>
                <b>{appt.patient_name}</b>
                <span>{appt.patient_email}</span>
                <span>Doctor: {appt.doctor_name}</span>
                <span>
                  {formatDate(appt.date)} at {formatTime(appt.time)}
                </span>
                <span>Service: {appt.services}</span>
                <span>Status: {appt.status}</span>
                {appt.cancel_reason && (
                  <span>Cancel Reason: {appt.cancel_reason}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}