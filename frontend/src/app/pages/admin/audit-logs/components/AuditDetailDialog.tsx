import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import type { OversightAuditLog } from "@/lib/admin-oversight-api";
import { auditTone, formatAuditAction, formatAuditDate } from "../audit-utils";
import styles from "../page.module.css";

function JsonBlock({ title, value }: { title: string; value?: Record<string, unknown> | null }) {
  return <div className={styles.jsonBlock}><strong>{title}</strong>{value && Object.keys(value).length ? <pre>{JSON.stringify(value, null, 2)}</pre> : <p>No data recorded.</p>}</div>;
}

export default function AuditDetailDialog({ log, onClose }: { log: OversightAuditLog | null; onClose: () => void }) {
  return (
    <AdminDialog open={Boolean(log)} onClose={onClose} eyebrow={log ? `Audit record #${log.id}` : "Audit record"} title={log ? formatAuditAction(log.action) : "Audit detail"} description="Backend-recorded actor, target, and change context for this administrative event." size="xl" footer={<AdminActionButton onClick={onClose}>Close detail</AdminActionButton>}>
      {log ? <div className={styles.detailBody}>
        <div className={styles.badgeRow}><StatusBadge tone={auditTone(log.action_type)}>{log.action_type || "system"}</StatusBadge><StatusBadge tone="info">{log.module || "System"}</StatusBadge></div>
        <div className={styles.detailGrid}>
          <div><span>Date & time</span><strong>{formatAuditDate(log.created_at)}</strong></div>
          <div><span>Actor</span><strong>{log.actor_name || log.performed_by || "System"}</strong><small>{log.actor_email || log.actor_role || "No account details"}</small></div>
          <div><span>Target</span><strong>{log.target_name || log.target_type || "N/A"}</strong><small>{log.target_record_id ? `Record ${log.target_record_id}` : log.target_id ? `ID ${log.target_id}` : "No target ID"}</small></div>
        </div>
        <div className={styles.descriptionBox}><strong>Description</strong><p>{log.description || "No description provided."}</p></div>
        <div className={styles.jsonGrid}><JsonBlock title="Before" value={log.before_data} /><JsonBlock title="After" value={log.after_data} /><JsonBlock title="Metadata" value={log.metadata_json} /></div>
      </div> : null}
    </AdminDialog>
  );
}
