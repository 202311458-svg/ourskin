"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import Image from "next/image"

export default function Home() {

  const router = useRouter()

  const [modal, setModal] = useState(false)
  const [isLogin] = useState(true)

  /* ADDED */
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  /* ADDED */
  const login = async () => {

    try {

      const res = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      })

      if (!res.ok) {
        const text = await res.text()
        console.error("Server error:", text)
        return
      }

      const data = await res.json()

      if (!res.ok) {
        alert(data.detail || "Login failed")
        return
      }

      const role = String(data.role).trim().toLowerCase()

      // save authentication info
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("role", role)

      console.log("ROLE STORED:", localStorage.getItem("role"))

      setModal(false)

      // redirect depending on role
      if (role === "staff" || role === "admin") {
        router.push("/pages/staff/dashboard")
      } else {
        router.push("/pages/patient/dashboard")
      }

    } catch (err) {
      console.error(err)
      alert("Server error")
    }

  }

  return (

    <div>

      {/* NAVBAR */}

      <nav className="navbar">

        <div className="navLogo">
          <Image src="/os-logo.png" alt="Our Skin" width={140} height={50} />
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
            onClick={() => setModal(true)}
          >
            Login
          </button>

          <button
            className="bookBtn"
            onClick={() => setModal(true)}
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
            <br />
            Starts With
            <br />
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
              onClick={() => setModal(true)}
            >
              Book Consultation
            </button>

            <a
              href="https://www.facebook.com/share/p/1HcJPLTfMg/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="outlineBtn">
                Explore Services
              </button>
            </a>

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
            <h3>CONSULTATION</h3>
          </div>

          <div className="serviceCard">
            <h3>CONTACT ALLERGY TESTING</h3>
          </div>

          <div className="serviceCard">
            <h3>FACIALS</h3>
          </div>

          <div className="serviceCard">
            <h3>SURGICAL</h3>
          </div>

          <div className="serviceCard">
            <h3>CHEMICAL PEELS</h3>
          </div>

          <div className="serviceCard">
            <h3>LASERS AND EBDs</h3>
          </div>

          <div className="serviceCard">
            <h3>INJECTABLES</h3>
          </div>

          <div className="serviceCard">
            <h3>COSMETIC SURGERY</h3>
          </div>

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


      {/* BOOK CTA */}

      <section className="ctaSection">

        <h2>Start Your Skin Consultation Today</h2>

        <p>
          Book an appointment with our dermatology specialists
          and receive professional care tailored for your skin.
        </p>

        <button
          className="bookBtn"
          onClick={() => setModal(true)}
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
                <p>Call: 0998 887 8050</p>
              </div>

            </div>

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

            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              className="submitBtn"
              onClick={login}
            >
              {isLogin ? "Login" : "Register"}
            </button>

            <p className="switch">

              {isLogin ? "Don't have an account?" : "Already have an account?"}

              <span
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setModal(false)
                  router.push("/pages/patient/register")
                }}
              >
                Register
              </span>

            </p>

            <button
              className="closeBtn"
              onClick={() => setModal(false)}
            >
              Close
            </button>

          </div>

        </div>

      )}

    </div>

  )

}