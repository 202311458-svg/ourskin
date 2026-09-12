import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import type { AdminAppointment } from "@/lib/admin-api";
import {
  formatSchedule,
  formatStatus,
  getGuardianName,
  getStatusTone,
} from "../appointment-utils";
import styles from "../page.module.css";

type Props = {
  appointment: AdminAppointment | null;
  onClose: () => void;
};

export default function AppointmentDetailsDialog({ appointment, onClose }: Props) {
  return (
    <AdminDialog
      open={Boolean(appointment)}
      onClose={onClose}
      eyebrow="Appointment record"
      title={appointment?.patient_name || "Appointment details"}
      description="Review the patient, guardian, schedule, and workflow context before taking action."
      size="xl"
      footer={<AdminActionButton onClick={onClose}>Close details</AdminActionButton>}
    >
      {appointment ? (
        <div className={styles.dialogStack}>
          <section className={styles.detailSection}>
            <div className={styles.detailSectionHeading}>
              <div>
                <h3>Patient information</h3>
                <p>Contact and demographic details attached to this request.</p>
              </div>
              <StatusBadge tone={getStatusTone(appointment.status)}>
                {formatStatus(appointment.status)}
              </StatusBadge>
            </div>
            <div className={styles.dialogDetailGrid}>
              <Detail label="Name" value={appointment.patient_name} />
              <Detail label="Email" value={appointment.patient_email} />
              <Detail label="Contact" value={appointment.patient_contact} />
              <Detail
                label="Age"
                value={appointment.patient_age_label || appointment.patient_age}
              />
              <Detail label="Address" value={appointment.patient_address} wide />
            </div>
          </section>

          {appointment.is_minor ? (
            <section className={styles.detailSection}>
              <div className={styles.detailSectionHeading}>
                <div>
                  <h3>Guardian information</h3>
                  <p>Guardian context required for a minor patient account.</p>
                </div>
              </div>
              <div className={styles.dialogDetailGrid}>
                <Detail label="Name" value={getGuardianName(appointment)} />
                <Detail label="Relationship" value={appointment.guardian_relationship} />
                <Detail label="Contact" value={appointment.guardian_contact} />
                <Detail label="Email" value={appointment.guardian_email} />
                <Detail
                  label="Consent"
                  value={appointment.guardian_consent ? "Provided" : "Not provided"}
                />
              </div>
            </section>
          ) : null}

          <section className={styles.detailSection}>
            <div className={styles.detailSectionHeading}>
              <div>
                <h3>Appointment workflow</h3>
                <p>Service, assignment, schedule, and patient-facing instructions.</p>
              </div>
            </div>
            <div className={styles.dialogDetailGrid}>
              <Detail label="Service" value={appointment.services} />
              <Detail label="Type" value={appointment.appointment_type} />
              <Detail label="Mode" value={appointment.consultation_mode} />
              <Detail label="Doctor" value={appointment.doctor_name} />
              <Detail
                label="Schedule"
                value={formatSchedule(appointment.date, appointment.time, appointment.end_time)}
                wide
              />
              <Detail
                label="Approval email"
                value={appointment.approval_email_sent ? "Sent" : "Not sent"}
              />
            </div>

            {appointment.concern ? (
              <div className={styles.longDetail}>
                <span>Concern</span>
                <p>{appointment.concern}</p>
              </div>
            ) : null}
            {appointment.patient_instruction ? (
              <div className={styles.longDetail}>
                <span>Patient instruction</span>
                <p>{appointment.patient_instruction}</p>
              </div>
            ) : null}
            {appointment.cancel_reason ? (
              <div className={styles.longDetail}>
                <span>Recorded reason</span>
                <p>{appointment.cancel_reason}</p>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </AdminDialog>
  );
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value?: string | number | null;
  wide?: boolean;
}) {
  const display = value === null || value === undefined || value === "" ? "N/A" : String(value);
  return (
    <div className={`${styles.dialogDetailItem} ${wide ? styles.dialogDetailWide : ""}`}>
      <span>{label}</span>
      <strong>{display}</strong>
    </div>
  );
}
