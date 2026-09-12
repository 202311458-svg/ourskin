import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import type { AiMonitorRun } from "@/lib/admin-ai-api";
import { badgeTone, formatDateTime, modeLabel, pretty } from "../ai-utils";
import styles from "../m6.module.css";

export default function AiRunCard({ item, onOpen }: { item: AiMonitorRun; onOpen: () => void }) {
  return (
    <article className={styles.runCard}>
      <div className={styles.runHeader}>
        <div>
          <span className={styles.eyebrow}>{modeLabel(item.analysis_mode)}</span>
          <h3>{item.analysis_mode === "RECOVERY_PROGRESS" ? pretty(item.progress_trend) : item.primary_condition_display || pretty(item.status)}</h3>
          <p>{item.patient_name} · Appointment #{item.appointment_id} · Run #{item.id}</p>
        </div>
        <div className={styles.badgeRow}>
          <StatusBadge tone={badgeTone(item.status)}>{pretty(item.status)}</StatusBadge>
          <StatusBadge tone={badgeTone(item.review_status)}>{pretty(item.review_status)}</StatusBadge>
          {item.diagnosis_agreement ? <StatusBadge tone={badgeTone(item.diagnosis_agreement)}>{pretty(item.diagnosis_agreement)}</StatusBadge> : null}
        </div>
      </div>

      <div className={styles.metaGrid}>
        <div><span>Doctor</span><strong>{item.doctor_name || "Not assigned"}</strong></div>
        <div><span>Service</span><strong>{item.booked_service || "N/A"}</strong></div>
        <div><span>Evidence</span><strong>{pretty(item.evidence_strength)}</strong></div>
        <div><span>Model</span><strong>{item.model_id || "Not recorded"}</strong></div>
        <div><span>Created</span><strong>{formatDateTime(item.created_at)}</strong></div>
        <div><span>Doctor diagnosis</span><strong>{item.doctor_final_diagnosis || "Not linked yet"}</strong></div>
      </div>

      <div className={styles.cardFooter}>
        <span>{item.patient_email || "No patient email"}</span>
        <AdminActionButton onClick={onOpen}>View audit detail</AdminActionButton>
      </div>
    </article>
  );
}
