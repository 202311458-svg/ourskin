"use client";

import { useId, useRef } from "react";
import styles from "./AppointmentInstructionsDialog.module.css";

type AppointmentInstructionsDialogProps = {
  instructions: string;
  emailSent?: boolean | null;
  triggerLabel?: string;
};

export default function AppointmentInstructionsDialog({
  instructions,
  emailSent = false,
  triggerLabel = "View Appointment Instructions",
}: AppointmentInstructionsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const openDialog = () => {
    dialogRef.current?.showModal();
  };

  const closeDialog = () => {
    dialogRef.current?.close();
  };

  return (
    <>
      <button type="button" className={styles.trigger} onClick={openDialog}>
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDialog();
        }}
      >
        <div className={styles.panel}>
          <div className={styles.header}>
            <div>
              <p className={styles.eyebrow}>Your appointment</p>
              <h2 id={titleId}>Appointment Instructions</h2>
            </div>
            <button
              type="button"
              className={styles.closeButton}
              onClick={closeDialog}
              aria-label="Close appointment instructions"
            >
              ×
            </button>
          </div>

          <div className={styles.body}>
            <p>{instructions}</p>
            {emailSent && (
              <p className={styles.note}>A copy of these instructions was also sent by the clinic.</p>
            )}
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.doneButton} onClick={closeDialog}>
              Done
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
