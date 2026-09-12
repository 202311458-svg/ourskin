"use client";

import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import type { ClinicUnavailableDate } from "@/lib/admin-api";
import type { AdminScheduleRecord } from "@/lib/admin-schedules-api";
import { formatDate } from "../schedule-utils";
import styles from "../page.module.css";

export type DeleteTarget =
  | { kind: "schedule"; item: AdminScheduleRecord }
  | { kind: "closure"; item: ClinicUnavailableDate };

type Props = {
  target: DeleteTarget | null;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (target: DeleteTarget) => void | Promise<void>;
};

export default function ScheduleDeleteDialog({ target, busy, error, onClose, onConfirm }: Props) {
  const isSchedule = target?.kind === "schedule";
  const title = isSchedule ? "Delete doctor schedule?" : "Remove unavailable date?";
  const description = target
    ? isSchedule
      ? `${target.item.doctor_name} • ${formatDate(target.item.schedule_date)}`
      : `${formatDate(target.item.closure_date)} • ${target.item.reason}`
    : undefined;

  return (
    <AdminDialog
      open={Boolean(target)}
      onClose={() => {
        if (!busy) onClose();
      }}
      eyebrow="Destructive action"
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <AdminActionButton onClick={onClose} disabled={busy}>Keep record</AdminActionButton>
          <AdminActionButton
            tone="danger"
            onClick={() => target && onConfirm(target)}
            disabled={busy || !target}
          >
            {busy ? "Deleting…" : "Delete"}
          </AdminActionButton>
        </>
      }
    >
      <div className={styles.dialogStack}>
        {error ? <div className={styles.dialogError} role="alert">{error}</div> : null}
        <p className={styles.dangerCopy}>
          {isSchedule
            ? "Deleting a schedule permanently removes the availability record. Schedules linked to appointments or already in the past are protected and cannot be deleted."
            : "Past clinic closure records are retained for history and cannot be deleted."}
        </p>
      </div>
    </AdminDialog>
  );
}
