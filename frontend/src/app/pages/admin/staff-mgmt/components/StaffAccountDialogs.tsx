import Image from "next/image";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import type { ConfirmAction, EditStaffForm, StaffUser } from "../staff-types";
import { capitalize, formatDate } from "../staff-types";
import styles from "../page.module.css";

export function StaffViewDialog({ member, open, onClose }: { member: StaffUser | null; open: boolean; onClose: () => void }) {
  return <AdminDialog open={open && Boolean(member)} onClose={onClose} title="Internal account details" description="Review role, access status, and clinic profile information." size="lg" footer={<AdminActionButton onClick={onClose}>Close</AdminActionButton>}>
    {member ? <div className={styles.detailStack}><div className={styles.profileHeader}><Image src={member.profile_image || "/default-avatar.png"} alt={member.full_name} width={56} height={56} className={styles.avatarLarge} /><div><h3>{member.full_name}</h3><p>{member.email}</p></div></div>{member.protection_reason ? <div className={styles.protection}>{member.protection_reason}</div> : null}<div className={styles.detailGrid}><Detail label="Role" value={capitalize(member.role)} /><Detail label="Status" value={member.status} /><Detail label="Department" value={member.department} /><Detail label="Contact" value={member.phone} /><Detail label="Specialty" value={member.specialty} /><Detail label="Created" value={formatDate(member.created_at)} /></div></div> : null}
  </AdminDialog>;
}

export function StaffEditDialog({ member, open, form, busy, error, onClose, onChange, onSave }: { member: StaffUser | null; open: boolean; form: EditStaffForm; busy: boolean; error: string; onClose: () => void; onChange: (next: EditStaffForm) => void; onSave: () => void | Promise<void> }) {
  return <AdminDialog open={open && Boolean(member)} onClose={() => { if (!busy) onClose(); }} title="Edit internal account" description="Role changes invalidate existing sessions. Doctors with clinical history cannot be converted to another role." size="lg" footer={<><AdminActionButton onClick={onClose} disabled={busy}>Cancel</AdminActionButton><AdminActionButton tone="primary" onClick={onSave} disabled={busy}>{busy ? "Saving…" : "Save changes"}</AdminActionButton></>}>
    <div className={styles.formStack}>{error ? <div className={styles.dialogError} role="alert">{error}</div> : null}{member?.protection_reason ? <div className={styles.protection}>{member.protection_reason}</div> : null}<div className={styles.formGrid}>
      <label>Full name<input value={form.full_name} onChange={(e) => onChange({ ...form, full_name: e.target.value })} /></label>
      <label>Role<select value={form.role} disabled={member?.can_change_role === false} onChange={(e) => onChange({ ...form, role: e.target.value })}><option value="admin">Admin</option><option value="staff">Staff</option><option value="doctor">Doctor</option></select></label>
      <label>Department<input value={form.department} onChange={(e) => onChange({ ...form, department: e.target.value })} /></label>
      <label>Contact<input value={form.phone} onChange={(e) => onChange({ ...form, phone: e.target.value })} /></label>
      <label className={styles.fullWidth}>Specialty {form.role === "doctor" ? <span className={styles.required}>Required for Doctor role</span> : null}<input value={form.specialty} onChange={(e) => onChange({ ...form, specialty: e.target.value })} /></label>
    </div></div>
  </AdminDialog>;
}

export function StaffLifecycleDialog({ action, busy, error, onClose, onConfirm }: { action: ConfirmAction; busy: boolean; error: string; onClose: () => void; onConfirm: () => void | Promise<void> }) {
  const deactivate = action?.type === "deactivate";
  return <AdminDialog open={Boolean(action)} onClose={() => { if (!busy) onClose(); }} eyebrow="Access control" title={deactivate ? "Deactivate internal account" : "Reactivate internal account"} description={deactivate ? "Deactivation blocks authenticated access immediately and invalidates existing sessions." : "Reactivation restores account access; a fresh login may be required."} size="sm" footer={<><AdminActionButton onClick={onClose} disabled={busy}>Cancel</AdminActionButton><AdminActionButton tone={deactivate ? "danger" : "success"} onClick={onConfirm} disabled={busy}>{busy ? "Saving…" : deactivate ? "Deactivate" : "Reactivate"}</AdminActionButton></>}>
    {error ? <div className={styles.dialogError} role="alert">{error}</div> : null}{action ? <p className={styles.helper}><strong>{action.member.full_name}</strong><br />{action.member.email}</p> : null}
  </AdminDialog>;
}
function Detail({ label, value }: { label: string; value?: string | null }) { return <div><span>{label}</span><strong>{value || "N/A"}</strong></div>; }
