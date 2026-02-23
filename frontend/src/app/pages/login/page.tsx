export default function LoginPage() {
  return (
    <div className="flex items-center justify-center h-screen">

      <div className="p-8 bg-white rounded shadow w-96">

        <h1 className="mb-6 text-2xl font-bold">
          Staff Login
        </h1>

        <input
          placeholder="Email"
          className="w-full p-2 mb-3 border rounded"
        />

        <input
          placeholder="Password"
          type="password"
          className="w-full p-2 mb-4 border rounded"
        />

        <button className="w-full py-2 text-white bg-black rounded">
          Login
        </button>

      </div>

    </div>
  );
}