import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import type { AdminManagedUser } from "@/lib/admin-data-api";
import styles from "../page.module.css";

export type UserLifecycleAction = { user: AdminManagedUser; nextStatus: "Active" | "Inactive" } | null;

export default function UserLifecycleDialog({ action, busy, error, onClose, onConfirm }: { action: UserLifecycleAction; busy: boolean; error: string; onClose: () => void; onConfirm: () => void | Promise<void> }) {
  const deactivate = action?.nextStatus === "Inactive";
  return <AdminDialog open={Boolean(action)} onClose={() => { if (!busy) onClose(); }} eyebrow="Access control" title={deactivate ? "Deactivate account" : "Reactivate account"} description={deactivate ? "Deactivation blocks authenticated access immediately and invalidates existing sessions." : "Reactivation restores access, but previously invalidated sessions require a fresh login."} size="sm" footer={<><AdminActionButton onClick={onClose} disabled={busy}>Cancel</AdminActionButton><AdminActionButton tone={deactivate ? "danger" : "success"} onClick={onConfirm} disabled={busy}>{busy ? "Saving…" : deactivate ? "Deactivate" : "Reactivate"}</AdminActionButton></>}>
    {error ? <div className={styles.dialogError} role="alert">{error}</div> : null}
    {action ? <p className={styles.confirmText}><strong>{action.user.name}</strong><br />{action.user.email}</p> : null}
  </AdminDialog>;
}
