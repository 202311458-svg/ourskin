"use client";

import { useEffect, useState } from "react";
import {
  Appointment,
  fetchAppointments,
  updateAppointmentStatus,
} from "../services/mockApi";

export default function AppointmentTable() {

  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const loadAppointments = async () => {
    const data = await fetchAppointments();
    setAppointments(data);
  };

  useEffect(() => {
    (async () => {
      const data = await fetchAppointments();
      setAppointments(data);
    })();
  }, []);

  const handleStatus = async (
    id: number,
    status: "accepted" | "declined"
  ) => {
    await updateAppointmentStatus(id, status);
    loadAppointments();
  };

  return (

    <div className="p-6 bg-white rounded shadow">

      <h2 className="mb-4 text-xl font-bold">
        Appointment Requests
      </h2>

      <table className="w-full border">

        <thead>

          <tr className="bg-gray-100 border-b">

            <th className="p-2 text-left">
              Patient
            </th>

            <th className="p-2 text-left">
              Date
            </th>

            <th className="p-2 text-left">
              Status
            </th>

            <th className="p-2 text-left">
              Actions
            </th>

          </tr>

        </thead>

        <tbody>

          {appointments.map((a) => (

            <tr key={a.id} className="border-b">

              <td className="p-2">
                {a.patientName}
              </td>

              <td className="p-2">
                {a.date}
              </td>

              <td className="p-2 capitalize">
                {a.status}
              </td>

              <td className="p-2 space-x-2">

                {a.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleStatus(a.id, "accepted")}
                      className="px-3 py-1 text-white bg-green-500 rounded"
                    >
                      Accept
                    </button>

                    <button
                      onClick={() => handleStatus(a.id, "declined")}
                      className="px-3 py-1 text-white bg-red-500 rounded"
                    >
                      Decline
                    </button>
                  </>
                )}

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );
}