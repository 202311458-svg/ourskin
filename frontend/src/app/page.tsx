"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FaBars, FaMoon, FaSun, FaTimes } from "react-icons/fa";
import AuthModal from "@/app/components/AuthModal";
import { useDarkMode } from "@/app/hooks/useDarkMode";
import styles from "@/app/styles/landing.module.css";

type ServiceCategory = {
  title: string;
  shortTitle: string;
  description: string;
  key: string;
};

type Doctor = {
  img: string;
  name: string;
  role: string;
};

const serviceDetails: Record<string, string[]> = {
  consultation: [
    "Diagnosis and treatment of diseases of the skin, hair, and nails",
    "Face-to-face / online consult",
    "Dermoscopy and mole assessment",
    "Skin cancer screening",
  ],
  allergy: [
    "Patch test",
    "30 allergens (baseline series)",
    "80 allergens (comprehensive series)",
  ],
  facials: [
    "OurSkin acne facial",
    "OurSkin brightening facial",
    "OurSkin anti-aging facial",
  ],
  surgical: [
    "Skin biopsy (punch/shave/incision/excision)",
    "Excision surgery",
    "Incision and drainage",
    "Nail surgery",
    "Scar revision surgery",
    "Wart removal (cautery/laser)",
    "Benign skin growth removal",
    "Callus and corn removal",
    "Subcision",
    "Microneedling",
  ],
  chemicalPeels: [
    "Acne vulgaris and acne scars",
    "Pigmentation (melasma, etc.)",
    "Skin rejuvenation",
    "TCA CROSS for acne scars",
  ],
  lasers: [
    "Ablative CO2 laser",
    "Fractional CO2 laser",
    "Laser peeling",
    "Skin tightening",
    "Skin rejuvenation",
    "Acne scars",
    "Stretch marks",
    "Carbon laser peel",
    "Laser toning",
    "Pigmentation treatment",
    "Hair removal (1064 nm long-pulse Nd:YAG)",
    "Vascular lesions treatment",
    "Radiofrequency skin tightening",
    "High intensity focused ultrasound (HIFU)",
    "Lip lightening",
    "Body lightening",
    "Tattoo removal",
  ],
  injectables: [
    "Intralesional steroid injections",
    "Acne vulgaris treatment",
    "Keloids and hypertrophic scars",
    "Alopecia areata",
    "Botulinum toxin injections (Botox)",
    "Skin boosters",
    "Hyaluronic acid fillers",
    "Mesolipo fat dissolving injections",
    "Hair growth solutions",
    "Sclerotherapy for varicosities",
  ],
  cosmetic: [
    "Blepharoplasty (eyelids)",
    "Face lift (partial/full)",
    "Rhinoplasty",
    "Thread lifting",
  ],
};

