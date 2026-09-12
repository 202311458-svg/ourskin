"use client";

import { useEffect, useState } from "react";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import type {
  ClinicUnavailableDate,
  ClinicUnavailableDatePayload,
} from "@/lib/admin-api";
import {
  UNAVAILABLE_REASONS,
  getClinicNowParts,
  isSunday,
  type ClosureForm,
} from "../schedule-utils";
import styles from "../page.module.css";

type Props = {
  open: boolean;
  closure: ClinicUnavailableDate | null;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSave: (closureId: number | null, payload: ClinicUnavailableDatePayload) => void | Promise<void>;
};

function formFromClosure(closure: ClinicUnavailableDate | null): ClosureForm {
  return closure
    ? {
        id: closure.id,
        closure_date: closure.closure_date,
        reason: closure.reason,
        note: closure.note || "",
      }
    : {
        id: null,
        closure_date: getClinicNowParts().date,
        reason: "Holiday",
        note: "",
      };
}

export default function ClinicClosureDialog({
  open,
  closure,
  busy,
  error,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<ClosureForm>(formFromClosure(closure));
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(formFromClosure(closure));
    setValidationError("");
  }, [open, closure]);

  async function submit() {
    if (!form.closure_date) {
      setValidationError("Select a clinic closure date.");
      return;
    }
    if (isSunday(form.closure_date)) {
      setValidationError("Sundays are already unavailable by default.");
      return;
    }
    if (!form.reason.trim()) {
      setValidationError("Select a closure reason.");
      return;
    }

    setValidationError("");
    await onSave(form.id, {
      closure_date: form.closure_date,
      reason: form.reason.trim(),
      note: form.note.trim() || null,
    });
  }

  return (
    <AdminDialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      eyebrow="Clinic-wide availability"
      title={closure ? "Edit unavailable date" : "Create unavailable date"}
      description="A clinic-wide closure blocks doctor schedule creation for the selected date. Existing schedules must be resolved first."
      size="md"
      footer={
        <>
          <AdminActionButton onClick={onClose} disabled={busy}>Cancel</AdminActionButton>
          <AdminActionButton tone="primary" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : closure ? "Save changes" : "Create unavailable date"}
          </AdminActionButton>
        </>
      }
    >
      <div className={styles.dialogStack}>
        {(validationError || error) ? (
          <div className={styles.dialogError} role="alert">{validationError || error}</div>
        ) : null}

        <div className={styles.formGrid}>
          <label className={styles.formGroup}>
            <span>Date</span>
            <input
              type="date"
              min={getClinicNowParts().date}
              value={form.closure_date}
              onChange={(event) => setForm((previous) => ({ ...previous, closure_date: event.target.value }))}
              disabled={busy}
            />
          </label>

          <label className={styles.formGroup}>
            <span>Reason</span>
            <select
              value={form.reason}
              onChange={(event) => setForm((previous) => ({ ...previous, reason: event.target.value }))}
              disabled={busy}
            >
              {UNAVAILABLE_REASONS.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </label>
        </div>

        <label className={styles.formGroup}>
          <span>Note</span>
          <textarea
            className={styles.textArea}
            rows={4}
            value={form.note}
            onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))}
            placeholder="Optional clinic closure note"
            disabled={busy}
          />
        </label>
      </div>
    </AdminDialog>
  );
}
