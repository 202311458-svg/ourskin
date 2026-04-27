"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import styles from "../history/history.module.css";

interface PatientRecord {
  id: number;
  patient_id?: number | null;
  doctor_id?: number | null;
  patient_name?: string | null;
  patient_email?: string | null;
  doctor_name: string;
  date: string;
  time: string;
  services: string;
  status: string;
  cancel_reason?: string | null;

  diagnosis_report_id?: number | null;

  final_diagnosis?: string | null;
  doctor_final_diagnosis?: string | null;
  diagnosis?: string | null;

  prescription?: string | null;
  doctor_prescription?: string | null;
  medication?: string | null;

  follow_up_plan?: string | null;
  followup_plan?: string | null;
  follow_up?: string | null;

  next_visit_date?: string | null;
}

interface PrescriptionItem {
  medicine: string;
  usage: string;
  reason: string;
}

export default function PatientMedicalRecords() {
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [navCollapsed, setNavCollapsed] = useState(false);

  const normalizeRecords = (data: unknown): PatientRecord[] => {
    if (Array.isArray(data)) return data as PatientRecord[];

    if (
      data &&
      typeof data === "object" &&
      "appointments" in data &&
      Array.isArray((data as { appointments: unknown }).appointments)
    ) {
      return (data as { appointments: PatientRecord[] }).appointments;
    }

    if (
      data &&
      typeof data === "object" &&
      "records" in data &&
      Array.isArray((data as { records: unknown }).records)
    ) {
      return (data as { records: PatientRecord[] }).records;
    }

    return [];
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Not scheduled";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeString?: string | null) => {
    if (!timeString) return "Not scheduled";

    const date = new Date(`1970-01-01T${timeString}`);

    if (Number.isNaN(date.getTime())) return timeString;

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const valueOrFallback = (
    value: string | null | undefined,
    fallback = "Not yet recorded."
  ) => {
    if (!value || value.trim() === "") return fallback;
    return value;
  };

  const getDiagnosis = (record: PatientRecord) => {
    return (
      record.final_diagnosis ||
      record.doctor_final_diagnosis ||
      record.diagnosis ||
      ""
    );
  };

  const getPrescription = (record: PatientRecord) => {
    return (
      record.prescription ||
      record.doctor_prescription ||
      record.medication ||
      ""
    );
  };

  const getFollowUpPlan = (record: PatientRecord) => {
    return (
      record.follow_up_plan ||
      record.followup_plan ||
      record.follow_up ||
      ""
    );
  };

  const hasDoctorRecord = (record: PatientRecord) => {
    return Boolean(
      record.diagnosis_report_id ||
        getDiagnosis(record) ||
        getPrescription(record) ||
        getFollowUpPlan(record) ||
        record.next_visit_date
    );
  };

  const completedRecords = useMemo(() => {
    return records.filter((record) => {
      const isCompleted = record.status?.toLowerCase() === "completed";
      return isCompleted && hasDoctorRecord(record);
    });
  }, [records]);

  useEffect(() => {
    const handleNavToggle = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setNavCollapsed(customEvent.detail);
    };

    window.addEventListener("navbarToggle", handleNavToggle);

    return () => {
      window.removeEventListener("navbarToggle", handleNavToggle);
    };
  }, []);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("No token found");
        }

        const recordsRes = await fetch(
          "http://127.0.0.1:8000/appointments/my",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!recordsRes.ok) {
          const rawRecords = await recordsRes.text();

          console.error("Medical records request failed:", {
            status: recordsRes.status,
            statusText: recordsRes.statusText,
            body: rawRecords,
          });

          throw new Error("Failed to fetch medical records");
        }

        const recordsData = await recordsRes.json();
        setRecords(normalizeRecords(recordsData));
      } catch (error) {
        console.error("Failed to fetch medical records:", error);
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, []);

  return (
    <div className={`${navCollapsed ? "nav-collapsed" : "nav-active"}`}>
      <Navbar />

      <main
        className={styles.historyContainer}
        style={{
          marginLeft: navCollapsed ? "80px" : "220px",
        }}
      >
        <section className={styles.contentWrapper}>
          <div className={styles.headerRow}>
            <div>
              <p className={styles.eyebrow}>Patient Portal</p>

              <h1 className={styles.h1}>My Medical Records</h1>

              <p className={styles.subtitle}>
                View your completed consultation records, including your
                doctor’s final diagnosis, prescription, and follow-up plan.
              </p>
            </div>

            <Link
              href="/pages/patient/history"
              className={styles.secondaryButton}
            >
              Back to Appointments
            </Link>
          </div>

          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <p className={styles.summaryLabel}>Completed Records</p>
              <p className={styles.summaryValue}>{completedRecords.length}</p>
            </div>
          </div>

          {loading ? (
            <div className={styles.emptyState}>
              <h2>Loading medical records...</h2>
              <p>Please wait while your consultation records are being loaded.</p>
            </div>
          ) : completedRecords.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>No medical records yet</h2>

              <p>
                Your medical records will appear here once your consultation is
                completed and your doctor has saved the official diagnosis
                report.
              </p>
            </div>
          ) : (
            <div className={styles.cards}>
              {completedRecords.map((record) => (
                <article key={record.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div>
                      <h2>Dr. {record.doctor_name || "Assigned Doctor"}</h2>

                      <p className={styles.serviceText}>
                        {record.services || "Consultation"} ·{" "}
                        {formatDate(record.date)} · {formatTime(record.time)}
                      </p>
                    </div>

                    <span
                      className={`${styles.statusBadge} ${styles.statusCompleted}`}
                    >
                      Completed
                    </span>
                  </div>

                  <div className={styles.detailsGrid}>
                    <div className={styles.detailBox}>
                      <p className={styles.detailLabel}>Date</p>
                      <p className={styles.detailValue}>
                        {formatDate(record.date)}
                      </p>
                    </div>

                    <div className={styles.detailBox}>
                      <p className={styles.detailLabel}>Time</p>
                      <p className={styles.detailValue}>
                        {formatTime(record.time)}
                      </p>
                    </div>

                    <div className={styles.detailBox}>
                      <p className={styles.detailLabel}>Service</p>
                      <p className={styles.detailValue}>
                        {record.services || "Not specified"}
                      </p>
                    </div>
                  </div>

                  <div className={styles.recordSection}>
                    <h3>Doctor’s Diagnosis</h3>

                    <div className={styles.recordFields}>
                      <RecordField
                        label="Final Diagnosis"
                        value={valueOrFallback(getDiagnosis(record))}
                        highlight
                      />

                      <PrescriptionDetails
                        prescription={valueOrFallback(getPrescription(record))}
                      />

                      <RecordField
                        label="Follow-up Plan"
                        value={valueOrFallback(getFollowUpPlan(record))}
                      />

                      <RecordField
                        label="Next Visit Date"
                        value={
                          record.next_visit_date
                            ? formatDate(record.next_visit_date)
                            : "No next visit date recorded."
                        }
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function RecordField({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`${styles.recordField} ${
        highlight ? styles.recordFieldHighlight : ""
      }`}
    >
      <p className={styles.recordLabel}>{label}</p>

      <p
        className={`${styles.recordValue} ${
          highlight ? styles.recordValueHighlight : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function PrescriptionDetails({ prescription }: { prescription: string }) {
  const parsedPrescription = parsePrescription(prescription);

  if (!prescription || prescription === "Not yet recorded.") {
    return (
      <RecordField label="Prescription" value="No prescription recorded yet." />
    );
  }

  if (parsedPrescription.length === 0) {
    return <RecordField label="Prescription" value={prescription} />;
  }

  return (
    <div className={styles.recordField}>
      <p className={styles.recordLabel}>Prescription</p>

      <div
        style={{
          overflowX: "auto",
          marginTop: "10px",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "720px",
          }}
        >
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Medicine</th>
              <th style={tableHeaderStyle}>Usage</th>
              <th style={tableHeaderStyle}>Reason</th>
            </tr>
          </thead>

          <tbody>
            {parsedPrescription.map((item, index) => (
              <tr key={`${item.medicine}-${index}`}>
                <td style={tableCellStyle}>
                  <strong>{item.medicine || "Not specified"}</strong>
                </td>

                <td style={tableCellStyle}>
                  {item.usage || "No usage instruction recorded."}
                </td>

                <td style={tableCellStyle}>
                  {item.reason || "No reason recorded."}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const tableHeaderStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid #e5e7eb",
  background: "#f8fafc",
  color: "#4b5563",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tableCellStyle: React.CSSProperties = {
  verticalAlign: "top",
  padding: "12px",
  borderBottom: "1px solid #e5e7eb",
  color: "#374151",
  fontSize: "14px",
  lineHeight: 1.6,
};

function parsePrescription(rawPrescription: string): PrescriptionItem[] {
  const raw = rawPrescription?.trim();

  if (!raw || raw === "Not yet recorded.") return [];

  const medicationSection = getSection(raw, "Medication", ["Usage", "Reason"]);
  const usageSection = getSection(raw, "Usage", ["Reason"]);
  const reasonSection = getSection(raw, "Reason", []);

  if (!medicationSection && !usageSection && !reasonSection) {
    return [];
  }

  const medicines = splitMedicines(medicationSection);

  if (medicines.length === 0) {
    return [];
  }

  const usageMap = mapDetailsByMedicine(usageSection, medicines);
  const reasonMap = mapDetailsByMedicine(reasonSection, medicines);

  return medicines.map((medicine) => ({
    medicine,
    usage: usageMap[medicine.toLowerCase()] || "",
    reason: reasonMap[medicine.toLowerCase()] || "",
  }));
}

function getSection(
  text: string,
  label: "Medication" | "Usage" | "Reason",
  nextLabels: string[]
) {
  const lowerText = text.toLowerCase();
  const labelText = `${label.toLowerCase()}:`;

  const startIndex = lowerText.indexOf(labelText);

  if (startIndex === -1) return "";

  const contentStart = startIndex + labelText.length;

  let contentEnd = text.length;

  for (const nextLabel of nextLabels) {
    const nextLabelText = `${nextLabel.toLowerCase()}:`;
    const nextIndex = lowerText.indexOf(nextLabelText, contentStart);

    if (nextIndex !== -1 && nextIndex < contentEnd) {
      contentEnd = nextIndex;
    }
  }

  return cleanText(text.slice(contentStart, contentEnd));
}

function splitMedicines(section: string) {
  if (!section) return [];

  return section
    .split(";")
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function mapDetailsByMedicine(section: string, medicines: string[]) {
  const result: Record<string, string> = {};

  if (!section || medicines.length === 0) return result;

  const lowerSection = section.toLowerCase();

  const positions = medicines
    .map((medicine) => {
      const needle = `${medicine.toLowerCase()}:`;
      const index = lowerSection.indexOf(needle);

      return {
        medicine,
        index,
        labelLength: needle.length,
      };
    })
    .filter((item) => item.index !== -1)
    .sort((a, b) => a.index - b.index);

  positions.forEach((item, index) => {
    const valueStart = item.index + item.labelLength;
    const valueEnd =
      index + 1 < positions.length ? positions[index + 1].index : section.length;

    const value = cleanText(section.slice(valueStart, valueEnd));

    result[item.medicine.toLowerCase()] = value;
  });

  return result;
}

function cleanText(value: string) {
  return value
    .replace(/\r?\n/g, " ")
    .replace(/^[-•]\s*/g, "")
    .replace(/;+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}