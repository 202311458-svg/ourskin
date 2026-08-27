"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FaEnvelope,
  FaIdBadge,
  FaShieldAlt,
  FaUser,
  FaUserMd,
  FaUsers,
} from "react-icons/fa";

import PaginationControls from "@/app/components/PaginationControls";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDataTable from "@/app/components/portal/admin/AdminDataTable";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import AdminToolbar from "@/app/components/portal/admin/AdminToolbar";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import StatCard from "@/app/components/portal/ui/StatCard";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import { AdminUser, getAdminUsers } from "@/lib/admin-api";
import styles from "./page.module.css";

type RoleFilter = "all" | "patient" | "doctor" | "staff" | "admin";
type VerificationFilter = "all" | "verified" | "unverified";
type PatientTypeFilter = "all" | "minor" | "adult" | "internal";
type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getRoleIcon(role?: string | null) {
  const cleanRole = normalizeText(role);
  if (cleanRole === "doctor") return <FaUserMd />;
  if (["admin", "staff"].includes(cleanRole)) return <FaShieldAlt />;
  return <FaUser />;
}

function getRoleTone(role?: string | null): BadgeTone {
  const cleanRole = normalizeText(role);
  if (cleanRole === "patient") return "success";
  if (cleanRole === "doctor") return "info";
  if (cleanRole === "staff") return "warning";
  if (cleanRole === "admin") return "danger";
  return "neutral";
}

function getInitials(name?: string | null, email?: string | null) {
  const source = name || email || "U";
  const parts = source.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.charAt(0).toUpperCase();
}

function getFullGuardianName(user: AdminUser) {
  return [user.guardian_first_name, user.guardian_last_name]
    .filter(Boolean)
    .join(" ");
}

function getPatientType(user: AdminUser) {
  const role = normalizeText(user.role);
  if (role !== "patient") return "Internal";
  return user.is_minor ? "Minor" : "Adult";
}

