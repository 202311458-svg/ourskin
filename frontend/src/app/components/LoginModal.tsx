"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  close: () => void;
}

export default function LoginModal({ close }: Props) {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const router = useRouter();

  const login = async () => {
    try {

      const res = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Login failed");
        return;
      }

      // Save JWT token
      localStorage.setItem("token", data.access_token);

      alert("Login successful");

      close();

      // Optional redirect after login
      router.push("/");

    } catch (error) {
      console.error(error);
      alert("Server error");
    }
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

        <p>Don&apos;t have an account?</p>

        <button
          className="switchBtn"
          onClick={() => {
            close();
            router.push("/pages/patient/register");
          }}
        >
          Register here
        </button>

        <button className="closeBtn" onClick={close}>
          Close
        </button>

      </div>
    </div>
  );
}