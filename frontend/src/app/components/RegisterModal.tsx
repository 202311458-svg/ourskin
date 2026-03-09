"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"


export default function RegisterPage() {



const [fullName, setFullName] = useState("")
const [email, setEmail] = useState("")
const [contact, setContact] = useState("")
const [password, setPassword] = useState("")
const [confirmPassword, setConfirmPassword] = useState("")

const registerUser = async (e: React.FormEvent<HTMLFormElement>) => {
e.preventDefault()

if(password !== confirmPassword){
alert("Passwords do not match")
return
}

try{

const res = await fetch("http://localhost:8000/auth/register", {
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
name:fullName,
email:email,
contact:contact,
password:password
})
})

const data = await res.json()

if(!res.ok){
alert(data.detail || "Registration failed")
return
}

alert("Account created successfully")

}catch(err){
console.error(err)
alert("Server error")
}

}

return(

<div>

{/* NAVBAR */}

<nav className="navbar">

<div className="navLogo">
<Image src="/os-logo.png" alt="Our Skin" width={140} height={50}/>
</div>

<div className="navLinks">
<Link href="/#about">About</Link>
<Link href="/#services">Services</Link>
<Link href="/#doctors">Doctors</Link>
<Link href="/#contact">Contact</Link>
</div>

<div className="navActions">

<Link href="/?login=true">
<button className="loginBtn">
Login
</button>
</Link>

<Link href="/">
<button className="bookBtn">
Home
</button>
</Link>

</div>

</nav>


{/* REGISTER SECTION */}

<section className="section">

<div className="fabric1"></div>
<div className="fabric2"></div>
<div className="fabric3"></div>
<div className="circle c1"></div>
<div className="circle c2"></div>

<div className="heroCard" style={{maxWidth:"520px", margin:"0 auto"}}>

<h1 style={{marginBottom:"30px", color:"#82334c"}}>
Create An Account
</h1>

<form className="formGrid" onSubmit={registerUser}>

<div className="formField">
<label>Full Name</label>
<input 
type="text" 
placeholder="Enter your full name"
value={fullName}
onChange={(e)=>setFullName(e.target.value)}
/>
</div>

<div className="formField">
<label>Email</label>
<input 
type="email" 
placeholder="Enter your email"
value={email}
onChange={(e)=>setEmail(e.target.value)}
/>
</div>

<div className="formField">
<label>Contact Number</label>
<input 
type="text" 
placeholder="09XXXXXXXXX"
value={contact}
onChange={(e)=>setContact(e.target.value)}
/>
</div>

<div className="formField">
<label>Password</label>
<input 
type="password" 
placeholder="Create a password"
value={password}
onChange={(e)=>setPassword(e.target.value)}
/>
</div>

<div className="formField">
<label>Confirm Password</label>
<input 
type="password" 
placeholder="Confirm your password"
value={confirmPassword}
onChange={(e)=>setConfirmPassword(e.target.value)}
/>
</div>

<button className="bookBtn" type="submit">
Create Account
</button>

<p style={{marginTop:"15px", fontSize:"14px"}}>
Already have an account?{" "}
<Link href="/?login=true" style={{color:"#82334c"}}>
Login
</Link>
</p>

</form>

</div>

</section>


{/* FOOTER */}

<footer className="footer">
<p>© Our Skin Dermatology Center</p>
</footer>

</div>

)

}