"use client"

import { API_BASE_URL } from "@/lib/api"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { FaCalendarAlt, FaEye, FaEyeSlash, FaMoon, FaSun } from "react-icons/fa"
import GoogleAuthButton from "@/app/components/GoogleAuthButton"
import { useDarkMode } from "@/app/hooks/useDarkMode"
import landingStyles from "@/app/styles/landing.module.css"
import registerStyles from "@/app/styles/RegisterForm.module.css"
import { getRoleHome, persistAuthSession } from "@/lib/auth-session"

type GoogleOnboarding = {
  token: string
  profile?: { email?: string; first_name?: string; last_name?: string }
}

type Feedback = {
  kind: "error" | "success" | "info"
  message: string
} | null

export default function RegisterPage() {
  const router = useRouter()
  const { darkMode, toggleDarkMode } = useDarkMode()
  const policyDialogRef = useRef<HTMLDivElement>(null)
  const policyCloseRef = useRef<HTMLButtonElement>(null)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")

  const [dateOfBirth, setDateOfBirth] = useState("")
  const [dobMonth, setDobMonth] = useState("")
  const [dobDay, setDobDay] = useState("")
  const [dobYear, setDobYear] = useState("")

  const [address, setAddress] = useState("")
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
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [openPolicy, setOpenPolicy] = useState<"terms" | "privacy" | null>(null)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [googleOnboarding, setGoogleOnboarding] = useState<GoogleOnboarding | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem("googleOnboarding")
    if (!raw) return

    try {
      const saved = JSON.parse(raw) as GoogleOnboarding
      if (!saved.token) return

      setGoogleOnboarding(saved)
      setFirstName(saved.profile?.first_name || "")
      setLastName(saved.profile?.last_name || "")
      setEmail(saved.profile?.email || "")
      setGuardianEmail(saved.profile?.email || "")
    } catch {
      sessionStorage.removeItem("googleOnboarding")
    }
  }, [])

  useEffect(() => {
    if (!openPolicy) return

    const previousActive = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    const frame = window.requestAnimationFrame(() => policyCloseRef.current?.focus())

    document.body.style.overflow = "hidden"

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setOpenPolicy(null)
        return
      }

      if (event.key !== "Tab" || !policyDialogRef.current) return

      const focusable = Array.from(
        policyDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousActive?.focus()
    }
  }, [openPolicy])

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
    setAddress("")
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
    setAcceptedPrivacy(false)
    setPasswordTouched(false)
    setConfirmPasswordTouched(false)
    setShowPassword(false)
    setShowConfirmPassword(false)
    setOpenPolicy(null)
    setFeedback(null)
  }

  const showError = (message: string) => {
    setFeedback({ kind: "error", message })
  }

  const register = async () => {
    setFeedback(null)

    if (!googleOnboarding) {
      setPasswordTouched(true)
      setConfirmPasswordTouched(true)
    }

    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()
    const trimmedAddress = address.trim()

    if (trimmedFirstName.length < 2) {
      showError("Please enter a valid first name.")
      return
    }

    if (trimmedLastName.length < 2) {
      showError("Please enter a valid last name.")
      return
    }

    if (!dateOfBirth) {
      showError("Please enter the patient's date of birth.")
      return
    }

    if (isBelowMinimumAge) {
      showError("Patient must be at least 3 months old to register.")
      return
    }

    if (trimmedAddress.length < 5) {
      showError("Please enter the patient's complete address.")
      return
    }

    const accountEmail = isMinor ? guardianEmail.trim() : email.trim()
    const accountContact = isMinor ? guardianContact.trim() : contact.trim()

    if (isMinor) {
      if (!guardianFirstName.trim() || !guardianLastName.trim()) {
        showError("Please enter the parent or guardian's full name.")
        return
      }

      if (!guardianRelationship.trim()) {
        showError("Please enter the guardian's relationship to the patient.")
        return
      }

      if (!isValidContactNumber(accountContact)) {
        showError(
          "Please enter a valid guardian contact number. Example: 09123456789 or +639123456789."
        )
        return
      }

      if (!isValidEmailFormat(accountEmail)) {
        showError("Please enter a valid guardian email address.")
        return
      }

      if (!guardianConsent) {
        showError("Please confirm parent or guardian consent before registering.")
        return
      }
    } else {
      if (!isValidContactNumber(accountContact)) {
        showError(
          "Please enter a valid contact number. Example: 09123456789 or +639123456789."
        )
        return
      }

      if (!isValidEmailFormat(accountEmail)) {
        showError("Please enter a valid email address.")
        return
      }
    }

    if (!googleOnboarding && !isPasswordStrong) {
      showError(
        "Please use a strong password with at least 8 characters, 1 uppercase letter, 1 number, and 1 special character."
      )
      return
    }

    if (!googleOnboarding && !passwordsMatch) {
      showError("Confirm password does not match.")
      return
    }

    if (!acceptedTerms) {
      showError("Please accept the Terms and Conditions before registering.")
      return
    }

    if (!acceptedPrivacy) {
      showError("Please accept the Privacy Policy before registering.")
      return
    }

    try {
      setLoading(true)

      const res = await fetch(
        `${API_BASE_URL}${googleOnboarding ? "/auth/google/register" : "/auth/register"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...(googleOnboarding ? { onboarding_token: googleOnboarding.token } : {}),
            first_name: trimmedFirstName,
            last_name: trimmedLastName,
            date_of_birth: dateOfBirth,
            address: trimmedAddress,

            email: accountEmail,
            contact: accountContact,

            ...(!googleOnboarding
              ? { password, confirm_password: confirmPassword }
              : {}),

            guardian_first_name: isMinor ? guardianFirstName.trim() : null,
            guardian_last_name: isMinor ? guardianLastName.trim() : null,
            guardian_relationship: isMinor ? guardianRelationship.trim() : null,
            guardian_contact: isMinor ? guardianContact.trim() : null,
            guardian_email: isMinor ? guardianEmail.trim() : null,
            guardian_consent: isMinor ? guardianConsent : false,

            terms_accepted: acceptedTerms,
            privacy_accepted: acceptedPrivacy,
          }),
        }
      )

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (typeof data.detail === "string") {
          showError(data.detail)
          return
        }

        showError("Registration failed. Please check your details and try again.")
        return
      }

      if (googleOnboarding && data.access_token && data.role) {
        persistAuthSession(data)
        sessionStorage.removeItem("googleOnboarding")
        router.push(getRoleHome(data.role))
        return
      }

      window.alert("Account created. Please check your email to verify before logging in.")
      resetFields()
      router.push("/")
    } catch (error) {
      console.error("Registration error:", error)
      showError("Failed to connect to the server. Please make sure the backend is running.")
    } finally {
      setLoading(false)
    }
  }

  const isSubmitDisabled =
    loading ||
    !firstName.trim() ||
    !lastName.trim() ||
    !dateOfBirth ||
    !address.trim() ||
    isBelowMinimumAge ||
    (!googleOnboarding && (!isPasswordStrong || !passwordsMatch)) ||
    !acceptedTerms ||
    !acceptedPrivacy ||
    (isMinor &&
      (!guardianFirstName.trim() ||
        !guardianLastName.trim() ||
        !guardianRelationship.trim() ||
        !guardianContact.trim() ||
        !guardianEmail.trim() ||
        !guardianConsent)) ||
    (!isMinor && (!contact.trim() || !email.trim()))

  const feedbackClass = feedback
    ? `${registerStyles.formFeedback} ${
        feedback.kind === "error"
          ? registerStyles.formFeedbackError
          : feedback.kind === "success"
            ? registerStyles.formFeedbackSuccess
            : registerStyles.formFeedbackInfo
      }`
    : ""

  return (
    <main
      className={`${landingStyles.osLanding} ${
        darkMode ? landingStyles.osDark : ""
      } ${registerStyles.registerLandingPage}`}
    >
      <nav className={landingStyles.osNav} aria-label="Primary navigation">
        <div className={landingStyles.osNavInner}>
          <Link href="/" className={landingStyles.osLogoWrap} aria-label="OurSkin home">
            <Image src="/navlogo.png" alt="OurSkin" width={190} height={69} priority />
          </Link>

          <div className={landingStyles.osNavLinks}>
            <Link href="/#services">Services</Link>
            <Link href="/#about">About</Link>
            <Link href="/#doctors">Specialists</Link>
            <Link href="/#contact">Contact</Link>
          </div>

          <div className={landingStyles.osNavActions}>
            <button
              type="button"
              className={landingStyles.osThemeBtn}
              onClick={toggleDarkMode}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              aria-pressed={darkMode}
            >
              {darkMode ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
            </button>

            <button
              type="button"
              className={landingStyles.osLoginBtn}
              onClick={() => router.push("/")}
            >
              Login
            </button>
          </div>
        </div>
      </nav>

      <section className={registerStyles.registerHero}>
        <aside className={registerStyles.registerIntro} aria-labelledby="register-intro-title">
          <p className={registerStyles.registerEyebrow}>OurSkin Patient Registration</p>
          <h1 id="register-intro-title">A thoughtful start to your care.</h1>
          <p className={registerStyles.registerLead}>
            Create the patient account used for appointment requests, clinic communication,
            and continuity of dermatology care.
          </p>

          <div className={registerStyles.registerPrinciples} aria-label="Registration guidance">
            <div className={registerStyles.registerPrinciple}>
              <span aria-hidden="true" />
              <div>
                <h2>Patient-first details</h2>
                <p>Keep the patient profile accurate so appointments and follow-up stay connected.</p>
              </div>
            </div>

            <div className={registerStyles.registerPrinciple}>
              <span aria-hidden="true" />
              <div>
                <h2>Guardian-aware registration</h2>
                <p>Patients below 18 use a parent or legal guardian’s contact details and consent.</p>
              </div>
            </div>

            <div className={registerStyles.registerPrinciple}>
              <span aria-hidden="true" />
              <div>
                <h2>Secure account access</h2>
                <p>Register with email and password or continue through the existing Google flow.</p>
              </div>
            </div>
          </div>

          <p className={registerStyles.eligibilityNote}>
            <strong>Eligibility</strong>
            <span>Patients must be at least 3 months old.</span>
          </p>
        </aside>

        <section className={registerStyles.registerPanel} aria-labelledby="register-form-title">
          <header className={registerStyles.registerPanelHeader}>
            <p className={registerStyles.panelEyebrow}>Patient account</p>
            <h2 id="register-form-title">
              {googleOnboarding ? "Complete your patient profile" : "Create your OurSkin account"}
            </h2>
            <p>
              {googleOnboarding
                ? "Your Google identity is verified. Add the remaining patient details to finish registration."
                : "Enter the patient information below. Required guardian fields appear automatically for minors."}
            </p>
          </header>

          {googleOnboarding && (
            <div className={registerStyles.googleVerified} role="status">
              <span>Verified Google email</span>
              <strong>{googleOnboarding.profile?.email || "Google account"}</strong>
            </div>
          )}

          {feedback && (
            <p
              className={feedbackClass}
              role={feedback.kind === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {feedback.message}
            </p>
          )}

          <form
            className={registerStyles.registerForm}
            noValidate
            aria-busy={loading}
            onChange={() => {
              if (feedback) setFeedback(null)
            }}
            onSubmit={(event) => {
              event.preventDefault()
              void register()
            }}
          >
            <fieldset className={registerStyles.formSection}>
              <legend>Patient identity</legend>
              <p className={registerStyles.sectionDescription}>
                Use the patient’s legal name and date of birth.
              </p>

              <div className={registerStyles.registerGrid}>
                <div className={registerStyles.registerField}>
                  <label htmlFor="register-first-name">First name</label>
                  <input
                    id="register-first-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="Enter first name"
                    autoComplete="given-name"
                    required
                    disabled={loading}
                  />
                </div>

                <div className={registerStyles.registerField}>
                  <label htmlFor="register-last-name">Last name</label>
                  <input
                    id="register-last-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Enter last name"
                    autoComplete="family-name"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className={registerStyles.registerField}>
                <span className={registerStyles.fieldLabel}>Date of birth</span>
                <div className={registerStyles.dobControl}>
                  <div className={registerStyles.dobIcon} aria-hidden="true">
                    <FaCalendarAlt />
                  </div>

                  <div className={registerStyles.dobGrid}>
                    <div>
                      <label className={registerStyles.srOnly} htmlFor="register-dob-month">
                        Birth month
                      </label>
                      <select
                        id="register-dob-month"
                        value={dobMonth}
                        onChange={(event) => setDobMonth(event.target.value)}
                        autoComplete="bday-month"
                        aria-label="Birth month"
                        required
                        disabled={loading}
                      >
                        <option value="">Month</option>
                        {monthOptions.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={registerStyles.srOnly} htmlFor="register-dob-day">
                        Birth day
                      </label>
                      <select
                        id="register-dob-day"
                        value={dobDay}
                        onChange={(event) => setDobDay(event.target.value)}
                        autoComplete="bday-day"
                        aria-label="Birth day"
                        required
                        disabled={loading}
                      >
                        <option value="">Day</option>
                        {dayOptions.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={registerStyles.srOnly} htmlFor="register-dob-year">
                        Birth year
                      </label>
                      <select
                        id="register-dob-year"
                        value={dobYear}
                        onChange={(event) => setDobYear(event.target.value)}
                        autoComplete="bday-year"
                        aria-label="Birth year"
                        required
                        disabled={loading}
                      >
                        <option value="">Year</option>
                        {yearOptions.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {dateOfBirth && (
                  <p className={registerStyles.dobPreview} aria-live="polite">
                    <time dateTime={dateOfBirth}>{dateOfBirth}</time>
                    <span aria-hidden="true">·</span>
                    <span>{getAgeLabel()}</span>
                  </p>
                )}

                {isBelowMinimumAge && (
                  <p className={registerStyles.registerError} role="alert">
                    Patient must be at least 3 months old to register.
                  </p>
                )}

                {dateOfBirth && isMinor && (
                  <p className={registerStyles.registerInfo} role="status">
                    This patient is below 18 years old. Guardian details and consent are required.
                  </p>
                )}
              </div>
            </fieldset>

            <fieldset className={registerStyles.formSection}>
              <legend>Contact details</legend>
              <p className={registerStyles.sectionDescription}>
                {isMinor
                  ? "Add the patient’s address now. The guardian’s verified contact details are collected next."
                  : "These details are used for account verification and clinic communication."}
              </p>

              <div className={registerStyles.registerField}>
                <label htmlFor="register-address">Complete address</label>
                <input
                  id="register-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="House no., street, barangay, city, province"
                  autoComplete="street-address"
                  required
                  disabled={loading}
                />
              </div>

              {!isMinor && (
                <div className={registerStyles.registerGrid}>
                  <div className={registerStyles.registerField}>
                    <label htmlFor="register-contact">Contact number</label>
                    <input
                      id="register-contact"
                      value={contact}
                      onChange={(event) => setContact(event.target.value)}
                      placeholder="09123456789"
                      autoComplete="tel"
                      inputMode="tel"
                      required
                      disabled={loading}
                    />
                    <p className={registerStyles.registerHelper}>Use 09XXXXXXXXX or +639XXXXXXXXX.</p>
                  </div>

                  <div className={registerStyles.registerField}>
                    <label htmlFor="register-email">Email address</label>
                    <input
                      id="register-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="patient@email.com"
                      autoComplete="email"
                      inputMode="email"
                      readOnly={Boolean(googleOnboarding)}
                      aria-readonly={Boolean(googleOnboarding)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              )}
            </fieldset>

            {dateOfBirth && isMinor && (
              <fieldset className={registerStyles.formSection}>
                <legend>Guardian details</legend>
                <p className={registerStyles.sectionDescription}>
                  A parent or legal guardian manages registration and communication for a minor patient.
                </p>

                <div className={registerStyles.registerGrid}>
                  <div className={registerStyles.registerField}>
                    <label htmlFor="guardian-first-name">Guardian first name</label>
                    <input
                      id="guardian-first-name"
                      value={guardianFirstName}
                      onChange={(event) => setGuardianFirstName(event.target.value)}
                      placeholder="Enter guardian first name"
                      autoComplete="section-guardian given-name"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className={registerStyles.registerField}>
                    <label htmlFor="guardian-last-name">Guardian last name</label>
                    <input
                      id="guardian-last-name"
                      value={guardianLastName}
                      onChange={(event) => setGuardianLastName(event.target.value)}
                      placeholder="Enter guardian last name"
                      autoComplete="section-guardian family-name"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className={registerStyles.registerField}>
                  <label htmlFor="guardian-relationship">Relationship to patient</label>
                  <input
                    id="guardian-relationship"
                    value={guardianRelationship}
                    onChange={(event) => setGuardianRelationship(event.target.value)}
                    placeholder="Example: Mother, Father, Legal Guardian"
                    required
                    disabled={loading}
                  />
                </div>

                <div className={registerStyles.registerGrid}>
                  <div className={registerStyles.registerField}>
                    <label htmlFor="guardian-contact">Guardian contact number</label>
                    <input
                      id="guardian-contact"
                      value={guardianContact}
                      onChange={(event) => setGuardianContact(event.target.value)}
                      placeholder="09123456789"
                      autoComplete="section-guardian tel"
                      inputMode="tel"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className={registerStyles.registerField}>
                    <label htmlFor="guardian-email">Guardian email address</label>
                    <input
                      id="guardian-email"
                      type="email"
                      value={guardianEmail}
                      onChange={(event) => setGuardianEmail(event.target.value)}
                      placeholder="guardian@email.com"
                      autoComplete="section-guardian email"
                      inputMode="email"
                      readOnly={Boolean(googleOnboarding)}
                      aria-readonly={Boolean(googleOnboarding)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <label className={registerStyles.registerCheckbox}>
                  <input
                    type="checkbox"
                    checked={guardianConsent}
                    onChange={(event) => setGuardianConsent(event.target.checked)}
                    required
                    disabled={loading}
                  />
                  <span>
                    I confirm that I am the parent or legal guardian of this minor patient and
                    I consent to the collection and processing of the patient’s information for
                    appointment booking and dermatology care.
                  </span>
                </label>
              </fieldset>
            )}

            {!googleOnboarding ? (
              <fieldset className={registerStyles.formSection}>
                <legend>Security</legend>
                <p className={registerStyles.sectionDescription}>
                  Create a strong password for secure access to the patient account.
                </p>

                <div className={registerStyles.registerField}>
                  <label htmlFor="register-password">Password</label>
                  <div className={registerStyles.registerPasswordWrap}>
                    <input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      onBlur={() => setPasswordTouched(true)}
                      placeholder="Create password"
                      autoComplete="new-password"
                      aria-invalid={passwordTouched && !isPasswordStrong}
                      required
                      disabled={loading}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      disabled={loading}
                    >
                      {showPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                    </button>
                  </div>

                  <ul className={registerStyles.passwordChecklist} aria-label="Password requirements">
                    <li className={passwordChecks.length ? registerStyles.requirementMet : ""}>
                      At least 8 characters
                    </li>
                    <li className={passwordChecks.uppercase ? registerStyles.requirementMet : ""}>
                      1 uppercase letter
                    </li>
                    <li className={passwordChecks.number ? registerStyles.requirementMet : ""}>
                      1 number
                    </li>
                    <li className={passwordChecks.special ? registerStyles.requirementMet : ""}>
                      1 special character
                    </li>
                  </ul>
                </div>

                <div className={registerStyles.registerField}>
                  <label htmlFor="register-confirm-password">Confirm password</label>
                  <div className={registerStyles.registerPasswordWrap}>
                    <input
                      id="register-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      onBlur={() => setConfirmPasswordTouched(true)}
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      aria-invalid={
                        confirmPasswordTouched && confirmPassword.length > 0 && !passwordsMatch
                      }
                      required
                      disabled={loading}
                    />

                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
                      aria-pressed={showConfirmPassword}
                      disabled={loading}
                    >
                      {showConfirmPassword ? (
                        <FaEyeSlash aria-hidden="true" />
                      ) : (
                        <FaEye aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {confirmPasswordTouched && confirmPassword.length > 0 && !passwordsMatch && (
                    <p className={registerStyles.registerError} role="alert">
                      Confirm password does not match.
                    </p>
                  )}
                </div>
              </fieldset>
            ) : (
              <div className={registerStyles.googleSecurityNote}>
                <strong>Google sign-in is connected.</strong>
                <span>No additional OurSkin password is required for this registration.</span>
              </div>
            )}

            <fieldset className={registerStyles.formSection}>
              <legend>Consent</legend>
              <p className={registerStyles.sectionDescription}>
                Review the clinic terms and privacy notice before creating the account.
              </p>

              <div className={registerStyles.consentList}>
                <div className={registerStyles.consentRow}>
                  <input
                    id="register-terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    required
                    disabled={loading}
                  />
                  <p>
                    <label htmlFor="register-terms">I agree to the </label>
                    <button
                      type="button"
                      className={registerStyles.registerPolicyBtn}
                      onClick={() => setOpenPolicy("terms")}
                    >
                      Terms and Conditions
                    </button>
                    .
                  </p>
                </div>

                <div className={registerStyles.consentRow}>
                  <input
                    id="register-privacy"
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                    required
                    disabled={loading}
                  />
                  <p>
                    <label htmlFor="register-privacy">I have read and accept the </label>
                    <button
                      type="button"
                      className={registerStyles.registerPolicyBtn}
                      onClick={() => setOpenPolicy("privacy")}
                    >
                      Privacy Policy
                    </button>
                    .
                  </p>
                </div>
              </div>
            </fieldset>

            <button
              className={registerStyles.registerSubmit}
              type="submit"
              disabled={isSubmitDisabled}
            >
              {loading
                ? "Creating account…"
                : googleOnboarding
                  ? "Complete Google registration"
                  : "Create account"}
            </button>
          </form>

          {!googleOnboarding && (
            <GoogleAuthButton
              theme={darkMode ? "dark" : "light"}
              onAuthenticated={(role, token) => {
                persistAuthSession({ access_token: token, role })
                router.push(getRoleHome(role))
              }}
              onOnboarding={() => window.location.reload()}
            />
          )}

          <p className={registerStyles.registerLoginText}>
            Already have an account? <Link href="/">Go back to Login</Link>
          </p>
        </section>
      </section>

      {openPolicy && (
        <div
          className={registerStyles.registerPolicyOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpenPolicy(null)
          }}
        >
          <div
            ref={policyDialogRef}
            className={registerStyles.registerPolicyModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-policy-title"
          >
            <div className={registerStyles.registerPolicyHeader}>
              <div>
                <p>{openPolicy === "terms" ? "Registration terms" : "Your information"}</p>
                <h2 id="register-policy-title">
                  {openPolicy === "terms" ? "Terms and Conditions" : "Privacy Policy"}
                </h2>
              </div>

              <button
                ref={policyCloseRef}
                type="button"
                onClick={() => setOpenPolicy(null)}
                aria-label={`Close ${openPolicy === "terms" ? "Terms and Conditions" : "Privacy Policy"}`}
              >
                ×
              </button>
            </div>

            <div className={registerStyles.registerPolicyBody}>
              {openPolicy === "terms" ? (
                <>
                  <p>
                    Welcome to OurSkin. By creating an account and using this platform, you agree
                    to provide accurate and updated information for account registration,
                    appointment booking, and clinic-related communication.
                  </p>

                  <h3>Appointment Requests</h3>
                  <p>
                    Appointment requests submitted through the system are subject to clinic review,
                    availability, and confirmation.
                  </p>

                  <h3>Medical and System Limitations</h3>
                  <p>
                    OurSkin supports clinic workflows but does not replace professional medical
                    advice, diagnosis, or treatment.
                  </p>

                  <h3>Account Security</h3>
                  <p>
                    Users are responsible for keeping their account credentials secure and using
                    the platform only for appropriate clinic-related purposes.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    OurSkin collects personal information such as patient name, contact details,
                    email address, complete address, date of birth, appointment information, and
                    related account details to support clinic operations.
                  </p>

                  <h3>Minor Patient Information</h3>
                  <p>
                    If the patient is a minor, parent or guardian details and consent may be
                    collected to manage appointment booking and account verification.
                  </p>

                  <h3>Use of Information</h3>
                  <p>
                    Personal information is used for account management, appointment processing,
                    clinic communication, system security, and record maintenance.
                  </p>
                </>
              )}
            </div>

            <button
              type="button"
              className={registerStyles.registerPolicyClose}
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
