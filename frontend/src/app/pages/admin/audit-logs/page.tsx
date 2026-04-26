"use client";

import { useEffect, useState } from "react";
import AdminNavbar from "@/app/components/AdminNavbar";
import styles from "./audit-logs.module.css";

type AuditLog = {
    id: number;
    action: string;
    description: string;
    actor_id: number;
    target_id?: number;
    created_at: string;
};

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const handleNav = (e: CustomEvent<boolean>) => {
            setCollapsed(e.detail);
        };

        window.addEventListener("navbarToggle", handleNav as EventListener);

        return () => {
            window.removeEventListener("navbarToggle", handleNav as EventListener);
        };
    }, []);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const token = localStorage.getItem("token");

                const res = await fetch("http://127.0.0.1:8000/admin/audit-logs", {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const data = await res.json();

                // 🔥 FIX: force array safety
                setLogs(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Audit log fetch failed:", err);
                setLogs([]);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, []);

    const getColor = (action: string) => {
        if (action.includes("DELETE")) return styles.red;
        if (action.includes("UPDATE")) return styles.blue;
        if (action.includes("CREATE")) return styles.green;
        return styles.gray;
    };

    return (
        <div className={styles.layout}>
            <AdminNavbar />

            <div className={`${styles.content} ${collapsed ? styles.collapsed : ""}`}>
                <h1 className={styles.title}>Audit Logs</h1>

                {loading ? (
                    <p>Loading logs...</p>
                ) : (
                    <div className={styles.grid}>
                        {logs.map((log) => (
                            <div key={log.id} className={`${styles.card} ${getColor(log.action)}`}>
                                <div className={styles.header}>
                                    <span className={styles.action}>{log.action}</span>
                                    <span className={styles.time}>
                                        {new Date(log.created_at).toLocaleString()}
                                    </span>
                                </div>

                                <p className={styles.desc}>{log.description}</p>

                                <div className={styles.meta}>
                                    Actor ID: {log.actor_id} | Target ID: {log.target_id ?? "—"}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}