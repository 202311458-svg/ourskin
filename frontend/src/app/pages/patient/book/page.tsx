"use client";

import Image from "next/image"
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BookAppointment() {

const router = useRouter();

const [date,setDate] = useState("");
const [time,setTime] = useState("");
const [service,setService] = useState("");

const submitAppointment = async () => {

if(!date || !time || !service){
alert("Please complete all fields");
return;
}

const token = localStorage.getItem("token");

const res = await fetch("http://127.0.0.1:8000/appointments",{
method:"POST",
headers:{
"Content-Type":"application/json",
Authorization:`Bearer ${token}`
},
body:JSON.stringify({
date,
time,
service
})
});

if(!res.ok){
alert("Booking failed");
return;
}

alert("Appointment request sent");

router.push("/pages/patient/dashboard");

};

return(

<div className="patientDashboard">

{/* SIDEBAR */}

<aside className="dashboardSidebar">

 <div className="dashLogo">
  <Image
    src="/os-logo.png"
    alt="OurSkin"
    width={140}
    height={45}
  />
</div>

<nav>

<button onClick={()=>router.push("/pages/patient/dashboard")}>
Dashboard
</button>

<button onClick={()=>router.push("/pages/patient/book")}>
Book Appointment
</button>

<button onClick={()=>router.push("/pages/patient/appointments")}>
My Appointments
</button>

<button>
Profile
</button>

<button
onClick={()=>{
localStorage.removeItem("token");
router.push("/");
}}
>
Logout
</button>

</nav>

</aside>


{/* MAIN CONTENT */}

<main className="dashboardMain">

<h1>Book Appointment</h1>

<div className="bookingCard">

<div className="formField">
<label>Preferred Date</label>
<input
type="date"
value={date}
onChange={(e)=>{
const selectedDate = new Date(e.target.value);
if(selectedDate.getDay() === 0){
alert("Sundays are unavailable. Please select another date.");
setDate("");
return;
}
setDate(e.target.value);
}}
/>
</div>

<div className="formField">
<label>Preferred Time</label>
<select
value={time}
onChange={(e)=>setTime(e.target.value)}
>
<option value="">Select time</option>
<option value="9:00 AM">9:00 AM</option>
<option value="10:00 AM">10:00 AM</option>
<option value="11:00 AM">11:00 AM</option>
<option value="1:00 PM">1:00 PM</option>
<option value="2:00 PM">2:00 PM</option>
<option value="3:00 PM">3:00 PM</option>
</select>
</div>

<div className="formField">

<label>Type of Service</label>

<select
value={service}
onChange={(e)=>setService(e.target.value)}
>

<option value="">Select Type of Service</option>

<optgroup label="Consultation">
<option>Dermatology Consultation</option>
<option>Face-to-Face Dermatology Consultation</option>
<option>Online Dermatology Consultation</option>
<option>Dermoscopy and Mole Assessment</option>
<option>Skin Cancer Screening</option>
</optgroup>

<optgroup label="Contact Allergy Testing">
<option>Patch Test – 30 Allergens (Baseline Series)</option>
<option>Patch Test – 80 Allergens (Comprehensive Series)</option>
</optgroup>

<optgroup label="Facials">
<option>Acne Facial</option>
<option>Brightening Facial</option>
<option>Anti-Aging Facial</option>
</optgroup>

<optgroup label="Surgical Procedures">
<option>Skin Biopsy (Punch / Shave / Incision / Excision)</option>
<option>Excision Surgery</option>
<option>Incision and Drainage</option>
<option>Nail Surgery</option>
<option>Scar Revision Surgery</option>
<option>Wart Removal (Cautery / Laser)</option>
<option>Benign Skin Growth Removal</option>
<option>Callus and Corn Removal</option>
<option>Subcision</option>
<option>Microneedling</option>
</optgroup>

<optgroup label="Chemical Peels">
<option>Acne Vulgaris and Acne Scars</option>
<option>Pigmentation (Melasma etc.)</option>
<option>Skin Rejuvenation</option>
<option>TCA CROSS for Acne Scars</option>
</optgroup>

<optgroup label="Laser and EBD Treatments">
<option>Ablative CO2 Laser – Wart Removal</option>
<option>Ablative CO2 Laser – Benign Skin Growth Removal</option>
<option>Fractional CO2 Laser – Laser Peeling</option>
<option>Fractional CO2 Laser – Skin Tightening</option>
<option>Fractional CO2 Laser – Skin Rejuvenation</option>
<option>Fractional CO2 Laser – Acne Scars</option>
<option>Fractional CO2 Laser – Stretch Marks</option>
<option>QS Nd:YAG Laser – Carbon Laser Peel</option>
<option>QS Nd:YAG Laser – Laser Toning</option>
<option>QS Nd:YAG Laser – Pigmentation Treatment</option>
<option>QS Nd:YAG Laser – Dark Under Eyes</option>
<option>QS Nd:YAG Laser – Lip Lightening</option>
<option>QS Nd:YAG Laser – Body Lightening</option>
<option>QS Nd:YAG Laser – Tattoo Removal</option>
<option>Long Pulse Nd:YAG Laser – Hair Removal</option>
<option>Long Pulse Nd:YAG Laser – Vascular Treatment</option>
<option>Radiofrequency Skin Tightening</option>
<option>HIFU (High Intensity Focused Ultrasound)</option>
</optgroup>

<optgroup label="Injectables">
<option>Intralesional Steroid – Acne Vulgaris</option>
<option>Intralesional Steroid – Hypertrophic Scars / Keloids</option>
<option>Intralesional Steroid – Alopecia Areata</option>
<option>Intralesional Steroid – Inflammatory Skin Conditions</option>
<option>Intramuscular Steroid Injection</option>
<option>Botulinum Toxin Injection – Upper Face</option>
<option>Botulinum Toxin Injection – Lower Face</option>
<option>Botulinum Toxin Injection – Masseter Botox</option>
<option>Botulinum Toxin Injection – Microbotox</option>
<option>Botulinum Toxin Injection – Neck Lift</option>
<option>Botulinum Toxin Injection – Sweattox</option>
<option>Botulinum Toxin Injection – Trapezius Botox</option>
<option>Botulinum Toxin Injection – Barbie Arms</option>
<option>Biostimulators / Skin Boosters – Hyaluronic Acid</option>
<option>Biostimulators / Skin Boosters – Polynucleotides</option>
<option>Biostimulators / Skin Boosters – Poly-L-Lactic Acid</option>
<option>Hyaluronic Acid Filler Injection</option>
<option>Mesolipo Fat Dissolving – Face</option>
<option>Mesolipo Fat Dissolving – Body</option>
<option>Mesotherapy – Biostimulators / Skin Boosters</option>
<option>Mesotherapy – Lightening Solutions</option>
<option>Mesotherapy – Hair Growth Solutions</option>
<option>Sclerotherapy for Varicosities</option>
</optgroup>

<optgroup label="Cosmetic Surgery">
<option>Blepharoplasty – Upper / Lower Eyelids</option>
<option>Face Lift – Partial / Full</option>
<option>Rhinoplasty</option>
<option>Thread Lift – Face Cog Thread Lift</option>
<option>Thread Lift – Nose Hiko Thread Lift</option>
</optgroup>

</select>

</div>

<button
className="bookBtn"
onClick={submitAppointment}
>
Request Appointment
</button>

</div>

</main>

</div>

);

}