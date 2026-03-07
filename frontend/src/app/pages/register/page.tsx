export default function RegisterPage() {
  return (
    <div className="max-w-lg p-8 mx-auto mt-12 bg-white rounded shadow">

      <h1 className="mb-6 text-2xl font-bold">
        Book Appointment
      </h1>

      <input
        placeholder="Full Name"
        className="w-full p-2 mb-3 border rounded"
      />

      <input
        placeholder="Contact Number"
        className="w-full p-2 mb-3 border rounded"
      />

      <input
        type="date"
        className="w-full p-2 mb-3 border rounded"
      />

      <textarea
        placeholder="Skin concern"
        className="w-full p-2 mb-4 border rounded"
      />

      <button className="w-full py-2 text-white bg-black rounded">
        Request Appointment
      </button>

    </div>
  );
}