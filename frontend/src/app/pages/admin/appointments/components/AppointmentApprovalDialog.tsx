"use client";

import { useEffect, useState } from "react";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import type { AdminAppointment } from "@/lib/admin-api";
import { buildDefaultApprovalInstruction } from "../appointment-utils";
import styles from "../page.module.css";

type Props = {
  appointment: AdminAppointment | null;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (instruction: string, sendEmail: boolean) => void | Promise<void>;
};

export default function AppointmentApprovalDialog({
  appointment,
  busy,
  error,
  onClose,
  onConfirm,
}: Props) {
  const [instruction, setInstruction] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!appointment) return;
    setInstruction(
      appointment.patient_instruction || buildDefaultApprovalInstruction(appointment)
    );
    setSendEmail(true);
    setValidationError("");
  }, [appointment]);

  const submit = async () => {
    const trimmed = instruction.trim();
    if (!trimmed) {
      setValidationError("Patient instructions are required before approval.");
      return;
    }

    setValidationError("");
    await onConfirm(trimmed, sendEmail);
  };

  return (
    <AdminDialog
      open={Boolean(appointment)}
      onClose={() => {
        if (!busy) onClose();
      }}
      eyebrow="Approval"
      title="Approve appointment"
      description={
        appointment
          ? `Confirm the instructions for ${appointment.patient_name}. They are saved to the patient record and can optionally be emailed.`
          : undefined
      }
      size="lg"
      footer={
        <>
          <AdminActionButton onClick={onClose} disabled={busy}>
            Cancel
          </AdminActionButton>
          <AdminActionButton tone="success" onClick={submit} disabled={busy}>
            {busy ? "Approving…" : "Approve appointment"}
          </AdminActionButton>
        </>
      }
    >
      <div className={styles.dialogStack}>
        {(validationError || error) ? (
          <div className={styles.dialogError} role="alert">
            {validationError || error}
          </div>
        ) : null}

        <label className={styles.formGroup}>
          <span>Patient instruction</span>
          <textarea
            className={styles.textArea}
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            rows={8}
            disabled={busy}
          />
        </label>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(event) => setSendEmail(event.target.checked)}
            disabled={busy}
          />
          <span>Send the approval message to the patient by email</span>
        </label>
      </div>
    </AdminDialog>
  );
}
