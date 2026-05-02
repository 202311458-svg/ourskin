"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { FaMoon, FaSun } from "react-icons/fa";
import AuthModal from "@/app/components/AuthModal";
import { useDarkMode } from "@/app/hooks/useDarkMode";
import styles from "@/app/styles/landing.module.css";

type ServiceCategory = {
  title: string;
  shortTitle: string;
  description: string;
  posterIndex: number;
};

type Doctor = {
  img: string;
  name: string;
  role: string;
};

export default function Home() {
  const router = useRouter();

  const [modal, setModal] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [currentService, setCurrentService] = useState(0);

  const { darkMode, toggleDarkMode } = useDarkMode();

  const serviceImages = [
    "/service1.jpg",
    "/service2.jpg",
    "/service3.jpg",
    "/service4.jpg",
    "/service5.jpg",
    "/service6.jpg",
    "/service7.jpg",
  ];

  const serviceCategories: ServiceCategory[] = [
    {
      title: "Consultation and Assessment",
      shortTitle: "Consultation",
      description:
        "Face-to-face and online dermatology consultation for skin, hair, and nail concerns, including mole assessment and skin cancer screening.",
      posterIndex: 0,
    },
    {
      title: "Contact Allergy Testing",
      shortTitle: "Allergy Testing",
      description:
        "Patch testing support for patients who need professional evaluation of possible contact allergies.",
      posterIndex: 0,
    },
    {
      title: "OurSkin Signature Facials",
      shortTitle: "Facials",
      description:
        "Signature facial treatments designed to support acne care, brightening, anti-aging, and overall skin health.",
      posterIndex: 0,
    },
    {
      title: "Surgical Procedures",
      shortTitle: "Surgical",
      description:
        "Minor dermatologic procedures for selected skin, nail, scar, wart, growth, biopsy, and removal concerns.",
      posterIndex: 1,
    },
    {
      title: "Chemical Peels",
      shortTitle: "Peels",
      description:
        "Professional peel treatments for acne, pigmentation, acne scars, rejuvenation, and selected resurfacing needs.",
      posterIndex: 1,
    },
    {
      title: "Lasers and Energy-Based Devices",
      shortTitle: "Lasers and EBDs",
      description:
        "Advanced laser and energy-based treatments for pigmentation, acne scars, tightening, rejuvenation, hair removal, and selected skin concerns.",
      posterIndex: 2,
    },
    {
      title: "Injectables",
      shortTitle: "Injectables",
      description:
        "Injectable dermatology and aesthetic treatments for selected skin, lifting, contouring, booster, and filler needs.",
      posterIndex: 4,
    },
    {
      title: "Cosmetic Surgery",
      shortTitle: "Cosmetic Surgery",
      description:
        "Cosmetic surgical options for selected facial aesthetic concerns, including eyelid enhancement, face lift, rhinoplasty, and thread lifting.",
      posterIndex: 6,
    },
  ];

  const doctors: Doctor[] = [
    {
      img: "/cecilia.png",
      name: "Cecilia Roxas-Rosete, MD, FPDS",
      role: "Lead Dermatologist",
    },
    {
      img: "/raisa.png",
      name: "Raisa Rosete, MD, MBA, DPDS",
      role: "Dermatologist",
    },
    {
      img: "/reena.png",
      name: "Reena Tagle, MD, DPDS",
      role: "Dermatologist",
    },
    {
      img: "/gelaine.png",
      name: "Gelaine Pangilinan, MD, MBA",
      role: "Dermatologist",
    },
    {
      img: "/hans.png",
      name: "Hans Alitin, MD, DPDS",
      role: "Dermatologist",
    },
    {
      img: "/reinier.png",
      name: "Reinier Rosete, MD, FPSCS",
      role: "Cosmetic Surgeon",
    },
    {
      img: "/konrad.png",
      name: "Konrad Aguila, MD, FPSOHNS, FPSCS",
      role: "Cosmetic Surgeon",
    },
  ];

  const prevService = () => {
    setCurrentService((prev) =>
      prev === 0 ? serviceImages.length - 1 : prev - 1
    );
  };

  const nextService = () => {
    setCurrentService((prev) => (prev + 1) % serviceImages.length);
  };

  const openServicePoster = (posterIndex: number) => {
    setCurrentService(posterIndex);
    setServiceModalOpen(true);
  };

  const handleLoginSuccess = (role: string, token: string) => {
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);

    setModal(false);

    if (role === "admin") {
      router.push("/pages/admin/dashboard");
    } else if (role === "staff") {
      router.push("/pages/staff/dashboard");
    } else if (role === "doctor") {
      router.push("/pages/doctor/dashboard");
    } else {
      router.push("/pages/patient/dashboard");
    }
  };

  return (
    <main className={`${styles.osLanding} ${darkMode ? styles.osDark : ""}`}>
      <div className={`${styles.osBgGlow} ${styles.osBgGlowOne}`}></div>
      <div className={`${styles.osBgGlow} ${styles.osBgGlowTwo}`}></div>

      {/* NAVBAR */}
      <nav className={styles.osNav}>
        <a href="#top" className={styles.osLogoWrap} aria-label="OurSkin Home">
          <Image src="/navlogo.png" alt="OurSkin" width={190} height={69} />
        </a>

        <div className={styles.osNavLinks}>
          <a href="#services">Services</a>
          <a href="#about">About</a>
          <a href="#doctors">Doctors</a>
          <a href="#contact">Contact</a>
        </div>

        <div className={styles.osNavActions}>
          <button
            type="button"
            className={styles.osThemeBtn}
            onClick={toggleDarkMode}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <FaSun /> : <FaMoon />}
            <span>{darkMode ? "Light" : "Dark"}</span>
          </button>

          <button
            type="button"
            className={styles.osLoginBtn}
            onClick={() => setModal(true)}
          >
            Login
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section id="top" className={styles.osHero}>
        <div className={styles.osHeroText}>
          <span className={styles.osKicker}>OurSkin Dermatology Center</span>

          <h1>
            See Our Services
            <span>Before You Book</span>
          </h1>

          <p>
            Explore dermatology consultations, facials, peels, laser procedures,
            injectables, cosmetic surgery, and allergy testing in one modern skin
            care center.
          </p>

          <div className={styles.osHeroButtons}>
            <button
              type="button"
              className={styles.osPrimaryBtn}
              onClick={() => setModal(true)}
            >
              Book Consultation
            </button>

            <a href="#services" className={styles.osSecondaryBtn}>
              View Services
            </a>
          </div>
        </div>

        <div className={styles.osHeroPanel}>
          <div className={styles.osHeroPanelHeader}>
            <span>Featured Services</span>
            <h2>Start with the care you need.</h2>
          </div>

          <div className={styles.osHeroServiceList}>
            {serviceCategories.slice(0, 6).map((service, index) => (
              <button
                type="button"
                key={service.title}
                className={styles.osHeroServiceItem}
                onClick={() => openServicePoster(service.posterIndex)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>

                <div>
                  <strong>{service.shortTitle}</strong>
                  <small>{service.title}</small>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section
        id="services"
        className={`${styles.osSection} ${styles.osServicesSection}`}
      >
        <div className={styles.osSectionHeader}>
          <span className={styles.osKicker}>Services</span>
          <h2>Professional Skin Care, Clearly Presented</h2>
          <p>
            Patients can quickly understand what OurSkin offers without going
            through long lists. Detailed posters are still available when needed.
          </p>
        </div>

        <div className={styles.osServiceGrid}>
          {serviceCategories.map((service, index) => (
            <article key={service.title} className={styles.osServiceCard}>
              <div className={styles.osServiceNumber}>
                {String(index + 1).padStart(2, "0")}
              </div>

              <div className={styles.osServiceContent}>
                <span>{service.shortTitle}</span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </div>

              <div className={styles.osServiceActions}>
                <button
                  type="button"
                  onClick={() => openServicePoster(service.posterIndex)}
                >
                  View Details
                </button>

                <button type="button" onClick={() => setModal(true)}>
                  Book
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

{/* ABOUT */}
<section
  id="about"
  className={`${styles.osSection} ${styles.osAboutMinimalSection}`}
>
  <div className={styles.osAboutMinimal}>
    <div className={styles.osAboutMinimalIntro}>
      <span className={styles.osKicker}>About OurSkin</span>

      <h2>Specialist skin care with a more organized patient experience.</h2>

      <p>
        OurSkin Dermatology Center provides medical, aesthetic, and cosmetic
        skin care services supported by professional consultation, digital
        records, and follow-up care.
      </p>
    </div>

    <div className={styles.osAboutMinimalBody}>
      <div className={styles.osAboutMinimalText}>
        <p>
          Led by dermatologists and cosmetic surgeons, OurSkin focuses on safe,
          personalized treatment planning for skin, hair, and aesthetic
          concerns.
        </p>

        <div className={styles.osAboutMinimalPoints}>
          <div>
            <strong>Professional care</strong>
            <span>Consultation guided by skin concerns and treatment needs.</span>
          </div>

          <div>
            <strong>Digital support</strong>
            <span>Online booking, patient records, and follow-up monitoring.</span>
          </div>

          <div>
            <strong>Comfortable setting</strong>
            <span>A calm clinic environment designed for better visits.</span>
          </div>
        </div>
      </div>

      <div className={styles.osAboutMinimalPhotos}>
        <Image
          src="/clinic2.jpg"
          alt="OurSkin clinic reception area"
          width={420}
          height={280}
        />

        <Image
          src="/clinic3.jpg"
          alt="OurSkin clinic interior"
          width={420}
          height={280}
        />
      </div>
    </div>
  </div>
</section>

      {/* DOCTORS */}
      <section
        id="doctors"
        className={`${styles.osSection} ${styles.osDoctorsSection}`}
      >
        <div className={styles.osSectionHeader}>
          <span className={styles.osKicker}>Doctors</span>
          <h2>Meet the Specialists Behind OurSkin</h2>

          <p>
            OurSkin is supported by dermatologists and cosmetic surgeons who
            provide professional guidance across medical, aesthetic, and cosmetic
            care.
          </p>
        </div>

        <div className={styles.osDoctorGrid}>
          {doctors.map((doctor) => (
            <article key={doctor.name} className={styles.osDoctorCard}>
              <Image
                src={doctor.img}
                alt={doctor.name}
                width={220}
                height={220}
              />

              <div>
                <h3>{doctor.name}</h3>
                <p>{doctor.role}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className={styles.osCta}>
        <span>Ready when you are</span>

        <h2>Start your skin care journey with OurSkin.</h2>

        <p>
          Book a consultation and receive professional guidance for your skin,
          hair, aesthetic, or cosmetic concern.
        </p>

        <button type="button" onClick={() => setModal(true)}>
          Schedule Appointment
        </button>
      </section>

      {/* CONTACT */}
      <section
        id="contact"
        className={`${styles.osSection} ${styles.osContactSection}`}
      >
        <div className={styles.osSectionHeader}>
          <span className={styles.osKicker}>Contact</span>

          <h2>Visit or Message OurSkin</h2>

          <p>
            Reach the clinic through our location, social channels, email, or
            contact number.
          </p>
        </div>

        <div className={styles.osContactGrid}>
          <article className={styles.osContactCard}>
            <span>Location</span>
            <h3>OurSkin Dermatology Center</h3>

            <p>
              3rd Floor, C&amp;C Commercial Hub, No. 730 Rizal Avenue, East
              Tapinac, Olongapo City, Philippines, 2200
            </p>

            <a
              href="https://www.google.com/maps/place/OurSkin+Dermatology+Center/@14.8310851,120.2780988,17z/data=!4m6!3m5!1s0x3396715b43c93d4f:0x2fb387e5aeae1007!8m2!3d14.8310799!4d120.2806737!16s%2Fg%2F11xv4qj05q?entry=ttu&g_ep=EgoyMDI2MDMwNC4xIKXMDSoASAFQAw%3D%3D"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Google Maps
            </a>
          </article>

          <article className={styles.osContactCard}>
            <span>Clinic Hours</span>
            <h3>Monday to Saturday</h3>

            <p>
              Clinic hours are from 12:00 NN to 7:00 PM. Doctors&apos; clinic
              hours may vary depending on their schedule.
            </p>
          </article>

          <article className={styles.osContactCard}>
            <span>Online Inquiry</span>
            <h3>Message OurSkin</h3>

            <p>
              Email: ourskincenter@gmail.com
              <br />
              Call: 0998 887 8050
              <br />
              Contact Person: Ms. Lanie
            </p>

            <div className={styles.osSocialLinks}>
              <a
                href="https://www.facebook.com/profile.php?id=61574827784283"
                target="_blank"
                rel="noopener noreferrer"
              >
                Facebook
              </a>

              <a
                href="https://www.instagram.com/ourskin.center"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>
            </div>
          </article>
        </div>
      </section>

      <footer className={styles.osFooter}>
        <p>© OurSkin Dermatology Center</p>
      </footer>

      {/* SERVICE MODAL */}
      {serviceModalOpen && (
        <div className={styles.osModal}>
          <div className={styles.osServiceModal}>
            <div className={styles.osServiceModalHeader}>
              <h2>OurSkin Services</h2>

              <button
                type="button"
                onClick={() => setServiceModalOpen(false)}
                aria-label="Close services modal"
              >
                Close
              </button>
            </div>

            <div className={styles.osServicePosterWrap}>
              <button
                type="button"
                className={`${styles.osPosterArrow} ${styles.osPosterArrowLeft}`}
                onClick={prevService}
                aria-label="Previous service"
              >
                ‹
              </button>

              <Image
                src={serviceImages[currentService]}
                alt={`OurSkin service ${currentService + 1}`}
                width={720}
                height={900}
                priority
              />

              <button
                type="button"
                className={`${styles.osPosterArrow} ${styles.osPosterArrowRight}`}
                onClick={nextService}
                aria-label="Next service"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <AuthModal
          isOpen={modal}
          onClose={() => setModal(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </main>
  );
}