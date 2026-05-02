"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { API_BASE_URL } from "@/lib/api";
import styles from "@/app/styles/patient.module.css";

interface PatientRecord {
  id: number;
  patient_id?: number | null;
  doctor_id?: number | null;
  patient_name?: string | null;
  patient_email?: string | null;
  doctor_name?: string | null;
  date: string;
  time: string;
  services?: string | null;
  status?: string | null;
  cancel_reason?: string | null;

  diagnosis_report_id?: number | null;

  final_diagnosis?: string | null;
  doctor_final_diagnosis?: string | null;
  diagnosis?: string | null;

  prescription?: string | null;
  doctor_prescription?: string | null;
  medication?: string | null;

  after_appointment_notes?: string | null;
  doctor_notes?: string | null;
  doctor_note?: string | null;
  notes?: string | null;

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

const uniqueRecordsById = (records: PatientRecord[]) => {
  return Array.from(new Map(records.map((record) => [record.id, record])).values());
};

const readJsonSafely = async (res: Response) => {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "Not scheduled";

  const date = new Date(`${dateString}T00:00:00`);

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
    record.doctor_final_diagnosis ||
    record.final_diagnosis ||
    record.diagnosis ||
    ""
  );
};

const getPrescription = (record: PatientRecord) => {
  return (
    record.doctor_prescription ||
    record.prescription ||
    record.medication ||
    ""
  );
};

const getDoctorNotes = (record: PatientRecord) => {
  return (
    record.after_appointment_notes ||
    record.doctor_notes ||
    record.doctor_note ||
    record.notes ||
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
      getDoctorNotes(record) ||
      getFollowUpPlan(record) ||
      record.next_visit_date
  );
};

export default function PatientMedicalRecords() {
  const router = useRouter();

  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [navCollapsed, setNavCollapsed] = useState(false);

  const fetchRecords = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const role = localStorage.getItem("role");

      if (!token) {
        router.push("/pages/login");
        return;
      }

      if (role !== "patient") {
        router.push("/");
        return;
      }

      setLoading(true);

      const recordsRes = await fetch(`${API_BASE_URL}/appointments/my`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const recordsData = await readJsonSafely(recordsRes);

      if (!recordsRes.ok) {
        console.error("Medical records request failed:", {
          status: recordsRes.status,
          statusText: recordsRes.statusText,
          body: recordsData,
        });

        throw new Error("Failed to fetch medical records");
      }

      setRecords(uniqueRecordsById(normalizeRecords(recordsData)));
    } catch (error) {
      console.error("Failed to fetch medical records:", error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const completedRecords = useMemo(() => {
    return records
      .filter((record) => {
        const isCompleted = record.status?.toLowerCase() === "completed";
        return isCompleted && hasDoctorRecord(record);
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time || "00:00:00"}`).getTime();
        const dateB = new Date(`${b.date}T${b.time || "00:00:00"}`).getTime();

        return dateB - dateA;
      });
  }, [records]);

  useEffect(() => {
    const handleNavToggle = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setNavCollapsed(customEvent.detail);
    };

    setNavCollapsed(document.body.classList.contains("navCollapsed"));
    window.addEventListener("navbarToggle", handleNavToggle);

    return () => {
      window.removeEventListener("navbarToggle", handleNavToggle);
    };
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  return (
    <div className={navCollapsed ? "nav-collapsed" : "nav-active"}>
      <Navbar />

      <main
        className={`${styles.historyContainer} ${
          navCollapsed ? styles.navCollapsed : ""
        }`}
      >
        <section className={styles.contentWrapper}>
          <div className={styles.headerRow}>
            <div>
              <p className={styles.eyebrow}>Patient Portal</p>

              <h1 className={styles.h1}>My Medical Records</h1>

              <p className={styles.subtitle}>
                View your completed consultation records, including your
                doctor’s final diagnosis, prescription, notes, and follow-up
                plan.
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
                        label="Doctor Notes"
                        value={valueOrFallback(
                          getDoctorNotes(record),
                          "No doctor notes recorded."
                        )}
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

      <div className={styles.prescriptionTableWrapper}>
        <table className={styles.prescriptionTable}>
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Usage</th>
              <th>Reason</th>
            </tr>
          </thead>

          <tbody>
            {parsedPrescription.map((item, index) => (
              <tr key={`${item.medicine}-${index}`}>
                <td>
                  <strong>{item.medicine || "Not specified"}</strong>
                </td>

                <td>{item.usage || "No usage instruction recorded."}</td>

                <td>{item.reason || "No reason recorded."}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parsePrescription(rawPrescription: string): PrescriptionItem[] {
  const raw = rawPrescription?.trim();

  if (!raw || raw === "Not yet recorded.") return [];

  const normalized = raw
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const medicationBlocks =
    normalized.match(/Medication\s*:\s*[\s\S]*?(?=\s*Medication\s*:|$)/gi) ||
    [];

  if (medicationBlocks.length > 0) {
    return medicationBlocks
      .map((block, index) => {
        const medicine = extractPrescriptionValue(block, "Medication");
        const usage = extractPrescriptionValue(block, "Usage");
        const reason = extractPrescriptionValue(block, "Reason");

        return {
          medicine: medicine || `Medication ${index + 1}`,
          usage,
          reason,
        };
      })
      .filter(
        (item) =>
          item.medicine.trim() || item.usage.trim() || item.reason.trim()
      );
  }

  const legacyMedicationSection = getSection(raw, "Medication", [
    "Usage",
    "Reason",
  ]);
  const legacyUsageSection = getSection(raw, "Usage", ["Reason"]);
  const legacyReasonSection = getSection(raw, "Reason", []);

  if (
    legacyMedicationSection ||
    legacyUsageSection ||
    legacyReasonSection
  ) {
    const medicines = splitMedicines(legacyMedicationSection);

    if (medicines.length === 0) return [];

    const usageMap = mapDetailsByMedicine(legacyUsageSection, medicines);
    const reasonMap = mapDetailsByMedicine(legacyReasonSection, medicines);

    return medicines.map((medicine) => ({
      medicine,
      usage: usageMap[medicine.toLowerCase()] || legacyUsageSection || "",
      reason: reasonMap[medicine.toLowerCase()] || legacyReasonSection || "",
    }));
  }

  return [
    {
      medicine: cleanText(normalized),
      usage: "",
      reason: "",
    },
  ];
}

function extractPrescriptionValue(
  block: string,
  label: "Medication" | "Usage" | "Reason"
) {
  const stopLabels = ["Medication", "Usage", "Reason"].filter(
    (item) => item !== label
  );

  const stopPattern = stopLabels
    .map((item) => `\\|?\\s*${item}\\s*:`)
    .join("|");

  const expression = new RegExp(
    `${label}\\s*:\\s*([\\s\\S]*?)(?=\\s*(?:${stopPattern})|$)`,
    "i"
  );

  return cleanText(block.match(expression)?.[1] || "");
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

  if (positions.length === 0) return result;

  positions.forEach((item, index) => {
    const nextItem = positions[index + 1];
    const start = item.index + item.labelLength;
    const end = nextItem ? nextItem.index : section.length;

    result[item.medicine.toLowerCase()] = cleanText(section.slice(start, end));
  });

  return result;
}

function cleanText(text: string) {
  return text
    .replace(/\|/g, "")
    .replace(/\s+/g, " ")
    .trim();
}