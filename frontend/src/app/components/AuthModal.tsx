"use client"

import { API_BASE_URL, SESSION_MARKER, markBrowserSession } from "@/app/utils/auth"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"
import { FaEye, FaEyeSlash } from "react-icons/fa"
import styles from "@/app/components/AuthModal.module.css"
import GoogleAuthButton from "@/app/components/GoogleAuthButton"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess: (role: string, token: string) => void
}

type Feedback = {
  kind: "error" | "success" | "info"
  message: string
} | null

export default function AuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
}: AuthModalProps) {
  const router = useRouter()
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  const [isForgot, setIsForgot] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [forgotCooldown, setForgotCooldown] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  useEffect(() => {
    const updateCooldown = () => {
      const stored = localStorage.getItem("resetCooldownUntil")
      if (!stored) {
        setForgotCooldown(0)
        return
      }

      const remaining = Math.max(0, Math.ceil((Number(stored) - Date.now()) / 1000))
      setForgotCooldown(remaining)
      if (remaining <= 0) localStorage.removeItem("resetCooldownUntil")
    }

    updateCooldown()
    const interval = setInterval(updateCooldown, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const previousActive = document.activeElement as HTMLElement | null
    const frame = window.requestAnimationFrame(() => emailRef.current?.focus())
    document.body.style.overflow = "hidden"

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== "Tab" || !dialogRef.current) return
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
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
      document.body.style.overflow = ""
      previousActive?.focus()
    }
  }, [isOpen, onClose])

  const isValidEmailFormat = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

  const resetFields = () => {
    setEmail("")
    setPassword("")
    setShowPassword(false)
    setIsForgot(false)
    setFeedback(null)
  }

  const finishLogin = (role: string) => {
    markBrowserSession(role)
    onLoginSuccess(role, SESSION_MARKER)
    resetFields()
    onClose()
  }

  const login = async () => {
    setFeedback(null)
    if (!email.trim()) {
      setFeedback({ kind: "error", message: "Please enter your email." })
      emailRef.current?.focus()
      return
    }
    if (!isValidEmailFormat(email)) {
      setFeedback({ kind: "error", message: "Please enter a valid email address." })
      emailRef.current?.focus()
      return
    }
    if (!password) {
      setFeedback({ kind: "error", message: "Please enter your password." })
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: email.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setFeedback({
          kind: "error",
          message: typeof data.detail === "string" ? data.detail : "Invalid email or password.",
        })
        return
      }
      if (!data.role) {
        setFeedback({ kind: "error", message: "Login failed. Please try again." })
        return
      }
      finishLogin(data.role)
    } catch (error) {
      console.error("Login error:", error)
      setFeedback({ kind: "error", message: "Unable to connect to OurSkin. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  const forgotPassword = async () => {
    setFeedback(null)
    if (!email.trim()) {
      setFeedback({ kind: "error", message: "Please enter your email first." })
      emailRef.current?.focus()
      return
    }
    if (!isValidEmailFormat(email)) {
      setFeedback({ kind: "error", message: "Please enter a valid email address." })
      emailRef.current?.focus()
      return
    }
    if (forgotCooldown > 0) {
      setFeedback({ kind: "info", message: `Please wait ${forgotCooldown} seconds before requesting again.` })
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 429) {
        const retryAfter =
          typeof data.detail === "object" && data.detail?.retry_after
            ? Number(data.detail.retry_after)
            : 60
        localStorage.setItem("resetCooldownUntil", String(Date.now() + retryAfter * 1000))
        setForgotCooldown(retryAfter)
        setFeedback({
          kind: "info",
          message:
            typeof data.detail === "object" && data.detail?.message
              ? data.detail.message
              : "Please wait before requesting another reset link.",
        })
        return
      }

      if (!res.ok) {
        setFeedback({
          kind: "error",
          message: typeof data.detail === "string" ? data.detail : "Failed to send reset link.",
        })
        return
      }

      localStorage.setItem("resetCooldownUntil", String(Date.now() + 60 * 1000))
      setForgotCooldown(60)
      setFeedback({
        kind: "success",
        message: data.message || "If an account exists for this email, a reset link has been sent.",
      })
      setPassword("")
      setShowPassword(false)
    } catch (error) {
      console.error("Forgot password error:", error)
      setFeedback({ kind: "error", message: "Unable to connect to OurSkin. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  const goToRegister = () => {
    resetFields()
    onClose()
    router.push("/register")
  }

  if (!isOpen) return null

  return (
    <div
      className={styles.modal}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <h2 id={titleId}>{isForgot ? "Forgot Password" : "Login"}</h2>
        <p id={descriptionId} className={styles.authHelperText}>
          {isForgot
            ? "Enter your email and we’ll send you a reset link."
            : "Please log in to continue your booking."}
        </p>

        {feedback && (
          <p
            className={`${styles.feedback} ${styles[`feedback${feedback.kind[0].toUpperCase()}${feedback.kind.slice(1)}`]}`}
            role={feedback.kind === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {feedback.message}
          </p>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (isForgot) void forgotPassword()
            else void login()
          }}
        >
          <label className={styles.fieldLabel} htmlFor="auth-email">Email address</label>
          <input
            ref={emailRef}
            id="auth-email"
            className={styles.authInput}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          {!isForgot && (
            <>
              <label className={styles.fieldLabel} htmlFor="auth-password">Password</label>
              <div className={styles.inputWrapper}>
                <input
                  id="auth-password"
                  className={styles.authInput}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className={styles.eyeIcon}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </>
          )}

          {!isForgot && (
            <div className={styles.forgotRow}>
              <button
                type="button"
                className={styles.forgotLink}
                onClick={() => {
                  setFeedback(null)
                  setIsForgot(true)
                  setPassword("")
                  setShowPassword(false)
                }}
              >
                Forgot Password?
              </button>
            </div>
          )}

          <button
            className={styles.submitBtn}
            type="submit"
            disabled={loading || (isForgot && forgotCooldown > 0)}
          >
            {isForgot
              ? forgotCooldown > 0
                ? `Send Again in ${forgotCooldown}s`
                : loading
                ? "Sending..."
                : "Send Reset Link"
              : loading
              ? "Logging in..."
              : "Login"}
          </button>
        </form>

        {!isForgot && (
          <GoogleAuthButton
            onAuthenticated={(role) => finishLogin(role)}
            onOnboarding={() => {
              resetFields()
              onClose()
              router.push("/register?google=1")
            }}
          />
        )}

        <p className={styles.switch}>
          {!isForgot ? "Don’t have an account? " : "Remember your password? "}
          <button
            type="button"
            className={styles.switchAction}
            onClick={() => {
              if (!isForgot) goToRegister()
              else {
                setFeedback(null)
                setIsForgot(false)
                setPassword("")
                setShowPassword(false)
              }
            }}
          >
            {!isForgot ? "Register" : "Login"}
          </button>
        </p>

        <div className={styles.authCloseRow}>
          <button
            type="button"
            className={styles.authCloseBtn}
            onClick={() => {
              resetFields()
              onClose()
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
