"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";
import { AdminUser, getAdminUsers } from "@/lib/admin-api";
import styles from "@/app/styles/admin.module.css";

function getRoleClass(role?: string) {
  const cleanRole = (role || "").toLowerCase();

  if (cleanRole === "patient") return styles.patient;
  if (cleanRole === "staff") return styles.staff;
  if (cleanRole === "doctor") return styles.doctor;
  if (cleanRole === "admin") return styles.admin;

  return styles.neutral;
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleDateString();
}

function normalizeStatus(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function getFullGuardianName(user: AdminUser) {
  return [user.guardian_first_name, user.guardian_last_name]
    .filter(Boolean)
    .join(" ");
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [minorFilter, setMinorFilter] = useState("all");

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
      } catch (loadError) {
        console.error("Users fetch error:", loadError);
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
      const guardianName = getFullGuardianName(user);

      const matchesSearch =
        !keyword ||
        (user.name || "").toLowerCase().includes(keyword) ||
        (user.first_name || "").toLowerCase().includes(keyword) ||
        (user.last_name || "").toLowerCase().includes(keyword) ||
        (user.email || "").toLowerCase().includes(keyword) ||
        (user.contact || "").toLowerCase().includes(keyword) ||
        (user.address || "").toLowerCase().includes(keyword) ||
        guardianName.toLowerCase().includes(keyword) ||
        (user.guardian_email || "").toLowerCase().includes(keyword) ||
        (user.guardian_contact || "").toLowerCase().includes(keyword) ||
        (user.specialty || "").toLowerCase().includes(keyword);

      const matchesRole =
        roleFilter === "all" || user.role?.toLowerCase() === roleFilter;

      const matchesVerification =
        verificationFilter === "all" ||
        (verificationFilter === "verified" && user.is_verified) ||
        (verificationFilter === "unverified" && !user.is_verified);

      const matchesMinor =
        minorFilter === "all" ||
        (minorFilter === "minor" && user.is_minor) ||
        (minorFilter === "adult" && !user.is_minor);

      return matchesSearch && matchesRole && matchesVerification && matchesMinor;
    });
  }, [users, search, roleFilter, verificationFilter, minorFilter]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      patients: users.filter((user) => user.role?.toLowerCase() === "patient")
        .length,
      internal: users.filter((user) =>
        ["admin", "staff", "doctor"].includes(user.role?.toLowerCase())
      ).length,
      verified: users.filter((user) => user.is_verified).length,
      minors: users.filter((user) => user.is_minor).length,
    };
  }, [users]);

  return (
    <div className="staffLayout">
      <AdminNavbar />

      <main className={`staffContent ${styles.usersPage}`}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Patients & Users</h1>
            <p className={styles.subtitle}>
              Monitor registered patients, account verification, guardian
              details, and internal clinic users.
            </p>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span>Total Users</span>
            <strong>{stats.total}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.greenAccent}`}>
            <span>Patients</span>
            <strong>{stats.patients}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.blueAccent}`}>
            <span>Internal Users</span>
            <strong>{stats.internal}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.orangeAccent}`}>
            <span>Verified</span>
            <strong>{stats.verified}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.pinkAccent}`}>
            <span>Minor Patients</span>
            <strong>{stats.minors}</strong>
          </div>
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Search by name, email, contact, address, guardian, or specialty"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={styles.searchInput}
          />

          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
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
            onChange={(event) => setVerificationFilter(event.target.value)}
            className={styles.selectInput}
          >
            <option value="all">All Verification</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>

          <select
            value={minorFilter}
            onChange={(event) => setMinorFilter(event.target.value)}
            className={styles.selectInput}
          >
            <option value="all">All Ages</option>
            <option value="minor">Minor Patients</option>
            <option value="adult">Adults / Non-minors</option>
          </select>
        </div>

        <section className={styles.tableCard}>
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
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Verification</th>
                  <th>Status</th>
                  <th>Contact</th>
                  <th>Patient Type</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => {
                  const role = (user.role || "patient").toLowerCase();

                  return (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.name || "Unnamed User"}</strong>
                        <span>{user.email}</span>
                      </td>

                      <td>
                        <span
                          className={`${styles.roleBadge} ${getRoleClass(
                            user.role
                          )}`}
                        >
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
                            normalizeStatus(user.status) === "active"
                              ? styles.approved
                              : styles.cancelled
                          }`}
                        >
                          {user.status || "Active"}
                        </span>
                      </td>

                      <td>{user.contact || "N/A"}</td>

                      <td>
                        {role === "patient" ? (
                          user.is_minor ? (
                            <span className={styles.minorBadge}>Minor</span>
                          ) : (
                            "Adult"
                          )
                        ) : (
                          "Internal"
                        )}
                      </td>

                      <td>{formatDate(user.created_at)}</td>

                      <td>
                        <button
                          type="button"
                          className={styles.secondaryAction}
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
          )}
        </section>

        {selectedUser && (
          <div className={styles.modalBackdrop}>
            <div className={`${styles.modalCard} ${styles.modalLarge}`}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>{selectedUser.name || "User Details"}</h2>
                  <p>
                    Full admin view of account, patient profile, guardian
                    details, and internal role information.
                  </p>
                </div>

                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={() => setSelectedUser(null)}
                >
                  ×
                </button>
              </div>

              <div className={styles.modalBody}>
                <section className={styles.detailSection}>
                  <h3>Account Details</h3>
                  <div className={styles.detailGrid}>
                    <div>
                      <span>Full Name</span>
                      <strong>{selectedUser.name || "N/A"}</strong>
                    </div>

                    <div>
                      <span>First Name</span>
                      <strong>{selectedUser.first_name || "N/A"}</strong>
                    </div>

                    <div>
                      <span>Last Name</span>
                      <strong>{selectedUser.last_name || "N/A"}</strong>
                    </div>

                    <div>
                      <span>Email</span>
                      <strong>{selectedUser.email || "N/A"}</strong>
                    </div>

                    <div>
                      <span>Contact</span>
                      <strong>{selectedUser.contact || "N/A"}</strong>
                    </div>

                    <div>
                      <span>Role</span>
                      <strong>{selectedUser.role || "N/A"}</strong>
                    </div>

                    <div>
                      <span>Verification</span>
                      <strong>
                        {selectedUser.is_verified ? "Verified" : "Unverified"}
                      </strong>
                    </div>

                    <div>
                      <span>Status</span>
                      <strong>{selectedUser.status || "Active"}</strong>
                    </div>
                  </div>
                </section>

                {selectedUser.role?.toLowerCase() === "patient" && (
                  <section className={styles.detailSection}>
                    <h3>Patient Profile</h3>
                    <div className={styles.detailGrid}>
                      <div>
                        <span>Date of Birth</span>
                        <strong>{formatDate(selectedUser.date_of_birth)}</strong>
                      </div>

                      <div>
                        <span>Minor Status</span>
                        <strong>
                          {selectedUser.is_minor ? "Minor Patient" : "Adult Patient"}
                        </strong>
                      </div>

                      <div>
                        <span>Address</span>
                        <strong>{selectedUser.address || "N/A"}</strong>
                      </div>
                    </div>
                  </section>
                )}

                {selectedUser.is_minor && (
                  <section className={styles.detailSection}>
                    <h3>Guardian Details</h3>

                    <div className={styles.detailGrid}>
                      <div>
                        <span>Guardian Name</span>
                        <strong>{getFullGuardianName(selectedUser) || "N/A"}</strong>
                      </div>

                      <div>
                        <span>Relationship</span>
                        <strong>
                          {selectedUser.guardian_relationship || "N/A"}
                        </strong>
                      </div>

                      <div>
                        <span>Guardian Contact</span>
                        <strong>{selectedUser.guardian_contact || "N/A"}</strong>
                      </div>

                      <div>
                        <span>Guardian Email</span>
                        <strong>{selectedUser.guardian_email || "N/A"}</strong>
                      </div>

                      <div>
                        <span>Consent</span>
                        <strong>
                          {selectedUser.guardian_consent
                            ? "Provided"
                            : "Not provided"}
                        </strong>
                      </div>
                    </div>
                  </section>
                )}

                {["admin", "staff", "doctor"].includes(
                  selectedUser.role?.toLowerCase() || ""
                ) && (
                  <section className={styles.detailSection}>
                    <h3>Internal / Clinical Profile</h3>

                    <div className={styles.detailGrid}>
                      <div>
                        <span>Department</span>
                        <strong>{selectedUser.department || "N/A"}</strong>
                      </div>

                      <div>
                        <span>Specialty</span>
                        <strong>{selectedUser.specialty || "N/A"}</strong>
                      </div>

                      <div>
                        <span>Availability</span>
                        <strong>{selectedUser.availability || "N/A"}</strong>
                      </div>

                      <div>
                        <span>Bio</span>
                        <strong>{selectedUser.bio || "N/A"}</strong>
                      </div>
                    </div>
                  </section>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={() => setSelectedUser(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}