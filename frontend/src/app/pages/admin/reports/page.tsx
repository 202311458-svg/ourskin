"use client";

import { useCallback, useEffect, useState } from "react";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import EmptyState from "@/app/components/portal/ui/EmptyState";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import { getAdminOversightReports, type AdminOversightReports } from "@/lib/admin-oversight-api";
import AiReports from "./components/AiReports";
import AppointmentReports from "./components/AppointmentReports";
import ReportsOverview from "./components/ReportsOverview";
import WorkforceReports from "./components/WorkforceReports";
import styles from "./page.module.css";

export default function AdminReportsPage() {
  const [reports, setReports] = useState<AdminOversightReports | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setReports(await getAdminOversightReports()); }
    catch (err) { setReports(null); setError(err instanceof Error ? err.message : "Unable to load reports."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <PageShell>
      <PageHeader eyebrow="Operational reporting" title="Reports" description="Review clinic operations, account distribution, doctor workload, and versioned AI oversight without exposing unnecessary clinical detail." primaryAction={<AdminActionButton tone="secondary" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</AdminActionButton>} />
      {loading ? <EmptyState title="Loading reports…" /> : error ? <EmptyState title="Unable to load reports" description={error} /> : reports ? (
        <div className={styles.stack}>
          <ReportsOverview reports={reports} />
          <AppointmentReports reports={reports} />
          <AiReports reports={reports} />
          <WorkforceReports reports={reports} />
          <p className={styles.generated}>Generated {new Date(reports.generated_at).toLocaleString()}</p>
        </div>
      ) : <EmptyState title="No report data available." />}
    </PageShell>
  );
}
