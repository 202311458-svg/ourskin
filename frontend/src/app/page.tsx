"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import Image from "next/image"
import AuthModal from "@/app/components/AuthModal"

export default function Home() {
  const router = useRouter()
  const [modal, setModal] = useState(false)

  const clinicImages = ["/clinic1.jpg", "/clinic2.jpg", "/clinic3.jpg"]
  const [currentImage, setCurrentImage] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setCurrentImage((prev) => (prev + 1) % clinicImages.length), 3500)
    return () => clearInterval(interval)
  }, [])

  const serviceImages = ["/service1.jpg", "/service2.jpg", "/service3.jpg", "/service4.jpg", "/service5.jpg", "/service6.jpg"]
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [currentService, setCurrentService] = useState(0)

  const prevService = () => setCurrentService((prev) => prev === 0 ? serviceImages.length - 1 : prev - 1)
  const nextService = () => setCurrentService((prev) => (prev + 1) % serviceImages.length)

  const handleLoginSuccess = (role: string, token: string) => {
    localStorage.setItem("token", token)
    localStorage.setItem("role", role)
    setModal(false)
    if (role === "admin") router.push("/pages/admin/dashboard")
    else if (role === "staff") router.push("/pages/staff/dashboard")
    else if (role === "doctor") router.push("/pages/doctor/dashboard")
    else router.push("/pages/patient/dashboard")
  }

  return (
    <div>
      <div className="animatedBackground"></div>

      <nav className="landingnavbar">
        <div className="landingnavLogo">
          <Image src="/navlogo.png" alt="OurSkin" width={190} height={69} />
        </div>

        <div className="landingnavLinks">
          <a href="#about">About</a>
          <a href="#services">Services</a>
          <a href="#doctors">Doctors</a>
          <a href="#contact">Contact</a>
        </div>

        <div className="landingnavActions">
          <button className="loginBtn" onClick={() => setModal(true)}>Login</button>
          <button className="bookBtn" onClick={() => setModal(true)}>Book Appointment</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="heroLeft">
          <h1>Healthy Skin<br />Starts With<br />Expert Care</h1>
          <p>
            OurSkin Dermatology Center provides professional dermatological diagnosis,
            treatment, and skin monitoring supported by modern clinical technology.
          </p>
          <div className="heroButtons">
            <button className="bookBtn" onClick={() => setModal(true)}>Book Consultation</button>
            <button className="outlineBtn" onClick={() => setServiceModalOpen(true)}>Explore Services</button>
          </div>
        </div>

        <div className="heroRight">
          <div className="heroCard">
            <div className="heroGallery">
              <Image src={clinicImages[currentImage]} alt="OurSkin Clinic" width={400} height={220} className="galleryImage" />
            </div>
            <div className="heroStats">
              <div><h3>15+</h3><p>Years Experience</p></div>
              <div><h3>6k+</h3><p>Patients Treated</p></div>
              <div><h3>7</h3><p>Specialists</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE STRIP */}
      <section className="featureStrip">
        <div className="feature"><h4>Certified Dermatologists</h4><p>Board-certified professionals</p></div>
        <div className="feature"><h4>Modern Equipment</h4><p>Latest dermatology technology</p></div>
        <div className="feature"><h4>Digital Patient Records</h4><p>Secure clinical monitoring</p></div>
      </section>

      {/* ABOUT */}
      <section id="about" className="section">
        <h2>About Our Skin</h2>
        <p>OurSkin Dermatology Center is a medical and aesthetic clinic led by a dedicated
          team of PDS board-certified dermatologists and PSCS cosmetic surgeons. We are
          committed to providing safe, effective, and personalized treatments designed
          to support both skin health and aesthetic goals. Through expert care,
          advanced medical techniques, and patient-focused consultations, we help every
          client achieve healthier and more confident skin.</p>
      </section>

      {/* SERVICES */}
      <section id="services" className="section altSection">
        <h2>Dermatology Services</h2>
        <div className="cards">
          {["CONSULTATION", "CONTACT ALLERGY TESTING", "FACIALS", "SURGICAL", "CHEMICAL PEELS", "LASERS AND EBDs", "INJECTABLES", "COSMETIC SURGERY"].map((s, i) => <div key={i} className="serviceCard"><h3>{s}</h3></div>)}
        </div>
      </section>

      {/* DOCTORS */}
      <section id="doctors" className="section">
        <h2>Meet Our Dermatologists</h2>
        <div className="doctorGrid">
          {[
            { img: "/cecilia.png", name: "Cecilia Roxas-Rosete, MD, FPDS", role: "Lead Dermatologist" },
            { img: "/raisa.png", name: "Raisa Rosete, MD, MBA, DPDS", role: "Dermatologist" },
            { img: "/reena.png", name: "Reena Tagle, MD, DPDS", role: "Dermatologist" },
            { img: "/gelaine.png", name: "Gelaine Pangilinan, MD, MBA", role: "Dermatologist" },
            { img: "/hans.png", name: "Hans Alitin, MD, DPDS", role: "Dermatologist" },
            { img: "/reinier.png", name: "Reinier Rosete, MD, FPSCS", role: "Cosmetic Surgeon" },
            { img: "/konrad.png", name: "Konrad Aguila, MD, FPSOHNS, FPSCS", role: "Cosmetic Surgeon" }
          ].map((d, i) => (
            <div key={i} className="doctorCard">
              <Image src={d.img} alt={d.name} width={200} height={200} className="doctorPhoto" />
              <h3>{d.name}</h3>
              <p>{d.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="ctaSection">
        <h2>Start Your Skin Consultation Today</h2>
        <p>Book your consultation today and connect with our dermatologists and cosmetic
          surgeons for professional guidance and treatment tailored to your skin and
          aesthetic needs.</p>
        <button className="bookBtn" onClick={() => setModal(true)}>Schedule Appointment</button>
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

            <button
              className="closeBtn"
              onClick={() => setServiceModalOpen(false)}
            >
              Close
            </button>

          </div>

        </div>

      )}


      {/* AUTH MODAL */}
      {modal && (
        <AuthModal
          isOpen={modal}
          onClose={() => setModal(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

    </div>
  )
}