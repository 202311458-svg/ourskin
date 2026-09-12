import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import StatCard from "@/app/components/portal/ui/StatCard";
import type { AdminOversightReports } from "@/lib/admin-oversight-api";

export default function ReportsOverview({ reports }: { reports: AdminOversightReports }) {
  const data = reports.overview;
  return (
    <AdminStatsGrid>
      <StatCard label="Appointments" value={data.total_appointments} hint={`${data.completed_appointments} completed · ${data.pending_appointments} pending`} />
      <StatCard label="Active users" value={data.active_users} hint={`${data.inactive_users} inactive accounts`} tone="success" />
      <StatCard label="Versioned AI runs" value={data.total_ai_runs} hint={`${data.reviewed_ai_runs} reviewed · ${data.pending_ai_reviews} pending`} tone="info" />
      <StatCard label="Evaluated AI runs" value={data.evaluated_diagnosis_runs} hint="Runs linked to doctor-authored final diagnoses" tone="success" />
      <StatCard label="Legacy-only AI rows" value={reports.legacy_ai_records_retained} hint="Retained separately from versioned metrics" tone="warning" />
    </AdminStatsGrid>
  );
}
