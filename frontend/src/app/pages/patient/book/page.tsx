"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PatientNavbar from "@/app/components/Navbar";
import { API_BASE_URL, getAuth } from "@/lib/api";
import styles from "@/app/styles/patient.module.css";

type UserProfile = {
  id: number;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  contact?: string | null;
  email?: string | null;
  role?: string | null;
  is_minor?: boolean | null;
};

type Service = {
  id: number;
  name: string;
  description?: string | null;
  requires_initial_evaluation: boolean;
  is_active: boolean;
};

type Doctor = {
  id: number;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  specialty?: string | null;
  availability?: string | null;
  profile_image?: string | null;
  bio?: string | null;
};

type BookingSchedule = {
  id: string;
  slot_id: string;
  schedule_id: number;
  doctor_id: number;
  doctor_name: string;
  doctor_specialty?: string | null;
  service_id: number;
  service_name: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  consultation_mode: string;
  appointment_type: string;
  is_available: boolean;
  unavailable_reason?: string | null;
};

type BookingPreference = "doctor" | "time";

type AgeInfo = {
  years: number | null;
  label: string;
};

const regularSteps = [
  "Patient Details",
  "Select Service",
  "Booking Preference",
  "Concern",
  "Summary",
];

const initialEvaluationSteps = [
  "Patient Details",
  "Select Service",
  "Concern",
  "Summary",
];

function getAgeInfo(dateOfBirth?: string | null): AgeInfo | null {
  if (!dateOfBirth) return null;

  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();

  if (Number.isNaN(birthDate.getTime()) || birthDate > today) {
    return null;
  }

  let years = today.getFullYear() - birthDate.getFullYear();

  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) {
    years -= 1;
  }

  let totalMonths =
    (today.getFullYear() - birthDate.getFullYear()) * 12 +
    (today.getMonth() - birthDate.getMonth());

  if (today.getDate() < birthDate.getDate()) {
    totalMonths -= 1;
  }

  if (totalMonths < 1) {
    return {
      years: 0,
      label: "Less than 1 month old",
    };
  }

  if (totalMonths < 12) {
    return {
      years: 0,
      label: `${totalMonths} ${totalMonths === 1 ? "month" : "months"} old`,
    };
  }

  return {
    years,
    label: `${years} ${years === 1 ? "year" : "years"} old`,
  };
}

