"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import styles from "./page.module.css";
import PageShell from "@/app/components/portal/ui/PageShell";
import PageHeader from "@/app/components/portal/ui/PageHeader";

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

const uniqueRecordsById = (records: PatientRecord[]) =>
  Array.from(new Map(records.map((record) => [record.id, record])).values());

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
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const formatTime = (timeString?: string | null) => {
  if (!timeString) return "Not scheduled";
  const date = new Date(`1970-01-01T${timeString}`);
  if (Number.isNaN(date.getTime())) return timeString;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};

const valueOrFallback = (value: string | null | undefined, fallback = "Not yet recorded.") => {
  if (!value || value.trim() === "") return fallback;
  return value;
};

const getDiagnosis = (record: PatientRecord) =>
  record.doctor_final_diagnosis || record.final_diagnosis || record.diagnosis || "";

const getPrescription = (record: PatientRecord) =>
  record.doctor_prescription || record.prescription || record.medication || "";

const getDoctorNotes = (record: PatientRecord) =>
  record.after_appointment_notes || record.doctor_notes || record.doctor_note || record.notes || "";

const getFollowUpPlan = (record: PatientRecord) =>
  record.follow_up_plan || record.followup_plan || record.follow_up || "";

const hasDoctorRecord = (record: PatientRecord) =>
  Boolean(
    record.diagnosis_report_id ||
      getDiagnosis(record) ||
      getPrescription(record) ||
      getDoctorNotes(record) ||
      getFollowUpPlan(record) ||
      record.next_visit_date
  );

const truncate = (value: string, max = 72) => {
  const clean = value.trim();
  if (!clean) return "Not recorded";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

const getTreatmentSummary = (record: PatientRecord) => {
  const raw = getPrescription(record);
  if (!raw) return "No prescription";
  const parsed = parsePrescription(raw);
  if (parsed.length === 0) return truncate(raw, 48);
  const names = parsed.map((item) => item.medicine).filter(Boolean);
  if (names.length === 0) return "Prescription recorded";
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
};

export default function PatientMedicalRecords() {
  const router = useRouter();
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
        headers: { Authorization: `Bearer ${token}` },
      });
      const recordsData = await readJsonSafely(recordsRes);
      if (!recordsRes.ok) throw new Error("Failed to fetch medical records");
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
      .filter((record) => record.status?.toLowerCase() === "completed" && hasDoctorRecord(record))
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time || "00:00:00"}`).getTime();
        const dateB = new Date(`${b.date}T${b.time || "00:00:00"}`).getTime();
        return dateB - dateA;
      });
  }, [records]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  return (
    <PageShell className={styles.page}>
      <PageHeader
        eyebrow="Patient portal"
        title="Medical Records"
        description="Scan completed consultation records, then expand a record only when you need the full clinical detail."
        secondaryAction={<Link href="/pages/patient/history" className={styles.secondaryButton}>Appointments</Link>}
      />

      {loading ? (
        <div className={styles.emptyState}>Loading medical records...</div>
      ) : completedRecords.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No medical records yet</h2>
          <p>Your records will appear after a completed consultation has an official diagnosis report.</p>
        </div>
      ) : (
        <div className={styles.recordsList}>
          <div className={styles.listHeader} aria-hidden="true">
            <span>Date</span>
            <span>Doctor / service</span>
            <span>Diagnosis</span>
            <span>Treatment</span>
            <span>Status</span>
            <span></span>
          </div>

          {completedRecords.map((record) => (
            <details key={record.id} className={styles.record}>
              <summary className={styles.recordSummary}>
                <div className={styles.summaryCell} data-label="Date">
                  <strong>{formatDate(record.date)}</strong>
                  <span>{formatTime(record.time)}</span>
                </div>

                <div className={styles.summaryCell} data-label="Doctor / service">
                  <strong>Dr. {record.doctor_name || "Assigned Doctor"}</strong>
                  <span>{record.services || "Consultation"}</span>
                </div>

                <div className={styles.summaryCell} data-label="Diagnosis">
                  <strong>{truncate(getDiagnosis(record), 56)}</strong>
                </div>

                <div className={styles.summaryCell} data-label="Treatment">
                  <strong>{getTreatmentSummary(record)}</strong>
                </div>

                <div className={styles.summaryCell} data-label="Status">
                  <span className={styles.statusBadge}>Completed</span>
                </div>

                <span className={styles.expandLabel}>View details</span>
              </summary>

              <div className={styles.recordDetails}>
                <RecordField label="Final Diagnosis" value={valueOrFallback(getDiagnosis(record))} highlight />
                <PrescriptionDetails prescription={valueOrFallback(getPrescription(record))} />
                <RecordField label="Doctor Notes" value={valueOrFallback(getDoctorNotes(record), "No doctor notes recorded.")} />
                <RecordField label="Follow-up Plan" value={valueOrFallback(getFollowUpPlan(record), "No follow-up plan recorded.")} />
                <RecordField
                  label="Next Visit Date"
                  value={record.next_visit_date ? formatDate(record.next_visit_date) : "No next visit date recorded."}
                />
              </div>
            </details>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function RecordField({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`${styles.recordField} ${highlight ? styles.recordFieldHighlight : ""}`}>
      <p className={styles.recordLabel}>{label}</p>
      <p className={`${styles.recordValue} ${highlight ? styles.recordValueHighlight : ""}`}>{value}</p>
    </div>
  );
}

function PrescriptionDetails({ prescription }: { prescription: string }) {
  const parsedPrescription = parsePrescription(prescription);
  if (!prescription || prescription === "Not yet recorded.") {
    return <RecordField label="Prescription" value="No prescription recorded yet." />;
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
            <tr><th>Medicine</th><th>Usage</th><th>Reason</th></tr>
          </thead>
          <tbody>
            {parsedPrescription.map((item, index) => (
              <tr key={`${item.medicine}-${index}`}>
                <td><strong>{item.medicine || "Not specified"}</strong></td>
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

  const normalized = raw.replace(/\r/g, "").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  const medicationBlocks = normalized.match(/Medication\s*:\s*[\s\S]*?(?=\s*Medication\s*:|$)/gi) || [];

  if (medicationBlocks.length > 0) {
    return medicationBlocks
      .map((block, index) => ({
        medicine: extractPrescriptionValue(block, "Medication") || `Medication ${index + 1}`,
        usage: extractPrescriptionValue(block, "Usage"),
        reason: extractPrescriptionValue(block, "Reason"),
      }))
      .filter((item) => item.medicine.trim() || item.usage.trim() || item.reason.trim());
  }

  const medicationSection = getSection(raw, "Medication", ["Usage", "Reason"]);
  const usageSection = getSection(raw, "Usage", ["Reason"]);
  const reasonSection = getSection(raw, "Reason", []);

  if (medicationSection || usageSection || reasonSection) {
    const medicines = splitMedicines(medicationSection);
    if (medicines.length === 0) return [];
    const usageMap = mapDetailsByMedicine(usageSection, medicines);
    const reasonMap = mapDetailsByMedicine(reasonSection, medicines);
    return medicines.map((medicine) => ({
      medicine,
      usage: usageMap[medicine.toLowerCase()] || usageSection || "",
      reason: reasonMap[medicine.toLowerCase()] || reasonSection || "",
    }));
  }

  return [{ medicine: cleanText(normalized), usage: "", reason: "" }];
}

function extractPrescriptionValue(block: string, label: "Medication" | "Usage" | "Reason") {
  const stopLabels = ["Medication", "Usage", "Reason"].filter((item) => item !== label);
  const stopPattern = stopLabels.map((item) => `\\|?\\s*${item}\\s*:`).join("|");
  const expression = new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)(?=\\s*(?:${stopPattern})|$)`, "i");
  return cleanText(block.match(expression)?.[1] || "");
}

