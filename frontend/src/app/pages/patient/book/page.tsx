"use client";

import { useState, useEffect } from "react";
import Navbar from "@/app/components/Navbar";
import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./bookAppointment.module.css";

const times = ["12:00 pm","1:00 pm","2:00 pm","3:00 pm","4:00 pm","5:00 pm","6:00 pm"];
const services = ["Consultation","Contact Allergy Testing","Facial Treatment","Chemical Peels","Lasers and EBDs","Injectables","Surgical","Cosmetic Surgery"];

interface Doctor {
  name: string;
  img: string;
}

interface CurrentUser {
  id: number;
  name: string;
  email: string;
  contact?: string;
}

const doctors: Record<number, Doctor[]> = {
  1: [{ name: "Reena Tagle, MD, DPDS", img: "/reena.png" }],
  2: [{ name: "Gelaine Pangilinan, MD, MBA", img: "/gelaine.png" }],
  3: [{ name: "Hans Alitin, MD, DPDS", img: "/hans.png" }],
  4: [],
};

const getWeekOfMonth = (date: Date) => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  return Math.ceil((date.getDate() + firstDay) / 7);
};

export default function BookAppointment() {
  const router = useRouter();
  const today = new Date();

  const [step, setStep] = useState(1);
  const [darkMode, setDarkMode] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [description, setDescription] = useState("");

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [patientInfo, setPatientInfo] = useState({
    age: "",
    phone: "",
  });

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  useEffect(() => {
    if (darkMode) document.body.classList.add("darkMode");
    else document.body.classList.remove("darkMode");
  }, [darkMode]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/pages/login");
      return;
    }

    const fetchCurrentUser = async () => {
      try {
        setLoadingUser(true);

        const res = await fetch("http://127.0.0.1:8000/users/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch current user");
        }

        const userData: CurrentUser = await res.json();
        setCurrentUser(userData);
      } catch (error) {
        console.error("Error fetching current user:", error);
        alert("Unable to load your account details. Please log in again.");
        router.push("/pages/login");
      } finally {
        setLoadingUser(false);
      }
    };

    fetchCurrentUser();
  }, [router]);

  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedYear(selectedYear - 1);
      setSelectedMonth(11);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedYear(selectedYear + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const isSunday = (day: number) => new Date(selectedYear, selectedMonth, day).getDay() === 0;
  const isDisabledTime = (time: string) => time === "12:00 pm" || time === "1:00 pm";
  const selectedDate = new Date(selectedYear, selectedMonth, selectedDay);

  const getAvailableDoctors = () => {
    const weekday = selectedDate.getDay();
    const weekOfMonth = getWeekOfMonth(selectedDate);

    if (weekday === 5 || weekday === 6) {
      return weekOfMonth % 2 === 1
        ? [{ name: "Raisa Rosete, MD, MBA, DPDS", img: "/raisa.png" }]
        : [{ name: "Cecilia Roxas-Rosete, MD, FPDS", img: "/cecilia.png" }];
    }

    return doctors[weekday] || [];
  };

  const availableDoctors = getAvailableDoctors();

  const toggleService = (service: string) => {
    if (selectedServices.includes(service)) {
      setSelectedServices(selectedServices.filter((s) => s !== service));
    } else if (selectedServices.length < 3) {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const convertTime = (time: string) => {
    const [hourMinute, modifier] = time.split(" ");
    const [hourRaw, minute] = hourMinute.split(":").map(Number);
    let hour = hourRaw;

    if (modifier === "pm" && hour !== 12) hour += 12;
    if (modifier === "am" && hour === 12) hour = 0;

    return `${String(hour).padStart(2, "0")}:${minute}:00`;
  };

  const submitBooking = async () => {
    if (!currentUser) {
      alert("User information is missing. Please log in again.");
      return;
    }

    const token = localStorage.getItem("token");
    const doctor = availableDoctors.length > 0 ? availableDoctors[0].name : "Online Consultation";

    const booking = {
      patient_name: currentUser.name,
      patient_email: currentUser.email,
      doctor_name: doctor,
      date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`,
      time: convertTime(selectedTime),
      services: selectedServices.join(", "),
      description,
      age: patientInfo.age,
      phone: patientInfo.phone,
    };

    try {
      const res = await fetch("http://127.0.0.1:8000/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(booking),
      });

      if (!res.ok) {
        throw new Error("Booking failed");
      }

      alert("Appointment submitted successfully");
      router.push("/pages/patient/dashboard");
    } catch (err) {
      console.error(err);
      alert("Failed to submit appointment");
    }
  };

  const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1).getDay();
  const calendarCells = Array.from(
    { length: firstDayOfMonth + daysInMonth },
    (_, i) => (i < firstDayOfMonth ? null : i - firstDayOfMonth + 1)
  );

  const stepTitles = [
    "Select Appointment Date & Time",
    "Patient Information",
    "Appointment Details",
    "Confirm Appointment",
  ];

  return (
    <>
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />

      <div
        style={{
          marginLeft: "280px",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingRight: "40px",
        }}
      >
        <h1 className={styles.pageTitle}>{stepTitles[step - 1]}</h1>

        <div className={styles.container}>
          <div className={styles.stepper}>
            {[1, 2, 3, 4].map((s, index) => (
              <div key={s} className={styles.stepItem}>
                <div className={`${styles.stepCircle} ${step >= s ? styles.activeCircle : ""}`}>
                  {s}
                </div>
                {index !== 3 && (
                  <div className={`${styles.stepLine} ${step > s ? styles.activeLine : ""}`} />
                )}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className={styles.step1Wrapper}>
              <div className={styles.calendarTimeWrapper}>
                <div className={styles.calendarHeader}>
                  <span onClick={prevMonth}>◀</span>
                  <span>{monthNames[selectedMonth]} {selectedYear}</span>
                  <span onClick={nextMonth}>▶</span>
                </div>

                <div className={styles.calendarGrid}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className={styles.weekLabel}>{d}</div>
                  ))}

                  {calendarCells.map((day, i) => (
                    <div
                      key={i}
                      className={`${styles.dayCell} ${day === selectedDay ? styles.selectedDay : ""} ${day && isSunday(day) ? styles.disabledDay : ""}`}
                      onClick={() => day && !isSunday(day) && setSelectedDay(day)}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className={styles.timeSlotsWrapper}>
                  {times.map((time) => (
                    <div
                      key={time}
                      className={`${styles.timeSlot} ${selectedTime === time ? styles.selectedTime : ""} ${isDisabledTime(time) ? styles.disabledTime : ""}`}
                      onClick={() => !isDisabledTime(time) && setSelectedTime(time)}
                    >
                      {time}
                    </div>
                  ))}
                </div>

                <div className={styles.navButtons}>
                  <button
                    className={selectedTime ? styles.navButton : styles.navButtonDisabled}
                    disabled={!selectedTime}
                    onClick={() => setStep(2)}
                  >
                    Next
                  </button>
                </div>
              </div>

              {selectedTime && (
                <div className={styles.doctorSidebar}>
                  <h4>Available Doctor</h4>
                  {availableDoctors.length === 0 ? (
                    <p>Clinic open for online consultations and facial treatments.</p>
                  ) : (
                    <div className={styles.doctorGrid}>
                      {availableDoctors.map((doc) => (
                        <div key={doc.name} className={styles.doctorCardLarge}>
                          <Image
                            src={doc.img}
                            alt={doc.name}
                            width={200}
                            height={200}
                            className={styles.doctorImage}
                          />
                          <p className={styles.doctorName}>{doc.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <>
              <div className={styles.formGroup}>
                <label>Full Name</label>
                <input
                  type="text"
                  value={loadingUser ? "Loading..." : currentUser?.name || ""}
                  disabled
                />
              </div>

              <div className={styles.formGroup}>
                <label>Email</label>
                <input
                  type="email"
                  value={loadingUser ? "Loading..." : currentUser?.email || ""}
                  disabled
                />
              </div>

              <div className={styles.formGroup}>
                <label>Age</label>
                <input
                  type="number"
                  value={patientInfo.age}
                  onChange={(e) =>
                    setPatientInfo({ ...patientInfo, age: e.target.value })
                  }
                />
              </div>

              <div className={styles.formGroup}>
                <label>Phone Number</label>
                <input
                  type="text"
                  value={patientInfo.phone}
                  onChange={(e) =>
                    setPatientInfo({ ...patientInfo, phone: e.target.value })
                  }
                />
              </div>

              <div className={styles.navButtons}>
                <button className={styles.navButton} onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  className={currentUser ? styles.navButton : styles.navButtonDisabled}
                  disabled={!currentUser}
                  onClick={() => setStep(3)}
                >
                  Next
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className={styles.formGroup}>
                <label>What are you looking for? (Select up to 3)</label>
                <div className={styles.servicesGrid}>
                  {services.map((service) => (
                    <div
                      key={service}
                      className={`${styles.serviceCard} ${selectedServices.includes(service) ? styles.serviceActive : ""}`}
                      onClick={() => toggleService(service)}
                    >
                      {service}
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Describe your concern</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className={styles.navButtons}>
                <button className={styles.navButton} onClick={() => setStep(2)}>
                  Back
                </button>
                <button
                  className={selectedServices.length ? styles.navButton : styles.navButtonDisabled}
                  disabled={!selectedServices.length}
                  onClick={() => setStep(4)}
                >
                  Next
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h3>Confirm Appointment</h3>
              <p><strong>Date:</strong> {selectedMonth + 1}/{selectedDay}/{selectedYear}</p>
              <p><strong>Time:</strong> {selectedTime}</p>
              <p><strong>Name:</strong> {currentUser?.name || "N/A"}</p>
              <p><strong>Email:</strong> {currentUser?.email || "N/A"}</p>
              <p><strong>Phone:</strong> {patientInfo.phone || "N/A"}</p>
              <p><strong>Services:</strong> {selectedServices.join(", ")}</p>
              <p><strong>Description:</strong> {description}</p>

              <div className={styles.navButtons}>
                <button className={styles.navButton} onClick={() => setStep(3)}>
                  Back
                </button>
                <button className={styles.navButton} onClick={submitBooking}>
                  Confirm Appointment
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}