function formatDate(value: string) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);

  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(value: string) {
  if (!value) return "";

  const [hour, minute] = value.split(":");
  const date = new Date();

  date.setHours(Number(hour), Number(minute), 0, 0);

  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getFullName(user: UserProfile | null) {
  if (!user) return "";

  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();

  return fullName || user.name || "";
}

function getTodayDateValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function PatientBookingPage() {
  const [currentStep, setCurrentStep] = useState(1);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [schedules, setSchedules] = useState<BookingSchedule[]>([]);

  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [bookingPreference, setBookingPreference] =
    useState<BookingPreference>("doctor");

  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [preferredWeekStart, setPreferredWeekStart] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedScheduleId, setSelectedScheduleId] = useState("");

  const [patientAddress, setPatientAddress] = useState("");
  const [patientContact, setPatientContact] = useState("");
  const [concern, setConcern] = useState("");

  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const patientName = useMemo(() => getFullName(user), [user]);

  const ageInfo = useMemo(
    () => getAgeInfo(user?.date_of_birth),
    [user?.date_of_birth]
  );

  const patientAge = ageInfo?.years ?? null;
  const patientAgeLabel = ageInfo?.label || "Not set";

  const isMinorPatient = Boolean(
    user?.is_minor || (patientAge !== null && patientAge < 18)
  );

  const selectedService = useMemo(() => {
    return (
      services.find((service) => String(service.id) === selectedServiceId) ||
      null
    );
  }, [services, selectedServiceId]);

  const requiresInitialEvaluation = Boolean(
    selectedService?.requires_initial_evaluation
  );

  const wizardSteps = requiresInitialEvaluation
    ? initialEvaluationSteps
    : regularSteps;

  const finalStep = requiresInitialEvaluation ? 4 : 5;

  const selectedDoctor = useMemo(() => {
    return (
      doctors.find((doctor) => String(doctor.id) === selectedDoctorId) || null
    );
  }, [doctors, selectedDoctorId]);

  const selectedSchedule = useMemo(() => {
    return (
      schedules.find((schedule) => schedule.slot_id === selectedScheduleId) ||
      null
    );
  }, [schedules, selectedScheduleId]);

  const availableTimes = useMemo(() => {
    const uniqueTimes = Array.from(
      new Set(
        schedules
          .filter((schedule) => schedule.is_available)
          .map((schedule) => schedule.start_time)
      )
    );

    return uniqueTimes.sort((a, b) => a.localeCompare(b));
  }, [schedules]);

  const scheduleOptions = useMemo(() => {
    if (bookingPreference === "doctor") {
      return schedules;
    }

    if (!selectedTime) {
      return [];
    }

    return schedules.filter((schedule) => schedule.start_time === selectedTime);
  }, [bookingPreference, schedules, selectedTime]);

  const getHeaders = useCallback(() => {
    const { token } = getAuth();

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const resetScheduleSelections = useCallback(() => {
    setSelectedDoctorId("");
    setPreferredWeekStart("");
    setSelectedTime("");
    setSelectedScheduleId("");
    setSchedules([]);
  }, []);

  const fetchUserProfile = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/users/me`, {
      headers: getHeaders(),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.detail || "Unable to load patient profile.");
    }

    setUser(data);
    setPatientAddress(data?.address || "");
    setPatientContact(data?.contact || "");
  }, [getHeaders]);

  const fetchServices = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/booking/services`, {
      headers: getHeaders(),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.detail || "Unable to load services.");
    }

    setServices(Array.isArray(data) ? data : []);
  }, [getHeaders]);

  const loadInitialData = useCallback(async () => {
    setLoadingPage(true);
    setError("");
    setMessage("");

    try {
      await Promise.all([fetchUserProfile(), fetchServices()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load booking page."
      );
    } finally {
      setLoadingPage(false);
    }
  }, [fetchUserProfile, fetchServices]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  async function fetchDoctorsByService(serviceId: string) {
    if (!serviceId) {
      setDoctors([]);
      return;
    }

    setLoadingDoctors(true);
    setError("");

    try {
      const res = await fetch(
        `${API_BASE_URL}/booking/services/${serviceId}/doctors`,
        {
          headers: getHeaders(),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Unable to load doctors.");
      }

      setDoctors(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load doctors.");
      setDoctors([]);
    } finally {
      setLoadingDoctors(false);
    }
  }

  async function fetchSchedulesByService(options: {
    serviceId: string;
    doctorId?: string;
    weekStart?: string;
  }) {
    const { serviceId, doctorId, weekStart } = options;

    if (!serviceId) {
      setSchedules([]);
      return;
    }

    const params = new URLSearchParams();

    if (doctorId) {
      params.set("doctor_id", doctorId);
    }

    if (weekStart) {
      params.set("week_start", weekStart);
    }

    const queryString = params.toString();
    const url = `${API_BASE_URL}/booking/services/${serviceId}/schedules${
      queryString ? `?${queryString}` : ""
    }`;

    setLoadingSchedules(true);
    setError("");

    try {
      const res = await fetch(url, {
        headers: getHeaders(),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Unable to load available schedules.");
      }

      setSchedules(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load available schedules."
      );
      setSchedules([]);
    } finally {
      setLoadingSchedules(false);
    }
  }

  async function handleServiceChange(serviceId: string) {
    setSelectedServiceId(serviceId);
    setMessage("");
    setError("");
    resetScheduleSelections();
    setDoctors([]);

    const service = services.find((item) => String(item.id) === serviceId);

    if (!serviceId || service?.requires_initial_evaluation) {
      return;
    }

    await fetchDoctorsByService(serviceId);
  }

  function handlePreferenceChange(preference: BookingPreference) {
    setBookingPreference(preference);
    setMessage("");
    setError("");
    setSelectedDoctorId("");
    setPreferredWeekStart("");
    setSelectedTime("");
    setSelectedScheduleId("");
    setSchedules([]);
  }

  async function handleDoctorChange(doctorId: string) {
    setSelectedDoctorId(doctorId);
    setSelectedScheduleId("");
    setSchedules([]);
    setMessage("");

    if (!selectedServiceId || !doctorId) return;

    await fetchSchedulesByService({
      serviceId: selectedServiceId,
      doctorId,
    });
  }

  async function handlePreferredWeekChange(dateValue: string) {
    setPreferredWeekStart(dateValue);
    setSelectedTime("");
    setSelectedScheduleId("");
    setSchedules([]);
    setMessage("");

    if (!selectedServiceId || !dateValue) return;

    await fetchSchedulesByService({
      serviceId: selectedServiceId,
      weekStart: dateValue,
    });
  }

  function handleTimeChange(timeValue: string) {
    setSelectedTime(timeValue);
    setSelectedScheduleId("");
    setMessage("");
    setError("");
  }

  function validateCurrentStep() {
    setError("");

    if (currentStep === 1) {
      if (!(patientContact || "").trim()) {
        setError("Please provide a contact number.");
        return false;
      }

      if (!(patientAddress || "").trim()) {
        setError("Please provide an address.");
        return false;
      }
    }

    if (currentStep === 2) {
      if (!selectedServiceId) {
        setError("Please select a service.");
        return false;
      }
    }

    if (currentStep === 3 && !requiresInitialEvaluation) {
      if (!selectedSchedule) {
        setError("Please select an available appointment schedule.");
        return false;
      }
    }

    return true;
  }

  function goToNextStep() {
    const isValid = validateCurrentStep();

    if (!isValid) return;

    setMessage("");
    setError("");
    setCurrentStep((step) => Math.min(step + 1, finalStep));
  }

  function goToPreviousStep() {
    setMessage("");
    setError("");
    setCurrentStep((step) => Math.max(step - 1, 1));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    setMessage("");

    if (!selectedServiceId) {
      setError("Please select a service.");
      setSubmitting(false);
      setCurrentStep(2);
      return;
    }

    if (!requiresInitialEvaluation && !selectedSchedule) {
      setError("Please select an available appointment schedule.");
      setSubmitting(false);
      setCurrentStep(3);
      return;
    }

    if (!(patientContact || "").trim()) {
      setError("Please provide a contact number.");
      setSubmitting(false);
      setCurrentStep(1);
      return;
    }

    if (!(patientAddress || "").trim()) {
      setError("Please provide an address.");
      setSubmitting(false);
      setCurrentStep(1);
      return;
    }

    try {
      const payload = requiresInitialEvaluation
        ? {
            service_id: Number(selectedServiceId),
            patient_contact: patientContact.trim(),
            patient_address: patientAddress.trim(),
            patient_age: patientAge,
            patient_age_label: patientAgeLabel !== "Not set" ? patientAgeLabel : null,
            concern: concern.trim() || null,
          }
        : {
            schedule_id: selectedSchedule?.schedule_id,
            service_id: Number(selectedServiceId),
            start_time: selectedSchedule?.start_time,
            end_time: selectedSchedule?.end_time,
            patient_contact: patientContact.trim(),
            patient_address: patientAddress.trim(),
            patient_age: patientAge,
            patient_age_label: patientAgeLabel !== "Not set" ? patientAgeLabel : null,
            concern: concern.trim() || null,
          };

      const res = await fetch(`${API_BASE_URL}/appointments/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Unable to submit appointment request.");
      }

      setMessage(
        requiresInitialEvaluation
          ? "Initial evaluation request submitted successfully. Staff will review and schedule the evaluation."
          : "Appointment request submitted successfully."
      );

      setSelectedServiceId("");
      setBookingPreference("doctor");
      setSelectedDoctorId("");
      setPreferredWeekStart("");
      setSelectedTime("");
      setSelectedScheduleId("");
      setSchedules([]);
      setDoctors([]);
      setConcern("");
      setCurrentStep(1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit appointment request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function getNextButtonLabel() {
    if (currentStep === 1) return "Next: Select Service";

    if (currentStep === 2) {
      return requiresInitialEvaluation
        ? "Next: Add Concern"
        : "Next: Choose Preference";
    }

    if (requiresInitialEvaluation && currentStep === 3) {
      return "Next: Review Request";
    }

    if (!requiresInitialEvaluation && currentStep === 3) {
      return "Next: Concern";
    }

    if (!requiresInitialEvaluation && currentStep === 4) {
      return "Next: Review Booking";
    }

    return "Next";
  }

  const showBookingPreferenceStep = currentStep === 3 && !requiresInitialEvaluation;
  const showConcernStep =
    (requiresInitialEvaluation && currentStep === 3) ||
    (!requiresInitialEvaluation && currentStep === 4);
  const showSummaryStep = currentStep === finalStep;

  return (
    <>
      <PatientNavbar />

      <main className={styles.bookingPage}>
        <section className={styles.bookingHeader}>
          <div>
            <p className={styles.eyebrow}>Patient Appointment Booking</p>
            <h1>Book an Appointment</h1>
            <p className={styles.pageSubtext}>
              Complete each step to submit your appointment request for staff
              review.
            </p>
          </div>

          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={loadInitialData}
          >
            Refresh
          </button>
        </section>

        <section className={styles.bookingStepper}>
          {wizardSteps.map((step, index) => {
            const stepNumber = index + 1;
            const isActive = currentStep === stepNumber;
            const isDone = currentStep > stepNumber;

            return (
              <div
                key={step}
                className={`${styles.bookingStepItem} ${
                  isActive ? styles.bookingStepActive : ""
                } ${isDone ? styles.bookingStepDone : ""}`}
              >
                <span>{stepNumber}</span>
                <p>{step}</p>
              </div>
            );
          })}
        </section>

        {error && <div className={styles.errorBox}>{error}</div>}
        {message && <div className={styles.successBox}>{message}</div>}

        {loadingPage ? (
          <section className={styles.bookingCard}>
            <div className={styles.emptyState}>Loading booking details...</div>
          </section>
        ) : (
          <section className={styles.bookingWizardShell}>
            {currentStep === 1 && (
              <div className={styles.bookingCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2>Patient Details</h2>
                    <p>
                      Your registered details are shown below. Contact number
                      and address can be updated for this booking.
                    </p>
                  </div>
                </div>

                {isMinorPatient && (
                  <div className={styles.noticeBox}>
                    <strong>Minor Patient</strong>
                    <p>
                      This profile is flagged as a minor patient. Staff can
                      review guardian or representative details before approval.
                    </p>
                  </div>
                )}

                <div className={styles.patientInfoGrid}>
                  <div className={styles.formGroup}>
                    <label>First Name</label>
                    <input
                      type="text"
                      value={user?.first_name || patientName}
                      readOnly
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Last Name</label>
                    <input type="text" value={user?.last_name || ""} readOnly />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Age</label>
                    <input type="text" value={patientAgeLabel} readOnly />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Email</label>
                    <input type="email" value={user?.email || ""} readOnly />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Contact Number</label>
                    <input
                      type="text"
                      value={patientContact}
                      onChange={(event) =>
                        setPatientContact(event.target.value)
                      }
                      placeholder="Enter contact number"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Address</label>
                    <input
                      type="text"
                      value={patientAddress}
                      onChange={(event) =>
                        setPatientAddress(event.target.value)
                      }
                      placeholder="Enter complete address"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className={styles.bookingCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2>Select Service</h2>
                    <p>
                      Services are loaded from the clinic database and matched
                      with doctors and staff-managed schedules.
                    </p>
                  </div>
                </div>

                <div className={styles.serviceGrid}>
                  {services.map((service) => {
                    const active = selectedServiceId === String(service.id);

                    return (
                      <button
                        key={service.id}
                        type="button"
                        className={`${styles.serviceCard} ${
                          active ? styles.serviceCardActive : ""
                        }`}
                        onClick={() => handleServiceChange(String(service.id))}
                      >
                        <strong>{service.name}</strong>

                        {service.requires_initial_evaluation && (
                          <span>Initial evaluation required</span>
                        )}

                        {service.description && <p>{service.description}</p>}
                      </button>
                    );
                  })}
                </div>

                {selectedService?.requires_initial_evaluation && (
                  <div className={styles.noticeBox}>
                    <strong>Initial evaluation request</strong>
                    <p>
                      Surgical and Cosmetic Surgery requests will be submitted
                      for staff review first. You do not need to choose a doctor
                      or time on this step because staff will coordinate the
                      initial evaluation schedule.
                    </p>
                  </div>
                )}
              </div>
            )}

            {showBookingPreferenceStep && (
              <div className={styles.bookingCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2>Choose Booking Preference</h2>
                    <p>
                      Choose whether you want to book by doctor or by preferred
                      appointment time.
                    </p>
                  </div>
                </div>

                <div className={styles.preferenceGrid}>
                  <button
                    type="button"
                    className={`${styles.preferenceCard} ${
                      bookingPreference === "doctor"
                        ? styles.preferenceCardActive
                        : ""
                    }`}
                    onClick={() => handlePreferenceChange("doctor")}
                  >
                    <strong>Prefer Doctor</strong>
                    <span>
                      Select a doctor who performs the selected service, then
                      choose from their available hourly slots.
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.preferenceCard} ${
                      bookingPreference === "time"
                        ? styles.preferenceCardActive
                        : ""
                    }`}
                    onClick={() => handlePreferenceChange("time")}
                  >
                    <strong>Prefer Appointment Time</strong>
                    <span>
                      Select a week and preferred time first, then choose from
                      doctors available during that weekly schedule.
                    </span>
                  </button>
                </div>

                {bookingPreference === "doctor" && (
                  <div className={styles.bookingSubSection}>
                    <h3>Select Doctor</h3>

                    {loadingDoctors ? (
                      <div className={styles.emptyState}>Loading doctors...</div>
                    ) : doctors.length === 0 ? (
                      <div className={styles.emptyState}>
                        No doctors are assigned to this service yet.
                      </div>
                    ) : (
                      <div className={styles.doctorGrid}>
                        {doctors.map((doctor) => {
                          const active =
                            selectedDoctorId === String(doctor.id);

                          return (
                            <button
                              key={doctor.id}
                              type="button"
                              className={`${styles.doctorCard} ${
                                active ? styles.doctorCardActive : ""
                              }`}
                              onClick={() =>
                                handleDoctorChange(String(doctor.id))
                              }
                            >
                              <strong>{doctor.name}</strong>
                              <span>{doctor.specialty || "Doctor"}</span>
                              {doctor.bio && <p>{doctor.bio}</p>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {bookingPreference === "time" && (
                  <div className={styles.bookingSubSection}>
                    <h3>Select Preferred Week and Time</h3>

                    <div className={styles.noticeBox}>
                      <strong>Weekly availability</strong>
                      <p>
                        Available times are shown for the selected week only,
                        Monday to Saturday. Sunday is unavailable by default.
                      </p>
                    </div>

                    <div className={styles.patientInfoGrid}>
                      <div className={styles.formGroup}>
                        <label>Week Starting Date</label>
                        <input
                          type="date"
                          min={getTodayDateValue()}
                          value={preferredWeekStart}
                          onChange={(event) =>
                            handlePreferredWeekChange(event.target.value)
                          }
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Available Time</label>
                        <select
                          value={selectedTime}
                          disabled={
                            !preferredWeekStart || availableTimes.length === 0
                          }
                          onChange={(event) =>
                            handleTimeChange(event.target.value)
                          }
                        >
                          <option value="">Select time</option>
                          {availableTimes.map((timeValue) => (
                            <option key={timeValue} value={timeValue}>
                              {formatTime(timeValue)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className={styles.bookingSubSection}>
                  <h3>Select Available Schedule</h3>

                  {loadingSchedules ? (
                    <div className={styles.emptyState}>Loading schedules...</div>
                  ) : scheduleOptions.length === 0 ? (
                    <div className={styles.emptyState}>
                      {bookingPreference === "doctor"
                        ? "Select a doctor to view available hourly slots."
                        : "Select a week and time to view available doctors."}
                    </div>
                  ) : (
                    <div className={styles.scheduleGrid}>
                      {scheduleOptions.map((schedule) => {
                        const active = selectedScheduleId === schedule.slot_id;

                        return (
                          <button
                            key={schedule.slot_id}
                            type="button"
                            disabled={!schedule.is_available}
                            className={`${styles.scheduleOption} ${
                              active ? styles.scheduleOptionActive : ""
                            }`}
                            onClick={() => {
                              if (!schedule.is_available) return;
                              setSelectedScheduleId(schedule.slot_id);
                            }}
                          >
                            <strong>
                              {formatDate(schedule.schedule_date)}
                            </strong>
                            <span>
                              {formatTime(schedule.start_time)} to{" "}
                              {formatTime(schedule.end_time)}
                            </span>
                            <p>{schedule.doctor_name}</p>
                            <small>
                              {schedule.is_available
                                ? `${schedule.consultation_mode} · ${schedule.appointment_type}`
                                : schedule.unavailable_reason || "Unavailable"}
                            </small>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {showConcernStep && (
              <div className={styles.bookingCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2>Concern or Reason for Visit</h2>
                    <p>
                      Add a short note to help the clinic understand your
                      appointment request.
                    </p>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Concern</label>
                  <textarea
                    value={concern}
                    onChange={(event) => setConcern(event.target.value)}
                    placeholder="Example: Skin irritation, acne concern, follow-up concern, treatment inquiry"
                    rows={5}
                  />
                </div>
              </div>
            )}

            {showSummaryStep && (
              <div className={styles.bookingCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2>
                      {requiresInitialEvaluation
                        ? "Initial Evaluation Summary"
                        : "Booking Summary"}
                    </h2>
                    <p>
                      Review your request before submitting it for staff
                      approval.
                    </p>
                  </div>
                </div>

                <div className={styles.summaryList}>
                  <div>
                    <span>Patient</span>
                    <strong>{patientName || "Not available"}</strong>
                  </div>

                  <div>
                    <span>Age</span>
                    <strong>{patientAgeLabel}</strong>
                  </div>

                  <div>
                    <span>Patient Indicator</span>
                    <strong>{isMinorPatient ? "Minor Patient" : "Adult Patient"}</strong>
                  </div>

                  <div>
                    <span>Contact</span>
                    <strong>{patientContact || "Not set"}</strong>
                  </div>

                  <div>
                    <span>Address</span>
                    <strong>{patientAddress || "Not set"}</strong>
                  </div>

                  <div>
                    <span>Email</span>
                    <strong>{user?.email || "Not set"}</strong>
                  </div>

                  <div>
                    <span>Service</span>
                    <strong>{selectedService?.name || "Not selected"}</strong>
                  </div>

                  {!requiresInitialEvaluation && (
                    <div>
                      <span>Booking Preference</span>
                      <strong>
                        {bookingPreference === "doctor"
                          ? "Prefer Doctor"
                          : "Prefer Appointment Time"}
                      </strong>
                    </div>
                  )}

                  <div>
                    <span>Doctor</span>
                    <strong>
                      {requiresInitialEvaluation
                        ? "To be assigned by staff"
                        : selectedSchedule?.doctor_name ||
                          selectedDoctor?.name ||
                          "Not selected"}
                    </strong>
                  </div>

                  <div>
                    <span>Date</span>
                    <strong>
                      {requiresInitialEvaluation
                        ? "To be scheduled by staff"
                        : selectedSchedule
                        ? formatDate(selectedSchedule.schedule_date)
                        : "Not selected"}
                    </strong>
                  </div>

                  <div>
                    <span>Time</span>
                    <strong>
                      {requiresInitialEvaluation
                        ? "To be scheduled by staff"
                        : selectedSchedule
                        ? `${formatTime(selectedSchedule.start_time)} to ${formatTime(
                            selectedSchedule.end_time
                          )}`
                        : "Not selected"}
                    </strong>
                  </div>

                  <div>
                    <span>Mode</span>
                    <strong>
                      {requiresInitialEvaluation
                        ? "To be confirmed by staff"
                        : selectedSchedule?.consultation_mode || "Not selected"}
                    </strong>
                  </div>

                  <div>
                    <span>Appointment Type</span>
                    <strong>
                      {requiresInitialEvaluation
                        ? "Initial Evaluation Request"
                        : selectedSchedule?.appointment_type || "Regular"}
                    </strong>
                  </div>

                  <div>
                    <span>Concern</span>
                    <strong>{concern || "No concern added"}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={
                    submitting || (!requiresInitialEvaluation && !selectedSchedule)
                  }
                  onClick={handleSubmit}
                >
                  {submitting
                    ? "Submitting..."
                    : requiresInitialEvaluation
                    ? "Submit Initial Evaluation Request"
                    : "Submit Appointment Request"}
                </button>

                <p className={styles.summaryHelp}>
                  Requests remain pending until reviewed and approved by staff.
                </p>
              </div>
            )}

            <div className={styles.bookingNavButtons}>
              {currentStep > 1 && (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={goToPreviousStep}
                >
                  Back
                </button>
              )}

              {currentStep < finalStep && (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={goToNextStep}
                >
                  {getNextButtonLabel()}
                </button>
              )}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
