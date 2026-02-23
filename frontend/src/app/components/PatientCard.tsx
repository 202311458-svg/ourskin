"use client";

import { Patient } from "../services/mockApi";

interface Props {
  patient: Patient;
}

export default function PatientCard({ patient }: Props) {

  return (

    <div className="p-5 bg-white rounded shadow">

      <h3 className="mb-2 text-lg font-bold">
        {patient.name}
      </h3>

      <div className="space-y-1 text-sm">

        <p>
          <span className="font-semibold">
            Email:
          </span>{" "}
          {patient.email}
        </p>

        <p>
          <span className="font-semibold">
            Contact:
          </span>{" "}
          {patient.contact}
        </p>

        <p>
          <span className="font-semibold">
            Patient ID:
          </span>{" "}
          {patient.id}
        </p>

      </div>

      <div className="mt-4">

        <button className="px-4 py-2 text-white bg-blue-500 rounded">

          View Record

        </button>

      </div>

    </div>

  );

}