const serviceCategories: ServiceCategory[] = [
  {
    title: "Consultation and Assessment",
    shortTitle: "Consultation",
    description:
      "Face-to-face and online dermatology consultation for skin, hair, and nail concerns, including mole assessment and skin cancer screening.",
    key: "consultation",
  },
  {
    title: "Contact Allergy Testing",
    shortTitle: "Allergy Testing",
    description:
      "Patch testing support for patients who need professional evaluation of possible contact allergies.",
    key: "allergy",
  },
  {
    title: "OurSkin Signature Facials",
    shortTitle: "Facials",
    description:
      "Signature facial treatments designed to support acne care, brightening, anti-aging, and overall skin health.",
    key: "facials",
  },
  {
    title: "Surgical Procedures",
    shortTitle: "Surgical",
    description:
      "Minor dermatologic procedures for selected skin, nail, scar, wart, growth, biopsy, and removal concerns.",
    key: "surgical",
  },
  {
    title: "Chemical Peels",
    shortTitle: "Peels",
    description:
      "Professional peel treatments for acne, pigmentation, acne scars, rejuvenation, and selected resurfacing needs.",
    key: "chemicalPeels",
  },
  {
    title: "Lasers and Energy-Based Devices",
    shortTitle: "Lasers and EBDs",
    description:
      "Advanced laser and energy-based treatments for pigmentation, acne scars, tightening, rejuvenation, hair removal, and selected skin concerns.",
    key: "lasers",
  },
  {
    title: "Injectables",
    shortTitle: "Injectables",
    description:
      "Injectable dermatology and aesthetic treatments for selected skin, lifting, contouring, booster, and filler needs.",
    key: "injectables",
  },
  {
    title: "Cosmetic Surgery",
    shortTitle: "Cosmetic Surgery",
    description:
      "Cosmetic surgical options for selected facial aesthetic concerns, including eyelid enhancement, face lift, rhinoplasty, and thread lifting.",
    key: "cosmetic",
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

const dermatologistTeam = doctors.slice(1, 5);
const cosmeticSurgeons = doctors.slice(5);
const clinicalServiceIndexes = [0, 1, 3];
const aestheticServiceIndexes = [2, 4, 5, 6, 7];

export default function Home() {
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [currentService, setCurrentService] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { darkMode, toggleDarkMode } = useDarkMode();

  const openService = (index: number) => {
    setCurrentService(index);
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
      router.push("/pages/patient/home");
    }
  };

  return (
    <main className={`${styles.osLanding} ${darkMode ? styles.osDark : ""}`}>
      <nav className={styles.osNav} aria-label="Primary navigation">
        <div className={styles.osNavInner}>
          <a href="#top" className={styles.osLogoWrap} aria-label="OurSkin home">
            <Image src="/navlogo.png" alt="OurSkin" width={190} height={69} priority />
          </a>

          <div className={styles.osNavLinks}>
            <a href="#services">Services</a>
            <a href="#about">About</a>
            <a href="#doctors">Specialists</a>
            <a href="#experience">Patient Experience</a>
            <a href="#contact">Contact</a>
          </div>

          <div className={styles.osNavActions}>
            <button
              type="button"
              className={styles.osThemeBtn}
              onClick={toggleDarkMode}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              aria-pressed={darkMode}
            >
              {darkMode ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
            </button>

            <button
              type="button"
              className={styles.osLoginBtn}
              onClick={() => setModal(true)}
            >
              Login
            </button>

            <button
              type="button"
              className={styles.osNavBookBtn}
              onClick={() => setModal(true)}
            >
              Book Consultation
            </button>

            <button
              type="button"
              className={styles.osMenuBtn}
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {mobileNavOpen ? <FaTimes aria-hidden="true" /> : <FaBars aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div
          id="mobile-navigation"
          className={`${styles.osMobileNav} ${mobileNavOpen ? styles.osMobileNavOpen : ""}`}
        >
          <a href="#services" onClick={() => setMobileNavOpen(false)}>
            Services
          </a>
          <a href="#about" onClick={() => setMobileNavOpen(false)}>
            About
          </a>
          <a href="#doctors" onClick={() => setMobileNavOpen(false)}>
            Specialists
          </a>
          <a href="#experience" onClick={() => setMobileNavOpen(false)}>
            Patient Experience
          </a>
          <a href="#contact" onClick={() => setMobileNavOpen(false)}>
            Contact
          </a>
          <button
            type="button"
            onClick={() => {
              setMobileNavOpen(false);
              setModal(true);
            }}
          >
            Book Consultation
          </button>
        </div>
      </nav>

      <section id="top" className={styles.osHero}>
        <div className={styles.osHeroCopy}>
          <p className={styles.osEyebrow}>OurSkin Dermatology Center · Olongapo City</p>
          <h1>
            Specialist care for the skin <em>you live in.</em>
          </h1>
          <p className={styles.osHeroLead}>
            Medical dermatology, aesthetic treatments, and cosmetic expertise
            delivered through thoughtful consultation and individualized care.
          </p>

          <div className={styles.osHeroActions}>
            <button
              type="button"
              className={styles.osPrimaryBtn}
              onClick={() => setModal(true)}
            >
              Book Consultation
            </button>
            <a href="#services" className={styles.osTextLink}>
              Explore Services <span aria-hidden="true">↘</span>
            </a>
          </div>

          <div className={styles.osHeroTrust}>
            <div>
              <span>Specialist-led care</span>
              <p>Board-certified dermatologists and cosmetic surgeons.</p>
            </div>
            <div>
              <span>One connected experience</span>
              <p>Consultation, booking, records, and follow-up support.</p>
            </div>
          </div>
        </div>

        <div className={styles.osHeroVisual}>
          <figure className={styles.osHeroImageMain}>
            <Image
              src="/clinic8.jpg"
              alt="OurSkin Dermatology Center clinic interior"
              fill
              sizes="(max-width: 900px) 100vw, 54vw"
              priority
            />
            <figcaption>
              <span>OurSkin Dermatology Center</span>
              <small>Olongapo City, Philippines</small>
            </figcaption>
          </figure>

          <figure className={styles.osHeroImageInset}>
            <Image
              src="/clinic2.jpg"
              alt="A view inside OurSkin Dermatology Center"
              fill
              sizes="(max-width: 900px) 38vw, 18vw"
            />
          </figure>
        </div>
      </section>

      <section id="services" className={`${styles.osSection} ${styles.osServicesSection}`}>
        <div className={styles.osSectionIntro}>
          <div>
            <p className={styles.osEyebrow}>Services</p>
            <h2>Care built around your skin, not a menu of procedures.</h2>
          </div>
          <p>
            OurSkin brings medical dermatology, procedural care, and aesthetic
            treatments together in one specialist-led clinic. Start with a concern;
            your doctor can guide what comes next.
          </p>
        </div>

        <div className={styles.osServicesLayout}>
          <div className={styles.osServiceVisuals} aria-hidden="true">
            <div className={styles.osServiceVisualMain}>
              <Image src="/service1.jpg" alt="" fill sizes="(max-width: 900px) 100vw, 42vw" />
            </div>
            <div className={styles.osServiceVisualPair}>
              <div>
                <Image src="/service4.jpg" alt="" fill sizes="(max-width: 900px) 50vw, 20vw" />
              </div>
              <div>
                <Image src="/service7.jpg" alt="" fill sizes="(max-width: 900px) 50vw, 20vw" />
              </div>
            </div>
          </div>

          <div className={styles.osServiceIndex}>
            <div className={styles.osServiceGroup}>
              <p>Clinical dermatology</p>
              {clinicalServiceIndexes.map((serviceIndex) => {
                const service = serviceCategories[serviceIndex];
                return (
                  <button
                    type="button"
                    key={service.title}
                    className={styles.osServiceRow}
                    onClick={() => openService(serviceIndex)}
                  >
                    <span>{String(serviceIndex + 1).padStart(2, "0")}</span>
                    <strong>{service.title}</strong>
                    <span aria-hidden="true">↗</span>
                  </button>
                );
              })}
            </div>

            <div className={styles.osServiceGroup}>
              <p>Aesthetic & procedural care</p>
              {aestheticServiceIndexes.map((serviceIndex) => {
                const service = serviceCategories[serviceIndex];
                return (
                  <button
                    type="button"
                    key={service.title}
                    className={styles.osServiceRow}
                    onClick={() => openService(serviceIndex)}
                  >
                    <span>{String(serviceIndex + 1).padStart(2, "0")}</span>
                    <strong>{service.title}</strong>
                    <span aria-hidden="true">↗</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className={styles.osSectionCta}
              onClick={() => setModal(true)}
            >
              Book a consultation
            </button>
          </div>
        </div>

        <div className={styles.osServiceFilmstrip} aria-hidden="true">
          {[2, 3, 5, 6].map((imageNumber) => (
            <div key={imageNumber}>
              <Image
                src={`/service${imageNumber}.jpg`}
                alt=""
                fill
                sizes="(max-width: 700px) 42vw, 22vw"
              />
            </div>
          ))}
        </div>
      </section>

      <section id="about" className={`${styles.osSection} ${styles.osAboutSection}`}>
        <div className={styles.osAboutGrid}>
          <div className={styles.osAboutFeature}>
            <Image
              src="/clinic1.jpg"
              alt="OurSkin Dermatology Center consultation space"
              fill
              sizes="(max-width: 900px) 100vw, 50vw"
            />
          </div>

          <div className={styles.osAboutCopy}>
            <p className={styles.osEyebrow}>About OurSkin</p>
            <h2>Specialist skin care, thoughtfully delivered.</h2>
            <p className={styles.osAboutLead}>
              OurSkin Dermatology Center provides medical, aesthetic, and cosmetic
              skin care supported by professional consultation, digital records,
              and follow-up care.
            </p>
            <p>
              Led by Board-certified Dermatologists and Cosmetic Surgeons, OurSkin
              focuses on safe, personalized treatment planning for skin, hair, and
              aesthetic concerns.
            </p>

            <div className={styles.osAboutPrinciples}>
              <div>
                <span>01</span>
                <strong>Professional care</strong>
                <p>Consultation guided by your concerns and treatment needs.</p>
              </div>
              <div>
                <span>02</span>
                <strong>Digital support</strong>
                <p>Online booking, patient records, and follow-up monitoring.</p>
              </div>
              <div>
                <span>03</span>
                <strong>Comfortable setting</strong>
                <p>A calm clinic environment designed for better visits.</p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.osClinicGallery}>
          <figure className={styles.osClinicGalleryWide}>
            <Image
              src="/clinic4.jpg"
              alt="Interior view of OurSkin Dermatology Center"
              fill
              sizes="(max-width: 700px) 100vw, 60vw"
            />
          </figure>
          <figure>
            <Image
              src="/clinic6.jpg"
              alt="Another view of the OurSkin clinic"
              fill
              sizes="(max-width: 700px) 100vw, 32vw"
            />
          </figure>
        </div>
      </section>

      <section id="doctors" className={`${styles.osSection} ${styles.osDoctorsSection}`}>
        <div className={styles.osSectionIntro}>
          <div>
            <p className={styles.osEyebrow}>Our Specialists</p>
            <h2>Expertise you can see. Care you can feel.</h2>
          </div>
          <p>
            Meet the dermatologists and cosmetic surgeons behind OurSkin&apos;s
            medical, aesthetic, and cosmetic care.
          </p>
        </div>

        <article className={styles.osLeadDoctor}>
          <div className={styles.osLeadDoctorImage}>
            <Image
              src={doctors[0].img}
              alt={doctors[0].name}
              fill
              sizes="(max-width: 800px) 100vw, 42vw"
            />
          </div>
          <div className={styles.osLeadDoctorCopy}>
            <p>Lead Dermatologist</p>
            <h3>{doctors[0].name}</h3>
            <span>
              Specialist-led consultation and treatment planning across medical
              and aesthetic dermatology.
            </span>
            <button type="button" onClick={() => setModal(true)}>
              Book a consultation
            </button>
          </div>
        </article>

        <div className={styles.osDoctorRoster}>
          <div className={styles.osDoctorGroup}>
            <div className={styles.osDoctorGroupHeading}>
              <p>Dermatologists</p>
              <span>Medical & aesthetic skin care</span>
            </div>
            <div className={styles.osDoctorList}>
              {dermatologistTeam.map((doctor) => (
                <article key={doctor.name} className={styles.osDoctorRow}>
                  <div className={styles.osDoctorPortrait}>
                    <Image
                      src={doctor.img}
                      alt={doctor.name}
                      fill
                      sizes="96px"
                    />
                  </div>
                  <div>
                    <h3>{doctor.name}</h3>
                    <p>{doctor.role}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className={styles.osDoctorGroup}>
            <div className={styles.osDoctorGroupHeading}>
              <p>Cosmetic Surgeons</p>
              <span>Cosmetic & procedural care</span>
            </div>
            <div className={styles.osDoctorList}>
              {cosmeticSurgeons.map((doctor) => (
                <article key={doctor.name} className={styles.osDoctorRow}>
                  <div className={styles.osDoctorPortrait}>
                    <Image
                      src={doctor.img}
                      alt={doctor.name}
                      fill
                      sizes="96px"
                    />
                  </div>
                  <div>
                    <h3>{doctor.name}</h3>
                    <p>{doctor.role}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="experience" className={`${styles.osSection} ${styles.osExperienceSection}`}>
        <div className={styles.osExperienceHeader}>
          <p className={styles.osEyebrow}>Patient Experience</p>
          <h2>Your care, clearly guided.</h2>
          <p>
            From the first appointment to follow-up care, OurSkin keeps the
            experience organized and easy to understand.
          </p>
        </div>

        <ol className={styles.osProcessList}>
          <li>
            <span>01</span>
            <div>
              <h3>Book your consultation</h3>
              <p>Choose the care you need and begin with an appointment.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Meet your specialist</h3>
              <p>Discuss your concern, history, and treatment goals.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Receive your care plan</h3>
              <p>Your doctor recommends appropriate next steps or treatment.</p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <h3>Stay connected</h3>
              <p>Use OurSkin&apos;s digital support for records and follow-up care.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className={styles.osFinalCta} aria-labelledby="consultation-cta">
        <div>
          <p className={styles.osEyebrow}>When you&apos;re ready</p>
          <h2 id="consultation-cta">Ready to speak with a skin specialist?</h2>
        </div>
        <div className={styles.osFinalCtaActions}>
          <button type="button" onClick={() => setModal(true)}>
            Book Consultation
          </button>
          <a href="tel:+639988878050">Call 0998 887 8050</a>
        </div>
      </section>

      <section id="contact" className={`${styles.osSection} ${styles.osContactSection}`}>
        <div className={styles.osContactVisual}>
          <Image
            src="/clinic7.jpg"
            alt="OurSkin Dermatology Center clinic"
            fill
            sizes="(max-width: 900px) 100vw, 45vw"
          />
        </div>

        <div className={styles.osContactContent}>
          <p className={styles.osEyebrow}>Visit OurSkin</p>
          <h2>OurSkin Dermatology Center</h2>

          <address>
            3rd Floor, C&amp;C Commercial Hub, No. 730 Rizal Avenue,
            <br />
            East Tapinac, Olongapo City, Philippines, 2200
          </address>

          <a
            className={styles.osMapLink}
            href="https://www.google.com/maps/place/OurSkin+Dermatology+Center/@14.8310851,120.2780988,17z/data=!4m6!3m5!1s0x3396715b43c93d4f:0x2fb387e5aeae1007!8m2!3d14.8310799!4d120.2806737!16s%2Fg%2F11xv4qj05q?entry=ttu&g_ep=EgoyMDI2MDMwNC4xIKXMDSoASAFQAw%3D%3D"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Google Maps <span aria-hidden="true">↗</span>
          </a>

          <div className={styles.osContactDetails}>
            <div>
              <span>Clinic hours</span>
              <strong>Monday to Saturday</strong>
              <p>
                12:00 NN to 7:00 PM. Doctors&apos; clinic hours may vary depending
                on their schedule.
              </p>
            </div>
            <div>
              <span>Contact</span>
              <a href="tel:+639988878050">0998 887 8050</a>
              <a href="mailto:ourskincenter@gmail.com">ourskincenter@gmail.com</a>
              <p>Contact Person: Ms. Lanie</p>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.osFooter}>
        <div className={styles.osFooterTop}>
          <div className={styles.osFooterBrand}>
            <Image src="/navlogo.png" alt="OurSkin" width={180} height={66} />
            <p>Dermatology Center · Olongapo City, Philippines</p>
          </div>

          <div className={styles.osFooterLinks}>
            <div>
              <span>Explore</span>
              <a href="#services">Services</a>
              <a href="#doctors">Specialists</a>
              <a href="#about">About</a>
              <a href="#contact">Contact</a>
            </div>
            <div>
              <span>Connect</span>
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
              <a href="mailto:ourskincenter@gmail.com">Email</a>
            </div>
          </div>
        </div>

        <div className={styles.osFooterBottom}>
          <p>© OurSkin Dermatology Center</p>
          <button type="button" onClick={() => setModal(true)}>
            Patient Login
          </button>
        </div>
      </footer>

      {serviceModalOpen && (
        <div
          className={styles.osModal}
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setServiceModalOpen(false);
            }
          }}
        >
          <section
            className={styles.osServiceModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-dialog-title"
          >
            <div className={styles.osServiceModalHeader}>
              <div>
                <p>{serviceCategories[currentService].shortTitle}</p>
                <h2 id="service-dialog-title">
                  {serviceCategories[currentService].title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setServiceModalOpen(false)}
                aria-label="Close service details"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.osServiceModalBody}>
              <p>{serviceCategories[currentService].description}</p>
              <ul>
                {serviceDetails[serviceCategories[currentService].key]?.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className={styles.osServiceModalFooter}>
              <button
                type="button"
                onClick={() => {
                  setServiceModalOpen(false);
                  setModal(true);
                }}
              >
                Book Consultation
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentService((current) =>
                    current === serviceCategories.length - 1 ? 0 : current + 1
                  )
                }
              >
                Next Service
              </button>
            </div>
          </section>
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