function getPatientTypeTone(patientType: string): BadgeTone {
  if (patientType === "Minor") return "warning";
  if (patientType === "Adult") return "success";
  return "neutral";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function DetailItem({
  label,
  value,
  wide = false,
}: {
  label: string;
  value?: string | number | boolean | null;
  wide?: boolean;
}) {
  const displayValue =
    value === true
      ? "Yes"
      : value === false
      ? "No"
      : value === null || value === undefined || value === ""
      ? "N/A"
      : String(value);

  return (
    <div className={`${styles.profileInfoItem} ${wide ? styles.wideInfoItem : ""}`}>
      <span>{label}</span>
      <strong className={displayValue === "N/A" ? styles.emptyValue : ""}>
        {displayValue}
      </strong>
    </div>
  );
}

function DetailSection({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.detailSectionClean}>
      <div className={styles.detailSectionTitle}>
        <span aria-hidden="true">{icon}</span>
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>("all");
  const [patientTypeFilter, setPatientTypeFilter] = useState<PatientTypeFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      try {
        setLoading(true);
        setError("");
        const data = await getAdminUsers(page, pageSize);
        if (cancelled) return;
        setUsers(data.items);
        setTotal(data.total);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Unable to load user records."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize]);

  const filteredUsers = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return users.filter((user) => {
      const userRole = normalizeText(user.role);
      const guardianName = getFullGuardianName(user);
      const patientType = getPatientType(user).toLowerCase();

      const matchesSearch =
        !keyword ||
        normalizeText(user.name).includes(keyword) ||
        normalizeText(user.first_name).includes(keyword) ||
        normalizeText(user.last_name).includes(keyword) ||
        normalizeText(user.email).includes(keyword) ||
        normalizeText(user.contact).includes(keyword) ||
        normalizeText(user.address).includes(keyword) ||
        normalizeText(guardianName).includes(keyword) ||
        normalizeText(user.guardian_email).includes(keyword) ||
        normalizeText(user.guardian_contact).includes(keyword) ||
        normalizeText(user.specialty).includes(keyword) ||
        normalizeText(user.department).includes(keyword);

      const matchesRole = roleFilter === "all" || userRole === roleFilter;
      const matchesVerification =
        verificationFilter === "all" ||
        (verificationFilter === "verified" && user.is_verified) ||
        (verificationFilter === "unverified" && !user.is_verified);
      const matchesPatientType =
        patientTypeFilter === "all" ||
        (patientTypeFilter === "minor" && userRole === "patient" && user.is_minor) ||
        (patientTypeFilter === "adult" && userRole === "patient" && !user.is_minor) ||
        (patientTypeFilter === "internal" && userRole !== "patient") ||
        patientType === patientTypeFilter;

      return matchesSearch && matchesRole && matchesVerification && matchesPatientType;
    });
  }, [users, search, roleFilter, verificationFilter, patientTypeFilter]);

  const stats = useMemo(() => {
    const patients = users.filter((user) => normalizeText(user.role) === "patient");
    const internal = users.filter((user) =>
      ["admin", "staff", "doctor"].includes(normalizeText(user.role))
    );

    return {
      total: users.length,
      patients: patients.length,
      internal: internal.length,
      verified: users.filter((user) => user.is_verified).length,
      minors: patients.filter((user) => user.is_minor).length,
    };
  }, [users]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin directory"
        title="Patients & Users"
        description="Monitor registered patients, guardian records, verification status, and internal clinic accounts in one organised view."
      />

      <AdminStatsGrid>
        <StatCard label="Users on this page" value={stats.total} hint={`${total} total registered accounts`} />
        <StatCard label="Patients" value={stats.patients} hint="Patient accounts on this page" tone="success" />
        <StatCard label="Internal users" value={stats.internal} hint="Admin, staff, and doctors on this page" tone="info" />
        <StatCard label="Verified" value={stats.verified} hint="Email-confirmed accounts on this page" tone="success" />
        <StatCard label="Minor patients" value={stats.minors} hint="Patient accounts requiring guardian context" tone="warning" />
      </AdminStatsGrid>

      <AdminToolbar meta={`${filteredUsers.length} shown on this page`}>
        <input
          type="search"
          aria-label="Search patients and users"
          placeholder="Search name, email, contact, guardian, address, specialty…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)} aria-label="Filter users by role">
          <option value="all">All roles</option>
          <option value="patient">Patients</option>
          <option value="doctor">Doctors</option>
          <option value="staff">Staff</option>
          <option value="admin">Admins</option>
        </select>
        <select value={verificationFilter} onChange={(event) => setVerificationFilter(event.target.value as VerificationFilter)} aria-label="Filter users by verification status">
          <option value="all">All verification</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>
        <select value={patientTypeFilter} onChange={(event) => setPatientTypeFilter(event.target.value as PatientTypeFilter)} aria-label="Filter users by account type">
          <option value="all">All types</option>
          <option value="adult">Adult patients</option>
          <option value="minor">Minor patients</option>
          <option value="internal">Internal users</option>
        </select>
      </AdminToolbar>

      <AdminDataTable
        title="User directory"
        description="Registered accounts and key administrative profile details."
        loading={loading}
        loadingText="Loading users…"
        error={error}
        empty={!loading && !error && filteredUsers.length === 0}
        emptyTitle="No users match this view."
        emptyDescription="Try changing the search or filters."
      >
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Verification</th>
              <th>Status</th>
              <th>Contact</th>
              <th>Type</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const role = normalizeText(user.role) || "patient";
              const status = normalizeText(user.status || "Active");
              const patientType = getPatientType(user);

              return (
                <tr key={user.id}>
                  <td>
                    <div className={styles.userIdentity}>
                      <div className={styles.userAvatarSmall}>{getInitials(user.name, user.email)}</div>
                      <div className={styles.userNameBlock}>
                        <strong>{user.name || "Unnamed User"}</strong>
                        <span>{user.email || "No email available"}</span>
                        {user.address && role === "patient" ? <small>{user.address}</small> : null}
                      </div>
                    </div>
                  </td>
                  <td><StatusBadge tone={getRoleTone(role)}>{getRoleIcon(role)} {role}</StatusBadge></td>
                  <td><StatusBadge tone={user.is_verified ? "success" : "warning"}>{user.is_verified ? "Verified" : "Unverified"}</StatusBadge></td>
                  <td><StatusBadge tone={status === "active" ? "success" : "neutral"}>{user.status || "Active"}</StatusBadge></td>
                  <td>
                    <span className={styles.tableStackText}>
                      {user.contact || "N/A"}
                      {user.guardian_contact && user.is_minor ? <small>Guardian: {user.guardian_contact}</small> : null}
                    </span>
                  </td>
                  <td><StatusBadge tone={getPatientTypeTone(patientType)}>{patientType}</StatusBadge></td>
                  <td>{formatDate(user.created_at)}</td>
                  <td><AdminActionButton onClick={() => setSelectedUser(user)}>View details</AdminActionButton></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminDataTable>

      <PaginationControls
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      <AdminDialog
        open={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        eyebrow="User profile"
        title={selectedUser?.name || "User details"}
        description={selectedUser?.email || "Review account and profile information."}
        size="xl"
        footer={
          <AdminActionButton onClick={() => setSelectedUser(null)}>
            Close details
          </AdminActionButton>
        }
      >
        {selectedUser ? (
          <div className={styles.cleanModalBody}>
            <div className={styles.profileHero}>
              <div className={styles.profileAvatar}>{getInitials(selectedUser.name, selectedUser.email)}</div>
              <div className={styles.profileHeroMain}>
                <h3>{selectedUser.name || "User"}</h3>
                <p>{selectedUser.email || "No email available"}</p>
                <div className={styles.profileBadgeRow}>
                  <StatusBadge tone={getRoleTone(selectedUser.role)}>{getRoleIcon(selectedUser.role)} {normalizeText(selectedUser.role) || "user"}</StatusBadge>
                  <StatusBadge tone={selectedUser.is_verified ? "success" : "warning"}>{selectedUser.is_verified ? "Verified" : "Unverified"}</StatusBadge>
                  <StatusBadge tone={normalizeText(selectedUser.status) === "active" ? "success" : "neutral"}>{selectedUser.status || "Active"}</StatusBadge>
                </div>
              </div>
            </div>

            <DetailSection icon={<FaIdBadge />} title="Account details" subtitle="Core identity and login information.">
              <div className={styles.cleanInfoGrid}>
                <DetailItem label="Full name" value={selectedUser.name} />
                <DetailItem label="First name" value={selectedUser.first_name} />
                <DetailItem label="Last name" value={selectedUser.last_name} />
                <DetailItem label="Email" value={selectedUser.email} />
                <DetailItem label="Contact" value={selectedUser.contact} />
                <DetailItem label="Created" value={formatDate(selectedUser.created_at)} />
              </div>
            </DetailSection>

            {normalizeText(selectedUser.role) === "patient" ? (
              <DetailSection icon={<FaUsers />} title="Patient profile" subtitle="Patient demographics and clinic contact details.">
                <div className={styles.cleanInfoGrid}>
                  <DetailItem label="Date of birth" value={formatDate(selectedUser.date_of_birth)} />
                  <DetailItem label="Patient type" value={getPatientType(selectedUser)} />
                  <DetailItem label="Address" value={selectedUser.address} wide />
                </div>
              </DetailSection>
            ) : null}

            {selectedUser.is_minor ? (
              <DetailSection icon={<FaShieldAlt />} title="Guardian details" subtitle="Required information for minor patient accounts.">
                <div className={styles.cleanInfoGrid}>
                  <DetailItem label="Guardian name" value={getFullGuardianName(selectedUser)} />
                  <DetailItem label="Relationship" value={selectedUser.guardian_relationship} />
                  <DetailItem label="Guardian contact" value={selectedUser.guardian_contact} />
                  <DetailItem label="Guardian email" value={selectedUser.guardian_email} />
                  <DetailItem label="Consent" value={selectedUser.guardian_consent ? "Provided" : "Not provided"} />
                </div>
              </DetailSection>
            ) : null}

            {["admin", "staff", "doctor"].includes(normalizeText(selectedUser.role)) ? (
              <DetailSection icon={<FaUserMd />} title="Internal / clinical profile" subtitle="Internal account context for clinic operations.">
                <div className={styles.cleanInfoGrid}>
                  <DetailItem label="Department" value={selectedUser.department} />
                  <DetailItem label="Specialty" value={selectedUser.specialty} />
                  <DetailItem label="Availability" value={selectedUser.availability} />
                  <DetailItem label="Bio" value={selectedUser.bio} wide />
                </div>
              </DetailSection>
            ) : null}

            <DetailSection icon={<FaEnvelope />} title="Contact snapshot" subtitle="Main contact points for admin reference.">
              <div className={styles.cleanInfoGrid}>
                <DetailItem label="Email" value={selectedUser.email} />
                <DetailItem label="Phone" value={selectedUser.contact} />
                {selectedUser.is_minor ? (
                  <>
                    <DetailItem label="Guardian email" value={selectedUser.guardian_email} />
                    <DetailItem label="Guardian contact" value={selectedUser.guardian_contact} />
                  </>
                ) : null}
              </div>
            </DetailSection>
          </div>
        ) : null}
      </AdminDialog>
    </PageShell>
  );
}
