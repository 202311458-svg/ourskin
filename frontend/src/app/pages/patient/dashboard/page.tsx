"use client";

import Image from "next/image"
import { useRouter } from "next/navigation";

export default function PatientDashboard() {

  const router = useRouter();

  return (

    

    <div className="patientDashboard">

      <aside className="dashboardSidebar">

        <div className="dashLogo">
          <Image
            src="/os-logo.png"
            alt="OurSkin"
            width={140}
            height={45}
          />
        </div>

        <nav>

          <button onClick={()=>router.push("/pages/patient/dashboard")}>
            Dashboard
          </button>

          <button onClick={()=>router.push("/pages/patient/book")}>
            Book Appointment
          </button>

          <button onClick={()=>router.push("/pages/patient/appointments")}>
            My Appointments
          </button>

          <button>
            Profile
          </button>

          <button
            onClick={()=>{
              localStorage.removeItem("token");
              router.push("/");
            }}
          >
            Logout
          </button>

        </nav>

      </aside>


      <main className="dashboardMain">

        <h1>Welcome Back</h1>

        <div className="dashboardCards">

          <div className="dashCard">
            <h3>Upcoming Appointment</h3>
            <p>No upcoming appointments</p>
          </div>

          <div className="dashCard">
            <h3>Appointment History</h3>
            <p>View your previous visits</p>
          </div>

          <div className="dashCard">
            <h3>Quick Booking</h3>

            <button
className="bookBtn"
onClick={()=>router.push("/pages/patient/book")}
>
Book Appointment
</button>
          </div>

        </div>

      </main>

    </div>

  );
}