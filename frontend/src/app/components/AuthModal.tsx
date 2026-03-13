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

  const res = await fetch("http://127.0.0.1:8000/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      username: email,
      password: password,
    }),
  });

  if (!res.ok) {
    alert("Invalid email or password");
    return;
  }

  const data = await res.json();

  if (!data.access_token) {
    alert("Login failed.");
    return;
  }

  localStorage.setItem("token", data.access_token);

  onLoginSuccess("patient", data.access_token);
  onClose();
};

const register = async () => {
  const res = await fetch("http://127.0.0.1:8000/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: name,
      email: email,
      contact: contact,
      password: password
    })
  })

  if (res.ok) {
    alert("Account created. Please login.")
    setIsLogin(true)
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