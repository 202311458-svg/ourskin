import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import type { AdminAppointment } from "@/lib/admin-api";
import {
  formatSchedule,
  formatStatus,
  getGuardianName,
  getStatusTone,
  needsInitialEvaluationSchedule,
  normalizeStatus,
  type ModalAction,
} from "../appointment-utils";
import styles from "../page.module.css";

type Props = {
  appointment: AdminAppointment;
  busy: boolean;
  onView: (appointment: AdminAppointment) => void;
  onApprove: (appointment: AdminAppointment) => void;
  onComplete: (appointment: AdminAppointment) => void;
  onReasonAction: (appointment: AdminAppointment, action: ModalAction) => void;
};

export default function AppointmentCard({
  appointment,
  busy,
  onView,
  onApprove,
  onComplete,
  onReasonAction,
}: Props) {
  const normalized = normalizeStatus(appointment.status);
  const canApprove = normalized === "pending";
  const canDecline = normalized === "pending";
  const canManageApproved = normalized === "approved";
  const guardianName = getGuardianName(appointment);

  return (
    <article className={styles.appointmentCard}>
      <div className={styles.cardHeader}>
        <div className={styles.patientIdentity}>
          <div className={styles.patientNameRow}>
            <h3>{appointment.patient_name || "Unknown Patient"}</h3>
            {appointment.is_minor ? <span className={styles.minorBadge}>Minor</span> : null}
          </div>
          <p>{appointment.patient_email || "No email available"}</p>
        </div>
        <StatusBadge tone={getStatusTone(appointment.status)}>
          {formatStatus(appointment.status)}
        </StatusBadge>
      </div>

      <div className={styles.cardDetails}>
        <Detail label="Doctor" value={appointment.doctor_name || "Not assigned"} />
        <Detail
          label="Schedule"
          value={formatSchedule(appointment.date, appointment.time, appointment.end_time)}
        />
        <Detail label="Service" value={appointment.services || "N/A"} />
        <Detail label="Type" value={appointment.appointment_type || "Regular"} />
        <Detail label="Mode" value={appointment.consultation_mode || "N/A"} />
        <Detail
          label="Email"
          value={appointment.approval_email_sent ? "Approval sent" : "Not sent"}
        />
      </div>

      {(appointment.concern || appointment.cancel_reason || appointment.is_minor) && (
        <div className={styles.cardContext}>
          {appointment.concern ? (
            <p><strong>Concern:</strong> {appointment.concern}</p>
          ) : null}
          {appointment.cancel_reason ? (
            <p><strong>Recorded reason:</strong> {appointment.cancel_reason}</p>
          ) : null}
          {appointment.is_minor ? (
            <p>
              <strong>Guardian:</strong> {guardianName || "Guardian details unavailable"}
              {appointment.guardian_relationship
                ? ` • ${appointment.guardian_relationship}`
                : ""}
            </p>
          ) : null}
        </div>
      )}

      <div className={styles.cardFooter}>
        <AdminActionButton onClick={() => onView(appointment)} disabled={busy}>
          View details
        </AdminActionButton>

        <div className={styles.actionGroup}>
          {canApprove ? (
            <AdminActionButton
              tone="success"
              onClick={() => onApprove(appointment)}
              disabled={busy}
            >
              {needsInitialEvaluationSchedule(appointment) ? "Assign schedule" : "Approve"}
            </AdminActionButton>
          ) : null}

          {canDecline ? (
            <AdminActionButton
              tone="danger"
              onClick={() => onReasonAction(appointment, "decline")}
              disabled={busy}
            >
              Decline
            </AdminActionButton>
          ) : null}

          {canManageApproved ? (
            <>
              <AdminActionButton
                tone="success"
                onClick={() => onComplete(appointment)}
                disabled={busy}
              >
                {busy ? "Updating…" : "Complete"}
              </AdminActionButton>
              <AdminActionButton
                tone="danger"
                onClick={() => onReasonAction(appointment, "no-show")}
                disabled={busy}
              >
                No-show
              </AdminActionButton>
              <AdminActionButton
                tone="danger"
                onClick={() => onReasonAction(appointment, "cancel")}
                disabled={busy}
              >
                Cancel
              </AdminActionButton>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
