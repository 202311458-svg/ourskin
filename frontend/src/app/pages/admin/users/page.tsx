"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";
import { API_BASE_URL } from "@/lib/api";
import styles from "./users.module.css";

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

    fetch(`${API_BASE_URL}/admin/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch users");
        }
        return res.json();
      })
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Users fetch error:", err);
        setError("Unable to load user records.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name?.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase()) ||
        user.contact?.toLowerCase().includes(search.toLowerCase());

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
      patients: users.filter((u) => u.role?.toLowerCase() === "patient").length,
      staff: users.filter((u) =>
        ["admin", "staff", "doctor"].includes(u.role?.toLowerCase())
      ).length,
      verified: users.filter((u) => u.is_verified).length,
    };
  }, [users]);

  return (
    <div className="staffLayout">
      <AdminNavbar />

      <div className="staffContent">
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
          <div className={styles.statCard}>
            <span>Patients</span>
            <strong>{stats.patients}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Internal Users</span>
            <strong>{stats.staff}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Verified</span>
            <strong>{stats.verified}</strong>
          </div>
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Search by name, email, or contact"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
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
            onChange={(e) => setVerificationFilter(e.target.value)}
            className={styles.selectInput}
          >
            <option value="all">All Verification</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
        </div>

        <div className={styles.tableCard}>
          {loading ? (
            <p className={styles.message}>Loading users...</p>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : filteredUsers.length === 0 ? (
            <p className={styles.message}>No users found.</p>
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
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.contact || "N/A"}</td>
                    <td>
                      <span className={`${styles.roleBadge} ${styles[user.role?.toLowerCase()] || ""}`}>
                        {user.role}
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
                          (user.status || "Active").toLowerCase() === "active"
                            ? styles.active
                            : styles.inactive
                        }`}
                      >
                        {user.status || "Active"}
                      </span>
                    </td>
                    <td>
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}