function getSection(text: string, label: "Medication" | "Usage" | "Reason", nextLabels: string[]) {
  const lowerText = text.toLowerCase();
  const labelText = `${label.toLowerCase()}:`;
  const startIndex = lowerText.indexOf(labelText);
  if (startIndex === -1) return "";
  const contentStart = startIndex + labelText.length;
  let contentEnd = text.length;
  for (const nextLabel of nextLabels) {
    const nextIndex = lowerText.indexOf(`${nextLabel.toLowerCase()}:`, contentStart);
    if (nextIndex !== -1 && nextIndex < contentEnd) contentEnd = nextIndex;
  }
  return cleanText(text.slice(contentStart, contentEnd));
}

function splitMedicines(section: string) {
  if (!section) return [];
  return section.split(";").map((item) => cleanText(item)).filter(Boolean);
}

function mapDetailsByMedicine(section: string, medicines: string[]) {
  const result: Record<string, string> = {};
  if (!section || medicines.length === 0) return result;
  const lowerSection = section.toLowerCase();
  const positions = medicines
    .map((medicine) => {
      const needle = `${medicine.toLowerCase()}:`;
      return { medicine, index: lowerSection.indexOf(needle), labelLength: needle.length };
    })
    .filter((item) => item.index !== -1)
    .sort((a, b) => a.index - b.index);

  positions.forEach((item, index) => {
    const nextItem = positions[index + 1];
    result[item.medicine.toLowerCase()] = cleanText(section.slice(item.index + item.labelLength, nextItem ? nextItem.index : section.length));
  });
  return result;
}

function cleanText(text: string) {
  return text.replace(/\|/g, "").replace(/\s+/g, " ").trim();
}
