"use client"

import { useEffect, useState } from "react"
import Navbar from "@/app/components/Navbar"

type Analysis = {
  id: number
  image_path: string
  condition: string
  confidence: number
  created_at: string
}

export default function HistoryPage(){

const [history,setHistory] = useState<Analysis[]>([])
const [loading,setLoading] = useState(true)

useEffect(() => {

const token = localStorage.getItem("token")

fetch("http://127.0.0.1:8000/ai/history",{
headers:{
Authorization:`Bearer ${token}`
}
})
.then(res => res.json())
.then(data => {

  if (Array.isArray(data)) {
    setHistory(data)
  } else {
    console.error("Unexpected response:", data)
    setHistory([])
  }

  setLoading(false)

})
.catch(err => {
  console.error("History fetch error:", err)
  setLoading(false)
})

},[])

return(

<div className="pageWrapper">

<Navbar/>

<div className="dashboardContainer">

<h1 className="pageTitle">Skin Analysis History</h1>

{loading && <p>Loading history...</p>}

<div className="historyGrid">

{history.map((item)=>(
<div key={item.id} className="historyCard">

<img
  src={`http://127.0.0.1:8000${item.image_path}`}
  alt="Skin analysis"
  width={150}
/>

<div className="historyInfo">

<p className="condition">{item.condition}</p>

<p className="confidence">
Confidence: {(item.confidence * 100).toFixed(1)}%
</p>

<p className="date">
{new Date(item.created_at).toLocaleDateString()}
</p>

</div>

</div>
))}

</div>

</div>

</div>

)

}