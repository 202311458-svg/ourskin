import Navbar from "../components/Navbar";
import AppointmentTable from "../components/AppointmentTable";

export default function DashboardPage() {
  return (
    <>
      <Navbar />
      <main className="p-8">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <AppointmentTable />
      </main>
    </>
  );
}