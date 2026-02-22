import Navbar from "./app/components/Navbar";
import AppointmentTable from "/components/AppointmentTable";

export default function DashboardPage() {
  return (
    <>
      <Navbar />
      <main className="p-8">
        <h1 className="mb-6 text-3xl font-bold">Dashboard</h1>
        <AppointmentTable />
      </main>
    </>
  );
}