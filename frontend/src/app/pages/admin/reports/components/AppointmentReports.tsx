import AdminDataTable from "@/app/components/portal/admin/AdminDataTable";
import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import Section from "@/app/components/portal/ui/Section";
import StatCard from "@/app/components/portal/ui/StatCard";
import type { AdminOversightReports } from "@/lib/admin-oversight-api";

export default function AppointmentReports({ reports }: { reports: AdminOversightReports }) {
  const o = reports.overview;
  return (
    <>
      <Section title="Appointment outcomes" description="Current totals across the complete appointment dataset.">
        <AdminStatsGrid compact>
          <StatCard label="Completed" value={o.completed_appointments} tone="success" />
          <StatCard label="Approved" value={o.approved_appointments} tone="info" />
          <StatCard label="Cancelled" value={o.cancelled_appointments} tone="warning" />
          <StatCard label="Declined" value={o.declined_appointments} tone="warning" />
          <StatCard label="No-show" value={o.no_show_appointments} tone="danger" />
        </AdminStatsGrid>
      </Section>
      <AdminDataTable title="Monthly appointment summary" description="Appointment volume and status distribution by scheduled month." empty={reports.monthly_appointments.length === 0} emptyTitle="No monthly appointment data yet.">
        <table><thead><tr><th>Month</th><th>Total</th><th>Pending</th><th>Approved</th><th>Completed</th><th>Cancelled</th><th>Declined</th><th>No-show</th></tr></thead>
        <tbody>{reports.monthly_appointments.map((item) => <tr key={item.month}><td>{item.month}</td><td>{item.total}</td><td>{item.pending}</td><td>{item.approved}</td><td>{item.completed}</td><td>{item.cancelled}</td><td>{item.declined}</td><td>{item.no_show}</td></tr>)}</tbody></table>
      </AdminDataTable>
    </>
  );
}
