import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import type { AdminVerifiedUserOption } from "@/lib/admin-management-api";
import styles from "../page.module.css";

export default function StaffPromotionDialog({ open, busy, error, search, candidates, loading, selected, onClose, onSearch, onSelect, onConfirm }: { open: boolean; busy: boolean; error: string; search: string; candidates: AdminVerifiedUserOption[]; loading: boolean; selected: number | null; onClose: () => void; onSearch: (value: string) => void; onSelect: (id: number | null) => void; onConfirm: () => void | Promise<void> }) {
  return <AdminDialog open={open} onClose={() => { if (!busy) onClose(); }} title="Promote account to staff" description="Only verified, active accounts with no patient appointment history are eligible. Promotion invalidates the user's current session." size="md" footer={<><AdminActionButton onClick={onClose} disabled={busy}>Cancel</AdminActionButton><AdminActionButton tone="primary" onClick={onConfirm} disabled={busy || !selected}>{busy ? "Promoting…" : "Grant staff access"}</AdminActionButton></>}>
    <div className={styles.formStack}>
      {error ? <div className={styles.dialogError} role="alert">{error}</div> : null}
      <label>Find eligible account<input type="search" value={search} onChange={(event) => { onSearch(event.target.value); onSelect(null); }} placeholder="Search name or email" /></label>
      <label>Verified account<select value={selected || ""} onChange={(event) => onSelect(event.target.value ? Number(event.target.value) : null)} disabled={loading}><option value="">{loading ? "Loading candidates…" : "Select account"}</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.email})</option>)}</select></label>
      {!loading && candidates.length === 0 ? <p className={styles.helper}>No eligible accounts match this search. Ask the staff member to register and verify a fresh account before it is used as a patient account.</p> : null}
    </div>
  </AdminDialog>;
}
