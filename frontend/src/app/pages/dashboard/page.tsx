export default function Dashboard() {
  return (

    <div className="p-10">

      <h1 className="text-3xl font-bold">
        Patient Dashboard
      </h1>

      <p className="mt-4">
        Welcome to OurSkin Patient Portal.
      </p>

      <div className="mt-6">

        <a href="/book">
          <button className="mainBtn">
            Book Appointment
          </button>
        </a>

      </div>

    </div>

  );
}