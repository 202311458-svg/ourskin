"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  FaBrain,
  FaChartLine,
  FaClipboardCheck,
  FaFlask,
  FaSearch,
  FaTimes,
} from "react-icons/fa";

import PaginationControls from "@/app/components/PaginationControls";
import PortalShell from "@/app/components/PortalShell";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import {
  getAiEvaluationSummary,
  getAiMonitor,
  type AiEvaluationSummary,
  type AiMonitorRun,
} from "@/lib/admin-ai-api";
import styles from "./m6.module.css";

const pretty = (value?: string | null) =>
  (value || "—")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const formatPercent = (value?: number | null) =>
  value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;

const agreementTone = (value?: string | null) => {
  if (value === "AGREE") return styles.good;
  if (value === "PARTIAL") return styles.info;
  if (value === "DISAGREE") return styles.warn;
  return styles.neutral;
};

const modeLabel = (value?: string | null) =>
  value === "RECOVERY_PROGRESS" ? "Recovery / progress" : "Dermatology assessment";

export default function AdminAiMonitorPage() {
  const router = useRouter();
  const [items, setItems] = useState<AiMonitorRun[]>([]);
  const [summary, setSummary] = useState<AiEvaluationSummary | null>(null);
  const [selected, setSelected] = useState<AiMonitorRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("ALL");
  const [reviewStatus, setReviewStatus] = useState("ALL");
  const [agreement, setAgreement] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    if (!token || role !== "admin") {
      router.push("/");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [monitor, metrics] = await Promise.all([
        getAiMonitor({ page, pageSize, mode, reviewStatus, agreement }),
        getAiEvaluationSummary(),
      ]);
      setItems(monitor.items);
      setTotal(monitor.total);
      setSummary(metrics);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load AI audit data."
      );
    } finally {
      setLoading(false);
    }
  }, [agreement, mode, page, pageSize, reviewStatus, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [mode, reviewStatus, agreement]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) =>
      [
        item.patient_name,
        item.patient_email,
        item.doctor_name,
        item.primary_condition_display,
        item.doctor_final_diagnosis,
        item.booked_service,
        item.model_id,
        String(item.appointment_id),
        String(item.id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [items, search]);

  return (
    <div className="staffLayout">
      <PortalShell role="admin">
        <main className={styles.page}>
          <PageHeader
            eyebrow="AI audit & evaluation"
            title="AI Review Monitor"
            description="Monitor versioned AI runs, doctor-linked agreement signals, progress analyses, and model metadata without treating operational agreement as clinical accuracy."
            primaryAction={
              <button
                type="button"
                className={styles.refreshButton}
                onClick={load}
                disabled={loading}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            }
          />

          {error && <div className={styles.error}>{error}</div>}

          <section className={styles.metricGrid}>
            <MetricCard
              icon={<FaBrain />}
              label="Versioned AI runs"
              value={summary?.total_runs ?? "—"}
              note={`${summary?.dermatology_runs ?? 0} dermatology • ${
                summary?.progress_runs ?? 0
              } progress`}
            />
            <MetricCard
              icon={<FaClipboardCheck />}
              label="Primary agreement"
              value={formatPercent(summary?.primary_agreement_rate)}
              note="Doctor final diagnosis matched AI primary consideration"
            />
            <MetricCard
              icon={<FaChartLine />}
              label="Primary + differential"
              value={formatPercent(
                summary?.primary_or_differential_alignment_rate
              )}
              note="Includes final diagnoses matching an AI differential"
            />
            <MetricCard
              icon={<FaFlask />}
              label="Avg processing"
              value={
                summary?.average_latency_ms == null
                  ? "—"
                  : `${Math.round(summary.average_latency_ms)} ms`
              }
              note={`${summary?.reviewed_runs ?? 0} reviewed • ${
                summary?.pending_runs ?? 0
              } pending`}
            />
          </section>

          <section className={styles.noticePanel}>
            <strong>Evaluation boundary</strong>
            <p>
              {summary?.methodology.clinical_validation ||
                "Operational agreement is an audit signal, not a clinical validation claim."}
            </p>
            {summary?.legacy_records_retained ? (
              <span>
                {summary.legacy_records_retained} legacy-only AI record
                {summary.legacy_records_retained === 1 ? "" : "s"} remain retained
                outside these versioned metrics.
              </span>
            ) : null}
          </section>

          <section className={styles.distributionGrid}>
            <Distribution
              title="Doctor agreement"
              values={summary?.agreement_counts}
            />
            <Distribution
              title="Analysis status"
              values={summary?.status_counts}
            />
            <Distribution
              title="Service compatibility"
              values={summary?.compatibility_counts}
            />
            <Distribution
              title="Progress trend"
              values={summary?.progress_trend_counts}
            />
          </section>

          <section className={styles.panel}>
            <div className={styles.toolbar}>
              <div className={styles.searchWrap}>
                <FaSearch />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search patient, doctor, condition, model, appointment or run"
                />
              </div>

              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="ALL">All modes</option>
                <option value="DERMATOLOGY_ASSESSMENT">Dermatology</option>
                <option value="RECOVERY_PROGRESS">Recovery / progress</option>
              </select>

              <select
                value={reviewStatus}
                onChange={(event) => setReviewStatus(event.target.value)}
              >
                <option value="ALL">All review states</option>
                <option value="PENDING_REVIEW">Pending review</option>
                <option value="REVIEWED">Reviewed</option>
              </select>

              <select
                value={agreement}
                onChange={(event) => setAgreement(event.target.value)}
              >
                <option value="ALL">All agreement states</option>
                <option value="AGREE">Agree</option>
                <option value="PARTIAL">Partial</option>
                <option value="DISAGREE">Disagree</option>
                <option value="NOT_ASSESSABLE">Not assessable</option>
              </select>
            </div>

            {loading ? (
              <div className={styles.empty}>Loading versioned AI runs…</div>
            ) : filteredItems.length === 0 ? (
              <div className={styles.empty}>No AI runs match the current filters.</div>
            ) : (
              <div className={styles.runList}>
                {filteredItems.map((item) => (
                  <article className={styles.runCard} key={item.id}>
                    <div className={styles.runMain}>
                      <div className={styles.identity}>
                        <strong>{item.patient_name}</strong>
                        <span>{item.patient_email || "No email"}</span>
                      </div>
                      <div className={styles.titleBlock}>
                        <span>{modeLabel(item.analysis_mode)}</span>
                        <strong>
                          {item.analysis_mode === "RECOVERY_PROGRESS"
                            ? pretty(item.progress_trend)
                            : item.primary_condition_display || pretty(item.status)}
                        </strong>
                        <small>
                          Run #{item.id} • Appointment #{item.appointment_id}
                        </small>
                      </div>
                    </div>

                    <div className={styles.badges}>
                      <span className={styles.badge}>{pretty(item.status)}</span>
                      <span className={styles.badge}>{pretty(item.review_status)}</span>
                      {item.diagnosis_agreement && (
                        <span
                          className={`${styles.badge} ${agreementTone(
                            item.diagnosis_agreement
                          )}`}
                        >
                          {pretty(item.diagnosis_agreement)}
                        </span>
                      )}
                    </div>

                    <div className={styles.metaGrid}>
                      <Info label="Doctor" value={item.doctor_name} />
                      <Info label="Booked service" value={item.booked_service} />
                      <Info
                        label="Evidence"
                        value={pretty(item.evidence_strength)}
                      />
                      <Info
                        label="Compatibility"
                        value={pretty(item.service_compatibility)}
                      />
                      <Info label="Model" value={item.model_id} />
                      <Info
                        label="Created"
                        value={formatDate(item.created_at)}
                      />
                    </div>

                    <div className={styles.cardFooter}>
                      <span>
                        {item.doctor_final_diagnosis
                          ? `Doctor: ${item.doctor_final_diagnosis}`
                          : "No linked final diagnosis yet"}
                      </span>
                      <button
                        type="button"
                        className={styles.detailButton}
                        onClick={() => setSelected(item)}
                      >
                        View audit detail
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <PaginationControls
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
            />
          </section>

          {selected && (
            <div className={styles.modalBackdrop} onClick={() => setSelected(null)}>
              <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <div>
                    <span>AI run #{selected.id}</span>
                    <h2>{modeLabel(selected.analysis_mode)}</h2>
                  </div>
                  <button
                    type="button"
                    className={styles.closeButton}
                    onClick={() => setSelected(null)}
                    aria-label="Close"
                  >
                    <FaTimes />
                  </button>
                </div>

                <div className={styles.detailGrid}>
                  <Detail
                    label="AI primary"
                    value={selected.primary_condition_display || "—"}
                  />
                  <Detail
                    label="Doctor final diagnosis"
                    value={selected.doctor_final_diagnosis || "—"}
                  />
                  <Detail
                    label="Agreement"
                    value={pretty(selected.diagnosis_agreement)}
                  />
                  <Detail
                    label="Matched differential"
                    value={selected.matched_differential_display || "—"}
                  />
                  <Detail
                    label="Progress trend"
                    value={pretty(selected.progress_trend)}
                  />
                  <Detail
                    label="Comparison reliable"
                    value={
                      selected.comparison_reliable == null
                        ? "—"
                        : selected.comparison_reliable
                        ? "Yes"
                        : "No"
                    }
                  />
                  <Detail
                    label="Medication option used"
                    value={
                      selected.medication_suggestion_used == null
                        ? "Not applicable / not measured"
                        : selected.medication_suggestion_used
                        ? "Yes"
                        : "No"
                    }
                  />
                  <Detail
                    label="Medication matches"
                    value={selected.medication_matches?.join(", ") || "—"}
                  />
                  <Detail
                    label="Model"
                    value={`${selected.model_provider || "—"} / ${
                      selected.model_id || "—"
                    }`}
                  />
                  <Detail
                    label="Pipeline"
                    value={selected.pipeline_version || "—"}
                  />
                  <Detail
                    label="Taxonomy"
                    value={selected.taxonomy_version || "—"}
                  />
                  <Detail
                    label="Latency"
                    value={
                      selected.latency_ms == null
                        ? "—"
                        : `${selected.latency_ms} ms`
                    }
                  />
                </div>

                <div className={styles.longDetail}>
                  <strong>Audit methodology</strong>
                  <p>
                    {selected.evaluation_basis
                      ? "Diagnosis agreement is a deterministic text-match audit signal created when the doctor completes the report. It is not a model-generated score."
                      : "This run has no doctor-linked diagnosis evaluation yet."}
                  </p>
                </div>

                <div className={styles.longDetail}>
                  <strong>Red flags</strong>
                  <p>{selected.red_flags?.join(" • ") || "None recorded."}</p>
                </div>

                <div className={styles.longDetail}>
                  <strong>Limitations</strong>
                  <p>{selected.limitations?.join(" • ") || "None recorded."}</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </PortalShell>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  note: string;
}) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricIcon}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{note}</p>
      </div>
    </div>
  );
}

function Distribution({
  title,
  values,
}: {
  title: string;
  values?: Record<string, number>;
}) {
  const entries = Object.entries(values || {});
  return (
    <div className={styles.distributionCard}>
      <strong>{title}</strong>
      {entries.length === 0 ? (
        <span className={styles.muted}>No data yet</span>
      ) : (
        <div className={styles.distributionList}>
          {entries.map(([key, value]) => (
            <div key={key}>
              <span>{pretty(key)}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className={styles.info}>
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detail}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
