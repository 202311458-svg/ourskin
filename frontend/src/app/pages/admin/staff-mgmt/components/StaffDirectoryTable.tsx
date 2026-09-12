import Image from "next/image";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDataTable from "@/app/components/portal/admin/AdminDataTable";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import type { ConfirmAction, StaffUser } from "../staff-types";
import { capitalize, formatDate, roleTone } from "../staff-types";
import styles from "../page.module.css";

export default function StaffDirectoryTable({ staff, loading, error, onView, onEdit, onConfirm }: { staff: StaffUser[]; loading: boolean; error: string; onView: (member: StaffUser) => void; onEdit: (member: StaffUser) => void; onConfirm: (action: Exclude<ConfirmAction, null>) => void }) {
  return <AdminDataTable title="Internal user directory" description="Role changes and access changes are audited. Protected administrator accounts cannot be demoted or deactivated." loading={loading} loadingText="Loading internal accounts…" error={error} empty={!loading && !error && staff.length === 0} emptyTitle="No internal accounts match this view." emptyDescription="Try adjusting the search or filters.">
    <table><thead><tr><th>User</th><th>Role</th><th>Department / specialty</th><th>Access</th><th>Created</th><th>Actions</th></tr></thead><tbody>
      {staff.map((member) => { const active = member.status.toLowerCase() === "active"; return <tr key={member.id}>
        <td><div className={styles.staffCell}><Image src={member.profile_image || "/default-avatar.png"} alt={member.full_name} width={42} height={42} className={styles.avatar} /><div><strong>{member.full_name}</strong><span>{member.email}</span>{member.is_current_user ? <small>Current account</small> : null}</div></div></td>
        <td><StatusBadge tone={roleTone(member.role)}>{capitalize(member.role)}</StatusBadge></td>
        <td><div className={styles.stack}><span>{member.department || "No department"}</span>{member.role === "doctor" ? <small>{member.specialty || "No specialty"}</small> : null}</div></td>
        <td><StatusBadge tone={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</StatusBadge></td><td>{formatDate(member.created_at)}</td>
        <td><div className={styles.actions}><AdminActionButton onClick={() => onView(member)}>View</AdminActionButton><AdminActionButton onClick={() => onEdit(member)}>Edit</AdminActionButton>{active ? <AdminActionButton tone="danger" disabled={!member.can_deactivate} title={!member.can_deactivate ? member.protection_reason || "This account is protected." : undefined} onClick={() => onConfirm({ type: "deactivate", member })}>Deactivate</AdminActionButton> : <AdminActionButton tone="success" disabled={!member.can_reactivate} onClick={() => onConfirm({ type: "reactivate", member })}>Reactivate</AdminActionButton>}</div></td>
      </tr>; })}
    </tbody></table>
  </AdminDataTable>;
}
