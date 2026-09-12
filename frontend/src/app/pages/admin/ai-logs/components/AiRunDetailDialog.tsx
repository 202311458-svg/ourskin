import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import type { AiMonitorRun } from "@/lib/admin-ai-api";
import { badgeTone, modeLabel, pretty } from "../ai-utils";
import styles from "../m6.module.css";

function Detail({ label, value }: { label: string; value: string }) {
  return <div className={styles.detailItem}><span>{label}</span><strong>{value}</strong></div>;
}

export default function AiRunDetailDialog({ item, onClose }: { item: AiMonitorRun | null; onClose: () => void }) {
  return (
    <AdminDialog
      open={Boolean(item)}
      onClose={onClose}
      eyebrow={item ? `AI run #${item.id}` : "AI run"}
      title={item ? modeLabel(item.analysis_mode) : "AI audit detail"}
      description="Version, review, agreement, and limitation details for this recorded AI run."
      size="xl"
      footer={<AdminActionButton onClick={onClose}>Close detail</AdminActionButton>}
    >
      {item ? (
        <div className={styles.detailBody}>
          <div className={styles.badgeRow}>
            <StatusBadge tone={badgeTone(item.status)}>{pretty(item.status)}</StatusBadge>
            <StatusBadge tone={badgeTone(item.review_status)}>{pretty(item.review_status)}</StatusBadge>
            {item.diagnosis_agreement ? <StatusBadge tone={badgeTone(item.diagnosis_agreement)}>{pretty(item.diagnosis_agreement)}</StatusBadge> : null}
          </div>
          <div className={styles.detailGrid}>
            <Detail label="AI primary" value={item.primary_condition_display || "—"} />
            <Detail label="Doctor final diagnosis" value={item.doctor_final_diagnosis || "—"} />
            <Detail label="Matched differential" value={item.matched_differential_display || "—"} />
            <Detail label="Evidence" value={pretty(item.evidence_strength)} />
            <Detail label="Severity" value={pretty(item.severity_level)} />
            <Detail label="Service compatibility" value={pretty(item.service_compatibility)} />
            <Detail label="Progress trend" value={pretty(item.progress_trend)} />
            <Detail label="Comparison reliable" value={item.comparison_reliable == null ? "—" : item.comparison_reliable ? "Yes" : "No"} />
            <Detail label="Medication option used" value={item.medication_suggestion_used == null ? "Not measured" : item.medication_suggestion_used ? "Yes" : "No"} />
            <Detail label="Model" value={`${item.model_provider || "—"} / ${item.model_id || "—"}`} />
            <Detail label="Pipeline" value={item.pipeline_version || "—"} />
            <Detail label="Taxonomy" value={item.taxonomy_version || "—"} />
            <Detail label="Latency" value={item.latency_ms == null ? "—" : `${item.latency_ms} ms`} />
          </div>
          <div className={styles.longDetail}><strong>Audit methodology</strong><p>{item.evaluation_basis ? "Diagnosis agreement is a deterministic text-match audit signal created from the doctor-authored diagnosis. It is not a model confidence or clinical-accuracy score." : "No doctor-linked diagnosis evaluation has been recorded for this run."}</p></div>
          <div className={styles.longDetail}><strong>Medication matches</strong><p>{item.medication_matches?.join(", ") || "None recorded."}</p></div>
          <div className={styles.longDetail}><strong>Red flags</strong><p>{item.red_flags?.join(" • ") || "None recorded."}</p></div>
          <div className={styles.longDetail}><strong>Limitations</strong><p>{item.limitations?.join(" • ") || "None recorded."}</p></div>
        </div>
      ) : null}
    </AdminDialog>
  );
}
