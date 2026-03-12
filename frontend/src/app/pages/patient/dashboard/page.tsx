"use client";

import Navbar from "@/app/components/Navbar";
import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

export default function PatientDashboard() {

const router = useRouter();

const patientName = "Faith";

const latestAppointments = [
{
doctor:"Dr. Cecilia Roxas-Rosete",
specialty:"Lead Dermatologist",
date:"16 Feb 2026"
},
{
doctor:"Dr. Raisa Rosete",
specialty:"Dermatologist",
date:"11 Feb 2026"
},
{
doctor:"Dr. Reinier Rosete",
specialty:"Cosmetic Surgeon",
date:"10 Oct 2025"
}
];

const upcomingAppointment = {
doctor:"Dr. Cecilia Roxas-Rosete",
specialty:"Lead Dermatologist",
date:"16 Mar 2026",
time:"2:30 PM",
note:"Follow-up on previous consultation",
photo:"/cecilia.png"
};

return (

<>
<Navbar />

<main className="pageWrapper">

<section className={styles.greetingSection}>

<h1 className={styles.greetingTitle}>
Hello, {patientName}
</h1>

<p className={styles.greetingSubtitle}>
You have {latestAppointments.length} appointment{latestAppointments.length > 1 ? "s" : ""} today
</p>

</section>


<section className={styles.dashboardCards}>

{/* Latest Appointments */}

<div className={`${styles.dashCard} ${styles.dashCardHoverable}`}>

<h3>Latest Appointments</h3>

<ul>

{latestAppointments.map((appt,idx)=>(

<li key={idx}>
<span>{appt.doctor} ({appt.specialty})</span>
{" - "}
<span>{appt.date}</span>
</li>

))}

</ul>

</div>


{/* Upcoming Appointment */}

<div className={`${styles.dashCard} ${styles.dashCardHoverable}`}>

<h3>Upcoming Appointment</h3>

<div className={styles.upcomingDetails}>

<div className={styles.doctorPhoto}>
<Image
src={upcomingAppointment.photo}
alt={upcomingAppointment.doctor}
width={80}
height={80}
/>
</div>

<div>

<h4>{upcomingAppointment.doctor}</h4>

<p>{upcomingAppointment.specialty}</p>

<p>
{upcomingAppointment.date} | {upcomingAppointment.time}
</p>

<p>{upcomingAppointment.note}</p>

</div>

</div>

</div>


{/* Reminder */}

<div className={`${styles.dashCard} ${styles.dashCardHoverable}`}>

<h3>Appointment Reminder</h3>

<p>
Don&apos;t forget your upcoming appointment with {upcomingAppointment.doctor}!
</p>

<button
className={`${styles.btnBook} ${styles.btnBookHoverable}`}
onClick={()=>router.push("/pages/patient/book")}
>

Book New Appointment

</button>

</div>

</section>

</main>
</>

);

}