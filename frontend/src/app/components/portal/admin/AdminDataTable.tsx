import type { ReactNode } from "react";
import EmptyState from "@/app/components/portal/ui/EmptyState";
import Section from "@/app/components/portal/ui/Section";
import styles from "./AdminDataTable.module.css";

type AdminDataTableProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  loading?: boolean;
  loadingText?: string;
  error?: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  ariaLabel?: string;
};

export default function AdminDataTable({
  title,
  description,
  action,
  children,
  loading = false,
  loadingText = "Loading records…",
  error,
  empty = false,
  emptyTitle = "No records found.",
  emptyDescription,
  className = "",
  ariaLabel,
}: AdminDataTableProps) {
  return (
    <Section
      title={title}
      description={description}
      action={action}
      className={`${styles.section} ${className}`.trim()}
      ariaLabel={ariaLabel}
    >
      {loading ? (
        <EmptyState title={loadingText} />
      ) : error ? (
        <div className={styles.error} role="alert">{error}</div>
      ) : empty ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className={styles.tableWrap}>{children}</div>
      )}
    </Section>
  );
}
