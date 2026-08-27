import type { ReactNode } from "react";
import styles from "./AdminStatsGrid.module.css";

type AdminStatsGridProps = {
  children: ReactNode;
  className?: string;
  compact?: boolean;
};

export default function AdminStatsGrid({
  children,
  className = "",
  compact = false,
}: AdminStatsGridProps) {
  return (
    <div className={`${styles.grid} ${compact ? styles.compact : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
