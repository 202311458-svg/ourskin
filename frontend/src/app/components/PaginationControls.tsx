import styles from "./PaginationControls.module.css";

type PaginationControlsProps = {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export default function PaginationControls({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRecord = Math.min(page * pageSize, total);
  const compactPages = Array.from(
    new Set([1, page - 1, page, page + 1, totalPages])
  ).filter((value) => value >= 1 && value <= totalPages);

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <div className={styles.summary} aria-live="polite">
        <span>
          {firstRecord}-{lastRecord} of {total}
        </span>
        <label>
          Rows
          <select
            className={styles.select}
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <div className={styles.pageNumbers} aria-label={`Page ${page} of ${totalPages}`}>
          {compactPages.map((pageNumber, index) => (
            <span key={pageNumber} className={styles.pageGroup}>
              {index > 0 && pageNumber - compactPages[index - 1] > 1 && <span>…</span>}
              <button
                type="button"
                className={`${styles.button} ${pageNumber === page ? styles.current : ""}`}
                aria-current={pageNumber === page ? "page" : undefined}
                onClick={() => onPageChange(pageNumber)}
              >
                {pageNumber}
              </button>
            </span>
          ))}
        </div>
        <button
          type="button"
          className={styles.button}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}