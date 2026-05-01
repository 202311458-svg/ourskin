"use client"

import { API_BASE_URL } from "@/lib/api"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { FaCalendarAlt, FaEye, FaEyeSlash, FaMoon, FaSun } from "react-icons/fa"
import styles from "./register.module.css"

export default function RegisterPage() {
  const router = useRouter()

  const [darkMode, setDarkMode] = useState(false)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")

  const [dateOfBirth, setDateOfBirth] = useState("")
  const [dobMonth, setDobMonth] = useState("")
  const [dobDay, setDobDay] = useState("")
  const [dobYear, setDobYear] = useState("")

  const [contact, setContact] = useState("")
  const [email, setEmail] = useState("")

  const [guardianFirstName, setGuardianFirstName] = useState("")
  const [guardianLastName, setGuardianLastName] = useState("")
  const [guardianRelationship, setGuardianRelationship] = useState("")
  const [guardianContact, setGuardianContact] = useState("")
  const [guardianEmail, setGuardianEmail] = useState("")
  const [guardianConsent, setGuardianConsent] = useState(false)

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false)

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [openPolicy, setOpenPolicy] = useState<"terms" | "privacy" | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const savedMode = localStorage.getItem("ourskinDarkMode")
    const isDark =
      savedMode === "true" || document.body.classList.contains("darkMode")

    setDarkMode(isDark)

    if (isDark) {
      document.body.classList.add("darkMode")
    } else {
      document.body.classList.remove("darkMode")
    }
  }, [])

  const toggleDarkMode = () => {
    const nextMode = !darkMode

    setDarkMode(nextMode)
    localStorage.setItem("ourskinDarkMode", String(nextMode))

    if (nextMode) {
      document.body.classList.add("darkMode")
    } else {
      document.body.classList.remove("darkMode")
    }
  }

  const todayISO = new Date().toISOString().split("T")[0]

 
  const currentYear = new Date().getFullYear()

const monthOptions = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
]

const yearOptions = Array.from({ length: 120 }, (_, index) =>
  String(currentYear - index)
)

const getDaysInMonth = (year: string, month: string) => {
  if (!year || !month) return 31
  return new Date(Number(year), Number(month), 0).getDate()
}

const daysInSelectedMonth = getDaysInMonth(dobYear, dobMonth)

const dayOptions = Array.from({ length: daysInSelectedMonth }, (_, index) =>
  String(index + 1).padStart(2, "0")
)


useEffect(() => {
  if (dobDay && Number(dobDay) > daysInSelectedMonth) {
    setDobDay("")
  }
}, [dobMonth, dobYear, dobDay, daysInSelectedMonth])

