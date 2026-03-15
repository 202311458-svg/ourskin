"use client";

import { useState } from "react";
import Navbar from "@/app/components/Navbar";
import Image from "next/image";
import styles from "./bookAppointment.module.css";

// Times & Services
const times = ["12:00 pm","1:00 pm","2:00 pm","3:00 pm","4:00 pm","5:00 pm","6:00 pm"];
const services = ["Consultation","Contact Allergy Testing", "Facial Treatment", "Chemical Peels", "Lasers and EBDs", "Injectables", "Surgical", "Cosmetic Surgery"];

// Doctor interface
interface Doctor {
  name: string;
  img: string;
}

// Default doctors per weekday (0 = Sunday, 6 = Saturday)
const doctors: Record<number, Doctor[]> = {
  1: [{ name: "Reena Tagle, MD, DPDS", img: "/reena.png" }],
  2: [{ name: "Gelaine Pangilinan, MD, MBA", img: "/gelaine.png" }],
  3: [{ name: "Hans Alitin, MD, DPDS", img: "/hans.png" }],
  4: [], // Thursday open but no doctor
};

// Helper: week of month
const getWeekOfMonth = (date: Date) => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  return Math.ceil((date.getDate() + firstDay) / 7);
};

export default function BookAppointment() {
  const today = new Date();

  // Steps
  const [step, setStep] = useState(1);
  const stepTitles = ["Select Appointment Date & Time","Patient Information","Appointment Details","Confirm Appointment"];

  // Calendar selection
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  // Appointment data
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [patientInfo, setPatientInfo] = useState({
    firstName: "",
    lastName: "",
    age: "",
    phone: "",
    email: ""
  });

  // Calendar helpers
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const prevMonth = () => {
    if (selectedMonth === 0) setSelectedMonth(11), setSelectedYear(selectedYear - 1);
    else setSelectedMonth(selectedMonth - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 11) setSelectedMonth(0), setSelectedYear(selectedYear + 1);
    else setSelectedMonth(selectedMonth + 1);
  };

  // Sunday & disabled times
  const isSunday = (day: number) => new Date(selectedYear, selectedMonth, day).getDay() === 0;
  const isDisabledTime = (time: string) => time === "12:00 pm" || time === "1:00 pm";

  const selectedDate = new Date(selectedYear, selectedMonth, selectedDay);

  // Get available doctors including alternate Fri/Sat logic
  const getAvailableDoctors = () => {
    const weekday = selectedDate.getDay();
    const weekOfMonth = getWeekOfMonth(selectedDate);

    if (weekday === 5 || weekday === 6) {
      // Friday or Saturday alternates
      return weekOfMonth % 2 === 1
        ? [{ name: "Raisa Rosete, MD, MBA, DPDS", img: "/raisa.png" }]
        : [{ name: "Cecilia Roxas-Rosete, MD, FPDS", img: "/cecilia.png" }];
    }
    return doctors[weekday] || [];
  };

  const availableDoctors = getAvailableDoctors();

  // Services selection
  const toggleService = (service: string) => {
    if (selectedServices.includes(service)) setSelectedServices(selectedServices.filter(s => s !== service));
    else if (selectedServices.length < 3) setSelectedServices([...selectedServices, service]);
  };

  // Submit booking
  const submitBooking = () => {
    const booking = {
      id: Date.now(),
      date: `${selectedMonth+1}/${selectedDay}/${selectedYear}`,
      time: selectedTime,
      services: selectedServices,
      description,
      patient: patientInfo,
      status: "Pending"
    };
    const existing = JSON.parse(localStorage.getItem("appointments") || "[]");
    existing.push(booking);
    localStorage.setItem("appointments", JSON.stringify(existing));
    alert("Appointment submitted!");
    window.location.href = "/pages/patient/history";
  };

  return (
    <>
      <Navbar/>
      <h2 className={styles.pageTitle}>{stepTitles[step-1]}</h2>
      <div className={styles.container}>

        {/* STEP PROGRESS */}
        <div className={styles.stepper}>
          {[1,2,3,4].map((s, index)=>(
            <div key={s} className={styles.stepItem}>
              <div className={`${styles.stepCircle} ${step>=s ? styles.activeCircle : ""}`}>{s}</div>
              {index !== 3 && <div className={`${styles.stepLine} ${step>s ? styles.activeLine : ""}`} />}
            </div>
          ))}
        </div>

        {/* STEP 1: Calendar + Doctor Sidebar */}
        {step === 1 && (
          <div className={styles.step1Wrapper}>
            <div className={styles.calendarTimeWrapper}>
              <div className={styles.calendarHeader}>
                <span onClick={prevMonth}>◀</span>
                <span>{monthNames[selectedMonth]} {selectedYear}</span>
                <span onClick={nextMonth}>▶</span>
              </div>
              <div className={styles.calendarGrid}>
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} className={styles.weekLabel}>{d}</div>)}
                {daysArray.map(day => (
                  <div
                    key={day}
                    className={`${styles.dayCell} ${isSunday(day) ? styles.disabledDay : ""} ${day === selectedDay ? styles.selectedDay : ""}`}
                    onClick={() => !isSunday(day) && setSelectedDay(day)}
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className={styles.timeSlotsWrapper}>
                {times.map(time => (
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
                <button className={selectedTime ? styles.navButton : styles.navButtonDisabled} disabled={!selectedTime} onClick={() => setStep(2)}>Next</button>
              </div>
            </div>

            {selectedTime && (
              <div className={styles.doctorSidebar}>
                <h4>Available Doctor</h4>
                {availableDoctors.length === 0 ? <p>Clinic open for online consultations and facial treatments.</p> :
                  <div className={styles.doctorGrid}>
                    {availableDoctors.map(doc => (
                      <div key={doc.name} className={styles.doctorCardLarge}>
                        <Image src={doc.img} alt={doc.name} width={200} height={200} className={styles.doctorImage}/>
                        <p className={styles.doctorName}>{doc.name}</p>
                      </div>
                    ))}
                  </div>
                }
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Patient Info */}
        {step === 2 && (
          <>
            <div className={styles.formGroup}>
              <label>First Name</label>
              <input value={patientInfo.firstName} onChange={e => setPatientInfo({...patientInfo, firstName: e.target.value})} />
            </div>
            <div className={styles.formGroup}>
              <label>Last Name</label>
              <input value={patientInfo.lastName} onChange={e => setPatientInfo({...patientInfo, lastName: e.target.value})} />
            </div>
            <div className={styles.formGroup}>
              <label>Age</label>
              <input type="number" value={patientInfo.age} onChange={e => setPatientInfo({...patientInfo, age: e.target.value})} />
            </div>
            <div className={styles.formGroup}>
              <label>Phone Number</label>
              <input value={patientInfo.phone} onChange={e => setPatientInfo({...patientInfo, phone: e.target.value})} />
            </div>
            <div className={styles.formGroup}>
              <label>Email</label>
              <input type="email" value={patientInfo.email} onChange={e => setPatientInfo({...patientInfo, email: e.target.value})} />
            </div>

            <div className={styles.navButtons}>
              <button className={styles.navButton} onClick={() => setStep(1)}>Back</button>
              <button className={patientInfo.firstName && patientInfo.lastName ? styles.navButton : styles.navButtonDisabled}
                      disabled={!patientInfo.firstName || !patientInfo.lastName}
                      onClick={() => setStep(3)}>Next</button>
            </div>
          </>
        )}

        {/* STEP 3: Services */}
        {step === 3 && (
          <>
            <div className={styles.formGroup}>
              <label>What are you looking for? (Select up to 3)</label>
              <div className={styles.servicesGrid}>
                {services.map(service => (
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
              <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <div className={styles.navButtons}>
              <button className={styles.navButton} onClick={() => setStep(2)}>Back</button>
              <button className={selectedServices.length ? styles.navButton : styles.navButtonDisabled}
                      disabled={!selectedServices.length} onClick={() => setStep(4)}>Next</button>
            </div>
          </>
        )}

        {/* STEP 4: Confirm */}
        {step === 4 && (
          <>
            <h3>Confirm Appointment</h3>
            <p><strong>Date:</strong> {selectedMonth+1}/{selectedDay}/{selectedYear}</p>
            <p><strong>Time:</strong> {selectedTime}</p>
            <p><strong>Name:</strong> {patientInfo.firstName} {patientInfo.lastName}</p>
            <p><strong>Services:</strong> {selectedServices.join(", ")}</p>
            <p><strong>Description:</strong> {description}</p>

            <div className={styles.navButtons}>
              <button className={styles.navButton} onClick={() => setStep(3)}>Back</button>
              <button className={styles.navButton} onClick={submitBooking}>Confirm Appointment</button>
            </div>
          </>
        )}

      </div>
    </>
  );
}