"use client"

import { API_BASE_URL, SESSION_MARKER, markBrowserSession } from "@/app/utils/auth"
import { useDarkMode } from "@/app/hooks/useDarkMode"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { FaEye, FaEyeSlash, FaTimes } from "react-icons/fa"
import GoogleAuthButton from "@/app/components/GoogleAuthButton"
import styles from "@/app/components/AuthModal.module.css"

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
  const { darkMode } = useDarkMode()
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const [isForgot, setIsForgot] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [forgotCooldown, setForgotCooldown] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const resetFields = useCallback(() => {
    setEmail("")
    setPassword("")
    setShowPassword(false)
    setIsForgot(false)
    setFeedback(null)
    setLoading(false)
  }, [])

  const closeModal = useCallback(() => {
    resetFields()
    onClose()
  }, [onClose, resetFields])

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
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeModal()
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
      document.body.style.overflow = previousOverflow
      previousActive?.focus()
    }
  }, [isOpen, closeModal])

  const isValidEmailFormat = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

  const finishLogin = (role: string) => {
    markBrowserSession(role)
    onLoginSuccess(role, SESSION_MARKER)
    closeModal()
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
      passwordRef.current?.focus()
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
      setFeedback({
        kind: "info",
        message: `Please wait ${forgotCooldown} seconds before requesting again.`,
      })
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
    closeModal()
    router.push("/register")
  }

  if (!isOpen) return null

  const feedbackClass = feedback
    ? `${styles.feedback} ${styles[`feedback${feedback.kind[0].toUpperCase()}${feedback.kind.slice(1)}`]}`
    : ""

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal()
      }}
    >
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className={styles.header}>
          <div className={styles.headingBlock}>
            <p className={styles.eyebrow}>OurSkin Dermatology Center</p>
            <h2 id={titleId}>{isForgot ? "Reset your password" : "Welcome back"}</h2>
            <p id={descriptionId} className={styles.helperText}>
              {isForgot
                ? "Enter your email and we’ll send you a secure reset link."
                : "Log in to continue your booking and access your patient account."}
            </p>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={closeModal}
            aria-label="Close login modal"
          >
            <FaTimes aria-hidden="true" />
            <span>Close</span>
          </button>
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
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            if (isForgot) void forgotPassword()
            else void login()
          }}
          noValidate
        >
          <div className={styles.field}>
            <label htmlFor="auth-email">Email address</label>
            <input
              ref={emailRef}
              id="auth-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          {!isForgot && (
            <div className={styles.field}>
              <label htmlFor="auth-password">Password</label>
              <div className={styles.passwordField}>
                <input
                  ref={passwordRef}
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  disabled={loading}
                >
                  {showPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                </button>
              </div>
            </div>
          )}

          {!isForgot && (
            <div className={styles.forgotRow}>
              <button
                type="button"
                className={styles.textAction}
                onClick={() => {
                  setFeedback(null)
                  setIsForgot(true)
                  setPassword("")
                  setShowPassword(false)
                }}
                disabled={loading}
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            className={styles.primaryButton}
            type="submit"
            disabled={loading || (isForgot && forgotCooldown > 0)}
          >
            {isForgot
              ? forgotCooldown > 0
                ? `Send again in ${forgotCooldown}s`
                : loading
                ? "Sending reset link…"
                : "Send reset link"
              : loading
              ? "Logging in…"
              : "Login"}
          </button>
        </form>

        {!isForgot ? (
          <>
            <GoogleAuthButton
              theme={darkMode ? "dark" : "light"}
              onAuthenticated={(role) => finishLogin(role)}
              onOnboarding={() => {
                closeModal()
                router.push("/register?google=1")
              }}
            />

            <p className={styles.accountPrompt}>
              Don&apos;t have an account?
              <button type="button" className={styles.textAction} onClick={goToRegister}>
                Register
              </button>
            </p>
          </>
        ) : (
          <p className={styles.accountPrompt}>
            Remember your password?
            <button
              type="button"
              className={styles.textAction}
              onClick={() => {
                setFeedback(null)
                setIsForgot(false)
                setPassword("")
                setShowPassword(false)
              }}
            >
              Back to login
            </button>
          </p>
        )}
      </section>
    </div>
  )
}
