"use client";

import { useState } from "react";

interface Props {
  close: () => void;
  switchRegister: () => void;
}

export default function LoginModal({ close, switchRegister }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = () => {
    console.log("Login attempt", email, password);
  };

  return (
    <div className="modal">
      <div className="modalCard">

        <h2>Patient Login</h2>

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

        <button className="submitBtn" onClick={login}>
          Login
        </button>

        <p>
          Don't have an account?
        </p>

        <button className="switchBtn" onClick={switchRegister}>
          Register here
        </button>

        <button className="closeBtn" onClick={close}>
          Close
        </button>

      </div>
    </div>
  );
}