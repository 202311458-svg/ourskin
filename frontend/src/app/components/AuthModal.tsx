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

  const login = async () => {
    // replace with your real API call
    const token = "dummy-token"
    const role = "user"
    onLoginSuccess(role, token)
    onClose()
  }

  const register = async () => {
    // replace with your real API call
    const token = "dummy-token"
    const role = "user"
    onLoginSuccess(role, token)
    onClose()
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