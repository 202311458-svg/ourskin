"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaEnvelope,
  FaIdBadge,
  FaPhoneAlt,
  FaShieldAlt,
  FaTimes,
  FaUser,
  FaUserMd,
  FaUsers,
} from "react-icons/fa";

import AdminNavbar from "@/app/components/AdminNavbar";
import PortalShell from "@/app/components/PortalShell";
import { AdminUser, getAdminUsers } from "@/lib/admin-api";
import styles from "@/app/styles/admin.module.css";

type RoleFilter = "all" | "patient" | "doctor" | "staff" | "admin";
type VerificationFilter = "all" | "verified" | "unverified";
type PatientTypeFilter = "all" | "minor" | "adult" | "internal";

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

function getRoleClass(role?: string | null) {
  const cleanRole = normalizeText(role);

  if (cleanRole === "patient") return styles.patient;
  if (cleanRole === "staff") return styles.staff;
  if (cleanRole === "doctor") return styles.doctor;
  if (cleanRole === "admin") return styles.admin;

  return styles.neutral;
}

function getRoleIcon(role?: string | null) {
  const cleanRole = normalizeText(role);

  if (cleanRole === "doctor") return <FaUserMd />;
  if (["admin", "staff"].includes(cleanRole)) return <FaShieldAlt />;

  return <FaUser />;
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
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.detailSectionClean}>
      <div className={styles.detailSectionTitle}>
        {icon}
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
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [verificationFilter, setVerificationFilter] =
    useState<VerificationFilter>("all");
  const [patientTypeFilter, setPatientTypeFilter] =
    useState<PatientTypeFilter>("all");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "admin") {
      router.push("/");
      return;
    }

    async function loadUsers() {
      try {
        setLoading(true);
        setError("");

        const data = await getAdminUsers();
        setUsers(Array.isArray(data) ? data : []);
      } catch (loadError: unknown) {
        setError(getErrorMessage(loadError, "Unable to load user records."));
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [router]);

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

      return (
        matchesSearch &&
        matchesRole &&
        matchesVerification &&
        matchesPatientType
      );
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
    <div className="staffLayout">
      <AdminNavbar />

      <PortalShell role="admin">
      <main className={`staffContent ${styles.usersPage} ${styles.visualPageFix}`}>
        <div className={styles.headerRow}>
          <div>
            <p className={styles.eyebrow}>Admin Directory</p>
            <h1 className={styles.title}>Patients & Users</h1>
            <p className={styles.subtitle}>
              Monitor registered patients, guardian records, verification status,
              and internal clinic accounts in one organised view.
            </p>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} ${styles.pinkAccent}`}>
            <span>Total Users</span>
            <strong>{stats.total}</strong>
            <p>All registered accounts</p>
          </div>

          <div className={`${styles.statCard} ${styles.greenAccent}`}>
            <span>Patients</span>
            <strong>{stats.patients}</strong>
            <p>Patient-facing accounts</p>
          </div>

          <div className={`${styles.statCard} ${styles.blueAccent}`}>
            <span>Internal Users</span>
            <strong>{stats.internal}</strong>
            <p>Admin, staff, and doctors</p>
          </div>

          <div className={`${styles.statCard} ${styles.orangeAccent}`}>
            <span>Verified</span>
            <strong>{stats.verified}</strong>
            <p>Email-confirmed accounts</p>
          </div>

          <div className={`${styles.statCard} ${styles.pinkAccent}`}>
            <span>Minor Patients</span>
            <strong>{stats.minors}</strong>
            <p>Require guardian details</p>
          </div>
        </div>

        <div className={`${styles.adminToolbar} ${styles.toolbarCenteredFix}`}>
          <input
            type="text"
            placeholder="Search name, email, contact, guardian, address, specialty..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={styles.searchInput}
          />

          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
            className={styles.selectInput}
          >
            <option value="all">All Roles</option>
            <option value="patient">Patients</option>
            <option value="doctor">Doctors</option>
            <option value="staff">Staff</option>
            <option value="admin">Admins</option>
          </select>

          <select
            value={verificationFilter}
            onChange={(event) =>
              setVerificationFilter(event.target.value as VerificationFilter)
            }
            className={styles.selectInput}
          >
            <option value="all">All Verification</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>

          <select
            value={patientTypeFilter}
            onChange={(event) =>
              setPatientTypeFilter(event.target.value as PatientTypeFilter)
            }
            className={styles.selectInput}
          >
            <option value="all">All Types</option>
            <option value="adult">Adult Patients</option>
            <option value="minor">Minor Patients</option>
            <option value="internal">Internal Users</option>
          </select>
        </div>

        <section className={`${styles.tableCard} ${styles.profileTableCard} ${styles.userTableFix}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>    User Directory</h2>
              <p>
                {filteredUsers.length} record{filteredUsers.length === 1 ? "" : "s"} shown
              </p>
            </div>
          </div>

          {loading ? (
            <p className={styles.message}>Loading users...</p>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : filteredUsers.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No users found</h3>
              <p>Try changing your filters or search keyword.</p>
            </div>
          ) : (
            <div className={styles.tableScrollArea}>
              <table className={`${styles.table} ${styles.modernTable} ${styles.userDirectoryTableClean}`}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Verification</th>
                    <th>Status</th>
                    <th>Contact</th>
                    <th>Type</th>
                    <th>Created</th>
                    <th className={styles.actionColumn}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => {
                    const role = normalizeText(user.role) || "patient";
                    const status = normalizeText(user.status || "Active");
                    const patientType = getPatientType(user);

                    return (
                      <tr key={user.id}>
                        <td className={styles.userIdentityCell}>
                          <div className={styles.userIdentity}>
                            <div className={styles.userAvatarSmall}>
                              {getInitials(user.name, user.email)}
                            </div>
                            <div className={styles.userNameBlock}>
                              <strong>{user.name || "Unnamed User"}</strong>
                              <span>{user.email || "No email available"}</span>
                              {user.address && role === "patient" ? (
                                <small>{user.address}</small>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className={`${styles.roleBadge} ${getRoleClass(role)}`}>
                            {getRoleIcon(role)}
                            {role}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`${styles.statusBadge} ${
                              user.is_verified ? styles.approved : styles.pending
                            }`}
                          >
                            {user.is_verified ? "Verified" : "Unverified"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`${styles.statusBadge} ${
                              status === "active" ? styles.approved : styles.cancelled
                            }`}
                          >
                            {user.status || "Active"}
                          </span>
                        </td>

                        <td>
                          <span className={styles.tableStackText}>
                            {user.contact || "N/A"}
                            {user.guardian_contact && user.is_minor ? (
                              <small>Guardian: {user.guardian_contact}</small>
                            ) : null}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`${styles.statusBadge} ${
                              patientType === "Minor"
                                ? styles.pending
                                : patientType === "Internal"
                                ? styles.neutral
                                : styles.approved
                            }`}
                          >
                            {patientType}
                          </span>
                        </td>

                        <td>{formatDate(user.created_at)}</td>

                        <td className={styles.actionColumn}>
                          <button
                            type="button"
                            className={`${styles.softActionButton} ${styles.centerActionButton}`}
                            onClick={() => setSelectedUser(user)}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      </PortalShell>

      {selectedUser && (
        <div
          className={`${styles.modalBackdrop} ${styles.adminFocusedBackdrop}`}
          role="button"
          tabIndex={0}
          onClick={() => setSelectedUser(null)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setSelectedUser(null);
          }}
        >
          <div
            className={`${styles.modalCard} ${styles.cleanDetailModal}`}
            role="dialog"
            aria-modal="true"
            aria-label="User details"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.cleanModalHeader}>
              <div className={styles.profileHero}>
                <div className={styles.profileAvatar}>
                  {getInitials(selectedUser.name, selectedUser.email)}
                </div>

                <div className={styles.profileHeroMain}>
                  <p className={styles.eyebrow}>User Profile</p>
                  <h2>{selectedUser.name || "User Details"}</h2>
                  <p>{selectedUser.email || "No email available"}</p>

                  <div className={styles.profileBadgeRow}>
                    <span className={`${styles.roleBadge} ${getRoleClass(selectedUser.role)}`}>
                      {getRoleIcon(selectedUser.role)}
                      {normalizeText(selectedUser.role) || "user"}
                    </span>
                    <span
                      className={`${styles.statusBadge} ${
                        selectedUser.is_verified ? styles.approved : styles.pending
                      }`}
                    >
                      {selectedUser.is_verified ? "Verified" : "Unverified"}
                    </span>
                    <span
                      className={`${styles.statusBadge} ${
                        normalizeText(selectedUser.status) === "active"
                          ? styles.approved
                          : styles.cancelled
                      }`}
                    >
                      {selectedUser.status || "Active"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={styles.modalCloseRound}
                onClick={() => setSelectedUser(null)}
                aria-label="Close user details"
              >
                <FaTimes />
              </button>
            </div>

            <div className={styles.cleanModalBody}>
              <DetailSection
                icon={<FaIdBadge />}
                title="Account Details"
                subtitle="Core identity and login information."
              >
                <div className={styles.cleanInfoGrid}>
                  <DetailItem label="Full Name" value={selectedUser.name} />
                  <DetailItem label="First Name" value={selectedUser.first_name} />
                  <DetailItem label="Last Name" value={selectedUser.last_name} />
                  <DetailItem label="Email" value={selectedUser.email} />
                  <DetailItem label="Contact" value={selectedUser.contact} />
                  <DetailItem label="Created" value={formatDate(selectedUser.created_at)} />
                </div>
              </DetailSection>

              {normalizeText(selectedUser.role) === "patient" && (
                <DetailSection
                  icon={<FaUsers />}
                  title="Patient Profile"
                  subtitle="Patient demographics and clinic contact details."
                >
                  <div className={styles.cleanInfoGrid}>
                    <DetailItem
                      label="Date of Birth"
                      value={formatDate(selectedUser.date_of_birth)}
                    />
                    <DetailItem label="Patient Type" value={getPatientType(selectedUser)} />
                    <DetailItem label="Address" value={selectedUser.address} wide />
                  </div>
                </DetailSection>
              )}

              {selectedUser.is_minor && (
                <DetailSection
                  icon={<FaShieldAlt />}
                  title="Guardian Details"
                  subtitle="Required information for minor patient accounts."
                >
                  <div className={styles.cleanInfoGrid}>
                    <DetailItem label="Guardian Name" value={getFullGuardianName(selectedUser)} />
                    <DetailItem label="Relationship" value={selectedUser.guardian_relationship} />
                    <DetailItem label="Guardian Contact" value={selectedUser.guardian_contact} />
                    <DetailItem label="Guardian Email" value={selectedUser.guardian_email} />
                    <DetailItem
                      label="Consent"
                      value={selectedUser.guardian_consent ? "Provided" : "Not provided"}
                    />
                  </div>
                </DetailSection>
              )}

              {["admin", "staff", "doctor"].includes(normalizeText(selectedUser.role)) && (
                <DetailSection
                  icon={<FaUserMd />}
                  title="Internal / Clinical Profile"
                  subtitle="Internal account context for clinic operations."
                >
                  <div className={styles.cleanInfoGrid}>
                    <DetailItem label="Department" value={selectedUser.department} />
                    <DetailItem label="Specialty" value={selectedUser.specialty} />
                    <DetailItem label="Availability" value={selectedUser.availability} />
                    <DetailItem label="Bio" value={selectedUser.bio} wide />
                  </div>
                </DetailSection>
              )}

              <DetailSection
                icon={<FaEnvelope />}
                title="Contact Snapshot"
                subtitle="Main contact points for admin reference."
              >
                <div className={styles.cleanInfoGrid}>
                  <DetailItem label="Email" value={selectedUser.email} />
                  <DetailItem label="Phone" value={selectedUser.contact} />
                  {selectedUser.is_minor ? (
                    <>
                      <DetailItem label="Guardian Email" value={selectedUser.guardian_email} />
                      <DetailItem label="Guardian Contact" value={selectedUser.guardian_contact} />
                    </>
                  ) : null}
                </div>
              </DetailSection>
            </div>

            <div className={styles.cleanModalFooter}>
              <button
                type="button"
                className={styles.softActionButton}
                onClick={() => setSelectedUser(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
