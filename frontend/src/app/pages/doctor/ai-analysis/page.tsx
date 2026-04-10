"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import styles from "@/app/styles/doctor.module.css";
import {
  getDoctorAiCases,
  reviewAnalysis,
  type Analysis,
} from "@/lib/doctor-api";
import { API_BASE_URL } from "@/lib/api";

const filters = ["All", "Pending Review", "Reviewed"];

export default function DoctorAIAnalysisPage() {
  const router = useRouter();
  const [cases, setCases] = useState<Analysis[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const loadCases = async (reviewStatus = activeFilter) => {
    try {
      setLoading(true);
      const data = await getDoctorAiCases(reviewStatus);
      setCases(data);

      const noteMap: Record<number, string> = {};
      data.forEach((item) => {
        noteMap[item.id] = item.doctor_note || "";
      });
      setNotes(noteMap);
    } catch (error) {
      console.error("Failed to load AI cases:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "doctor") {
      router.push("/");
      return;
    }

    loadCases(activeFilter);
  }, [router, activeFilter]);

  const handleSave = async (analysisId: number, reviewStatus: string) => {
    try {
      await reviewAnalysis(analysisId, notes[analysisId] || "", reviewStatus);
      await loadCases(activeFilter);
    } catch (error) {
      console.error("Failed to update analysis:", error);
      alert(error instanceof Error ? error.message : "Failed to update analysis");
    }
  };

  return (
    <>
      <DoctorNavbar />
      <main className={styles.pageWrapper}>
        <div className={styles.headerSection}>
          <h1 className={styles.pageTitle}>AI Analysis</h1>
          <p className={styles.pageSubtitle}>
            Review AI results, add notes, and mark cases as reviewed.
          </p>
        </div>

        <div className={styles.filterRow}>
          {filters.map((filter) => (
            <button
              key={filter}
              className={`${styles.filterChip} ${
                activeFilter === filter ? styles.activeChip : ""
              }`}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>

        <section className={styles.sectionCard}>
          {loading ? (
            <div className={styles.emptyState}>Loading AI cases...</div>
          ) : cases.length === 0 ? (
            <div className={styles.emptyState}>No AI cases found.</div>
          ) : (
            <div className={styles.list}>
              {cases.map((item) => (
                <div key={item.id} className={styles.sectionCard} style={{ marginBottom: 16 }}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                      {item.condition} • {item.severity}
                    </h2>
                    <span
                      className={`${styles.statusBadge} ${
                        item.review_status === "Reviewed"
                          ? styles.badgeCompleted
                          : styles.badgePending
                      }`}
                    >
                      {item.review_status}
                    </span>
                  </div>

                  {item.image_path && (
                    <img
                      src={`${API_BASE_URL}${item.image_path}`}
                      alt={item.condition}
                      style={{
                        width: "100%",
                        maxWidth: 320,
                        borderRadius: 12,
                        marginBottom: 16,
                      }}
                    />
                  )}

                  <div className={styles.listSecondary} style={{ marginBottom: 12 }}>
                    Confidence: {item.confidence} • Recommendation: {item.recommendation}
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Doctor Note</label>
                    <textarea
                      className={styles.textarea}
                      value={notes[item.id] || ""}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                    />
                  </div>

                  <div className={styles.buttonRow}>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => handleSave(item.id, "Pending Review")}
                    >
                      Save Draft
                    </button>
                    <button
                      className={styles.actionButton}
                      onClick={() => handleSave(item.id, "Reviewed")}
                    >
                      Mark Reviewed
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}