"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Appointment,
  fetchAppointments,
  updateAppointmentStatus,
} from "../../../services/mockApi"

function generateCalendar() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const daysInMonth = lastDay.getDate();
  const startDay = firstDay.getDay();

  const days: {
    date: number | null;
    isToday: boolean;
    isSunday: boolean;
  }[] = [];

  for (let i = 0; i < startDay; i++) {
    days.push({
      date: null,
      isToday: false,
      isSunday: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dayOfWeek = dateObj.getDay();

    days.push({
      date: d,
      isToday: d === todayDate,
      isSunday: dayOfWeek === 0,
    });
  }

  return {
    monthName: today.toLocaleString("default", { month: "long" }),
    year,
    days,
  };
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

const router = useRouter();

  // Staff-only access
  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "staff") {
      router.push("/"); // redirect non-staff to landing page
    }
  }, [router]);

  const calendar = generateCalendar();

  useEffect(() => {
    const load = async () => {
      const data = await fetchAppointments();
      setAppointments(data);
    };
    load();
  }, []);

  const handleStatus = async (
    id: number,
    status: "accepted" | "declined"
  ) => {
    await updateAppointmentStatus(id, status);
    const updated = await fetchAppointments();
    setAppointments(updated);
  };

  return (
    <div>

      {/* Background Layers */}
      <div className="fabric1"></div>
      <div className="fabric2"></div>
      <div className="fabric3"></div>
      <div className="circle c1"></div>
      <div className="circle c2"></div>

      <div className="contentLayer">

        <section className="section dashboardSection">

          <h2>Appointments</h2>

          <div className="appointmentsGrid">

            {/* LEFT PANEL — REQUESTS */}
            <div className="requestsPanel">

              <h3 className="panelTitle">
                Appointment Requests
              </h3>

              {appointments.length === 0 && (
                <div className="emptyState">
                  No pending requests.
                </div>
              )}

              {appointments.map((a) => (
                <div key={a.id} className="requestCard">

                  <strong>{a.patientName}</strong>
                  <p>{a.date}</p>
                  <p className="capitalize">{a.status}</p>

                  {a.status === "pending" && (
                    <div className="requestActions">
                      <button
                        onClick={() => handleStatus(a.id, "accepted")}
                        className="mainBtn small outlineBtn"
                      >
                        Accept
                      </button>

                      <button
                        onClick={() => handleStatus(a.id, "declined")}
                        className="mainBtn small outlineBtn"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                </div>
              ))}

            </div>

            {/* RIGHT PANEL — CALENDAR */}
            <div className="calendarPanel">

              <h3 className="panelTitle">
                {calendar.monthName} {calendar.year}
              </h3>

              <div className="calendarGrid">

                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => (
                  <div key={day} className="calendarHeader">
                    {day}
                  </div>
                ))}

                {calendar.days.map((day, index) => (
                  <div
                    key={index}
                    className={`
                      calendarCell
                      ${day.isSunday ? "sundayCell" : ""}
                      ${day.isToday ? "todayCell" : ""}
                    `}
                  >
                    {day.date && (
                      <>
                        <span className="dayNumber">
                          {day.date}
                        </span>

                        {day.isSunday && (
                          <span className="unavailableLabel">
                            Unavailable
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ))}

              </div>

            </div>

          </div>

        </section>

      </div>
    </div>
  );
}