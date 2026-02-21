"use client";

import { useEffect, useState } from "react";
import { fetchAppointments, updateAppointmentStatus, Appointment } from "../services/mockApi";
import Button from "./Button";

export default function AppointmentTable() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchAppointments().then((data) => {
      setAppointments(data);
      setLoading(false);
    });
  }, []);

  const handleStatus = async (id: number, status: "accepted" | "declined") => {
    setLoading(true);
    const updated = await updateAppointmentStatus(id, status);
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? updated : a))
    );
    setLoading(false);
  };

  if (loading) return <p>Loading appointments...</p>;

  return (
    <div className="space-y-4">
      {appointments.map((app) => (
        <div key={app.id} className="p-4 bg-white shadow rounded flex justify-between items-center">
          <div>
            <p className="font-bold">{app.patientName}</p>
            <p className="text-sm">Date: {app.date}</p>
            <p className="text-sm">Status: {app.status}</p>
          </div>
          {app.status === "pending" && (
            <div className="flex space-x-2">
              <Button text="Accept" onClick={() => handleStatus(app.id, "accepted")} />
              <Button
                text="Decline"
                className="bg-red-400 hover:bg-red-500"
                onClick={() => handleStatus(app.id, "declined")}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}