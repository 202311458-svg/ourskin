"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

useEffect(() => {
  const role = localStorage.getItem("role");

  if (!role) return;

  if (role !== "staff") {
    router.push("/");
  }
}, [router]);

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <p className="mt-4">Welcome to OurSkin Admin Portal.</p>
      <div className="mt-6">
        <a href="/book">
          <button className="mainBtn">View Appointment</button>
        </a>
      </div>
    </div>
  );
}