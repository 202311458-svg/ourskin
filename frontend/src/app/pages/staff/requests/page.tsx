"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StaffNavbar from "@/app/components/StaffNavbar";
import styles from "@/app/styles/staff.module.css";

type Appointment = {
  id: number
  patient_name: string
  doctor_name: string
  date: string
  time: string
  status: string
};

export default function AppointmentRequests(){

const [requests,setRequests] = useState<Appointment[]>([])
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

// restrict page to staff
useEffect(()=>{

const role = localStorage.getItem("role")

if(role !== "staff"){
router.push("/")
}

},[router])

// reusable loader
const loadRequests = async()=>{

const token = localStorage.getItem("token")

const res = await fetch(
"http://127.0.0.1:8000/appointments/requests",
{
headers:{Authorization:`Bearer ${token}`}
}
)

const data = await res.json()

setRequests(data)

}

// load requests when page opens
useEffect(()=>{

const init = async () => {
  await loadRequests()
}

init()

const interval = setInterval(loadRequests,3000)

return ()=>clearInterval(interval)

},[])

// update appointment status
const updateStatus = async(id:number,status:"Approved"|"Cancelled")=>{

const token = localStorage.getItem("token")

await fetch(
`http://127.0.0.1:8000/appointments/${id}/status`,
{
method:"PUT",
headers:{
"Content-Type":"application/json",
Authorization:`Bearer ${token}`
},
body:JSON.stringify({status})
}
)

// refresh list after update
loadRequests()

}

return(

<div className="staffLayout">

<StaffNavbar/>

<div className="staffContent">

<div className={styles.dashboardHeader}>
<h1>Appointment Requests</h1>
</div>

<div className={styles.card}>

{requests.length === 0 && (
<p>No pending appointment requests.</p>
)}

{requests.map((req)=>(

<div key={req.id} className={styles.requestCard}>

<div>

<b>{req.patient_name}</b>

<p>{req.doctor_name}</p>

<span>{formatDate(req.date)} {formatTime(req.time)}</span>

<p>Status: {req.status}</p>

</div>

<div className={styles.actions}>

<button
className={styles.acceptBtn}
onClick={()=>updateStatus(req.id,"Approved")}
>
Accept
</button>

<button
className={styles.declineBtn}
onClick={()=>updateStatus(req.id,"Cancelled")}
>
Decline
</button>

</div>

</div>

))}

</div>

</div>

</div>

)

}