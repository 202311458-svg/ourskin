"use client";

import { useEffect, useMemo, useState } from "react";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import type {
  AdminDoctor,
  AdminService,
  DoctorSchedulePayload,
} from "@/lib/admin-api";
import type { AdminScheduleRecord } from "@/lib/admin-schedules-api";
import {
  UNAVAILABLE_REASONS,
  createEmptyScheduleForm,
  formatTime,
  getAvailableEndTimes,
  getAvailableStartTimes,
  getClinicNowParts,
  isPastSchedule,
  isSunday,
  scheduleFormToPayload,
  scheduleToForm,
  type ScheduleForm,
} from "../schedule-utils";
import styles from "../page.module.css";

type Props = {
  open: boolean;
  schedule: AdminScheduleRecord | null;
  doctors: AdminDoctor[];
  services: AdminService[];
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSave: (scheduleId: number | null, payload: DoctorSchedulePayload) => void | Promise<void>;
};

export default function ScheduleEditorDialog({
  open,
  schedule,
  doctors,
  services,
  busy,
  error,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<ScheduleForm>(createEmptyScheduleForm());
  const [validationError, setValidationError] = useState("");
  const linked = (schedule?.linked_appointments || 0) > 0;

  useEffect(() => {
    if (!open) return;
    setForm(schedule ? scheduleToForm(schedule) : createEmptyScheduleForm());
    setValidationError("");
  }, [open, schedule]);

  const startOptions = useMemo(() => {
    const options = getAvailableStartTimes(form.schedule_date);
    if (schedule && !options.includes(form.start_time)) {
      return [form.start_time, ...options].sort();
    }
    return options;
  }, [form.schedule_date, form.start_time, schedule]);

  const endOptions = useMemo(() => {
    const options = getAvailableEndTimes(form.start_time);
    if (schedule && !options.includes(form.end_time)) {
      return [form.end_time, ...options].sort();
    }
    return options;
  }, [form.end_time, form.start_time, schedule]);

  function update<K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setValidationError("");
  }

  function toggleService(serviceName: string) {
    if (linked) return;
    setForm((previous) => ({
      ...previous,
      services: previous.services.includes(serviceName)
        ? previous.services.filter((item) => item !== serviceName)
        : [...previous.services, serviceName],
    }));
    setValidationError("");
  }

  function handleDateChange(value: string) {
    if (linked) return;
    const start = getAvailableStartTimes(value)[0] || "";
    const end = getAvailableEndTimes(start)[0] || "";
    setForm((previous) => ({
      ...previous,
      schedule_date: value,
      start_time: start,
      end_time: end,
    }));
    setValidationError("");
  }

  function handleStartChange(value: string) {
    if (linked) return;
    const endOptionsForStart = getAvailableEndTimes(value);
    setForm((previous) => ({
      ...previous,
      start_time: value,
      end_time: previous.end_time > value
        ? previous.end_time
        : endOptionsForStart[0] || "",
    }));
    setValidationError("");
  }

  async function submit() {
    if (!form.doctor_id) {
      setValidationError("Select a doctor before saving the schedule.");
      return;
    }
    if (form.services.length === 0) {
      setValidationError("Select at least one service.");
      return;
    }
    if (!form.schedule_date) {
      setValidationError("Select a schedule date.");
      return;
    }
    if (isSunday(form.schedule_date)) {
      setValidationError("Sundays are unavailable for scheduling.");
      return;
    }
    if (!form.start_time || !form.end_time || form.end_time <= form.start_time) {
      setValidationError("End time must be later than start time.");
      return;
    }
    if (!schedule && isPastSchedule(form.schedule_date, form.start_time)) {
      setValidationError("Past time slots cannot be scheduled.");
      return;
    }
    if (!form.is_available && !form.unavailable_reason) {
      setValidationError("Select a reason when marking the schedule unavailable.");
      return;
    }

    setValidationError("");
    await onSave(form.id, scheduleFormToPayload(form));
  }

  const clinicToday = getClinicNowParts().date;

  return (
    <AdminDialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      eyebrow="Clinic availability"
      title={schedule ? "Edit doctor schedule" : "Create doctor schedule"}
      description="Schedules use 30-minute intervals between 10:00 AM and 7:00 PM. Sundays and past start times are blocked."
      size="xl"
      footer={
        <>
          <AdminActionButton onClick={onClose} disabled={busy}>Cancel</AdminActionButton>
          <AdminActionButton tone="primary" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : schedule ? "Save changes" : "Create schedule"}
          </AdminActionButton>
        </>
      }
    >
      <div className={styles.dialogStack}>
        {linked ? (
          <div className={styles.linkedNotice} role="status">
            This schedule is linked to {schedule?.linked_appointments} appointment{schedule?.linked_appointments === 1 ? "" : "s"}. Doctor, date, time, services, and consultation mode are locked; availability and notes can still be updated.
          </div>
        ) : null}

        {(validationError || error) ? (
          <div className={styles.dialogError} role="alert">{validationError || error}</div>
        ) : null}

        <div className={styles.formGrid}>
          <label className={styles.formGroup}>
            <span>Doctor</span>
            <select
              value={form.doctor_id}
              onChange={(event) => update("doctor_id", event.target.value)}
              disabled={busy || linked}
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
            <span>Date</span>
            <input
              type="date"
              min={clinicToday}
              value={form.schedule_date}
              onChange={(event) => handleDateChange(event.target.value)}
              disabled={busy || linked}
            />
          </label>

          <label className={styles.formGroup}>
            <span>Start time</span>
            <select
              value={form.start_time}
              onChange={(event) => handleStartChange(event.target.value)}
              disabled={busy || linked}
            >
              {startOptions.map((time) => (
                <option key={time} value={time}>{formatTime(time)}</option>
              ))}
            </select>
          </label>

          <label className={styles.formGroup}>
            <span>End time</span>
            <select
              value={form.end_time}
              onChange={(event) => update("end_time", event.target.value)}
              disabled={busy || linked}
            >
              {endOptions.map((time) => (
                <option key={time} value={time}>{formatTime(time)}</option>
              ))}
            </select>
          </label>

          <label className={styles.formGroup}>
            <span>Consultation mode</span>
            <select
              value={form.consultation_mode}
              onChange={(event) => update("consultation_mode", event.target.value as ScheduleForm["consultation_mode"])}
              disabled={busy || linked}
            >
              <option value="In-Person">In-Person</option>
              <option value="Online Consultation">Online Consultation</option>
            </select>
          </label>

          <label className={styles.formGroup}>
            <span>Availability</span>
            <select
              value={form.is_available ? "available" : "unavailable"}
              onChange={(event) => update("is_available", event.target.value === "available")}
              disabled={busy}
            >
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </label>
        </div>

        {!form.is_available ? (
          <label className={styles.formGroup}>
            <span>Unavailable reason</span>
            <select
              value={form.unavailable_reason}
              onChange={(event) => update("unavailable_reason", event.target.value)}
              disabled={busy}
            >
              <option value="">Select reason</option>
              {UNAVAILABLE_REASONS.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </label>
        ) : null}

        <section className={styles.serviceSection} aria-label="Schedule services">
          <div>
            <h3>Services</h3>
            <p>{linked ? "Service coverage is locked because appointments reference this schedule." : "Choose the services this doctor will cover during the schedule."}</p>
          </div>
          <div className={styles.serviceGrid}>
            {services.map((service) => (
              <label key={service.id} className={styles.checkboxTile}>
                <input
                  type="checkbox"
                  checked={form.services.includes(service.name)}
                  onChange={() => toggleService(service.name)}
                  disabled={busy || linked}
                />
                <span>
                  <strong>{service.name}</strong>
                  {service.requires_initial_evaluation ? <small>Initial evaluation required</small> : null}
                </span>
              </label>
            ))}
          </div>
        </section>

        <label className={styles.formGroup}>
          <span>Internal note</span>
          <textarea
            className={styles.textArea}
            rows={4}
            value={form.schedule_note}
            onChange={(event) => update("schedule_note", event.target.value)}
            placeholder="Optional scheduling note"
            disabled={busy}
          />
        </label>
      </div>
    </AdminDialog>
  );
}
