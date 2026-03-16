"use client"

import { useEffect,useState } from "react"
import StaffNavbar from "@/app/components/StaffNavbar"
import styles from "@/app/styles/staff.module.css"

type Patient={
id:number
name:string
email:string
contact:string
}

export default function StaffPatients(){

const [patients,setPatients] = useState<Patient[]>([])

useEffect(()=>{

const token = localStorage.getItem("token")

fetch("http://127.0.0.1:8000/patients",{
headers:{Authorization:`Bearer ${token}`}
})
.then(res=>res.json())
.then(data=>setPatients(data))

},[])

return(

<div className="staffLayout">

<StaffNavbar/>

<div className="staffContent">

<div className={styles.dashboardHeader}>
<h1>Patients</h1>
</div>

<div className={styles.dashboardGrid}>

{patients.map((p)=>(

<div key={p.id} className={styles.card}>

<b>{p.name}</b>

<p>{p.email}</p>

<p>{p.contact}</p>

</div>

))}

</div>

</div>

</div>

)

}