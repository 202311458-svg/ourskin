import type { ReactNode } from "react";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import type { AdminManagedUser } from "@/lib/admin-data-api";
import styles from "../page.module.css";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const clean = (value?: string | null) => (value || "").trim().toLowerCase();
const cap = (value?: string | null) => value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : "N/A";
const date = (value?: string | null) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};
const initials = (name?: string | null, email?: string | null) => {
  const parts = (name || email || "U").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.[0] || "U").toUpperCase();
};
const roleTone = (role?: string | null): Tone => clean(role) === "patient" ? "success" : clean(role) === "doctor" ? "info" : clean(role) === "staff" ? "warning" : clean(role) === "admin" ? "danger" : "neutral";
const accountType = (user: AdminManagedUser) => clean(user.role) !== "patient" ? "Internal" : user.is_minor ? "Minor" : "Adult";

export default function UserDetailsDialog({ user, onClose }: { user: AdminManagedUser | null; onClose: () => void }) {
  return (
    <AdminDialog open={Boolean(user)} onClose={onClose} eyebrow="User profile" title={user?.name || "User details"} description={user?.email || "Review account and profile information."} size="xl" footer={<AdminActionButton onClick={onClose}>Close details</AdminActionButton>}>
      {user ? <div className={styles.detailStack}>
        <div className={styles.detailHero}>
          <div className={styles.largeAvatar}>{initials(user.name, user.email)}</div>
          <div><h3>{user.name}</h3><p>{user.email}</p><div className={styles.badges}>
            <StatusBadge tone={roleTone(user.role)}>{cap(user.role)}</StatusBadge>
            <StatusBadge tone={user.is_verified ? "success" : "warning"}>{user.is_verified ? "Verified" : "Unverified"}</StatusBadge>
            <StatusBadge tone={clean(user.status) === "active" ? "success" : "neutral"}>{user.status || "Active"}</StatusBadge>
          </div></div>
        </div>
        {user.protection_reason ? <div className={styles.protection}>{user.protection_reason}</div> : null}
        <Section title="Account">
          <Detail label="Full name" value={user.name} /><Detail label="Email" value={user.email} /><Detail label="Contact" value={user.contact} /><Detail label="Created" value={date(user.created_at)} /><Detail label="Role" value={cap(user.role)} /><Detail label="Account type" value={accountType(user)} />
        </Section>
        {clean(user.role) === "patient" ? <Section title="Patient profile">
          <Detail label="Date of birth" value={date(user.date_of_birth)} /><Detail label="Address" value={user.address} wide /><Detail label="Minor patient" value={user.is_minor ? "Yes" : "No"} />
        </Section> : <Section title="Clinic profile">
          <Detail label="Department" value={user.department} /><Detail label="Specialty" value={user.specialty} /><Detail label="Availability" value={user.availability} wide /><Detail label="Bio" value={user.bio} wide />
        </Section>}
        {user.is_minor ? <Section title="Guardian">
          <Detail label="Guardian name" value={[user.guardian_first_name, user.guardian_last_name].filter(Boolean).join(" ")} /><Detail label="Relationship" value={user.guardian_relationship} /><Detail label="Contact" value={user.guardian_contact} /><Detail label="Email" value={user.guardian_email} /><Detail label="Consent" value={user.guardian_consent ? "Provided" : "Not provided"} />
        </Section> : null}
      </div> : null}
    </AdminDialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.detailSection}><h3>{title}</h3><div className={styles.detailGrid}>{children}</div></section>;
}
function Detail({ label, value, wide = false }: { label: string; value?: string | number | null; wide?: boolean }) {
  const display = value === null || value === undefined || value === "" ? "N/A" : String(value);
  return <div className={`${styles.detailItem} ${wide ? styles.wide : ""}`}><span>{label}</span><strong>{display}</strong></div>;
}
