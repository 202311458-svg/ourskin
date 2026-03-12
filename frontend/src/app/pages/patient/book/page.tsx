"use client";

import { useState } from "react";
import Navbar from "@/app/components/Navbar";
import styles from "./bookAppointment.module.css";

const times = ["12:00 pm","1:00 pm","2:00 pm","3:00 pm","4:00 pm","5:00 pm","6:00 pm"];
const timezones = ["America / Los Angeles (-08:00)", "Asia / Manila (+08:00)"];

export default function BookAppointment() {
  const today = new Date();
  const [step, setStep] = useState(1);
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedTimezone, setSelectedTimezone] = useState(timezones[0]);
  const [patientInfo, setPatientInfo] = useState({
    firstName: "",
    lastName: "",
    age: "",
    phone: "",
    email: "",
    condition: "",
    lookingFor: "",
  });
  const [description, setDescription] = useState("");

  const monthNames = [
    "January","February","March","April","May","June","July","August","September","October","November","December"
  ];

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(selectedYear - 1); }
    else setSelectedMonth(selectedMonth - 1);
  };

  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(selectedYear + 1); }
    else setSelectedMonth(selectedMonth + 1);
  };

  const isDisabledDay = (day: number) => new Date(selectedYear, selectedMonth, day).getDay() === 0;
  const isDisabledTime = (time: string) => time === "12:00 pm" || time === "1:00 pm";

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        {/* Stepper */}
        <div className={styles.steps}>
          {[1,2,3,4].map(s => (
            <div key={s} className={`${styles.step} ${step === s ? styles.stepActive : ""}`}>
              Step {s}
            </div>
          ))}
        </div>

        {/* Step 1: Calendar */}
        {step === 1 && (
          <>
            <div className={styles.calendarWrapper}>
              <div className={styles.calendarHeader}>
                <span className={styles.arrow} onClick={prevMonth}>◀</span>
                <span>{monthNames[selectedMonth]} {selectedYear}</span>
                <span className={styles.arrow} onClick={nextMonth}>▶</span>
              </div>

              <div className={styles.timezoneWrapper}>
                <select
                  className={styles.timezoneSelect}
                  value={selectedTimezone}
                  onChange={e => setSelectedTimezone(e.target.value)}
                >
                  {timezones.map(tz => <option key={tz}>{tz}</option>)}
                </select>
              </div>

              <div className={styles.calendarGrid}>
                {daysArray.map(day => (
                  <div
                    key={day}
                    className={`${styles.dayCell} ${day === today.getDate() && selectedMonth === today.getMonth() ? styles.today : ""} ${day === selectedDay ? styles.selectedDay : ""} ${isDisabledDay(day) ? styles.disabled : ""}`}
                    onClick={() => !isDisabledDay(day) && setSelectedDay(day)}
                  >
                    {day}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.timeSlotsWrapper}>
              {times.map(time => (
                <div
                  key={time}
                  className={`${styles.timeSlot} ${time === selectedTime ? styles.selectedTime : ""} ${isDisabledTime(time) ? styles.timeSlotDisabled : ""}`}
                  onClick={() => !isDisabledTime(time) && setSelectedTime(time)}
                >
                  {time}
                </div>
              ))}
            </div>

            <div className={styles.navButtons}>
              <button
                className={selectedDay && selectedTime ? styles.navButton : styles.navButtonDisabled}
                disabled={!selectedDay || !selectedTime}
                onClick={() => setStep(step + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Step 2: Patient Info */}
        {step === 2 && (
          <>
            {Object.keys(patientInfo).map(f => (
              <div className={styles.formGroup} key={f}>
                <label>{f.replace(/([A-Z])/g, " $1")}</label>
                <input
                  type={f === "age" ? "number" : f === "email" ? "email" : "text"}
                  value={patientInfo[f as keyof typeof patientInfo]}
                  onChange={e => setPatientInfo({ ...patientInfo, [f]: e.target.value })}
                />
              </div>
            ))}

            <div className={styles.navButtons}>
              <button className={styles.navButton} onClick={() => setStep(step - 1)}>Back</button>
              <button
                className={patientInfo.firstName && patientInfo.lastName ? styles.navButton : styles.navButtonDisabled}
                disabled={!patientInfo.firstName || !patientInfo.lastName}
                onClick={() => setStep(step + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Step 3: Description */}
        {step === 3 && (
          <>
            <div className={styles.formGroup}>
              <label>Briefly describe what you want to happen</label>
              <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <div className={styles.navButtons}>
              <button className={styles.navButton} onClick={() => setStep(step - 1)}>Back</button>
              <button
                className={description ? styles.navButton : styles.navButtonDisabled}
                disabled={!description}
                onClick={() => setStep(step + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <>
            <h3 style={{ color: "#82334C" }}>Confirm Details</h3>
            <p><strong>Date:</strong> {selectedMonth + 1}/{selectedDay}/{selectedYear}</p>
            <p><strong>Time:</strong> {selectedTime}</p>
            <p><strong>Timezone:</strong> {selectedTimezone}</p>
            <p><strong>Name:</strong> {patientInfo.firstName} {patientInfo.lastName}</p>
            <p><strong>Age:</strong> {patientInfo.age}</p>
            <p><strong>Phone:</strong> {patientInfo.phone}</p>
            <p><strong>Email:</strong> {patientInfo.email}</p>
            <p><strong>Condition:</strong> {patientInfo.condition}</p>
            <p><strong>Looking for:</strong> {patientInfo.lookingFor}</p>
            <p><strong>Description:</strong> {description}</p>

            <div className={styles.navButtons}>
              <button className={styles.navButton} onClick={() => setStep(step - 1)}>Back</button>
              <button className={styles.navButton}>Confirm Appointment</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}