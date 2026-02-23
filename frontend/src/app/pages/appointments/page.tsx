import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import AppointmentTable from "../../components/AppointmentTable";

export default function AppointmentsPage() {

  return (

    <div className="flex h-screen">

      <Sidebar />

      <div className="flex-1">

        <Navbar />

        <div className="p-6">

          <h1 className="mb-4 text-2xl font-bold">
            Appointment Requests
          </h1>

          <AppointmentTable />

        </div>

      </div>

    </div>

  );

}