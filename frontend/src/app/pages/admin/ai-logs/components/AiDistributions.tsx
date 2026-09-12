import Section from "@/app/components/portal/ui/Section";
import { pretty } from "../ai-utils";
import styles from "../m6.module.css";

function Distribution({ title, values }: { title: string; values?: Record<string, number> }) {
  const entries = Object.entries(values || {});
  return (
    <div className={styles.distributionCard}>
      <strong>{title}</strong>
      {entries.length ? entries.map(([key, value]) => <div className={styles.distributionRow} key={key}><span>{pretty(key)}</span><strong>{value}</strong></div>) : <span className={styles.muted}>No data yet</span>}
    </div>
  );
}

export default function AiDistributions({ agreement, status, evidence, models }: { agreement?: Record<string, number>; status?: Record<string, number>; evidence?: Record<string, number>; models?: Record<string, number> }) {
  return (
    <Section title="AI oversight distributions" description="Recorded operational distributions for versioned runs. These are monitoring signals, not clinical validation results.">
      <div className={styles.distributionGrid}>
        <Distribution title="Doctor agreement" values={agreement} />
        <Distribution title="Run status" values={status} />
        <Distribution title="Evidence strength" values={evidence} />
        <Distribution title="Model usage" values={models} />
      </div>
    </Section>
  );
}
