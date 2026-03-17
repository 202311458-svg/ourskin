"use client"
import { useRouter } from "next/navigation"
import { useEffect,useState } from "react"
import StaffNavbar from "@/app/components/StaffNavbar"
import styles from "@/app/styles/staff.module.css"

type Appointment={
id:number
patient_name:string
doctor_name:string
date:string
time:string
status:string
}

export default function StaffAppointments(){

const [appointments,setAppointments] = useState<Appointment[]>([])
const router = useRouter()

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

fetch("http://127.0.0.1:8000/appointments/confirmed",{
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
<h1>Confirmed Appointments</h1>
</div>

<div className={styles.dashboardGrid}>

{appointments.map((appt) => (
  <div key={appt.id} className={styles.card}>

    <b>{appt.patient_name}</b>
    <p>{appt.doctor_name}</p>
    <span>{formatDate(appt.date)} {formatTime(appt.time)}</span>
    <p>Status: {appt.status}</p>

    <button
      className={styles.acceptBtn}
      onClick={() =>
        router.push(`/pages/staff/ai-analysis?appointmentId=${appt.id}`)
      }
      style={{ marginTop: "10px" }}
    >
      Analyze Skin
    </button>

  </div>
))}



</div>



</div>

</div>


)

}