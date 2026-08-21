import React from "react";
import styles from "./StatCard.module.css";

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
};

export default function StatCard({ label, value, hint, tone = "default", className = "" }: StatCardProps) {
  return (
    <div className={`${styles.card} ${styles[tone]} ${className}`}>
      <span className={styles.label}>{label}</span>
      <div className={styles.value}>{value}</div>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
