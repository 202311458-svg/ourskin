"use client";

import Navbar from "@/app/components/Navbar";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function PatientDashboard() {
  const router = useRouter();
  const patientName = "Faith";

  const latestAppointments = [
    { doctor: "Dr. Cecilia Roxas-Rosete", specialty: "Lead Dermatologist", date: "16 Feb 2026" },
    { doctor: "Dr. Raisa Rosete", specialty: "Dermatologist", date: "11 Feb 2026" },
    { doctor: "Dr. Reinier Rosete", specialty: "Cosmetic Surgeon", date: "10 Oct 2025" },
  ];

  const upcomingAppointment = {
    doctor: "Dr. Cecilia Roxas-Rosete",
    specialty: "Lead Dermatologist",
    date: "16 Mar 2026",
    time: "2:30 PM",
    note: "Follow-up on previous consultation",
    photo: "/cecilia.png",
  };

  return (
    <div className="dashboardContainer">
      <Navbar />
      <main className="dashboardMain">
        {/* Greeting */}
        <section className="greetingSection">
          <h1>Hello, {patientName}</h1>
          <p>You have {latestAppointments.length} appointment{latestAppointments.length > 1 ? "s" : ""} today</p>
        </section>

        {/* Dashboard Cards */}
        <section className="dashboardCards">
          <div className="dashCard appointmentsCard">
            <h3>Latest Appointments</h3>
            <ul>
              {latestAppointments.map((appt, idx) => (
                <li key={idx}>
                  <span>{appt.doctor} ({appt.specialty})</span> - <span>{appt.date}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="dashCard upcomingCard">
            <h3>Upcoming Appointment</h3>
            <div className="upcomingDetails">
              <div className="doctorPhoto">
                <Image src={upcomingAppointment.photo} alt={upcomingAppointment.doctor} width={80} height={80} />
              </div>
              <div>
                <h4>{upcomingAppointment.doctor}</h4>
                <p>{upcomingAppointment.specialty}</p>
                <p>{upcomingAppointment.date} | {upcomingAppointment.time}</p>
                <p>{upcomingAppointment.note}</p>
              </div>
            </div>
          </div>

          <div className="dashCard reminderCard">
            <h3>Appointment Reminder</h3>
            <p>Don&apos;t forget your upcoming appointment with {upcomingAppointment.doctor}!</p>
            <button onClick={() => router.push("/pages/patient/book")}>Book New Appointment</button>
          </div>
        </section>
      </main>
    </div>
  );
}