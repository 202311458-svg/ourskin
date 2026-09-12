import AdminDataTable from "@/app/components/portal/admin/AdminDataTable";
import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import Section from "@/app/components/portal/ui/Section";
import StatCard from "@/app/components/portal/ui/StatCard";
import type { AdminOversightReports } from "@/lib/admin-oversight-api";
import styles from "../page.module.css";

const percent = (value?: number | null) => value == null ? "N/A" : `${value.toFixed(1)}%`;
const pretty = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function AiReports({ reports }: { reports: AdminOversightReports }) {
  const ai = reports.ai_evaluation;
  return (
    <>
      <Section title="Versioned AI evaluation" description="Operational monitoring based only on AIAnalysisRun and doctor-linked evaluation records.">
        <AdminStatsGrid compact>
          <StatCard label="Primary agreement" value={percent(ai.primary_agreement_rate)} tone="success" />
          <StatCard label="Primary + differential" value={percent(ai.primary_or_differential_alignment_rate)} tone="info" />
          <StatCard label="Average latency" value={ai.average_latency_ms == null ? "N/A" : `${Math.round(ai.average_latency_ms)} ms`} />
          <StatCard label="Pending review" value={ai.pending_runs} tone="warning" />
        </AdminStatsGrid>
        <div className={styles.notice}><strong>Interpretation boundary</strong><p>{reports.reporting_notes.agreement}</p><p>{reports.reporting_notes.legacy_ai}</p></div>
      </Section>
      <AdminDataTable title="AI primary-condition summary" description="Versioned dermatology-assessment runs grouped by recorded primary consideration. No legacy confidence score is mixed into this view." empty={reports.ai_condition_summary.length === 0} emptyTitle="No versioned dermatology condition data yet.">
        <table><thead><tr><th>Primary consideration</th><th>Cases</th><th>Evidence</th><th>Common severity</th></tr></thead>
        <tbody>{reports.ai_condition_summary.map((item) => <tr key={item.condition}><td>{item.condition}</td><td>{item.cases}</td><td>{Object.entries(item.evidence_counts).map(([key, value]) => `${pretty(key)}: ${value}`).join(" · ") || "N/A"}</td><td>{pretty(item.common_severity)}</td></tr>)}</tbody></table>
      </AdminDataTable>
    </>
  );
}
