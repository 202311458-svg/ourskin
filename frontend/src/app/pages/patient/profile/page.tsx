"use client";

import { useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";

type User = {
  id: number;
  name: string;
  email: string;
  contact: string;
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    fetch("http://127.0.0.1:8000/users/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setUser(data);
      });
  }, []);

  return (
    <>
      <Navbar />

      <main className="pageWrapper">
        {!user ? (
          <p>Loading profile...</p>
        ) : (
          <>
            <h1>Account Profile</h1>

            <div className="profileCard">
              <p><b>Name:</b> {user.name}</p>
              <p><b>Email:</b> {user.email}</p>
              <p><b>Phone:</b> {user.contact}</p>
            </div>

          </>
        )}
      </main>
    </>
  );
}