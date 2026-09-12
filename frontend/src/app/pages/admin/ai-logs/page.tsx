"use client";

import { useCallback, useEffect, useState } from "react";
import PaginationControls from "@/app/components/PaginationControls";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import AdminToolbar from "@/app/components/portal/admin/AdminToolbar";
import EmptyState from "@/app/components/portal/ui/EmptyState";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import Section from "@/app/components/portal/ui/Section";
import StatCard from "@/app/components/portal/ui/StatCard";
import { useDebouncedValue } from "@/app/hooks/useDebouncedValue";
import { getAiEvaluationSummary, type AiEvaluationSummary, type AiMonitorRun } from "@/lib/admin-ai-api";
import { queryOversightAi } from "@/lib/admin-oversight-api";
import AiDistributions from "./components/AiDistributions";
import AiRunCard from "./components/AiRunCard";
import AiRunDetailDialog from "./components/AiRunDetailDialog";
import { formatPercent } from "./ai-utils";
import styles from "./m6.module.css";

export default function AdminAiMonitorPage() {
  const [items, setItems] = useState<AiMonitorRun[]>([]);
  const [summary, setSummary] = useState<AiEvaluationSummary | null>(null);
  const [selected, setSelected] = useState<AiMonitorRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("ALL");
  const [reviewStatus, setReviewStatus] = useState("ALL");
  const [agreement, setAgreement] = useState("ALL");
  const [runStatus, setRunStatus] = useState("ALL");
  const [model, setModel] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedModel = useDebouncedValue(model, 300);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [monitor, metrics] = await Promise.all([
        queryOversightAi({ page, pageSize, search: debouncedSearch, mode, reviewStatus, agreement, runStatus, model: debouncedModel, dateFrom, dateTo }),
        getAiEvaluationSummary(),
      ]);
      setItems(monitor.items);
      setTotal(monitor.total);
      setSummary(metrics);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load AI oversight data.");
    } finally {
      setLoading(false);
    }
  }, [agreement, dateFrom, dateTo, debouncedModel, debouncedSearch, mode, page, pageSize, reviewStatus, runStatus]);

  useEffect(() => { void load(); }, [load]);

  const resetFilters = () => {
    setSearch(""); setMode("ALL"); setReviewStatus("ALL"); setAgreement("ALL"); setRunStatus("ALL"); setModel(""); setDateFrom(""); setDateTo(""); setPage(1);
  };

  return (
    <PageShell>
      <PageHeader eyebrow="AI audit & evaluation" title="AI Review Monitor" description="Monitor versioned AI runs, review status, model metadata, and doctor-linked agreement signals without treating operational agreement as clinical accuracy." primaryAction={<AdminActionButton tone="secondary" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</AdminActionButton>} />

      <AdminStatsGrid>
        <StatCard label="Versioned AI runs" value={summary?.total_runs ?? 0} hint={`${summary?.dermatology_runs ?? 0} dermatology · ${summary?.progress_runs ?? 0} progress`} />
        <StatCard label="Pending review" value={summary?.pending_runs ?? 0} hint="Runs awaiting doctor review" tone="warning" />
        <StatCard label="Primary agreement" value={formatPercent(summary?.primary_agreement_rate)} hint="Doctor diagnosis matched AI primary consideration" tone="success" />
        <StatCard label="Primary + differential" value={formatPercent(summary?.primary_or_differential_alignment_rate)} hint="Operational text-match alignment" tone="info" />
        <StatCard label="Legacy-only AI rows" value={summary?.legacy_records_retained ?? 0} hint="Retained outside versioned metrics" />
      </AdminStatsGrid>

      <Section title="Evaluation boundary" description={summary?.methodology.clinical_validation || "Operational agreement is an audit signal, not a clinical validation claim."}>
        <p className={styles.boundaryText}>Medication-option uptake is also a literal audit match, not a judgment of treatment appropriateness or efficacy.</p>
      </Section>

      <AiDistributions agreement={summary?.agreement_counts} status={summary?.status_counts} evidence={summary?.evidence_counts} models={summary?.model_counts} />

      <AdminToolbar meta={`${total} matching run${total === 1 ? "" : "s"}`}>
        <input type="search" aria-label="Search AI runs" placeholder="Search patient, doctor, condition, model, appointment or run" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }} aria-label="Filter by analysis mode"><option value="ALL">All modes</option><option value="DERMATOLOGY_ASSESSMENT">Dermatology</option><option value="SERVICE_COMPATIBILITY">Service compatibility</option><option value="RECOVERY_PROGRESS">Recovery / progress</option></select>
        <select value={reviewStatus} onChange={(e) => { setReviewStatus(e.target.value); setPage(1); }} aria-label="Filter by review status"><option value="ALL">All review states</option><option value="PENDING_REVIEW">Pending review</option><option value="REVIEWED">Reviewed</option></select>
        <select value={agreement} onChange={(e) => { setAgreement(e.target.value); setPage(1); }} aria-label="Filter by agreement"><option value="ALL">All agreement states</option><option value="AGREE">Agree</option><option value="PARTIAL">Partial</option><option value="DISAGREE">Disagree</option><option value="NOT_ASSESSABLE">Not assessable</option></select>
        <select value={runStatus} onChange={(e) => { setRunStatus(e.target.value); setPage(1); }} aria-label="Filter by run status"><option value="ALL">All run statuses</option><option value="COMPLETED">Completed</option><option value="UNCERTAIN">Uncertain</option><option value="INSUFFICIENT_IMAGE">Insufficient image</option><option value="OUT_OF_SCOPE">Out of scope</option><option value="REQUIRES_DIRECT_REVIEW">Direct review required</option><option value="FAILED">Failed</option></select>
        <input type="search" aria-label="Filter AI runs by model" placeholder="Model/provider" value={model} onChange={(e) => { setModel(e.target.value); setPage(1); }} />
        <input type="date" aria-label="AI runs from date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <input type="date" aria-label="AI runs to date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        <AdminActionButton onClick={resetFilters}>Clear filters</AdminActionButton>
      </AdminToolbar>

      <Section title="Versioned run history" description="Read-only operational audit records. Clinical review and diagnosis remain in the Doctor Portal.">
        {error ? <div className={styles.error} role="alert">{error}</div> : loading ? <EmptyState title="Loading versioned AI runs…" /> : items.length === 0 ? <EmptyState title="No AI runs match this view." description="Try changing the filters or date range." /> : <div className={styles.runList}>{items.map((item) => <AiRunCard key={item.id} item={item} onOpen={() => setSelected(item)} />)}</div>}
        <PaginationControls total={total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
      </Section>

      <AiRunDetailDialog item={selected} onClose={() => setSelected(null)} />
    </PageShell>
  );
}
