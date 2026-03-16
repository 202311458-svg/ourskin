"use client"

import { useEffect, useState } from "react"
import StaffNavbar from "@/app/components/StaffNavbar"
import styles from "@/app/styles/staff.module.css"

type Appointment = {
  id:number
  patient_name:string
  doctor_name:string
  date:string
  time:string
}

export default function StaffDashboard(){

const [appointments,setAppointments] = useState<Appointment[]>([])

const formatDate = (dateString:string)=>{
  const date = new Date(dateString)

  return date.toLocaleDateString("en-US",{
    year:"numeric",
    month:"long",
    day:"numeric"
  })
}

const formatTime = (timeString:string)=>{

  const date = new Date(`1970-01-01T${timeString}`)

  return date.toLocaleTimeString("en-US",{
    hour:"numeric",
    minute:"2-digit",
    hour12:true
  })

}

useEffect(()=>{

const token = localStorage.getItem("token")

fetch("http://127.0.0.1:8000/appointments/upcoming",{
headers:{Authorization:`Bearer ${token}`}
})
.then(res=>res.json())
.then(data=>setAppointments(data))

},[])

return(

<div className="staffLayout">

<StaffNavbar/>

<div className="staffContent">

<div className={styles.dashboardHeader}>
<h1>Today&apos;s Appointments</h1>
</div>

<div className={styles.card}>

{appointments.length===0 && <p>No appointments scheduled today.</p>}

{appointments.map((appt)=>(
<div key={appt.id} className={styles.requestCard}>

<b>{appt.patient_name}</b>

<span>{appt.doctor_name}</span>

<span>{formatDate(appt.date)} {formatTime(appt.time)}</span>

</div>
))}

</div>

</div>

</div>

)

}