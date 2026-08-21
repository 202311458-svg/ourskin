import React from "react";
import styles from "./Section.module.css";

type SectionProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
};

export default function Section({
  title,
  description,
  action,
  children,
  className = "",
  ariaLabel,
}: SectionProps) {
  return (
    <section className={`${styles.section} ${className}`} aria-label={ariaLabel || title}>
      {(title || action) && (
        <div className={styles.header}>
          <div>
            {title && <h2 className={styles.title}>{title}</h2>}
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {action && <div className={styles.actions}>{action}</div>}
        </div>
      )}
      <div className={styles.content}>{children}</div>
    </section>
  );
}
