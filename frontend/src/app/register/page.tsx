"use client"

import { API_BASE_URL } from "@/lib/api"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { FaEye, FaEyeSlash, FaMoon, FaSun } from "react-icons/fa"
import AuthModal from "@/app/components/AuthModal"
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

type StepKey = "patient" | "guardian" | "security" | "consent"

type RegistrationStep = {
  key: StepKey
  label: string
  description: string
}

export default function RegisterPage() {
  const router = useRouter()
  const { darkMode, toggleDarkMode } = useDarkMode()
  const policyDialogRef = useRef<HTMLDivElement>(null)
  const policyCloseRef = useRef<HTMLButtonElement>(null)
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)

  const [loginOpen, setLoginOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
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
  const yearOptions = Array.from({ length: 120 }, (_, index) => String(currentYear - index))
  const getDaysInMonth = (year: string, month: string) => {
    if (!year || !month) return 31
    return new Date(Number(year), Number(month), 0).getDate()
  }
  const daysInSelectedMonth = getDaysInMonth(dobYear, dobMonth)
  const dayOptions = Array.from({ length: daysInSelectedMonth }, (_, index) =>
    String(index + 1).padStart(2, "0")
  )

  useEffect(() => {
    if (dobDay && Number(dobDay) > daysInSelectedMonth) setDobDay("")
  }, [dobMonth, dobYear, dobDay, daysInSelectedMonth])

  useEffect(() => {
    if (dobYear && dobMonth && dobDay) setDateOfBirth(`${dobYear}-${dobMonth}-${dobDay}`)
    else setDateOfBirth("")
  }, [dobYear, dobMonth, dobDay])

  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&]/.test(password),
  }
  const isPasswordStrong =
    passwordChecks.length && passwordChecks.uppercase && passwordChecks.number && passwordChecks.special
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
      (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth())
    if (today.getDate() < dob.getDate()) months -= 1
    return months
  }

  const ageInMonths = getAgeInMonths(dateOfBirth)
  const isMinor = Boolean(dateOfBirth) && ageInMonths < 216
  const isBelowMinimumAge = Boolean(dateOfBirth) && ageInMonths < 3

  const getAgeLabel = () => {
    if (!dateOfBirth) return ""
    if (ageInMonths < 12) return `${ageInMonths} month${ageInMonths === 1 ? "" : "s"} old`
    const years = Math.floor(ageInMonths / 12)
    const months = ageInMonths % 12
    if (months === 0) return `${years} year${years === 1 ? "" : "s"} old`
    return `${years} year${years === 1 ? "" : "s"} and ${months} month${months === 1 ? "" : "s"} old`
  }

  const isValidEmailFormat = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  const isValidContactNumber = (value: string) => /^(09\d{9}|\+639\d{9})$/.test(value.trim())

  const steps = useMemo<RegistrationStep[]>(() => {
    const next: RegistrationStep[] = [
      {
        key: "patient",
        label: "Patient information",
        description: isMinor
          ? "Enter the patient's details. Guardian account information is collected in the next step."
          : "Enter the patient details used for verification and clinic communication.",
      },
    ]

    if (isMinor) {
      next.push({
        key: "guardian",
        label: "Guardian information",
        description: "A parent or legal guardian manages registration for a patient below 18.",
      })
    }

    if (!googleOnboarding) {
      next.push({
        key: "security",
        label: "Account security",
        description: "Create a secure password for the OurSkin patient account.",
      })
    }

    next.push({
      key: "consent",
      label: "Review & consent",
      description: "Review the clinic terms and privacy notice, then create the account.",
    })

    return next
  }, [googleOnboarding, isMinor])

  useEffect(() => {
    setCurrentStep((step) => Math.min(step, steps.length - 1))
  }, [steps.length])

  const activeStep = steps[currentStep] ?? steps[0]
  const isLastStep = currentStep === steps.length - 1

  const resetFields = () => {
    setCurrentStep(0)
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

  const showError = (message: string) => setFeedback({ kind: "error", message })

  const validatePatientStep = () => {
    if (firstName.trim().length < 2) {
      showError("Please enter a valid first name.")
      return false
    }
    if (lastName.trim().length < 2) {
      showError("Please enter a valid last name.")
      return false
    }
    if (!dateOfBirth) {
      showError("Please enter the patient's date of birth.")
      return false
    }
    if (isBelowMinimumAge) {
      showError("Patient must be at least 3 months old to register.")
      return false
    }
    if (address.trim().length < 5) {
      showError("Please enter the patient's complete address.")
      return false
    }
    if (!isMinor) {
      if (!isValidContactNumber(contact)) {
        showError("Please enter a valid contact number. Example: 09123456789 or +639123456789.")
        return false
      }
      if (!isValidEmailFormat(email)) {
        showError("Please enter a valid email address.")
        return false
      }
    }
    return true
  }

  const validateGuardianStep = () => {
    if (!guardianFirstName.trim() || !guardianLastName.trim()) {
      showError("Please enter the parent or guardian's full name.")
      return false
    }
    if (!guardianRelationship.trim()) {
      showError("Please enter the guardian's relationship to the patient.")
      return false
    }
    if (!isValidContactNumber(guardianContact)) {
      showError("Please enter a valid guardian contact number. Example: 09123456789 or +639123456789.")
      return false
    }
    if (!isValidEmailFormat(guardianEmail)) {
      showError("Please enter a valid guardian email address.")
      return false
    }
    if (!guardianConsent) {
      showError("Please confirm parent or guardian consent before continuing.")
      return false
    }
    return true
  }

  const validateSecurityStep = () => {
    setPasswordTouched(true)
    setConfirmPasswordTouched(true)
    if (!isPasswordStrong) {
      showError("Please complete all password requirements before continuing.")
      return false
    }
    if (!passwordsMatch) {
      showError("Confirm password does not match.")
      return false
    }
    return true
  }

  const validateConsentStep = () => {
    if (!acceptedTerms) {
      showError("Please accept the Terms and Conditions before registering.")
      return false
    }
    if (!acceptedPrivacy) {
      showError("Please accept the Privacy Policy before registering.")
      return false
    }
    return true
  }

  const validateStep = (key: StepKey) => {
    if (key === "patient") return validatePatientStep()
    if (key === "guardian") return validateGuardianStep()
    if (key === "security") return validateSecurityStep()
    return validateConsentStep()
  }

  const goToStep = (nextStep: number, clearFeedback = true) => {
    if (clearFeedback) setFeedback(null)
    setCurrentStep(nextStep)
    window.requestAnimationFrame(() => stepHeadingRef.current?.focus())
  }

  const handleContinue = () => {
    setFeedback(null)
    if (!validateStep(activeStep.key)) return
    goToStep(Math.min(currentStep + 1, steps.length - 1))
  }

  const register = async () => {
    setFeedback(null)

    if (!validatePatientStep()) {
      goToStep(0, false)
      return
    }

    const guardianStepIndex = steps.findIndex((step) => step.key === "guardian")
    if (isMinor && !validateGuardianStep()) {
      goToStep(Math.max(guardianStepIndex, 0), false)
      return
    }

    const securityStepIndex = steps.findIndex((step) => step.key === "security")
    if (!googleOnboarding && !validateSecurityStep()) {
      goToStep(Math.max(securityStepIndex, 0), false)
      return
    }

    const consentStepIndex = steps.findIndex((step) => step.key === "consent")
    if (!validateConsentStep()) {
      goToStep(Math.max(consentStepIndex, 0), false)
      return
    }

    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()
    const trimmedAddress = address.trim()
    const accountEmail = isMinor ? guardianEmail.trim() : email.trim()
    const accountContact = isMinor ? guardianContact.trim() : contact.trim()

    try {
      setLoading(true)
      const res = await fetch(
        `${API_BASE_URL}${googleOnboarding ? "/auth/google/register" : "/auth/register"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(googleOnboarding ? { onboarding_token: googleOnboarding.token } : {}),
            first_name: trimmedFirstName,
            last_name: trimmedLastName,
            date_of_birth: dateOfBirth,
            address: trimmedAddress,
            email: accountEmail,
            contact: accountContact,
            ...(!googleOnboarding ? { password, confirm_password: confirmPassword } : {}),
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

  const feedbackClass = feedback
    ? `${registerStyles.formFeedback} ${
        feedback.kind === "error"
          ? registerStyles.formFeedbackError
          : feedback.kind === "success"
            ? registerStyles.formFeedbackSuccess
            : registerStyles.formFeedbackInfo
      }`
    : ""

  const openLogin = () => setLoginOpen(true)

  return (
    <main
      className={`${landingStyles.osLanding} ${
        darkMode ? landingStyles.osDark : ""
      } ${registerStyles.registerLandingPage}`}
    >
      <header className={registerStyles.authHeader}>
        <div className={registerStyles.authHeaderInner}>
          <Link href="/" className={registerStyles.authBrand} aria-label="OurSkin home">
            <Image src="/navlogo.png" alt="OurSkin" width={170} height={62} priority />
          </Link>

          <div className={registerStyles.authHeaderActions}>
            <button
              type="button"
              className={registerStyles.themeButton}
              onClick={toggleDarkMode}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              aria-pressed={darkMode}
            >
              {darkMode ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
            </button>
            <p>
              <span>Already have an account?</span>
              <button type="button" className={registerStyles.loginLink} onClick={openLogin}>
                Log in
              </button>
            </p>
          </div>
        </div>
      </header>

      <section className={registerStyles.registerMain} aria-labelledby="register-title">
        <header className={registerStyles.registerHeader}>
          <p className={registerStyles.registerEyebrow}>Patient registration</p>
          <h1 id="register-title">
            {googleOnboarding ? "Complete your patient profile" : "Create your account"}
          </h1>
          <p>
            {googleOnboarding
              ? "Your Google identity is verified. Complete the steps below to finish registration."
              : "A short guided setup for your OurSkin patient account."}
          </p>
        </header>

        {currentStep === 0 &&
          (googleOnboarding ? (
            <div className={registerStyles.googleVerified} role="status">
              <span>Verified Google email</span>
              <strong>{googleOnboarding.profile?.email || "Google account"}</strong>
            </div>
          ) : (
            <GoogleAuthButton
              theme={darkMode ? "dark" : "light"}
              dividerPosition="after"
              dividerText="or register with email"
              onAuthenticated={(role, token) => {
                persistAuthSession({ access_token: token, role })
                router.push(getRoleHome(role))
              }}
              onOnboarding={() => window.location.reload()}
            />
          ))}

        <div className={registerStyles.stepSummary} aria-label="Registration progress">
          <div>
            <span>
              Step {currentStep + 1} of {steps.length}
            </span>
            <strong>{activeStep.label}</strong>
          </div>
          <div className={registerStyles.progressTrack} aria-hidden="true">
            <span style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
          </div>
        </div>

        <div className={registerStyles.stepContent}>
          <header className={registerStyles.stepHeader}>
            <h2 ref={stepHeadingRef} tabIndex={-1}>
              {activeStep.label}
            </h2>
            <p>{activeStep.description}</p>
          </header>

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
              if (isLastStep) void register()
              else handleContinue()
            }}
          >
            {activeStep.key === "patient" && (
              <fieldset className={registerStyles.formSection}>
                <legend className={registerStyles.srOnly}>Patient information</legend>

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

                  {!dateOfBirth && (
                    <p className={registerStyles.registerHelper}>Patients must be at least 3 months old.</p>
                  )}
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
                  {dateOfBirth && isMinor && !isBelowMinimumAge && (
                    <p className={registerStyles.registerInfo} role="status">
                      Guardian information will be collected in the next step.
                    </p>
                  )}
                </div>

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
            )}

            {activeStep.key === "guardian" && (
              <fieldset className={registerStyles.formSection}>
                <legend className={registerStyles.srOnly}>Guardian information</legend>

                <div className={registerStyles.registerGrid}>
                  <div className={registerStyles.registerField}>
                    <label htmlFor="guardian-first-name">Guardian first name</label>
                    <input
                      id="guardian-first-name"
                      value={guardianFirstName}
                      onChange={(event) => setGuardianFirstName(event.target.value)}
                      placeholder="Enter first name"
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
                      placeholder="Enter last name"
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
                    I confirm that I am the parent or legal guardian and consent to the collection
                    and processing of this patient&apos;s information for dermatology care.
                  </span>
                </label>
              </fieldset>
            )}

            {activeStep.key === "security" && (
              <fieldset className={registerStyles.formSection}>
                <legend className={registerStyles.srOnly}>Account security</legend>

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
                      aria-describedby="password-requirements"
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
                  <ul
                    id="password-requirements"
                    className={registerStyles.passwordChecklist}
                    aria-label="Password requirements"
                  >
                    <li className={passwordChecks.length ? registerStyles.requirementMet : ""}>8+ characters</li>
                    <li className={passwordChecks.uppercase ? registerStyles.requirementMet : ""}>Uppercase letter</li>
                    <li className={passwordChecks.number ? registerStyles.requirementMet : ""}>Number</li>
                    <li className={passwordChecks.special ? registerStyles.requirementMet : ""}>Special character</li>
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
                      placeholder="Re-enter password"
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
            )}

            {activeStep.key === "consent" && (
              <fieldset className={registerStyles.formSection}>
                <legend className={registerStyles.srOnly}>Review and consent</legend>

                <div className={registerStyles.reviewSummary}>
                  <div>
                    <span>Patient</span>
                    <strong>{firstName.trim()} {lastName.trim()}</strong>
                  </div>
                  <div>
                    <span>Account email</span>
                    <strong>{isMinor ? guardianEmail.trim() : email.trim()}</strong>
                  </div>
                  <div>
                    <span>Registration</span>
                    <strong>{googleOnboarding ? "Google account" : "Email & password"}</strong>
                  </div>
                </div>

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
            )}

            <div className={registerStyles.stepActions}>
              {currentStep > 0 ? (
                <button
                  type="button"
                  className={registerStyles.backButton}
                  onClick={() => goToStep(currentStep - 1)}
                  disabled={loading}
                >
                  Back
                </button>
              ) : (
                <span />
              )}

              <button
                className={registerStyles.registerSubmit}
                type="submit"
                disabled={loading || (isLastStep && (!acceptedTerms || !acceptedPrivacy))}
              >
                {isLastStep
                  ? loading
                    ? "Creating account…"
                    : googleOnboarding
                      ? "Complete registration"
                      : "Create account"
                  : "Continue"}
              </button>
            </div>
          </form>
        </div>

        <p className={registerStyles.mobileLoginPrompt}>
          Already have an account?{" "}
          <button type="button" className={registerStyles.loginLink} onClick={openLogin}>
            Log in
          </button>
        </p>
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
                aria-label={`Close ${
                  openPolicy === "terms" ? "Terms and Conditions" : "Privacy Policy"
                }`}
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

      <AuthModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLoginSuccess={(role) => {
          setLoginOpen(false)
          router.push(getRoleHome(role))
        }}
      />
    </main>
  )
}
