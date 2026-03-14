"use client";

import { useState } from "react";
import Navbar from "@/app/components/Navbar";

type AnalysisResult = {
  condition: string
  confidence: number
  severity: string
  recommendation: string
  note: string
}

export default function AISkinAnalysis(){

const [image,setImage] = useState<File | null>(null)
const [preview,setPreview] = useState<string | null>(null)
const [result,setResult] = useState<AnalysisResult | null>(null)
const [loading,setLoading] = useState(false)

const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {

const file = e.target.files?.[0]

if(file){
setImage(file)
setPreview(URL.createObjectURL(file))
}

}

const analyzeSkin = async () => {

if(!image) return

setLoading(true)

const token = localStorage.getItem("token")

const formData = new FormData()
formData.append("file", image)

try{

const res = await fetch("http://127.0.0.1:8000/ai/analyze",{
method:"POST",
headers:{
Authorization:`Bearer ${token}`
},
body:formData
})

if(!res.ok){
console.error("Server error:", res.status)
alert("Session expired. Please login again.")
setLoading(false)
return
}

const data = await res.json()

setResult(data.analysis)

}catch(err){
console.error("Request failed:", err)
}

setLoading(false)

}

return(
<>
<Navbar/>

<main className="pageWrapper">

<h1>AI Skin Analysis</h1>

<div className="profileCard">

<p>
Upload a clear photo of your skin. Our AI will analyze possible skin conditions before your consultation.
</p>

<input
type="file"
accept="image/*"
onChange={handleImageChange}
className="formInput"
/>

<p style={{fontSize:"13px",color:"#666"}}>
Supported formats: JPG, PNG
</p>

{preview && (
<img
src={preview}
alt="preview"
style={{
width:"100%",
maxHeight:"350px",
objectFit:"cover",
marginTop:"15px",
borderRadius:"6px"
}}
/>
)}

<button
onClick={analyzeSkin}
className="mainBtn"
style={{marginTop:"15px"}}
>
{loading ? "Analyzing..." : "Analyze Skin"}
</button>

{result && (

<div style={{marginTop:"25px"}}>

<h3>Analysis Result</h3>

<p><b>Condition:</b> {result.condition}</p>

<p><b>Confidence:</b> {(result.confidence * 100).toFixed(0)}%</p>

<p><b>Severity:</b> {result.severity}</p>

<p style={{marginTop:"10px"}}>
<b>Recommendation:</b> {result.recommendation}
</p>

<p style={{fontSize:"12px",color:"#777",marginTop:"10px"}}>
{result.note}
</p>


</div>

)}

</div>

</main>

</>
)

}
