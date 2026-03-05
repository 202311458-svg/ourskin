"use client";

import { useState } from "react";

interface Props {
  close: () => void;
  switchLogin: () => void;
}

export default function RegisterModal({ close, switchLogin }: Props) {

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const register = () => {
    console.log("Register", name, email, password);
  };

  return (
    <div className="modal">
      <div className="modalCard">

        <h2>Create Patient Account</h2>

        <input
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

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

        <button className="submitBtn" onClick={register}>
          Register
        </button>

        <p>
          Already have an account?
        </p>

        <button className="switchBtn" onClick={switchLogin}>
          Login here
        </button>

        <button className="closeBtn" onClick={close}>
          Close
        </button>

      </div>
    </div>
  );
}