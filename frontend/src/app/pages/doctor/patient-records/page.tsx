"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import styles from "@/app/styles/doctor.module.css";
import {
  getDoctorPatientRecords,
  type PatientRecord,
} from "@/lib/doctor-api";

export default function DoctorPatientRecordsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDoctorPatientRecords();
      setRecords(data);
    } catch (error) {
      console.error("Failed to load patient records:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "doctor") {
      router.push("/");
      return;
    }

    loadRecords();
  }, [router, loadRecords]);

  return (
    <>
      <DoctorNavbar />

      <main className={styles.pageWrapper}>
        <div className={styles.headerSection}>
          <h1 className={styles.pageTitle}>Patient Records</h1>
          <p className={styles.pageSubtitle}>
            Review appointment history and AI results per patient visit.
          </p>
        </div>

        <section className={styles.sectionCard}>
          {loading ? (
            <div className={styles.emptyState}>Loading patient records...</div>
          ) : records.length === 0 ? (
            <div className={styles.emptyState}>No patient records found.</div>
          ) : (
            <div className={styles.list}>
              {records.map((record) => (
                <div
                  key={record.appointment.id}
                  className={styles.sectionCard}
                  style={{ marginBottom: 16 }}
                >
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                      {record.appointment.patient_name}
                    </h2>
                  </div>

                  <div className={styles.listSecondary}>
                    {record.appointment.date} • {record.appointment.time} •{" "}
                    {record.appointment.services}
                  </div>

                  <div className={styles.listSecondary} style={{ marginTop: 8 }}>
                    Assigned Doctor: {record.appointment.doctor_name}
                  </div>

                  <div className={styles.listSecondary} style={{ marginTop: 8 }}>
                    Status: {record.appointment.status}
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <h3 className={styles.sectionTitle} style={{ fontSize: 16 }}>
                      Analyses
                    </h3>

                    {record.analyses.length === 0 ? (
                      <div className={styles.emptyState}>
                        No analyses for this appointment.
                      </div>
                    ) : (
                      <div className={styles.list}>
                        {record.analyses.map((analysis) => (
                          <div key={analysis.id} className={styles.listItem}>
                            <div className={styles.listLeft}>
                              <div className={styles.listPrimary}>
                                {analysis.condition} • {analysis.severity}
                              </div>
                              <div className={styles.listSecondary}>
                                Confidence: {analysis.confidence}
                              </div>
                              <div className={styles.listSecondary}>
                                Note: {analysis.doctor_note || "No doctor note yet"}
                              </div>
                            </div>

                            <div className={styles.listRight}>
                              <span
                                className={`${styles.statusBadge} ${
                                  analysis.review_status === "Reviewed"
                                    ? styles.badgeCompleted
                                    : styles.badgePending
                                }`}
                              >
                                {analysis.review_status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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