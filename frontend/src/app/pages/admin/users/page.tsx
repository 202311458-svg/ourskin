"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";
import { API_BASE_URL } from "@/lib/api";
import styles from "@/app/styles/admin.module.css";

type User = {
  id: number;
  name: string;
  email: string;
  contact: string | null;
  role: string;
  is_verified: boolean;
  status?: string;
  created_at: string;
};

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

export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");

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

        const res = await fetch(`${API_BASE_URL}/admin/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch users");
        }

        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } catch (loadError) {
        console.error("Users fetch error:", loadError);
        setError("Unable to load user records.");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [router]);

  const filteredUsers = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return users.filter((user) => {
      const matchesSearch =
        !keyword ||
        user.name?.toLowerCase().includes(keyword) ||
        user.email?.toLowerCase().includes(keyword) ||
        user.contact?.toLowerCase().includes(keyword);

      const matchesRole =
        roleFilter === "all" || user.role?.toLowerCase() === roleFilter;

      const matchesVerification =
        verificationFilter === "all" ||
        (verificationFilter === "verified" && user.is_verified) ||
        (verificationFilter === "unverified" && !user.is_verified);

      return matchesSearch && matchesRole && matchesVerification;
    });
  }, [users, search, roleFilter, verificationFilter]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      patients: users.filter((user) => user.role?.toLowerCase() === "patient")
        .length,
      internal: users.filter((user) =>
        ["admin", "staff", "doctor"].includes(user.role?.toLowerCase())
      ).length,
      verified: users.filter((user) => user.is_verified).length,
    };
  }, [users]);

  return (
    <div className="staffLayout">
      <AdminNavbar />

      <main className={`staffContent ${styles.usersPage}`}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Users</h1>
            <p className={styles.subtitle}>
              Monitor all registered accounts across the platform.
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
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Search by name, email, or contact"
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
            <option value="patient">Patient</option>
            <option value="staff">Staff</option>
            <option value="doctor">Doctor</option>
            <option value="admin">Admin</option>
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
        </div>

        <section className={styles.tableCard}>
          {loading ? (
            <p className={styles.message}>Loading users...</p>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : filteredUsers.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No users found</h3>
              <p>Try adjusting the search or filter criteria.</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Verified</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => {
                  const status = user.status || "Active";
                  const isActive = status.toLowerCase() === "active";

                  return (
                    <tr key={user.id}>
                      <td>
                        <strong className={styles.patientName}>
                          {user.name || "Unnamed User"}
                        </strong>
                      </td>
                      <td>{user.email || "N/A"}</td>
                      <td>{user.contact || "N/A"}</td>
                      <td>
                        <span
                          className={`${styles.roleBadge} ${getRoleClass(
                            user.role
                          )}`}
                        >
                          {user.role || "N/A"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.verificationBadge} ${
                            user.is_verified ? styles.verified : styles.unverified
                          }`}
                        >
                          {user.is_verified ? "Verified" : "Unverified"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            isActive ? styles.active : styles.inactive
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td>{formatDate(user.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
