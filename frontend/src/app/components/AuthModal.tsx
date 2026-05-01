"use client"

import { API_BASE_URL } from "@/lib/api"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { FaEye, FaEyeSlash } from "react-icons/fa"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess: (role: string, token: string) => void
}

export default function AuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
}: AuthModalProps) {
  const router = useRouter()

  const [isForgot, setIsForgot] = useState(false)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const [forgotCooldown, setForgotCooldown] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const updateCooldown = () => {
      const stored = localStorage.getItem("resetCooldownUntil")

      if (!stored) {
        setForgotCooldown(0)
        return
      }

      const remaining = Math.max(
        0,
        Math.ceil((Number(stored) - Date.now()) / 1000)
      )

      setForgotCooldown(remaining)

      if (remaining <= 0) {
        localStorage.removeItem("resetCooldownUntil")
      }
    }

    updateCooldown()

    const interval = setInterval(updateCooldown, 1000)

    return () => clearInterval(interval)
  }, [])

  const isValidEmailFormat = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  }

  const resetFields = () => {
    setEmail("")
    setPassword("")
    setShowPassword(false)
    setIsForgot(false)
  }

  const login = async () => {
    if (!email.trim()) {
      alert("Please enter your email.")
      return
    }

    if (!isValidEmailFormat(email)) {
      alert("Please enter a valid email address.")
      return
    }

    if (!password) {
      alert("Please enter your password.")
      return
    }

    try {
      setLoading(true)

      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username: email.trim(),
          password: password,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (typeof data.detail === "string") {
          alert(data.detail)
        } else {
          alert("Invalid email or password.")
        }

        return
      }

      if (!data.access_token) {
        alert("Login failed.")
        return
      }

      localStorage.setItem("token", data.access_token)

      onLoginSuccess(data.role, data.access_token)
      resetFields()
      onClose()
    } catch (error) {
      console.error("Login error:", error)
      alert("Failed to connect to the server. Please make sure the backend is running.")
    } finally {
      setLoading(false)
    }
  }

  const forgotPassword = async () => {
    if (!email.trim()) {
      alert("Please enter your email first.")
      return
    }

    if (!isValidEmailFormat(email)) {
      alert("Please enter a valid email address.")
      return
    }

    if (forgotCooldown > 0) {
      alert(`Please wait ${forgotCooldown} seconds before requesting again.`)
      return
    }

    try {
      setLoading(true)

      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      })

      const data = await res.json().catch(() => ({}))

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
        alert(
          typeof data.detail === "string"
            ? data.detail
            : "Failed to send reset link."
        )
        return
      }

      const cooldownUntil = Date.now() + 60 * 1000

      localStorage.setItem("resetCooldownUntil", String(cooldownUntil))
      setForgotCooldown(60)

      alert(
        data.message ||
          "If an account exists for this email, a reset link has been sent."
      )

      setIsForgot(false)
      setPassword("")
      setShowPassword(false)
    } catch (error) {
      console.error("Forgot password error:", error)
      alert("Failed to connect to the server. Please make sure the backend is running.")
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
    <div className="modal">
      <div className="modalCard">
        <h2>{isForgot ? "Forgot Password" : "Login"}</h2>

        <p className="authHelperText">
          {isForgot
            ? "Enter your email and we’ll send you a reset link."
            : "Please log in to continue your booking."}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()

            if (isForgot) {
              forgotPassword()
            } else {
              login()
            }
          }}
        >
          <input
            className="authInput"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {!isForgot && (
            <div className="inputWrapper">
              <input
                className="authInput"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <span
                className="eyeIcon"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>
          )}

          {!isForgot && (
            <div className="forgotRow">
              <button
                type="button"
                className="forgotLink"
                onClick={() => {
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
            className="submitBtn"
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

        {!isForgot ? (
          <p className="switch">
            Don&apos;t have an account?
            <span className="switchAction" onClick={goToRegister}>
              {" "}
              Register
            </span>
          </p>
        ) : (
          <p className="switch">
            Remember your password?
            <span
              className="switchAction"
              onClick={() => {
                setIsForgot(false)
                setPassword("")
                setShowPassword(false)
              }}
            >
              {" "}
              Login
            </span>
          </p>
        )}

        <div className="authCloseRow">
          <button
            type="button"
            className="authCloseBtn"
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