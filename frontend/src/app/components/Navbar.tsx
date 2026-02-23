"use client";

export default function Navbar() {

  return (

    <div className="flex items-center justify-between p-4 bg-white shadow">

      <h1 className="text-lg font-semibold">
        Our Skin Dermatology Center
      </h1>

      <div className="flex items-center gap-4">

        <span className="text-gray-600">
          Staff User
        </span>

        <button className="px-4 py-2 text-white bg-red-500 rounded">
          Logout
        </button>

      </div>

    </div>

  );

}