// src/app/register/page.tsx
"use client";

import { useState } from "react";
import { createAppointment } from "../../services/mockApi";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAppointment(name, date);
    setSuccess(`Appointment requested for ${name} on ${date}`);
    setName("");
    setDate("");
  };

  return (
    <div className="max-w-md mx-auto p-8 mt-10 bg-white shadow rounded">
      <h1 className="text-2xl font-bold mb-6">Book an Appointment</h1>
      {success && <p className="mb-4 text-green-600">{success}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-semibold">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border px-3 py-2 rounded"
            required
          />
        </div>
        <div>
          <label className="block mb-1 font-semibold">Preferred Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border px-3 py-2 rounded"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          Request Appointment
        </button>
      </form>
    </div>
  );
}