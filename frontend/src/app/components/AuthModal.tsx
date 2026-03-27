"use client"

import { useState } from "react"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess: (role: string, token: string) => void
}

export default function AuthModal({ isOpen, onClose, onLoginSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const validatePassword = (password: string) => {
    return /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(password)
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
    if (password !== confirmPassword) {
      alert("Passwords do not match")
      return
    }

    if (!validatePassword(password)) {
      alert("Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 special character")
      return
    }

    const res = await fetch("http://127.0.0.1:8000/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: name,
        email: email,
        contact: contact,
        password: password,
        confirm_password: confirmPassword
      })
    })

    const data = await res.json()

    if (res.ok) {
      alert("Account created. Check your email to verify before logging in.")
      setIsLogin(true)
      setName("")
      setContact("")
      setEmail("")
      setPassword("")
      setConfirmPassword("")
    } else {
      alert(data.detail || "Registration failed")
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal">
      <div className="modalCard">
        <h2>{isLogin ? "Login to Continue Booking" : "Create an Account"}</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (isLogin) {
              login()
            } else {
              register()
            }
          }}
        >
          {!isLogin && (
            <>
              <input
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                placeholder="Contact Number"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </>
          )}

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {!isLogin && (
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          )}

          <button className="submitBtn" type="submit">
            {isLogin ? "Login" : "Register"}
          </button>
        </form>

        <p className="switch">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <span style={{ cursor: "pointer" }} onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? " Register" : " Login"}
          </span>
        </p>

        <button className="closeBtn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}