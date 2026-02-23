"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {

  const pathname = usePathname();

  const linkStyle = (path: string) =>
    `block px-4 py-2 rounded ${
      pathname === path
        ? "bg-blue-500 text-white"
        : "text-gray-700 hover:bg-gray-200"
    }`;

  return (

    <div className="h-screen p-4 bg-white shadow-md w-60">

      <h1 className="mb-6 text-2xl font-bold">
        OurSkin
      </h1>

      <nav className="space-y-2">

        <Link href="/dashboard" className={linkStyle("/dashboard")}>
          Dashboard
        </Link>

        <Link href="/appointments" className={linkStyle("/appointments")}>
  Appointments
</Link>

        <Link href="/dashboard/patients" className={linkStyle("/dashboard/patients")}>
          Patients
        </Link>

      </nav>

    </div>

  );

}