"use client"

import { useEffect, useState } from "react"
import { FaEye, FaEyeSlash } from "react-icons/fa"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess: (role: string, token: string) => void
}

export default function AuthModal({ isOpen, onClose, onLoginSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [isForgot, setIsForgot] = useState(false)

  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [forgotCooldown, setForgotCooldown] = useState(0)

  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false)

  const [openPolicy, setOpenPolicy] = useState<"terms" | "privacy" | null>(null)

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    const updateCooldown = () => {
      const stored = localStorage.getItem("resetCooldownUntil")

      if (!stored) {
        setForgotCooldown(0)
        return
      }

      const remaining = Math.max(0, Math.ceil((Number(stored) - Date.now()) / 1000))
      setForgotCooldown(remaining)

      if (remaining <= 0) {
        localStorage.removeItem("resetCooldownUntil")
      }
    }

    updateCooldown()
    const interval = setInterval(updateCooldown, 1000)

    return () => clearInterval(interval)
  }, [])

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

  const resetFields = () => {
    setName("")
    setContact("")
    setEmail("")
    setPassword("")
    setConfirmPassword("")
    setAcceptedTerms(false)
    setPasswordTouched(false)
    setConfirmPasswordTouched(false)
    setOpenPolicy(null)
  }

  const login = async () => {
    const res = await fetch("http://127.0.0.1:8000/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        username: email,
        password: password,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      alert(data.detail || "Invalid email or password")
      return
    }

    if (!data.access_token) {
      alert("Login failed.")
      return
    }

    localStorage.setItem("token", data.access_token)
    onLoginSuccess(data.role, data.access_token)
    onClose()
  }

  const register = async () => {
    setPasswordTouched(true)
    setConfirmPasswordTouched(true)

    if (!isPasswordStrong) {
      alert("Please use a strong password with at least 8 characters, 1 uppercase letter, 1 number, and 1 special character.")
      return
    }

    if (!passwordsMatch) {
      alert("Confirm password does not match.")
      return
    }

    if (!acceptedTerms) {
      alert("Please accept the Terms and Conditions and Privacy Policy before registering.")
      return
    }

    const res = await fetch("http://127.0.0.1:8000/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        contact,
        password,
        confirm_password: confirmPassword,
      }),
    })

    const data = await res.json()

    if (res.ok) {
      alert("Account created. Check your email to verify before logging in.")
      setIsLogin(true)
      setIsForgot(false)
      resetFields()
    } else {
      alert(data.detail || "Registration failed")
    }
  }

  const forgotPassword = async () => {
    if (!email.trim()) {
      alert("Please enter your email first.")
      return
    }

    if (forgotCooldown > 0) {
      alert(`Please wait ${forgotCooldown} seconds before requesting again.`)
      return
    }

    const res = await fetch("http://127.0.0.1:8000/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    })

    const data = await res.json()

    if (res.status === 429) {
      const retryAfter =
        typeof data.detail === "object" && data.detail?.retry_after
          ? Number(data.detail.retry_after)
          : 60

      const cooldownUntil = Date.now() + retryAfter * 1000
      localStorage.setItem("resetCooldownUntil", String(cooldownUntil))
      setForgotCooldown(retryAfter)

      const message =
        typeof data.detail === "object" && data.detail?.message
          ? data.detail.message
          : "Please wait before requesting another reset link."

      alert(message)
      return
    }

    if (!res.ok) {
      alert(typeof data.detail === "string" ? data.detail : "Failed to send reset link")
      return
    }

    const cooldownUntil = Date.now() + 60 * 1000
    localStorage.setItem("resetCooldownUntil", String(cooldownUntil))
    setForgotCooldown(60)

    alert(data.message || "If an account exists for this email, a reset link has been sent.")
    setIsForgot(false)
    setIsLogin(true)
    setPassword("")
    setConfirmPassword("")
  }

  if (!isOpen) return null

  return (
    <div className="modal">
      <div className="modalCard">
        <h2>
          {isForgot
            ? "Forgot Password"
            : isLogin
            ? "Login"
            : "Create an Account"}
        </h2>

        <p className="authHelperText">
          {isForgot
            ? "Enter your email and we’ll send you a reset link."
            : isLogin
            ? "Please log in to continue your booking."
            : "Create your account to continue with your appointment."}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()

            if (isForgot) {
              forgotPassword()
            } else if (isLogin) {
              login()
            } else {
              register()
            }
          }}
        >
          {!isLogin && !isForgot && (
            <>
              <input
                className="authInput"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <input
                className="authInput"
                placeholder="Contact Number"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </>
          )}

          <input
            className="authInput"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {!isForgot && (
            <>
            <div className="inputWrapper">
              <input
                className="authInput"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setPasswordTouched(true)}
              />
              <span
                className="eyeIcon"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>

              {!isLogin && (
                <p className={`passwordSummary ${password.length > 0 && isPasswordStrong ? "validText" : "invalidText"}`}>
                  Use at least 8 characters with 1 uppercase letter, 1 number, and 1 special character.
                </p>
              )}
            </>
          )}

          {!isLogin && !isForgot && (
            <>
              <div className="inputWrapper">
              <input
                className="authInput"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setConfirmPasswordTouched(true)}
              />
              <span
                className="eyeIcon"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>

              {confirmPasswordTouched && confirmPassword.length > 0 && !passwordsMatch && (
                <p className="fieldError">Confirm password does not match.</p>
              )}

              <label className="termsRow">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                />
                <span>
                  I agree to the{" "}
                  <button
                    type="button"
                    className="policyLinkBtn"
                    onClick={() => setOpenPolicy("terms")}
                  >
                    Terms and Conditions
                  </button>{" "}
                  and{" "}
                  <button
                    type="button"
                    className="policyLinkBtn"
                    onClick={() => setOpenPolicy("privacy")}
                  >
                    Privacy Policy
                  </button>.
                </span>
              </label>
            </>
          )}

          {isLogin && !isForgot && (
            <div className="forgotRow">
              <button
                type="button"
                className="forgotLink"
                onClick={() => {
                  setIsForgot(true)
                  setPassword("")
                  setConfirmPassword("")
                }}
              >
                Forgot Password?
              </button>
            </div>
          )}

          <button
            className="submitBtn"
            type="submit"
            disabled={
              (isForgot && forgotCooldown > 0) ||
              (!isLogin &&
                !isForgot &&
                (!isPasswordStrong || !passwordsMatch || !acceptedTerms))
            }
          >
            {isForgot
              ? forgotCooldown > 0
                ? `Send Again in ${forgotCooldown}s`
                : "Send Reset Link"
              : isLogin
              ? "Login"
              : "Register"}
          </button>
        </form>

        {!isForgot ? (
          <p className="switch">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <span
              className="switchAction"
              onClick={() => {
                setIsLogin(!isLogin)
                setIsForgot(false)
                resetFields()
              }}
            >
              {isLogin ? " Register" : " Login"}
            </span>
          </p>
        ) : (
          <p className="switch">
            Remember your password?
            <span
              className="switchAction"
              onClick={() => {
                setIsForgot(false)
                setIsLogin(true)
              }}
            >
              {" "}Login
            </span>
          </p>
        )}

        <div className="authCloseRow">
          <button type="button" className="authCloseBtn" onClick={onClose}>
            Close
          </button>
        </div>

        {openPolicy && (
          <div className="policyOverlay" onClick={() => setOpenPolicy(null)}>
            <div className="policyPopup" onClick={(e) => e.stopPropagation()}>
              <div className="policyPopupHeader">
                <h3>{openPolicy === "terms" ? "Terms and Conditions" : "Privacy Policy"}</h3>
                <button
                  type="button"
                  className="policyXBtn"
                  onClick={() => setOpenPolicy(null)}
                >
                  ×
                </button>
              </div>

              <div className="policyPopupContent">
                {openPolicy === "terms" ? (
                  <>
<p>
          Welcome to OurSkin. By creating an account and using this platform,
          you agree to the following Terms and Conditions. Please read them
          carefully before using the system.
        </p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By registering for an account, accessing the platform, or using any
          feature of OurSkin, you confirm that you have read, understood, and
          agreed to these Terms and Conditions.
        </p>

        <h2>2. Purpose of the Platform</h2>
        <p>
          OurSkin is designed to support dermatology-related clinic processes
          such as account registration, appointment booking, patient
          communication, and other clinic workflow features available within the
          system. The platform is intended to improve convenience, efficiency,
          and access to clinic-related services.
        </p>

        <h2>3. User Responsibilities</h2>
        <p>
          You agree to provide accurate, complete, and updated information when
          creating an account or booking an appointment. You are responsible for
          maintaining the confidentiality of your account credentials and for
          all activities that occur under your account.
        </p>

        <h2>4. Acceptable Use</h2>
        <p>
          You agree not to misuse the platform. This includes, but is not
          limited to, providing false information, attempting unauthorized
          access, disrupting the system, uploading harmful content, or using the
          platform for unlawful purposes.
        </p>

        <h2>5. Appointment Requests and Clinic Services</h2>
        <p>
          Submitting an appointment through OurSkin does not automatically
          guarantee approval or confirmation. All appointments remain subject to
          clinic availability, scheduling rules, and internal review. The clinic
          reserves the right to approve, reschedule, decline, or cancel
          appointments when necessary.
        </p>

        <h2>6. Medical and System Limitations</h2>
        <p>
          OurSkin is a support platform and does not replace professional
          medical judgment, diagnosis, or treatment from a licensed healthcare
          provider. Any information shown in the system should be interpreted
          within the context of actual clinic assessment and consultation.
        </p>

        <h2>7. Privacy and Data Use</h2>
        <p>
          By using OurSkin, you acknowledge that your personal information may
          be collected, processed, and stored in accordance with the platform’s
          Privacy Policy. Users are encouraged to review the Privacy Policy to
          understand how their information is handled.
        </p>

        <h2>8. Account Suspension or Termination</h2>
        <p>
          OurSkin reserves the right to suspend, restrict, or terminate accounts
          that violate these Terms and Conditions, provide misleading
          information, attempt to compromise system security, or misuse the
          platform in any way.
        </p>

        <h2>9. Changes to the Terms</h2>
        <p>
          These Terms and Conditions may be updated from time to time to reflect
          system improvements, policy changes, or operational requirements.
          Continued use of the platform after changes are made means you accept
          the updated Terms.
        </p>

        <h2>10. Contact</h2>
        <p>
          For questions or concerns regarding these Terms and Conditions, please
          contact the clinic or system administrator through the official
          communication channels provided by OurSkin.
        </p>
                  </>
                ) : (
                  <>
                           <p>
          At OurSkin, we value your privacy and are committed to protecting your
          personal information. This Privacy Policy explains how your
          information is collected, used, stored, and protected when you use
          the platform.
        </p>

        <h2>1. Information We Collect</h2>
        <p>
          OurSkin may collect personal information that you provide when using
          the platform, including your name, contact number, email address,
          account details, appointment information, and other relevant data
          needed for clinic-related services. Additional records related to your
          use of the platform may also be collected for operational and security
          purposes.
        </p>

        <h2>2. How We Use Your Information</h2>
        <p>
          The information collected through OurSkin is used to create and manage
          your account, process appointment requests, support communication
          between users and the clinic, improve system functionality, maintain
          records, and protect the security of the platform.
        </p>

        <h2>3. Information Sharing</h2>
        <p>
          OurSkin does not share your personal information with unauthorized
          third parties. Information may only be accessed or shared when
          necessary for clinic operations, authorized system processes, legal
          compliance, or legitimate service-related purposes.
        </p>

        <h2>4. Data Security</h2>
        <p>
          Reasonable administrative and technical measures are used to help
          protect your personal information from unauthorized access, misuse,
          alteration, or disclosure. While efforts are made to secure the
          platform, no digital system can guarantee absolute security.
        </p>

        <h2>5. User Responsibility</h2>
        <p>
          Users are responsible for keeping their login credentials secure and
          for avoiding unauthorized access to their accounts. You should not
          share your password with others and should notify the system
          administrator or clinic immediately if you suspect unauthorized use of
          your account.
        </p>

        <h2>6. Data Retention</h2>
        <p>
          Personal information may be retained only for as long as necessary to
          support clinic operations, maintain records, comply with applicable
          requirements, or improve the platform’s performance and reliability.
        </p>

        <h2>7. User Rights</h2>
        <p>
          You may request to review or update the personal information
          associated with your account, subject to clinic policies and system
          limitations. Requests related to incorrect or outdated information
          should be directed to the clinic or system administrator.
        </p>

        <h2>8. Changes to This Privacy Policy</h2>
        <p>
          This Privacy Policy may be updated from time to time to reflect
          changes in system features, operational processes, or privacy
          practices. Continued use of the platform after updates means you
          acknowledge the revised Privacy Policy.
        </p>

        <h2>9. Contact</h2>
        <p>
          If you have questions or concerns regarding this Privacy Policy or the
          handling of your personal information, please contact the clinic or
          system administrator through the official communication channels
          provided by OurSkin.
        </p>
                  </>
                )}
              </div>

              <button
                type="button"
                className="policyCloseBtn"
                onClick={() => setOpenPolicy(null)}
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}