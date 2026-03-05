"use client"

import { useState } from "react"
import Image from "next/image"

export default function Home() {

const [modal,setModal] = useState(false)
const [isLogin,setIsLogin] = useState(true)

return(

<div>

{/* NAVBAR */}

<nav className="navbar">

<div className="navLogo">
<Image src="/os-logo.png" alt="Our Skin" width={140} height={50}/>
</div>

<div className="navLinks">
<a href="#about">About</a>
<a href="#services">Services</a>
<a href="#doctors">Doctors</a>
<a href="#contact">Contact</a>
</div>

<div className="navActions">

<button
className="loginBtn"
onClick={()=>setModal(true)}
>
Login
</button>

<button
className="bookBtn"
onClick={()=>setModal(true)}
>
Book Appointment
</button>

</div>

</nav>


{/* HERO */}

<section className="hero">

<div className="heroLeft">

<h1>
Healthy Skin
<br/>
Starts With
<br/>
Expert Care
</h1>

<p>
Our Skin Dermatology Center provides professional
dermatological diagnosis, treatment, and skin
monitoring supported by modern clinical technology.
</p>

<div className="heroButtons">

<button
className="bookBtn"
onClick={()=>setModal(true)}
>
Book Consultation
</button>

<button className="outlineBtn">
Explore Services
</button>

</div>

</div>


<div className="heroRight">

<div className="heroCard">

<Image
src="/os-logo.png"
alt="clinic"
width={350}
height={200}
/>

<div className="heroStats">

<div>
<h3>15+</h3>
<p>Years Experience</p>
</div>

<div>
<h3>10k+</h3>
<p>Patients Treated</p>
</div>

<div>
<h3>6</h3>
<p>Specialists</p>
</div>

</div>

</div>

</div>

</section>


{/* FEATURE STRIP */}

<section className="featureStrip">

<div className="feature">

<h4>Certified Dermatologists</h4>
<p>Board-certified professionals</p>

</div>

<div className="feature">

<h4>Modern Equipment</h4>
<p>Latest dermatology technology</p>

</div>

<div className="feature">

<h4>Digital Patient Records</h4>
<p>Secure clinical monitoring</p>

</div>

</section>


{/* ABOUT */}

<section id="about" className="section">

<h2>About Our Skin</h2>

<p>
Our Skin Dermatology Center is dedicated to providing
high-quality dermatological care. Our specialists focus
on diagnosis, treatment, and long-term skin health using
advanced medical technologies and personalized care plans.
</p>

</section>


{/* SERVICES */}

<section id="services" className="section altSection">

<h2>Dermatology Services</h2>

<div className="cards">

<div className="serviceCard">
<h3>Acne Treatment</h3>
<p>Medical acne treatment plans for long-term control.</p>
</div>

<div className="serviceCard">
<h3>Laser Dermatology</h3>
<p>Advanced cosmetic and medical laser procedures.</p>
</div>

<div className="serviceCard">
<h3>Skin Diagnostics</h3>
<p>Professional dermatological evaluation.</p>
</div>

<div className="serviceCard">
<h3>Scar Therapy</h3>
<p>Treatment options for acne and surgical scars.</p>
</div>

</div>

</section>


{/* DOCTORS */}

<section id="doctors" className="section">

<h2>Meet Our Dermatologists</h2>

<div className="doctorGrid">

<div className="doctorCard">
<div className="doctorPhoto"></div>
<h3>Cecilia Roxas-Rosete, MD</h3>
<p>Lead Dermatologist</p>
</div>

<div className="doctorCard">
<div className="doctorPhoto"></div>
<h3>Raisa Rosete, MD</h3>
<p>Dermatologist</p>
</div>

<div className="doctorCard">
<div className="doctorPhoto"></div>
<h3>Reena Tagle, MD</h3>
<p>Dermatologist</p>
</div>

<div className="doctorCard">
<div className="doctorPhoto"></div>
<h3>Hans Alitin, MD</h3>
<p>Dermatologist</p>
</div>

</div>

</section>


{/* BOOK CTA */}

<section className="ctaSection">

<h2>Start Your Skin Consultation Today</h2>

<p>
Book an appointment with our dermatology specialists
and receive professional care tailored for your skin.
</p>

<button
className="bookBtn"
onClick={()=>setModal(true)}
>
Schedule Appointment
</button>

</section>


{/* CONTACT */}

<section id="contact" className="section">

<h2>Visit Our Clinic</h2>

<div className="contactGrid">

<div className="contactCard">
<h3>Location</h3>
<p>Olongapo City, Philippines</p>
</div>

<div className="contactCard">
<h3>Clinic Hours</h3>
<p>Monday – Saturday</p>
<p>9:00 AM – 6:00 PM</p>
</div>

<div className="contactCard">

<h3>Online Inquiry</h3>

<a
href="https://www.facebook.com/profile.php?id=61574827784283"
target="_blank"
>

<button className="mainBtn">
Message us on Facebook
</button>

</a>

</div>

</div>

</section>


{/* FOOTER */}

<footer className="footer">

<p>© Our Skin Dermatology Center</p>

</footer>


{/* MODAL */}

{modal && (

<div className="modal">

<div className="modalCard">

<h2>
{isLogin ? "Login to Continue Booking" : "Create an Account"}
</h2>

{!isLogin && (
<input placeholder="Full Name"/>
)}

<input placeholder="Email"/>
<input type="password" placeholder="Password"/>

<button className="submitBtn">
{isLogin ? "Login" : "Register"}
</button>

<p className="switch">

{isLogin ? "Don't have an account?" : "Already have an account?"}

<span onClick={()=>setIsLogin(!isLogin)}>
{isLogin ? " Register" : " Login"}
</span>

</p>

<button
className="closeBtn"
onClick={()=>setModal(false)}
>
Close
</button>

</div>

</div>

)}

</div>

)

}