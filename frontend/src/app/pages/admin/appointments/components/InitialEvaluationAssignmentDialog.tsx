"use client";

import { useEffect, useMemo, useState } from "react";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import type { AdminAppointment, AssignableDoctor, AssignableSlot } from "@/lib/admin-api";
import {
  assignInitialEvaluationSchedule,
  getAssignableInitialEvaluationDoctors,
  getAssignableInitialEvaluationSlots,
} from "@/lib/admin-api";
import {
  TIME_OPTIONS,
  addDaysToInputDate,
  formatDate,
  formatTime,
  getTodayInputDate,
  type ManualConsultationMode,
} from "../appointment-utils";
import styles from "../page.module.css";

type Props = {
  appointment: AdminAppointment | null;
  onClose: () => void;
  onAssigned: (appointment: AdminAppointment) => void;
};

export default function InitialEvaluationAssignmentDialog({
  appointment,
  onClose,
  onAssigned,
}: Props) {
  const [doctors, setDoctors] = useState<AssignableDoctor[]>([]);
  const [slots, setSlots] = useState<AssignableSlot[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [weekStart, setWeekStart] = useState(getTodayInputDate());
  const [manualDate, setManualDate] = useState(addDaysToInputDate(1));
  const [manualStartTime, setManualStartTime] = useState("10:00");
  const [manualEndTime, setManualEndTime] = useState("11:00");
  const [manualMode, setManualMode] =
    useState<ManualConsultationMode>("In-Person");
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!appointment) return;

    setDoctors([]);
    setSlots([]);
    setSelectedDoctorId(null);
    setSelectedSlotId("");
    setWeekStart(getTodayInputDate());
    setManualDate(addDaysToInputDate(1));
    setManualStartTime("10:00");
    setManualEndTime("11:00");
    setManualMode("In-Person");
    setError("");

    let cancelled = false;
    setLoadingDoctors(true);

    void getAssignableInitialEvaluationDoctors(appointment.id)
      .then((items) => {
        if (cancelled) return;
        setDoctors(items);
        setSelectedDoctorId(items[0]?.id ?? null);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setDoctors([]);
        setSelectedDoctorId(null);
        setError(getErrorMessage(loadError, "Unable to load assignable doctors."));
      })
      .finally(() => {
        if (!cancelled) setLoadingDoctors(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appointment]);

  useEffect(() => {
    if (!appointment || selectedDoctorId === null) {
      setSlots([]);
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    setSelectedSlotId("");
    setError("");

    void getAssignableInitialEvaluationSlots(appointment.id, {
      doctor_id: selectedDoctorId,
      week_start: weekStart,
    })
      .then((items) => {
        if (!cancelled) setSlots(items);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setSlots([]);
        setError(getErrorMessage(loadError, "Unable to load assignable slots."));
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appointment, selectedDoctorId, weekStart]);

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.slot_id === selectedSlotId) || null,
    [selectedSlotId, slots]
  );

  const useSelectedSlot = async () => {
    if (!appointment) return;
    if (!selectedSlot) {
      setError("Select an available slot first.");
      return;
    }
    if (!selectedSlot.is_available) {
      setError("That slot is no longer available. Select another slot.");
      return;
    }

    try {
      setAssigning(true);
      setError("");
      const data = await assignInitialEvaluationSchedule(appointment.id, {
        schedule_id: selectedSlot.schedule_id,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
      });
      onAssigned(data.appointment);
    } catch (assignError: unknown) {
      setError(getErrorMessage(assignError, "Unable to assign the selected schedule."));
    } finally {
      setAssigning(false);
    }
  };

  const useManualSchedule = async () => {
    if (!appointment) return;
    if (!selectedDoctorId) {
      setError("Select a doctor before using manual assignment.");
      return;
    }
    if (!manualDate || !manualStartTime || !manualEndTime) {
      setError("Complete the manual schedule date and time fields.");
      return;
    }
    if (manualEndTime <= manualStartTime) {
      setError("End time must be later than start time.");
      return;
    }

    try {
      setAssigning(true);
      setError("");
      const data = await assignInitialEvaluationSchedule(appointment.id, {
        schedule_id: null,
        doctor_id: selectedDoctorId,
        schedule_date: manualDate,
        start_time: manualStartTime,
        end_time: manualEndTime,
        consultation_mode: manualMode,
      });
      onAssigned(data.appointment);
    } catch (assignError: unknown) {
      setError(getErrorMessage(assignError, "Unable to assign the manual schedule."));
    } finally {
      setAssigning(false);
    }
  };

  const blocked = loadingDoctors || assigning;

  return (
    <AdminDialog
      open={Boolean(appointment)}
      onClose={() => {
        if (!blocked) onClose();
      }}
      eyebrow="Initial evaluation"
      title="Assign doctor and schedule"
      description="Initial-evaluation requests must have a doctor and complete schedule before approval."
      size="xl"
      footer={
        <AdminActionButton onClick={onClose} disabled={blocked}>
          Close
        </AdminActionButton>
      }
    >
      {appointment ? (
        <div className={styles.dialogStack}>
          <div className={styles.requestSummary}>
            <strong>{appointment.patient_name}</strong>
            <span>{appointment.services}</span>
            {appointment.concern ? <small>{appointment.concern}</small> : null}
          </div>

          {error ? <div className={styles.dialogError} role="alert">{error}</div> : null}

          <div className={styles.formGrid}>
            <label className={styles.formGroup}>
              <span>Doctor</span>
              <select
                className={styles.input}
                value={selectedDoctorId || ""}
                onChange={(event) => setSelectedDoctorId(Number(event.target.value) || null)}
                disabled={loadingDoctors || assigning}
              >
                <option value="">Select doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}{doctor.specialty ? ` • ${doctor.specialty}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.formGroup}>
              <span>Week start</span>
              <input
                className={styles.input}
                type="date"
                value={weekStart}
                min={getTodayInputDate()}
                onChange={(event) => setWeekStart(event.target.value)}
                disabled={assigning}
              />
            </label>
          </div>

          <section className={styles.assignmentSection}>
            <div className={styles.assignmentHeading}>
              <div>
                <h3>Available clinic slots</h3>
                <p>Use a configured slot whenever possible so clinic capacity stays consistent.</p>
              </div>
            </div>

            {loadingDoctors || loadingSlots ? (
              <div className={styles.dialogMessage}>Loading available schedules…</div>
            ) : !selectedDoctorId ? (
              <div className={styles.dialogMessage}>Select a doctor to view available slots.</div>
            ) : slots.length === 0 ? (
              <div className={styles.dialogMessage}>
                No available slots were found for this doctor and week. Manual assignment remains available below for schedules already coordinated by the clinic.
              </div>
            ) : (
              <div className={styles.slotList}>
                {slots.map((slot) => (
                  <button
                    key={slot.slot_id}
                    type="button"
                    className={`${styles.slotButton} ${
                      selectedSlotId === slot.slot_id ? styles.slotButtonActive : ""
                    } ${!slot.is_available ? styles.slotButtonDisabled : ""}`.trim()}
                    disabled={!slot.is_available || assigning}
                    onClick={() => setSelectedSlotId(slot.slot_id)}
                    aria-pressed={selectedSlotId === slot.slot_id}
                  >
                    <strong>{formatDate(slot.schedule_date)}</strong>
                    <span>{formatTime(slot.start_time)} – {formatTime(slot.end_time)}</span>
                    <small>{slot.doctor_name} • {slot.consultation_mode}</small>
                    {!slot.is_available && slot.unavailable_reason ? (
                      <small>{slot.unavailable_reason}</small>
                    ) : null}
                  </button>
                ))}
              </div>
            )}

            <div className={styles.assignmentActions}>
              <AdminActionButton
                tone="success"
                onClick={useSelectedSlot}
                disabled={!selectedSlot || assigning || loadingSlots}
              >
                {assigning ? "Assigning…" : "Use selected slot"}
              </AdminActionButton>
            </div>
          </section>

          <section className={styles.assignmentSection}>
            <div className={styles.assignmentHeading}>
              <div>
                <h3>Manual assignment</h3>
                <p>Use only when the clinic has already coordinated a schedule outside the configured weekly slots.</p>
              </div>
            </div>

            <div className={styles.manualGrid}>
              <label className={styles.formGroup}>
                <span>Date</span>
                <input
                  className={styles.input}
                  type="date"
                  min={getTodayInputDate()}
                  value={manualDate}
                  onChange={(event) => setManualDate(event.target.value)}
                  disabled={assigning}
                />
              </label>

              <label className={styles.formGroup}>
                <span>Start time</span>
                <select
                  className={styles.input}
                  value={manualStartTime}
                  onChange={(event) => setManualStartTime(event.target.value)}
                  disabled={assigning}
                >
                  {TIME_OPTIONS.slice(0, -1).map((time) => (
                    <option key={time} value={time}>{formatTime(time)}</option>
                  ))}
                </select>
              </label>

              <label className={styles.formGroup}>
                <span>End time</span>
                <select
                  className={styles.input}
                  value={manualEndTime}
                  onChange={(event) => setManualEndTime(event.target.value)}
                  disabled={assigning}
                >
                  {TIME_OPTIONS.slice(1).map((time) => (
                    <option key={time} value={time}>{formatTime(time)}</option>
                  ))}
                </select>
              </label>

              <label className={styles.formGroup}>
                <span>Consultation mode</span>
                <select
                  className={styles.input}
                  value={manualMode}
                  onChange={(event) => setManualMode(event.target.value as ManualConsultationMode)}
                  disabled={assigning}
                >
                  <option value="In-Person">In-Person</option>
                  <option value="Online Consultation">Online Consultation</option>
                </select>
              </label>
            </div>

            <div className={styles.assignmentActions}>
              <AdminActionButton tone="primary" onClick={useManualSchedule} disabled={assigning}>
                {assigning ? "Assigning…" : "Use manual schedule"}
              </AdminActionButton>
            </div>
          </section>
        </div>
      ) : null}
    </AdminDialog>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
