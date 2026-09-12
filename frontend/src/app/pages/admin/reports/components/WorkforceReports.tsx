import AdminDataTable from "@/app/components/portal/admin/AdminDataTable";
import type { AdminOversightReports } from "@/lib/admin-oversight-api";

const cap = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : "N/A";

export default function WorkforceReports({ reports }: { reports: AdminOversightReports }) {
  return (
    <>
      <AdminDataTable title="Account distribution" description="Current account counts by role, access status, and verification state." empty={reports.account_distribution.length === 0} emptyTitle="No account data yet.">
        <table><thead><tr><th>Role</th><th>Total</th><th>Active</th><th>Inactive</th><th>Verified</th><th>Unverified</th></tr></thead><tbody>{reports.account_distribution.map((item) => <tr key={item.role}><td>{cap(item.role)}</td><td>{item.total}</td><td>{item.active}</td><td>{item.inactive}</td><td>{item.verified}</td><td>{item.unverified}</td></tr>)}</tbody></table>
      </AdminDataTable>
      <AdminDataTable title="Doctor operational activity" description="Appointment workload and versioned AI review activity by doctor. This is workload monitoring, not a quality ranking." empty={reports.doctor_activity.length === 0} emptyTitle="No doctor activity data yet.">
        <table><thead><tr><th>Doctor</th><th>Assigned</th><th>Completed</th><th>AI runs</th><th>Pending review</th><th>Reviewed</th><th>Evaluated</th></tr></thead><tbody>{reports.doctor_activity.map((item) => <tr key={item.doctor_id}><td>{item.doctor_name}</td><td>{item.assigned_appointments}</td><td>{item.completed_appointments}</td><td>{item.versioned_ai_runs}</td><td>{item.pending_ai_reviews}</td><td>{item.reviewed_ai_cases}</td><td>{item.evaluated_ai_cases}</td></tr>)}</tbody></table>
      </AdminDataTable>
    </>
  );
}
