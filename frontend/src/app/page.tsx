"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import Image from "next/image"

export default function Home() {

  const router = useRouter()

  const [modal, setModal] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // --- Hero Gallery ---
  const clinicImages = [
    "/clinic1.jpg",
    "/clinic2.jpg",
    "/clinic3.jpg",
    "/clinic4.jpg"
  ]
  const [currentImage, setCurrentImage] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % clinicImages.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  // --- Service Gallery Modal ---
  const serviceImages = [
    "/service1.jpg",
    "/service2.jpg",
    "/service3.jpg",
    "/service4.jpg",
    "/service5.jpg",
    "/service6.jpg"
  ]
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [currentService, setCurrentService] = useState(0)

  const prevService = () => {
    setCurrentService((prev) => (prev === 0 ? serviceImages.length - 1 : prev - 1))
  }

  const nextService = () => {
    setCurrentService((prev) => (prev + 1) % serviceImages.length)
  }

  // --- Login Function ---
  const login = async () => {
    if (!email || !password) {
      alert("Please enter email and password")
      return
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.detail || "Login failed")
        return
      }

      const role = String(data.role).trim().toLowerCase()
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("role", role)
      setModal(false)

      if (role === "admin") router.push("/pages/admin/dashboard")
      else if (role === "staff") router.push("/pages/staff/dashboard")
      else if (role === "doctor") router.push("/pages/doctor/dashboard")
      else router.push("/pages/patient/dashboard")

    } catch (err) {
      console.error(err)
      alert("Server error. Make sure backend is running.")
    }
  }

  const closeModal = () => {
    setModal(false)
    setEmail("")
    setPassword("")
  }

  return (
    <div>

      <div className="animatedBackground"></div>

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="navLogo">
          <Image src="/os-logo.png" alt="OurSkin" width={140} height={50} />
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
            onClick={() => { setIsLogin(true); setModal(true) }}
          >Login</button>

          <button
            className="bookBtn"
            onClick={() => { setIsLogin(true); setModal(true) }}
          >Book Appointment</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="heroLeft">
          <h1>
            Healthy Skin
            <br />
            Starts With
            <br />
            Expert Care
          </h1>

          <p>
            OurSkin Dermatology Center provides professional
            dermatological diagnosis, treatment, and skin
            monitoring supported by modern clinical technology.
          </p>

          <div className="heroButtons">
            <button
              className="bookBtn"
              onClick={() => { setIsLogin(true); setModal(true) }}
            >Book Consultation</button>

            <button
              className="outlineBtn"
              onClick={() => setServiceModalOpen(true)}
            >
              Explore Services
            </button>
          </div>
        </div>

        <div className="heroRight">
          <div className="heroCard">

            {/* --- Hero Gallery --- */}
            <div className="heroGallery">
              <Image
                src={clinicImages[currentImage]}
                alt="OurSkin Clinic"
                width={350}
                height={220}
                className="galleryImage"
              />
            </div>

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
                <h3>7</h3>
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
          OurSkin Dermatology Center is a medical and aesthetic clinic led by a dedicated
          team of PDS board-certified dermatologists and PSCS cosmetic surgeons. We are
          committed to providing safe, effective, and personalized treatments designed
          to support both skin health and aesthetic goals. Through expert care,
          advanced medical techniques, and patient-focused consultations, we help every
          client achieve healthier and more confident skin.
        </p>
      </section>

      {/* SERVICES */}
      <section id="services" className="section altSection">
        <h2>Dermatology Services</h2>
        <div className="cards">
          <div className="serviceCard"><h3>CONSULTATION</h3></div>
          <div className="serviceCard"><h3>CONTACT ALLERGY TESTING</h3></div>
          <div className="serviceCard"><h3>FACIALS</h3></div>
          <div className="serviceCard"><h3>SURGICAL</h3></div>
          <div className="serviceCard"><h3>CHEMICAL PEELS</h3></div>
          <div className="serviceCard"><h3>LASERS AND EBDs</h3></div>
          <div className="serviceCard"><h3>INJECTABLES</h3></div>
          <div className="serviceCard"><h3>COSMETIC SURGERY</h3></div>
        </div>
      </section>

      {/* DOCTORS */}
      <section id="doctors" className="section">
        <h2>Meet Our Dermatologists</h2>
        <div className="doctorGrid">

          <div className="doctorCard">
            <Image src="/cecilia.png" alt="Cecilia Roxas-Rosete, MD, FPDS" width={200} height={200} className="doctorPhoto" />
            <h3>Cecilia Roxas-Rosete, MD, FPDS</h3>
            <p>Lead Dermatologist</p>
          </div>
          <div className="doctorCard">
            <Image src="/raisa.png" alt="Raisa Rosete, MD, MBA, DPDS" width={200} height={200} className="doctorPhoto" />
            <h3>Raisa Rosete, MD, MBA, DPDS</h3>
            <p>Dermatologist</p>
          </div>
          <div className="doctorCard">
            <Image src="/reena.png" alt="Reena Tagle, MD, DPDS" width={200} height={200} className="doctorPhoto" />
            <h3>Reena Tagle, MD, DPDS</h3>
            <p>Dermatologist</p>
          </div>
          <div className="doctorCard">
            <Image src="/gelaine.png" alt="Gelaine Pangilinan, MD, MBA" width={200} height={200} className="doctorPhoto" />
            <h3>Gelaine Pangilinan, MD, MBA</h3>
            <p>Dermatologist</p>
          </div>
          <div className="doctorCard">
            <Image src="/hans.png" alt="Hans Alitin, MD, DPDS" width={200} height={200} className="doctorPhoto" />
            <h3>Hans Alitin, MD, DPDS</h3>
            <p>Dermatologist</p>
          </div>
          <div className="doctorCard">
            <Image src="/reinier.png" alt="Reinier Rosete, MD, FPSCS" width={200} height={200} className="doctorPhoto" />
            <h3>Reinier Rosete, MD, FPSCS</h3>
            <p>Cosmetic Surgeon</p>
          </div>
          <div className="doctorCard">
            <Image src="/konrad.png" alt="Konrad Aguila, MD, FPSOHNS, FPSCS" width={200} height={200} className="doctorPhoto" />
            <h3>Konrad Aguila, MD, FPSOHNS, FPSCS</h3>
            <p>Cosmetic Surgeon</p>
          </div>

        </div>
      </section>

      {/* CTA */}
      <section className="ctaSection">
        <h2>Start Your Skin Consultation Today</h2>
        <p>
          Book your consultation today and connect with our dermatologists and cosmetic
          surgeons for professional guidance and treatment tailored to your skin and
          aesthetic needs.
        </p>
        <button
          className="bookBtn"
          onClick={() => { setIsLogin(true); setModal(true) }}
        >Schedule Appointment</button>
      </section>

      {/* CONTACT */}

      <section id="contact" className="section">

        <h2>Visit Our Clinic</h2>

        <div className="contactGrid">

          <div className="contactCard">
            <h3>Location</h3>
            <b>⠀ ⠀ ⠀ ⠀ ⠀</b>
            <p>3rd Floor, C&C Commercial Hub, No. 730 Rizal Avenue,</p>
            <p>East Tapinac, Olongapo City, Olongapo, Philippines, 2200</p>
            <b>⠀ ⠀ ⠀ ⠀ ⠀</b>
            <a href="https://www.google.com/maps/place/OurSkin+Dermatology+Center/@14.8310851,120.2780988,17z/data=!4m6!3m5!1s0x3396715b43c93d4f:0x2fb387e5aeae1007!8m2!3d14.8310799!4d120.2806737!16s%2Fg%2F11xv4qj05q?entry=ttu&g_ep=EgoyMDI2MDMwNC4xIKXMDSoASAFQAw%3D%3D" target="_blank" rel="noopener noreferrer">
              <button className="mainBtn">View on Google Maps</button>
            </a>
          </div>

          <div className="contactCard">
            <h3>Clinic Hours</h3>
            <b>⠀ ⠀ ⠀ ⠀ ⠀</b>
            <p>Monday – Saturday</p>
            <p>12:00 NN – 7:00 PM</p>
            <b>⠀ ⠀ ⠀ ⠀ ⠀</b>
            <p>Doctors&apos; clinic hours vary by schedule and may change unexpectedly. </p>
          </div>

          <div className="contactCard">

            <h3>Online Inquiry</h3>
            <div className="contactButtons">
              <a href="https://www.facebook.com/profile.php?id=61574827784283" target="_blank">
                <button className="mainBtn">Message us on Facebook</button>
              </a>

              <a href="https://www.instagram.com/ourskin.center" target="_blank">
                <button className="mainBtn">Message us on Instagram</button>
              </a>

              <div className="contactInfo">
                <p>Email: ourskincenter@gmail.com</p>
                <p>Call: 0998 887 8050 - Ms. Lanie</p>
              </div>

            </div>

          </div>

        </div>

      </section>
      
      {/* FOOTER */}
      <footer className="footer">
        <p>© OurSkin Dermatology Center</p>
      </footer>

      {/* LOGIN MODAL */}
      {modal && (
        <div className="modal">
          <div className="modalCard">
            <h2>{isLogin ? "Login to Continue Booking" : "Create an Account"}</h2>
            <form onSubmit={(e) => { e.preventDefault(); login() }}>
              <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button className="submitBtn" type="submit">{isLogin ? "Login" : "Register"}</button>
            </form>
            <p className="switch">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <span style={{ cursor: "pointer" }} onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? " Register" : " Login"}
              </span>
            </p>
            <button className="closeBtn" onClick={closeModal}>Close</button>
          </div>
        </div>
      )}

      {/* SERVICE MODAL */}
      {serviceModalOpen && (
        <div className="modal">
          <div className="serviceModal">
            <h1>Our Services</h1>
            <div className="serviceGallery">
              <button className="arrowPrev" onClick={prevService}>⟨</button>
              <Image
                src={serviceImages[currentService]}
                alt={`Service ${currentService + 1}`}
                width={500}
                height={600}
              />
              <button className="arrowNext" onClick={nextService}>⟩</button>
            </div>
            <button className="closeBtn" onClick={() => setServiceModalOpen(false)}>Close</button>
          </div>
        </div>
      )}

    </div>
  )
}