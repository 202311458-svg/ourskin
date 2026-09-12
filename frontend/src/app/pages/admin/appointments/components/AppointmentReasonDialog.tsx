"use client";

import { useEffect, useState } from "react";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import type { AdminAppointment } from "@/lib/admin-api";
import type { ModalAction } from "../appointment-utils";
import styles from "../page.module.css";

type Props = {
  appointment: AdminAppointment | null;
  action: ModalAction | null;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
};

const copy = {
  decline: {
    title: "Decline appointment",
    description: "Declining a pending request keeps the reason in the appointment history.",
    label: "Decline reason",
    button: "Decline appointment",
  },
  cancel: {
    title: "Cancel appointment",
    description: "Cancelling an approved appointment is a consequential change. Record the clinic reason clearly.",
    label: "Cancellation reason",
    button: "Cancel appointment",
  },
  "no-show": {
    title: "Mark as no-show",
    description: "Use this only when the patient did not attend the approved appointment.",
    label: "No-show reason",
    button: "Mark no-show",
  },
} satisfies Record<ModalAction, { title: string; description: string; label: string; button: string }>;

export default function AppointmentReasonDialog({
  appointment,
  action,
  busy,
  error,
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!appointment || !action) return;
    setReason("");
    setValidationError("");
  }, [appointment, action]);

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setValidationError("A reason is required for this status change.");
      return;
    }
    setValidationError("");
    await onConfirm(trimmed);
  };

  const content = action ? copy[action] : copy.cancel;

  return (
    <AdminDialog
      open={Boolean(appointment && action)}
      onClose={() => {
        if (!busy) onClose();
      }}
      eyebrow="Status change"
      title={content.title}
      description={content.description}
      size="md"
      footer={
        <>
          <AdminActionButton onClick={onClose} disabled={busy}>
            Keep current status
          </AdminActionButton>
          <AdminActionButton tone="danger" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : content.button}
          </AdminActionButton>
        </>
      }
    >
      <div className={styles.dialogStack}>
        {appointment ? (
          <div className={styles.requestSummary}>
            <strong>{appointment.patient_name}</strong>
            <span>{appointment.services}</span>
          </div>
        ) : null}

        {(validationError || error) ? (
          <div className={styles.dialogError} role="alert">
            {validationError || error}
          </div>
        ) : null}

        <label className={styles.formGroup}>
          <span>{content.label}</span>
          <textarea
            className={styles.textArea}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Enter a clear reason for the audit trail"
            rows={5}
            disabled={busy}
          />
        </label>
      </div>
    </AdminDialog>
  );
}
