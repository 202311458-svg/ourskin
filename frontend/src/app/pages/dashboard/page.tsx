import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import AppointmentTable from "../../components/AppointmentTable";

export default function DashboardPage() {

  return (

    <div className="flex">

      <Sidebar />

      <div className="p-6">

        <h1 className="text-2xl font-bold">
          Dashboard
        </h1>

        <p className="mt-2">
          Welcome to OurSkin Staff Dashboard
        </p>

      </div>

<div className="p-6">

  <h1 className="mb-6 text-3xl font-bold">
    Staff Dashboard
  </h1>

  <AppointmentTable />

</div>

        </div>

  );
}