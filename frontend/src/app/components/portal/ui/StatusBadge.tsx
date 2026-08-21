import React from "react";
import styles from "./StatusBadge.module.css";

type StatusBadgeProps = {
  children: React.ReactNode;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
  className?: string;
};

export default function StatusBadge({ children, tone = "neutral", className = "" }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]} ${className}`}>
      {children}
    </span>
  );
}
