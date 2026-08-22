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
}

type FieldErrorKey =
  | "firstName"
  | "lastName"
  | "dateOfBirth"
  | "address"
  | "contact"
  | "email"
  | "guardianName"
  | "guardianRelationship"
  | "guardianContact"
  | "guardianEmail"
  | "guardianConsent"
  | "password"
  | "confirmPassword"
  | "consent"

type FieldErrors = Partial<Record<FieldErrorKey, string>>

export default function RegisterPage() {
  const router = useRouter()
  const { darkMode, toggleDarkMode } = useDarkMode()
  const policyDialogRef = useRef<HTMLDivElement>(null)
  const policyCloseRef = useRef<HTMLButtonElement>(null)

  const [loginOpen, setLoginOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
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

    if (today.getDate() < dob.getDate()) months -= 1
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

  const isValidEmailFormat = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

  const isValidContactNumber = (value: string) =>
    /^(09\d{9}|\+639\d{9})$/.test(value.trim())

  const steps = useMemo<RegistrationStep[]>(() => {
    const next: RegistrationStep[] = [{ key: "patient", label: "Patient information" }]

    if (isMinor) {
      next.push({ key: "guardian", label: "Guardian information" })
    }

    if (!googleOnboarding) {
      next.push({ key: "security", label: "Account security" })
    }

    next.push({ key: "consent", label: "Review & consent" })
    return next
  }, [googleOnboarding, isMinor])

  useEffect(() => {
    setCurrentStep((step) => Math.min(step, steps.length - 1))
  }, [steps.length])

  const activeStep = steps[currentStep] ?? steps[0]
  const isLastStep = currentStep === steps.length - 1
  const upcomingSteps = steps.slice(currentStep + 1).map((step) => step.label)
  const maxBirthDate = new Date().toISOString().slice(0, 10)

  const resetFields = () => {
    setCurrentStep(0)
    setFirstName("")
    setLastName("")
    setDateOfBirth("")
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
    setFieldErrors({})
  }

  const showFieldError = (
    key: FieldErrorKey,
    message: string,
    fieldId: string,
    focus = true
  ) => {
    setFieldErrors({ [key]: message })

    if (focus) {
      window.requestAnimationFrame(() => {
        document.getElementById(fieldId)?.focus()
      })
    }
  }

  const validatePatientStep = (focus = true) => {
    if (firstName.trim().length < 2) {
      showFieldError("firstName", "Enter a valid first name.", "register-first-name", focus)
      return false
    }

    if (lastName.trim().length < 2) {
      showFieldError("lastName", "Enter a valid last name.", "register-last-name", focus)
      return false
    }

    if (!dateOfBirth) {
      showFieldError("dateOfBirth", "Select the patient's date of birth.", "register-dob", focus)
      return false
    }

    if (isBelowMinimumAge) {
      showFieldError(
        "dateOfBirth",
        "Patient must be at least 3 months old to register.",
        "register-dob",
        focus
      )
      return false
    }

    if (address.trim().length < 5) {
      showFieldError(
        "address",
        "Enter the patient's complete address.",
        "register-address",
        focus
      )
      return false
    }

    if (!isMinor) {
      if (!isValidContactNumber(contact)) {
        showFieldError(
          "contact",
          "Use 09XXXXXXXXX or +639XXXXXXXXX.",
          "register-contact",
          focus
        )
        return false
      }

      if (!isValidEmailFormat(email)) {
        showFieldError("email", "Enter a valid email address.", "register-email", focus)
        return false
      }
    }

    setFieldErrors({})
    return true
  }

  const validateGuardianStep = (focus = true) => {
    if (!guardianFirstName.trim() || !guardianLastName.trim()) {
      showFieldError(
        "guardianName",
        "Enter the parent or guardian's full name.",
        "guardian-first-name",
        focus
      )
      return false
    }

    if (!guardianRelationship.trim()) {
      showFieldError(
        "guardianRelationship",
        "Enter the guardian's relationship to the patient.",
        "guardian-relationship",
        focus
      )
      return false
    }

    if (!isValidContactNumber(guardianContact)) {
      showFieldError(
        "guardianContact",
        "Use 09XXXXXXXXX or +639XXXXXXXXX.",
        "guardian-contact",
        focus
      )
      return false
    }

    if (!isValidEmailFormat(guardianEmail)) {
      showFieldError(
        "guardianEmail",
        "Enter a valid guardian email address.",
        "guardian-email",
        focus
      )
      return false
    }

    if (!guardianConsent) {
      showFieldError(
        "guardianConsent",
        "Guardian consent is required to continue.",
        "guardian-consent",
        focus
      )
      return false
    }

    setFieldErrors({})
    return true
  }

  const validateSecurityStep = (focus = true) => {
    setPasswordTouched(true)
    setConfirmPasswordTouched(true)

    if (!isPasswordStrong) {
      showFieldError(
        "password",
        "Complete all four password requirements.",
        "register-password",
        focus
      )
      return false
    }

    if (!passwordsMatch) {
      showFieldError(
        "confirmPassword",
        "Confirm password does not match.",
        "register-confirm-password",
        focus
      )
      return false
    }

    setFieldErrors({})
    return true
  }

  const validateConsentStep = (focus = true) => {
    if (!acceptedTerms) {
      showFieldError(
        "consent",
        "Accept the Terms and Conditions to create your account.",
        "register-terms",
        focus
      )
      return false
    }

    if (!acceptedPrivacy) {
      showFieldError(
        "consent",
        "Accept the Privacy Policy to create your account.",
        "register-privacy",
        focus
      )
      return false
    }

    setFieldErrors({})
    return true
  }

  const validateStep = (key: StepKey, focus = true) => {
    if (key === "patient") return validatePatientStep(focus)
    if (key === "guardian") return validateGuardianStep(focus)
    if (key === "security") return validateSecurityStep(focus)
    return validateConsentStep(focus)
  }

  const goToStep = (nextStep: number, clearErrors = true) => {
    setFeedback(null)
    if (clearErrors) setFieldErrors({})
    setCurrentStep(nextStep)

    window.requestAnimationFrame(() => {
      document.getElementById("registration-progress")?.focus()
    })
  }

  const handleContinue = () => {
    setFeedback(null)
    setFieldErrors({})

    if (!validateStep(activeStep.key)) return
    goToStep(Math.min(currentStep + 1, steps.length - 1))
  }

  const register = async () => {
    setFeedback(null)
    setFieldErrors({})

    if (!validatePatientStep(false)) {
      goToStep(0, false)
      return
    }

    const guardianStepIndex = steps.findIndex((step) => step.key === "guardian")
    if (isMinor && !validateGuardianStep(false)) {
      goToStep(Math.max(guardianStepIndex, 0), false)
      return
    }

    const securityStepIndex = steps.findIndex((step) => step.key === "security")
    if (!googleOnboarding && !validateSecurityStep(false)) {
      goToStep(Math.max(securityStepIndex, 0), false)
      return
    }

    if (!validateConsentStep()) return

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
          setFeedback({ kind: "error", message: data.detail })
          return
        }

        setFeedback({
          kind: "error",
          message: "Registration failed. Please check your details and try again.",
        })
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
      setFeedback({
        kind: "error",
        message: "Failed to connect to the server. Please make sure the backend is running.",
      })
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

  const clearValidation = () => {
    if (feedback) setFeedback(null)
    if (Object.keys(fieldErrors).length) setFieldErrors({})
  }

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
            <Image src="/navlogo.png" alt="OurSkin" width={210} height={76} priority />
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
        <div
          className={`${registerStyles.introRow} ${
            currentStep === 0 ? registerStyles.introRowWithAuth : registerStyles.introRowSingle
          }`}
        >
          <header className={registerStyles.registerHeader}>
            <h1 id="register-title">
              {googleOnboarding ? "Complete your patient profile" : "Create your account"}
            </h1>
            <p>
              {googleOnboarding
                ? "Your Google identity is verified. Complete the remaining steps to finish setup."
                : "Set up your patient profile to book appointments and manage care with OurSkin."}
            </p>
          </header>

          {currentStep === 0 &&
            (googleOnboarding ? (
              <div className={registerStyles.googleVerified} role="status">
                <span>Verified Google email</span>
                <strong>{googleOnboarding.profile?.email || "Google account"}</strong>
              </div>
            ) : (
              <div className={registerStyles.authChoice}>
                <p>Prefer a faster start?</p>
                <GoogleAuthButton
                  theme={darkMode ? "dark" : "light"}
                  dividerPosition="after"
                  dividerText="or use email below"
                  onAuthenticated={(role, token) => {
                    persistAuthSession({ access_token: token, role })
                    router.push(getRoleHome(role))
                  }}
                  onOnboarding={() => window.location.reload()}
                />
              </div>
            ))}
        </div>

        <div
          id="registration-progress"
          className={registerStyles.progressBlock}
          tabIndex={-1}
          aria-label={`Step ${currentStep + 1} of ${steps.length}: ${activeStep.label}`}
        >
          <div className={registerStyles.progressMeta}>
            <p>
              <strong>
                Step {currentStep + 1} of {steps.length}
              </strong>
              <span aria-hidden="true">·</span>
              <span>{activeStep.label}</span>
            </p>

            <p className={registerStyles.remainingSteps}>
              {upcomingSteps.length
                ? `Next: ${upcomingSteps.join(" → ")}`
                : "Final step"}
            </p>
          </div>

          <div className={registerStyles.progressTrack} aria-hidden="true">
            <span style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
          </div>
        </div>

        <div className={registerStyles.flowBody}>
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
            onChange={clearValidation}
            onSubmit={(event) => {
              event.preventDefault()
              if (isLastStep) void register()
              else handleContinue()
            }}
          >
            <p className={registerStyles.requirementNote}>All fields in this step are required.</p>

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
                      aria-invalid={Boolean(fieldErrors.firstName)}
                      aria-describedby={
                        fieldErrors.firstName ? "register-first-name-error" : undefined
                      }
                      required
                      disabled={loading}
                    />
                    {fieldErrors.firstName && (
                      <p
                        id="register-first-name-error"
                        className={registerStyles.registerError}
                        role="alert"
                      >
                        {fieldErrors.firstName}
                      </p>
                    )}
                  </div>

                  <div className={registerStyles.registerField}>
                    <label htmlFor="register-last-name">Last name</label>
                    <input
                      id="register-last-name"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Enter last name"
                      autoComplete="family-name"
                      aria-invalid={Boolean(fieldErrors.lastName)}
                      aria-describedby={
                        fieldErrors.lastName ? "register-last-name-error" : undefined
                      }
                      required
                      disabled={loading}
                    />
                    {fieldErrors.lastName && (
                      <p
                        id="register-last-name-error"
                        className={registerStyles.registerError}
                        role="alert"
                      >
                        {fieldErrors.lastName}
                      </p>
                    )}
                  </div>
                </div>

                <div className={registerStyles.registerGrid}>
                  <div className={registerStyles.registerField}>
                    <label htmlFor="register-dob">Date of birth</label>
                    <input
                      id="register-dob"
                      type="date"
                      value={dateOfBirth}
                      max={maxBirthDate}
                      onChange={(event) => setDateOfBirth(event.target.value)}
                      autoComplete="bday"
                      aria-invalid={Boolean(fieldErrors.dateOfBirth)}
                      aria-describedby={
                        fieldErrors.dateOfBirth
                          ? "register-dob-help register-dob-error"
                          : "register-dob-help"
                      }
                      required
                      disabled={loading}
                    />
                    <p id="register-dob-help" className={registerStyles.registerHelper}>
                      At least 3 months old. Patients under 18 continue with guardian details.
                    </p>
                    {dateOfBirth && !fieldErrors.dateOfBirth && (
                      <p className={registerStyles.dobPreview} aria-live="polite">
                        {getAgeLabel()}
                      </p>
                    )}
                    {fieldErrors.dateOfBirth && (
                      <p
                        id="register-dob-error"
                        className={registerStyles.registerError}
                        role="alert"
                      >
                        {fieldErrors.dateOfBirth}
                      </p>
                    )}
                  </div>

                  <div className={registerStyles.registerField}>
                    <label htmlFor="register-address">Complete address</label>
                    <input
                      id="register-address"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="House no., street, barangay, city / province"
                      autoComplete="street-address"
                      aria-invalid={Boolean(fieldErrors.address)}
                      aria-describedby={
                        fieldErrors.address ? "register-address-error" : undefined
                      }
                      required
                      disabled={loading}
                    />
                    {fieldErrors.address && (
                      <p
                        id="register-address-error"
                        className={registerStyles.registerError}
                        role="alert"
                      >
                        {fieldErrors.address}
                      </p>
                    )}
                  </div>
                </div>

                {!isMinor && (
                  <div className={registerStyles.registerGrid}>
                    <div className={registerStyles.registerField}>
                      <label htmlFor="register-contact">Contact number</label>
                      <input
                        id="register-contact"
                        value={contact}
                        onChange={(event) => setContact(event.target.value)}
                        placeholder="09XXXXXXXXX"
                        autoComplete="tel"
                        inputMode="tel"
                        aria-invalid={Boolean(fieldErrors.contact)}
                        aria-describedby="register-contact-help"
                        required
                        disabled={loading}
                      />
                      <p id="register-contact-help" className={registerStyles.registerHelper}>
                        Philippine mobile: 09XXXXXXXXX or +639XXXXXXXXX.
                      </p>
                      {fieldErrors.contact && (
                        <p className={registerStyles.registerError} role="alert">
                          {fieldErrors.contact}
                        </p>
                      )}
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
                        aria-invalid={Boolean(fieldErrors.email)}
                        aria-describedby={
                          fieldErrors.email ? "register-email-error" : undefined
                        }
                        required
                        disabled={loading}
                      />
                      {fieldErrors.email && (
                        <p
                          id="register-email-error"
                          className={registerStyles.registerError}
                          role="alert"
                        >
                          {fieldErrors.email}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {dateOfBirth && isMinor && !isBelowMinimumAge && (
                  <p className={registerStyles.registerInfo} role="status">
                    Because this patient is under 18, a parent or legal guardian will provide the
                    account contact details in the next step.
                  </p>
                )}
              </fieldset>
            )}

            {activeStep.key === "guardian" && (
              <fieldset className={registerStyles.formSection}>
                <legend className={registerStyles.srOnly}>Guardian information</legend>

                <p className={registerStyles.stepLead}>
                  The guardian's verified contact details become the account contact information
                  for this minor patient.
                </p>

                <div className={registerStyles.registerGrid}>
                  <div className={registerStyles.registerField}>
                    <label htmlFor="guardian-first-name">Guardian first name</label>
                    <input
                      id="guardian-first-name"
                      value={guardianFirstName}
                      onChange={(event) => setGuardianFirstName(event.target.value)}
                      placeholder="Enter first name"
                      autoComplete="section-guardian given-name"
                      aria-invalid={Boolean(fieldErrors.guardianName)}
                      required
                      disabled={loading}
                    />
                    {fieldErrors.guardianName && (
                      <p className={registerStyles.registerError} role="alert">
                        {fieldErrors.guardianName}
                      </p>
                    )}
                  </div>

                  <div className={registerStyles.registerField}>
                    <label htmlFor="guardian-last-name">Guardian last name</label>
                    <input
                      id="guardian-last-name"
                      value={guardianLastName}
                      onChange={(event) => setGuardianLastName(event.target.value)}
                      placeholder="Enter last name"
                      autoComplete="section-guardian family-name"
                      aria-invalid={Boolean(fieldErrors.guardianName)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className={registerStyles.registerGrid}>
                  <div className={registerStyles.registerField}>
                    <label htmlFor="guardian-relationship">Relationship to patient</label>
                    <input
                      id="guardian-relationship"
                      value={guardianRelationship}
                      onChange={(event) => setGuardianRelationship(event.target.value)}
                      placeholder="Mother, Father, Legal Guardian"
                      aria-invalid={Boolean(fieldErrors.guardianRelationship)}
                      required
                      disabled={loading}
                    />
                    {fieldErrors.guardianRelationship && (
                      <p className={registerStyles.registerError} role="alert">
                        {fieldErrors.guardianRelationship}
                      </p>
                    )}
                  </div>

                  <div className={registerStyles.registerField}>
                    <label htmlFor="guardian-contact">Guardian contact number</label>
                    <input
                      id="guardian-contact"
                      value={guardianContact}
                      onChange={(event) => setGuardianContact(event.target.value)}
                      placeholder="09XXXXXXXXX"
                      autoComplete="section-guardian tel"
                      inputMode="tel"
                      aria-invalid={Boolean(fieldErrors.guardianContact)}
                      required
                      disabled={loading}
                    />
                    {fieldErrors.guardianContact && (
                      <p className={registerStyles.registerError} role="alert">
                        {fieldErrors.guardianContact}
                      </p>
                    )}
                  </div>
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
                    aria-invalid={Boolean(fieldErrors.guardianEmail)}
                    required
                    disabled={loading}
                  />
                  {fieldErrors.guardianEmail && (
                    <p className={registerStyles.registerError} role="alert">
                      {fieldErrors.guardianEmail}
                    </p>
                  )}
                </div>

                <label className={registerStyles.registerCheckbox}>
                  <input
                    id="guardian-consent"
                    type="checkbox"
                    checked={guardianConsent}
                    onChange={(event) => setGuardianConsent(event.target.checked)}
                    aria-invalid={Boolean(fieldErrors.guardianConsent)}
                    required
                    disabled={loading}
                  />
                  <span>
                    I confirm that I am the parent or legal guardian and consent to the collection
                    and processing of this patient's information for dermatology care.
                  </span>
                </label>

                {fieldErrors.guardianConsent && (
                  <p className={registerStyles.registerError} role="alert">
                    {fieldErrors.guardianConsent}
                  </p>
                )}
              </fieldset>
            )}

            {activeStep.key === "security" && (
              <fieldset className={registerStyles.formSection}>
                <legend className={registerStyles.srOnly}>Account security</legend>

                <div className={registerStyles.securityGrid}>
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
                        aria-invalid={
                          Boolean(fieldErrors.password) ||
                          (passwordTouched && !isPasswordStrong)
                        }
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
                        {showPassword ? (
                          <FaEyeSlash aria-hidden="true" />
                        ) : (
                          <FaEye aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    <ul
                      id="password-requirements"
                      className={registerStyles.passwordChecklist}
                      aria-label="Password requirements"
                    >
                      <li className={passwordChecks.length ? registerStyles.requirementMet : ""}>
                        8+ characters
                      </li>
                      <li
                        className={passwordChecks.uppercase ? registerStyles.requirementMet : ""}
                      >
                        Uppercase letter
                      </li>
                      <li className={passwordChecks.number ? registerStyles.requirementMet : ""}>
                        Number
                      </li>
                      <li className={passwordChecks.special ? registerStyles.requirementMet : ""}>
                        Special character
                      </li>
                    </ul>

                    {fieldErrors.password && (
                      <p className={registerStyles.registerError} role="alert">
                        {fieldErrors.password}
                      </p>
                    )}
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
                          Boolean(fieldErrors.confirmPassword) ||
                          (confirmPasswordTouched &&
                            confirmPassword.length > 0 &&
                            !passwordsMatch)
                        }
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirmed password"
                            : "Show confirmed password"
                        }
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

                    {confirmPasswordTouched &&
                      confirmPassword.length > 0 &&
                      !passwordsMatch &&
                      !fieldErrors.confirmPassword && (
                        <p className={registerStyles.registerError} role="alert">
                          Confirm password does not match.
                        </p>
                      )}

                    {fieldErrors.confirmPassword && (
                      <p className={registerStyles.registerError} role="alert">
                        {fieldErrors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>
              </fieldset>
            )}

            {activeStep.key === "consent" && (
              <fieldset className={registerStyles.formSection}>
                <legend className={registerStyles.srOnly}>Review and consent</legend>

                <div className={registerStyles.reviewSummary}>
                  <div>
                    <span>Patient</span>
                    <strong>
                      {firstName.trim()} {lastName.trim()}
                    </strong>
                  </div>
                  <div>
                    <span>Account email</span>
                    <strong>{isMinor ? guardianEmail.trim() : email.trim()}</strong>
                  </div>
                  <div>
                    <span>Sign-in method</span>
                    <strong>{googleOnboarding ? "Google" : "Email & password"}</strong>
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

                {fieldErrors.consent && (
                  <p className={registerStyles.registerError} role="alert">
                    {fieldErrors.consent}
                  </p>
                )}
              </fieldset>
            )}

            <div className={registerStyles.stepFooter}>
              <div className={registerStyles.footerSupport}>
                {currentStep > 0 && (
                  <button
                    type="button"
                    className={registerStyles.backButton}
                    onClick={() => goToStep(currentStep - 1)}
                    disabled={loading}
                  >
                    Back
                  </button>
                )}

                <p>
                  {isLastStep
                    ? "Your information is used for account setup, appointment coordination, and clinic communication."
                    : "Need assistance completing this step?"}
                  {" "}
                  <Link href="/#contact">{isLastStep ? "Privacy & support" : "Contact OurSkin"}</Link>
                </p>
              </div>

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
