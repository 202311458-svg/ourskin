import React from "react";
import styles from "./PageShell.module.css";

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
  id?: string;
};

export default function PageShell({ children, className = "", id }: PageShellProps) {
  return (
    <main id={id} className={`${styles.pageShell} ${className}`.trim()}>
      {children}
    </main>
  );
}