useEffect(() => {
  if (dobYear && dobMonth && dobDay) {
    setDateOfBirth(`${dobYear}-${dobMonth}-${dobDay}`)
  } else {
    setDateOfBirth("")
  }
}, [dobYear, dobMonth, dobDay])


  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&]/.test(password),
  }

  const isPasswordStrong =
    passwordChecks.length &&
    passwordChecks.uppercase &&
    passwordChecks.number &&
    passwordChecks.special

  const passwordsMatch = confirmPassword === password

  const parseDateInput = (birthDate: string) => {
    const [year, month, day] = birthDate.split("-").map(Number)
    return new Date(year, month - 1, day)
  }

  const getAgeInMonths = (birthDate: string) => {
    if (!birthDate) return 0

    const today = new Date()
    const dob = parseDateInput(birthDate)

    let months =
      (today.getFullYear() - dob.getFullYear()) * 12 +
      (today.getMonth() - dob.getMonth())

    if (today.getDate() < dob.getDate()) {
      months -= 1
    }

    return months
  }

  const ageInMonths = getAgeInMonths(dateOfBirth)
  const isMinor = Boolean(dateOfBirth) && ageInMonths < 216
  const isBelowMinimumAge = Boolean(dateOfBirth) && ageInMonths < 3

  const getAgeLabel = () => {
  if (!dateOfBirth) return ""

  if (ageInMonths < 12) {
    return `${ageInMonths} month${ageInMonths === 1 ? "" : "s"} old`
  }

  const years = Math.floor(ageInMonths / 12)
  const months = ageInMonths % 12

  if (months === 0) {
    return `${years} year${years === 1 ? "" : "s"} old`
  }

  return `${years} year${years === 1 ? "" : "s"} and ${months} month${
    months === 1 ? "" : "s"
  } old`
}

  const isValidEmailFormat = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  }

  const isValidContactNumber = (value: string) => {
    return /^(09\d{9}|\+639\d{9})$/.test(value.trim())
  }

  const resetFields = () => {
    setFirstName("")
    setLastName("")

    setDateOfBirth("")
    setDobMonth("")
    setDobDay("")
    setDobYear("")

    setContact("")
    setEmail("")

    setGuardianFirstName("")
    setGuardianLastName("")
    setGuardianRelationship("")
    setGuardianContact("")
    setGuardianEmail("")
    setGuardianConsent(false)

    setPassword("")
    setConfirmPassword("")
    setAcceptedTerms(false)
    setPasswordTouched(false)
    setConfirmPasswordTouched(false)
    setShowPassword(false)
    setShowConfirmPassword(false)
    setOpenPolicy(null)
  }

  const register = async () => {
    setPasswordTouched(true)
    setConfirmPasswordTouched(true)

    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()

    if (trimmedFirstName.length < 2) {
      alert("Please enter a valid first name.")
      return
    }

    if (trimmedLastName.length < 2) {
      alert("Please enter a valid last name.")
      return
    }

    if (!dateOfBirth) {
      alert("Please enter the patient's date of birth.")
      return
    }

    if (isBelowMinimumAge) {
      alert("Patient must be at least 3 months old to register.")
      return
    }

    const accountEmail = isMinor ? guardianEmail.trim() : email.trim()
    const accountContact = isMinor ? guardianContact.trim() : contact.trim()

    if (isMinor) {
      if (!guardianFirstName.trim() || !guardianLastName.trim()) {
        alert("Please enter the parent or guardian's full name.")
        return
      }

      if (!guardianRelationship.trim()) {
        alert("Please enter the guardian's relationship to the patient.")
        return
      }

      if (!isValidContactNumber(accountContact)) {
        alert(
          "Please enter a valid guardian contact number. Example: 09123456789 or +639123456789."
        )
        return
      }

      if (!isValidEmailFormat(accountEmail)) {
        alert("Please enter a valid guardian email address.")
        return
      }

      if (!guardianConsent) {
        alert("Please confirm parent or guardian consent before registering.")
        return
      }
    } else {
      if (!isValidContactNumber(accountContact)) {
        alert(
          "Please enter a valid contact number. Example: 09123456789 or +639123456789."
        )
        return
      }

      if (!isValidEmailFormat(accountEmail)) {
        alert("Please enter a valid email address.")
        return
      }
    }

    if (!isPasswordStrong) {
      alert(
        "Please use a strong password with at least 8 characters, 1 uppercase letter, 1 number, and 1 special character."
      )
      return
    }

    if (!passwordsMatch) {
      alert("Confirm password does not match.")
      return
    }

    if (!acceptedTerms) {
      alert(
        "Please accept the Terms and Conditions and Privacy Policy before registering."
      )
      return
    }

    try {
      setLoading(true)

      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          date_of_birth: dateOfBirth,

          email: accountEmail,
          contact: accountContact,

          password,
          confirm_password: confirmPassword,

          guardian_first_name: isMinor ? guardianFirstName.trim() : null,
          guardian_last_name: isMinor ? guardianLastName.trim() : null,
          guardian_relationship: isMinor ? guardianRelationship.trim() : null,
          guardian_contact: isMinor ? guardianContact.trim() : null,
          guardian_email: isMinor ? guardianEmail.trim() : null,
          guardian_consent: isMinor ? guardianConsent : false,

          terms_accepted: acceptedTerms,
          privacy_accepted: acceptedTerms,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (typeof data.detail === "string") {
          alert(data.detail)
          return
        }

        alert("Registration failed. Please check your details and try again.")
        return
      }

      alert("Account created. Please check your email to verify before logging in.")
      resetFields()
      router.push("/")
    } catch (error) {
      console.error("Registration error:", error)
      alert("Failed to connect to the server. Please make sure the backend is running.")
    } finally {
      setLoading(false)
    }
  }

  const isSubmitDisabled =
    loading ||
    !firstName.trim() ||
    !lastName.trim() ||
    !dateOfBirth ||
    isBelowMinimumAge ||
    !isPasswordStrong ||
    !passwordsMatch ||
    !acceptedTerms ||
    (isMinor &&
      (!guardianFirstName.trim() ||
        !guardianLastName.trim() ||
        !guardianRelationship.trim() ||
        !guardianContact.trim() ||
        !guardianEmail.trim() ||
        !guardianConsent)) ||
    (!isMinor && (!contact.trim() || !email.trim()))

  return (
    <main className={styles.registerLandingPage}>
      <div className={styles.animatedBackground} />

      <nav className={styles.registerNavbar}>
<Link href="/" className={styles.registerLogoLink}>
  <div className={styles.registerNavLogo}>
    <Image src="/navlogo.png" alt="OurSkin" width={190} height={69} priority />
  </div>
</Link>

        <div className={styles.registerNavLinks}>
          <Link href="/#about">About</Link>
          <Link href="/#services">Services</Link>
          <Link href="/#doctors">Doctors</Link>
          <Link href="/#contact">Contact</Link>
        </div>

        <div className={styles.registerNavActions}>
          <button
            type="button"
            className={styles.registerThemeBtn}
            onClick={toggleDarkMode}
          >
            {darkMode ? <FaSun /> : <FaMoon />}
            <span>{darkMode ? "Light" : "Dark"}</span>
          </button>

          <button
            type="button"
            className={styles.registerLoginBtn}
            onClick={() => router.push("/")}
          >
            Login
          </button>
        </div>
      </nav>

      <section className={styles.registerHero}>
        <div className={styles.registerIntro}>
          <p className={styles.registerEyebrow}>OurSkin Patient Registration</p>

          <h1>
            Create your
            <br />
            OurSkin account
          </h1>

          <p>
            Register the patient’s details to start booking appointments with
            OurSkin Dermatology Center. For patients below 18 years old, a
            parent or legal guardian must manage the account.
          </p>

          <div className={styles.registerHighlights}>
            <div>
              <h3>3mo+</h3>
              <p>Patients accepted</p>
            </div>

            <div>
              <h3>Secure</h3>
              <p>Email verification</p>
            </div>

            <div>
              <h3>Care</h3>
              <p>Guardian support</p>
            </div>
          </div>
        </div>

       <section className={styles.registerPanel}>
  <div className={styles.registerPanelHeader}>
    <h2>Create an Account</h2>
  </div>

  <form
    className={styles.registerForm}
    onSubmit={(e) => {
      e.preventDefault()
      register()
    }}
  >
    <div className={styles.registerGrid}>
      <div className={styles.registerField}>
        <label>First Name</label>
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Enter first name"
        />
      </div>

      <div className={styles.registerField}>
        <label>Last Name</label>
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Enter last name"
        />
      </div>
    </div>

    <div className={styles.registerField}>
      <label>Date of Birth</label>

      <div className={styles.dobCard}>
        <div className={styles.dobIcon}>
          <FaCalendarAlt />
        </div>

        <div className={styles.dobGrid}>
          <select value={dobMonth} onChange={(e) => setDobMonth(e.target.value)}>
            <option value="">Month</option>
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>

          <select value={dobDay} onChange={(e) => setDobDay(e.target.value)}>
            <option value="">Day</option>
            {dayOptions.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>

          <select value={dobYear} onChange={(e) => setDobYear(e.target.value)}>
            <option value="">Year</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {dateOfBirth && (
        <p className={styles.dobPreview}>
          Selected date: <strong>{dateOfBirth}</strong> · {getAgeLabel()}
        </p>
      )}

      {isBelowMinimumAge && (
        <p className={styles.registerError}>
          Patient must be at least 3 months old to register.
        </p>
      )}

      {dateOfBirth && isMinor && (
        <p className={styles.registerInfo}>
          This patient is below 18 years old. Guardian details are required.
        </p>
      )}
    </div>

    {dateOfBirth && isMinor ? (
      <>
        <div className={styles.registerDivider} />

        <div className={styles.registerGrid}>
          <div className={styles.registerField}>
            <label>Guardian First Name</label>
            <input
              value={guardianFirstName}
              onChange={(e) => setGuardianFirstName(e.target.value)}
              placeholder="Enter guardian first name"
            />
          </div>

          <div className={styles.registerField}>
            <label>Guardian Last Name</label>
            <input
              value={guardianLastName}
              onChange={(e) => setGuardianLastName(e.target.value)}
              placeholder="Enter guardian last name"
            />
          </div>
        </div>

        <div className={styles.registerField}>
          <label>Relationship to Patient</label>
          <input
            value={guardianRelationship}
            onChange={(e) => setGuardianRelationship(e.target.value)}
            placeholder="Example: Mother, Father, Legal Guardian"
          />
        </div>

        <div className={styles.registerGrid}>
          <div className={styles.registerField}>
            <label>Guardian Contact Number</label>
            <input
              value={guardianContact}
              onChange={(e) => setGuardianContact(e.target.value)}
              placeholder="09123456789"
            />
          </div>

          <div className={styles.registerField}>
            <label>Guardian Email</label>
            <input
              type="email"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              placeholder="guardian@email.com"
            />
          </div>
        </div>

        <label className={styles.registerCheckbox}>
          <input
            type="checkbox"
            checked={guardianConsent}
            onChange={(e) => setGuardianConsent(e.target.checked)}
          />
          <span>
            I confirm that I am the parent or legal guardian of this minor
            patient and I consent to the collection and processing of the
            patient’s information for appointment booking and dermatology care.
          </span>
        </label>
      </>
    ) : (
      <>
  <div className={styles.registerGrid}>
    <div className={styles.registerField}>
      <label>Contact Number</label>
      <input
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder="09XXXXXXXXX"
      />
    </div>

    <div className={styles.registerField}>
      <label>Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="patient@email.com"
      />
    </div>
  </div>
</>
    )}

  

    <div className={styles.registerField}>
      <label>Password</label>
      <div className={styles.registerPasswordWrap}>
        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setPasswordTouched(true)}
          placeholder="Create password"
        />

        <button type="button" onClick={() => setShowPassword(!showPassword)}>
          {showPassword ? <FaEyeSlash /> : <FaEye />}
        </button>
      </div>

      <p
        className={
          passwordTouched && password.length > 0 && isPasswordStrong
            ? styles.registerValid
            : styles.registerHelper
        }
      >
        Use at least 8 characters with 1 uppercase letter, 1 number, and 1
        special character.
      </p>
    </div>

    <div className={styles.registerField}>
      <label>Confirm Password</label>
      <div className={styles.registerPasswordWrap}>
        <input
          type={showConfirmPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => setConfirmPasswordTouched(true)}
          placeholder="Confirm password"
        />

        <button
          type="button"
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
        >
          {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
        </button>
      </div>

      {confirmPasswordTouched &&
        confirmPassword.length > 0 &&
        !passwordsMatch && (
          <p className={styles.registerError}>
            Confirm password does not match.
          </p>
        )}
    </div>

    <label className={styles.registerCheckbox}>
      <input
        type="checkbox"
        checked={acceptedTerms}
        onChange={(e) => setAcceptedTerms(e.target.checked)}
      />

      <span>
        I agree to the{" "}
        <button
          type="button"
          className={styles.registerPolicyBtn}
          onClick={() => setOpenPolicy("terms")}
        >
          Terms and Conditions
        </button>{" "}
        and{" "}
        <button
          type="button"
          className={styles.registerPolicyBtn}
          onClick={() => setOpenPolicy("privacy")}
        >
          Privacy Policy
        </button>
        .
      </span>
    </label>

    <button
      className={styles.registerSubmit}
      type="submit"
      disabled={isSubmitDisabled}
    >
      {loading ? "Creating Account..." : "Create Account"}
    </button>

    <p className={styles.registerLoginText}>
      Already have an account? <Link href="/">Go back to Login</Link>
    </p>
  </form>
</section>
        </section>

      {openPolicy && (
        <div
          className={styles.registerPolicyOverlay}
          onClick={() => setOpenPolicy(null)}
        >
          <div
            className={styles.registerPolicyModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.registerPolicyHeader}>
              <h2>
                {openPolicy === "terms"
                  ? "Terms and Conditions"
                  : "Privacy Policy"}
              </h2>

              <button type="button" onClick={() => setOpenPolicy(null)}>
                ×
              </button>
            </div>

            <div className={styles.registerPolicyBody}>
              {openPolicy === "terms" ? (
                <>
                  <p>
                    Welcome to OurSkin. By creating an account and using this
                    platform, you agree to provide accurate and updated
                    information for account registration, appointment booking,
                    and clinic-related communication.
                  </p>

                  <h3>Appointment Requests</h3>
                  <p>
                    Appointment requests submitted through the system are subject
                    to clinic review, availability, and confirmation.
                  </p>

                  <h3>Medical and System Limitations</h3>
                  <p>
                    OurSkin supports clinic workflows but does not replace
                    professional medical advice, diagnosis, or treatment.
                  </p>

                  <h3>Account Security</h3>
                  <p>
                    Users are responsible for keeping their account credentials
                    secure and using the platform only for appropriate
                    clinic-related purposes.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    OurSkin collects personal information such as patient name,
                    contact details, email address, date of birth, appointment
                    information, and related account details to support clinic
                    operations.
                  </p>

                  <h3>Minor Patient Information</h3>
                  <p>
                    If the patient is a minor, parent or guardian details and
                    consent may be collected to manage appointment booking and
                    account verification.
                  </p>

                  <h3>Use of Information</h3>
                  <p>
                    Personal information is used for account management,
                    appointment processing, clinic communication, system
                    security, and record maintenance.
                  </p>
                </>
              )}
            </div>

            <button
              type="button"
              className={styles.registerPolicyClose}
              onClick={() => setOpenPolicy(null)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </main>
  )
}