import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDataTable from "@/app/components/portal/admin/AdminDataTable";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import type { AdminManagedUser } from "@/lib/admin-data-api";
import styles from "../page.module.css";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";
const clean = (value?: string | null) => (value || "").trim().toLowerCase();
const cap = (value?: string | null) => value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : "N/A";
const roleTone = (role?: string | null): Tone => clean(role) === "patient" ? "success" : clean(role) === "doctor" ? "info" : clean(role) === "staff" ? "warning" : clean(role) === "admin" ? "danger" : "neutral";
const date = (value?: string | null) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};
const initials = (name?: string | null, email?: string | null) => {
  const parts = (name || email || "U").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.[0] || "U").toUpperCase();
};

export default function UserDirectoryTable({ users, loading, error, onView, onStatus }: { users: AdminManagedUser[]; loading: boolean; error: string; onView: (user: AdminManagedUser) => void; onStatus: (user: AdminManagedUser, status: "Active" | "Inactive") => void }) {
  return <AdminDataTable title="User directory" description="Access changes are enforced by the backend and recorded in the audit trail." loading={loading} loadingText="Loading users…" error={error} empty={!loading && !error && users.length === 0} emptyTitle="No users match this view." emptyDescription="Try changing the search or filters.">
    <table><thead><tr><th>User</th><th>Role</th><th>Verification</th><th>Access</th><th>Type</th><th>Created</th><th>Actions</th></tr></thead><tbody>
      {users.map((user) => {
        const active = clean(user.status || "Active") === "active";
        return <tr key={user.id}>
          <td><div className={styles.identity}><div className={styles.avatar}>{initials(user.name, user.email)}</div><div><strong>{user.name || "Unnamed User"}</strong><span>{user.email}</span></div></div></td>
          <td><StatusBadge tone={roleTone(user.role)}>{cap(user.role)}</StatusBadge></td>
          <td><StatusBadge tone={user.is_verified ? "success" : "warning"}>{user.is_verified ? "Verified" : "Unverified"}</StatusBadge></td>
          <td><StatusBadge tone={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</StatusBadge></td>
          <td>{clean(user.role) !== "patient" ? "Internal" : user.is_minor ? "Minor" : "Adult"}</td><td>{date(user.created_at)}</td>
          <td><div className={styles.actions}><AdminActionButton onClick={() => onView(user)}>View</AdminActionButton>{active ? <AdminActionButton tone="danger" disabled={!user.can_deactivate} title={!user.can_deactivate ? user.protection_reason || "This account is protected." : undefined} onClick={() => onStatus(user, "Inactive")}>Deactivate</AdminActionButton> : <AdminActionButton tone="success" disabled={!user.can_reactivate} onClick={() => onStatus(user, "Active")}>Reactivate</AdminActionButton>}</div></td>
        </tr>;
      })}
    </tbody></table>
  </AdminDataTable>;
}
