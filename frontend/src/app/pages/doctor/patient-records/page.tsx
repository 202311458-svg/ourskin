"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import styles from "@/app/styles/doctor.module.css";
import {
  getDoctorPatientRecords,
  type PatientRecord,
} from "@/lib/doctor-api";

type AnalysisRecord = PatientRecord["analyses"][number];
type DoctorDiagnosisReport = Record<string, unknown>;
type UnknownRecord = Record<string, unknown>;

type PatientGroup = {
  id: string;
  patientName: string;
  records: PatientRecord[];
  totalVisits: number;
  completedVisits: number;
  latestVisitDate: string;
  latestVisitTime: string;
};

type PrescriptionItem = {
  medication: string;
  usage: string;
  reason: string;
};

type SelectedAiModal = {
  patientName: string;
  appointment: PatientRecord["appointment"];
  analysis: AnalysisRecord;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const MAROON = "#8a3456";
const MAROON_DARK = "#6f2642";
const BORDER = "#eadde4";
const MUTED = "#7b6b75";
const SOFT_BG = "#fbf8fa";

const pageCardStyle: CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 24,
  background: "#ffffff",
  boxShadow: "0 12px 30px rgba(87, 47, 68, 0.06)",
};

const softPanelStyle: CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 18,
  background: SOFT_BG,
  padding: 18,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: MUTED,
};

const valueStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 16,
  lineHeight: 1.6,
  color: "#1f1f1f",
  whiteSpace: "pre-line",
};

function isObject(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEmptyValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function readObjectValue(source: unknown, key: string) {
  if (!isObject(source)) {
    return null;
  }

  return source[key] ?? null;
}

function readAny(source: unknown, keys: string[]) {
  for (const key of keys) {
    const value = readObjectValue(source, key);

    if (!isEmptyValue(value)) {
      return value;
    }
  }

  return null;
}

function displayValue(value: unknown, fallback = "Not yet added") {
  if (isEmptyValue(value)) {
    return fallback;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (isObject(item)) {
          return JSON.stringify(item);
        }

        return String(item);
      })
      .join("\n");
  }

  if (isObject(value)) {
    return JSON.stringify(value);
  }

  return String(value);
}

function readTextFromSources(
  sources: unknown[],
  keys: string[],
  fallback = "Not yet added"
) {
  for (const source of sources) {
    const value = readAny(source, keys);

    if (!isEmptyValue(value)) {
      return displayValue(value, fallback);
    }
  }

  return fallback;
}

function createPatientKey(record: PatientRecord) {
  const patientEmail = displayValue(
    readAny(record.appointment, ["patient_email", "email"]),
    ""
  );

  if (patientEmail) {
    return patientEmail.trim().toLowerCase();
  }

  const patientName = record.appointment.patient_name || "Unnamed Patient";
  return patientName.trim().toLowerCase().replace(/\s+/g, "-");
}

function getVisitTimestamp(record: PatientRecord) {
  const date = String(record.appointment.date || "");
  const time = String(record.appointment.time || "00:00");
  const parsedDate = new Date(`${date}T${time}`);

  if (Number.isNaN(parsedDate.getTime())) {
    return 0;
  }

  return parsedDate.getTime();
}

function formatConfidence(confidence: unknown) {
  const value = Number(confidence);

  if (Number.isNaN(value)) {
    return "N/A";
  }

  if (value <= 1) {
    return `${Math.round(value * 100)}% confidence`;
  }

  return `${Math.round(value)}% confidence`;
}

function formatGeneratedDate(value: unknown) {
  if (!value) {
    return "N/A";
  }

  const parsedDate = new Date(String(value));

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return parsedDate.toLocaleString();
}

function buildImageUrl(path: unknown) {
  if (!path || typeof path !== "string") {
    return "";
  }

  if (path.startsWith("http")) {
    return path;
  }

  if (path.startsWith("/")) {
    return `${API_BASE_URL}${path}`;
  }

  return `${API_BASE_URL}/${path}`;
}

async function getDiagnosisReportForAppointment(
  appointmentId: string | number
): Promise<DoctorDiagnosisReport | null> {
  const token = localStorage.getItem("token");

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/doctor/appointments/${appointmentId}/diagnosis-report`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();

      console.warn(
        `Diagnosis report not available for appointment ${appointmentId}. Status: ${response.status}`,
        errorText
      );

      return null;
    }

    return response.json();
  } catch (error) {
    console.warn(
      `Could not fetch diagnosis report for appointment ${appointmentId}:`,
      error
    );

    return null;
  }
}

function getStatusStyle(status: string): CSSProperties {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "completed") {
    return {
      background: "#ecfdf3",
      color: "#027a48",
      border: "1px solid #abefc6",
    };
  }

  if (
    normalizedStatus === "declined" ||
    normalizedStatus === "cancelled" ||
    normalizedStatus === "canceled"
  ) {
    return {
      background: "#fff1f3",
      color: "#c01048",
      border: "1px solid #fecdd6",
    };
  }

  if (normalizedStatus === "approved") {
    return {
      background: "#eff8ff",
      color: "#175cd3",
      border: "1px solid #b2ddff",
    };
  }

  return {
    background: "#fffaeb",
    color: "#b54708",
    border: "1px solid #fedf89",
  };
}

function getDoctorReportSources(
  diagnosisReport?: DoctorDiagnosisReport | null
) {
  return [
    diagnosisReport,
    readObjectValue(diagnosisReport, "report"),
    readObjectValue(diagnosisReport, "data"),
    readObjectValue(diagnosisReport, "diagnosis_report"),
    readObjectValue(diagnosisReport, "diagnosisReport"),
    readObjectValue(diagnosisReport, "doctor_report"),
    readObjectValue(diagnosisReport, "doctorReport"),
  ].filter(Boolean);
}

function getDoctorDiagnosis(
  _record: PatientRecord,
  diagnosisReport?: DoctorDiagnosisReport | null
) {
  return readTextFromSources(
    getDoctorReportSources(diagnosisReport),
    [
      "doctor_final_diagnosis",
      "doctorFinalDiagnosis",
      "final_diagnosis",
      "finalDiagnosis",
      "diagnosis",
    ],
    "No doctor diagnosis saved yet."
  );
}

function isLikelyAiSupportNote(note: string) {
  const normalized = note.toLowerCase();

  return (
    normalized.includes("severity:") ||
    normalized.includes("red flags:") ||
    normalized.includes("patient instructions:") ||
    normalized.includes("ai recommendation") ||
    normalized.includes("possible conditions") ||
    normalized.includes("key findings")
  );
}

function getDoctorNotes(
  _record: PatientRecord,
  diagnosisReport?: DoctorDiagnosisReport | null
) {
  const note = readTextFromSources(
    getDoctorReportSources(diagnosisReport),
    [
      "after_appointment_notes",
      "afterAppointmentNotes",
      "doctor_notes",
      "doctorNotes",
      "doctor_note",
      "doctorNote",
    ],
    ""
  );

  if (!note || isLikelyAiSupportNote(note)) {
    return "";
  }

  return note;
}

function getDoctorFollowUp(
  _record: PatientRecord,
  diagnosisReport?: DoctorDiagnosisReport | null
) {
  return readTextFromSources(
    getDoctorReportSources(diagnosisReport),
    [
      "follow_up_plan",
      "followUpPlan",
      "follow_up",
      "followup",
      "doctor_follow_up",
      "doctorFollowUp",
      "follow_up_instructions",
    ],
    "No follow-up plan saved yet."
  );
}

function tryParseJson(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith("{") && !trimmedValue.startsWith("[")) {
    return value;
  }

  try {
    return JSON.parse(trimmedValue);
  } catch {
    return value;
  }
}

function cleanMedicationName(value: string) {
  return value
    .replace(/^Medication\s*:/i, "")
    .replace(/^Medicine\s*:/i, "")
    .replace(/^Prescription\s*:/i, "")
    .split(/\bUsage\s*:/i)[0]
    .split(/\bReason\s*:/i)[0]
    .trim();
}

function splitMedicationNames(value: string) {
  const cleanedValue = cleanMedicationName(value);

  if (!cleanedValue) {
    return [];
  }

  return cleanedValue
    .split(/;|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSpecificInstruction(sourceText: string, medicationName: string) {
  if (!sourceText || !medicationName) {
    return "";
  }

  const pattern = new RegExp(
    `${escapeRegExp(medicationName)}\\s*:\\s*([^;\\n]+)`,
    "i"
  );

  const match = sourceText.match(pattern);
  return match?.[1]?.trim() || "";
}

function extractLabelledSegment(
  text: string,
  label: string,
  stopLabels: string[]
) {
  if (!text) {
    return "";
  }

  const stopPattern = stopLabels.map((item) => `${item}\\s*:`).join("|");

  const pattern = new RegExp(
    `${label}\\s*:\\s*([\\s\\S]*?)(?=${stopPattern}|$)`,
    "i"
  );

  const match = text.match(pattern);
  return match?.[1]?.trim() || "";
}

function cleanFieldText(value: string) {
  return value
    .replace(/\|/g, "")
    .replace(/^[-•]\s*/, "")
    .trim();
}

function isGenericMedicationName(value: string) {
  const normalized = cleanFieldText(value).toLowerCase();

  return (
    !normalized ||
    normalized === "medication" ||
    normalized === "medicine" ||
    normalized === "prescription"
  );
}

function splitAiPrescriptionEntries(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\n\s*[-•]\s+/g, "\n")
    .replace(/\s+-\s+(?=[A-Za-z][^:]{1,100}:)/g, "\n")
    .replace(/^[-•]\s+/g, "")
    .split(/\n+|;\s*(?=[A-Za-z][^:]{1,100}:)/)
    .map((entry) => cleanFieldText(entry))
    .filter(Boolean);
}

function parseSingleAiPrescriptionEntry(entry: string): PrescriptionItem | null {
  const cleanedEntry = cleanFieldText(entry);

  if (!cleanedEntry) {
    return null;
  }

  const labelledMedication =
    extractLabelledSegment(cleanedEntry, "Medication", ["Usage", "Reason"]) ||
    extractLabelledSegment(cleanedEntry, "Medicine", ["Usage", "Reason"]);

  const labelledUsage = extractLabelledSegment(cleanedEntry, "Usage", [
    "Reason",
  ]);

  const labelledReason = extractLabelledSegment(cleanedEntry, "Reason", [
    "Usage",
  ]);

  if (labelledMedication || labelledUsage || labelledReason) {
    return {
      medication: cleanFieldText(labelledMedication || "Medication"),
      usage: cleanFieldText(labelledUsage || "Not provided"),
      reason: cleanFieldText(labelledReason || "Not provided"),
    };
  }

  const firstColonIndex = cleanedEntry.indexOf(":");

  if (firstColonIndex !== -1) {
    const medication = cleanFieldText(cleanedEntry.slice(0, firstColonIndex));
    const remainder = cleanFieldText(cleanedEntry.slice(firstColonIndex + 1));

    const reasonMatch = remainder.match(/^(.*?)(?:\s*\(([^()]+)\))$/);

    if (reasonMatch) {
      return {
        medication: medication || "Medication",
        usage: cleanFieldText(reasonMatch[1] || "Not provided"),
        reason: cleanFieldText(reasonMatch[2] || "Not provided"),
      };
    }

    return {
      medication: medication || "Medication",
      usage: remainder || "Not provided",
      reason: "Not provided",
    };
  }

  return {
    medication: cleanedEntry,
    usage: "Not provided",
    reason: "Not provided",
  };
}

function parseAiPrescriptionSuggestions(value: unknown): PrescriptionItem[] {
  const parsedValue = tryParseJson(value);

  if (Array.isArray(parsedValue)) {
    return parsedValue.flatMap((item) => parseAiPrescriptionSuggestions(item));
  }

  if (isObject(parsedValue)) {
    const nestedItems = readAny(parsedValue, [
      "items",
      "prescriptions",
      "medications",
      "prescription_items",
      "prescriptionItems",
    ]);

    if (Array.isArray(nestedItems)) {
      return nestedItems.flatMap((item) => parseAiPrescriptionSuggestions(item));
    }

    const medication = displayValue(
      readAny(parsedValue, [
        "medication",
        "medicine",
        "name",
        "drug",
        "title",
        "prescription",
      ]),
      ""
    );

    const usage = displayValue(
      readAny(parsedValue, [
        "usage",
        "medication_usage",
        "medicationUsage",
        "dosage",
        "instructions",
        "direction",
        "directions",
      ]),
      ""
    );

    const reason = displayValue(
      readAny(parsedValue, [
        "reason",
        "usage_reason",
        "usageReason",
        "prescription_reason",
        "prescriptionReason",
        "medication_reason",
        "medicationReason",
        "purpose",
      ]),
      ""
    );

    const medicationNames = splitMedicationNames(medication);

    if (medicationNames.length > 0) {
      return medicationNames.map((medicationName) => ({
        medication: cleanFieldText(medicationName),
        usage:
          cleanFieldText(getSpecificInstruction(usage, medicationName) || usage) ||
          "Not provided",
        reason:
          cleanFieldText(
            getSpecificInstruction(reason, medicationName) || reason
          ) || "Not provided",
      }));
    }

    if (medication || usage || reason) {
      return [
        {
          medication: cleanFieldText(medication || "Medication"),
          usage: cleanFieldText(usage || "Not provided"),
          reason: cleanFieldText(reason || "Not provided"),
        },
      ];
    }
  }

  if (typeof parsedValue === "string") {
    return splitAiPrescriptionEntries(parsedValue)
      .map((entry) => parseSingleAiPrescriptionEntry(entry))
      .filter((item): item is PrescriptionItem => Boolean(item));
  }

  return [];
}

function getAiTextValue(analysis: AnalysisRecord, keys: string[]) {
  const value = readAny(analysis, keys);

  if (isEmptyValue(value)) {
    return "";
  }

  return displayValue(value, "");
}

function mergePrescriptionItemsWithFallback(
  primaryItems: PrescriptionItem[],
  fallbackItems: PrescriptionItem[]
) {
  if (primaryItems.length === 0) {
    return fallbackItems;
  }

  if (fallbackItems.length === 0) {
    return primaryItems;
  }

  const allPrimaryNamesAreGeneric = primaryItems.every((item) =>
    isGenericMedicationName(item.medication)
  );

  if (allPrimaryNamesAreGeneric && fallbackItems.length > 0) {
    return fallbackItems;
  }

  return primaryItems.map((item, index) => {
    const fallbackItem = fallbackItems[index];

    if (!fallbackItem) {
      return item;
    }

    return {
      medication: isGenericMedicationName(item.medication)
        ? fallbackItem.medication
        : item.medication,
      usage:
        item.usage === "Not provided" || !item.usage
          ? fallbackItem.usage
          : item.usage,
      reason:
        item.reason === "Not provided" || !item.reason
          ? fallbackItem.reason
          : item.reason,
    };
  });
}

function textLooksLikeMedicationInstructions(text: string) {
  if (!text) {
    return false;
  }

  const parsedItems = parseAiPrescriptionSuggestions(text);

  return parsedItems.some(
    (item) =>
      !isGenericMedicationName(item.medication) &&
      item.usage !== "Not provided"
  );
}

function prescriptionItemsFromUnknown(value: unknown): PrescriptionItem[] {
  const parsedValue = tryParseJson(value);

  if (Array.isArray(parsedValue)) {
    return parsedValue.flatMap((item) => prescriptionItemsFromUnknown(item));
  }

  if (isObject(parsedValue)) {
    const nestedItems = readAny(parsedValue, [
      "items",
      "prescriptions",
      "medications",
      "prescription_items",
      "prescriptionItems",
    ]);

    if (Array.isArray(nestedItems)) {
      return nestedItems.flatMap((item) => prescriptionItemsFromUnknown(item));
    }

    const medicationText = displayValue(
      readAny(parsedValue, [
        "medication",
        "medicine",
        "name",
        "drug",
        "title",
        "prescription",
      ]),
      ""
    );

    const usageText = displayValue(
      readAny(parsedValue, [
        "usage",
        "medication_usage",
        "medicationUsage",
        "dosage",
        "instructions",
        "direction",
        "directions",
      ]),
      ""
    );

    const reasonText = displayValue(
      readAny(parsedValue, [
        "reason",
        "usage_reason",
        "usageReason",
        "prescription_reason",
        "prescriptionReason",
        "medication_reason",
        "medicationReason",
        "purpose",
      ]),
      ""
    );

    const medicationNames = splitMedicationNames(medicationText);

    if (medicationNames.length > 0) {
      return medicationNames.map((medicationName) => ({
        medication: medicationName,
        usage:
          getSpecificInstruction(usageText, medicationName) ||
          usageText ||
          "Not provided",
        reason:
          getSpecificInstruction(reasonText, medicationName) ||
          reasonText ||
          "Not provided",
      }));
    }

    if (medicationText || usageText || reasonText) {
      return [
        {
          medication: medicationText || "Medication",
          usage: usageText || "Not provided",
          reason: reasonText || "Not provided",
        },
      ];
    }
  }

  if (typeof parsedValue === "string") {
    const rawText = parsedValue.trim();

    if (!rawText) {
      return [];
    }

    const medicationSegment =
      extractLabelledSegment(rawText, "Medication", ["Usage", "Reason"]) ||
      extractLabelledSegment(rawText, "Medicine", ["Usage", "Reason"]) ||
      rawText.split(/\bUsage\s*:/i)[0].split(/\bReason\s*:/i)[0];

    const usageSegment = extractLabelledSegment(rawText, "Usage", ["Reason"]);
    const reasonSegment = extractLabelledSegment(rawText, "Reason", ["Usage"]);

    const medicationNames = splitMedicationNames(medicationSegment);

    return medicationNames.map((medicationName) => ({
      medication: medicationName,
      usage:
        getSpecificInstruction(usageSegment, medicationName) ||
        usageSegment ||
        "Not provided",
      reason:
        getSpecificInstruction(reasonSegment, medicationName) ||
        reasonSegment ||
        "Not provided",
    }));
  }

  return [];
}

function getPrescriptionItemsFromSources(
  sources: unknown[],
  prescriptionKeys: string[],
  usageKeys: string[],
  reasonKeys: string[]
) {
  for (const source of sources) {
    for (const key of prescriptionKeys) {
      const value = readObjectValue(source, key);
      const items = prescriptionItemsFromUnknown(value);

      if (items.length > 0) {
        const usageText = readTextFromSources(sources, usageKeys, "");
        const reasonText = readTextFromSources(sources, reasonKeys, "");

        return items.map((item) => ({
          medication: item.medication,
          usage:
            item.usage !== "Not provided"
              ? item.usage
              : getSpecificInstruction(usageText, item.medication) ||
                usageText ||
                "Not provided",
          reason:
            item.reason !== "Not provided"
              ? item.reason
              : getSpecificInstruction(reasonText, item.medication) ||
                reasonText ||
                "Not provided",
        }));
      }
    }
  }

  const medicationText = readTextFromSources(sources, prescriptionKeys, "");
  const usageText = readTextFromSources(sources, usageKeys, "");
  const reasonText = readTextFromSources(sources, reasonKeys, "");

  if (!medicationText) {
    return [];
  }

  return splitMedicationNames(medicationText).map((medicationName) => ({
    medication: medicationName,
    usage:
      getSpecificInstruction(usageText, medicationName) ||
      usageText ||
      "Not provided",
    reason:
      getSpecificInstruction(reasonText, medicationName) ||
      reasonText ||
      "Not provided",
  }));
}

function getDoctorPrescriptionItems(
  _record: PatientRecord,
  diagnosisReport?: DoctorDiagnosisReport | null
) {
  const sources = getDoctorReportSources(diagnosisReport);

  return getPrescriptionItemsFromSources(
    sources,
    [
      "doctor_prescription_items",
      "doctorPrescriptionItems",
      "prescriptions",
      "doctor_prescription",
      "doctorPrescription",
      "prescription",
    ],
    [
      "usage",
      "medication_usage",
      "medicationUsage",
      "doctor_medication_usage",
      "doctorMedicationUsage",
      "prescription_usage",
      "dosage",
      "instructions",
      "directions",
    ],
    [
      "reason",
      "usage_reason",
      "usageReason",
      "prescription_reason",
      "prescriptionReason",
      "medication_reason",
      "medicationReason",
      "doctor_prescription_reason",
      "doctorPrescriptionReason",
      "purpose",
    ]
  );
}

function getAiPrescriptionItems(analysis: AnalysisRecord) {
  const sources = [
    analysis,
    readObjectValue(analysis, "ai_result"),
    readObjectValue(analysis, "aiResult"),
    readObjectValue(analysis, "result"),
    readObjectValue(analysis, "data"),
  ].filter(Boolean);

  const prescriptionKeys = [
    "ai_prescription_items",
    "aiPrescriptionItems",
    "prescription_items",
    "prescriptionItems",
    "prescription_suggestions",
    "prescriptionSuggestions",
    "ai_prescription_suggestions",
    "aiPrescriptionSuggestions",
    "suggested_prescriptions",
    "suggestedPrescriptions",
    "medication_suggestions",
    "medicationSuggestions",
  ];

  const fallbackText =
    getAiTextValue(analysis, [
      "treatment_suggestions",
      "treatmentSuggestions",
    ]) ||
    getAiTextValue(analysis, [
      "recommendation",
      "ai_recommendation",
      "aiRecommendation",
    ]);

  const fallbackItems = parseAiPrescriptionSuggestions(fallbackText);

  for (const source of sources) {
    for (const key of prescriptionKeys) {
      const value = readObjectValue(source, key);
      const primaryItems = parseAiPrescriptionSuggestions(value);

      if (primaryItems.length > 0) {
        return mergePrescriptionItemsWithFallback(primaryItems, fallbackItems);
      }
    }
  }

  return fallbackItems;
}

function getLatestAnalysis(record: PatientRecord) {
  const analyses = Array.isArray(record.analyses) ? record.analyses : [];

  return (
    analyses.find((analysis) => analysis.review_status === "Reviewed") ||
    analyses[0] ||
    null
  );
}

function isBasicOnlyStatus(status: string) {
  const normalizedStatus = status.toLowerCase();

  return (
    normalizedStatus === "declined" ||
    normalizedStatus === "cancelled" ||
    normalizedStatus === "canceled"
  );
}

function isCompletedStatus(status: string) {
  return status.toLowerCase() === "completed";
}

export default function DoctorPatientRecordsPage() {
  const router = useRouter();

  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [diagnosisReports, setDiagnosisReports] = useState<
    Record<string, DoctorDiagnosisReport | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    null
  );
  const [selectedAiModal, setSelectedAiModal] =
    useState<SelectedAiModal | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);

      const data = await getDoctorPatientRecords();
      const safeData = Array.isArray(data) ? data : [];

      setRecords(safeData);

      const completedRecords = safeData.filter((record) =>
        isCompletedStatus(record.appointment.status || "")
      );

      const reportEntries = await Promise.allSettled(
        completedRecords.map(async (record) => {
          const appointmentId = String(record.appointment.id);
          const report = await getDiagnosisReportForAppointment(appointmentId);

          return [appointmentId, report] as const;
        })
      );

      const reports: Record<string, DoctorDiagnosisReport | null> = {};

      reportEntries.forEach((entry) => {
        if (entry.status === "fulfilled") {
          const [appointmentId, report] = entry.value;
          reports[appointmentId] = report;
        }
      });

      setDiagnosisReports(reports);
    } catch (error) {
      console.error("Failed to load patient records:", error);
      setRecords([]);
      setDiagnosisReports({});
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

  const patientGroups = useMemo<PatientGroup[]>(() => {
    const groupedPatients = new Map<string, PatientRecord[]>();

    records.forEach((record) => {
      const patientId = createPatientKey(record);

      if (!groupedPatients.has(patientId)) {
        groupedPatients.set(patientId, []);
      }

      groupedPatients.get(patientId)?.push(record);
    });

    return Array.from(groupedPatients.entries())
      .map(([id, patientRecords]) => {
        const sortedRecords = [...patientRecords].sort(
          (a, b) => getVisitTimestamp(b) - getVisitTimestamp(a)
        );

        const latestRecord = sortedRecords[0];

        return {
          id,
          patientName:
            latestRecord?.appointment.patient_name || "Unnamed Patient",
          records: sortedRecords,
          totalVisits: sortedRecords.length,
          completedVisits: sortedRecords.filter((record) =>
            isCompletedStatus(record.appointment.status || "")
          ).length,
          latestVisitDate: latestRecord?.appointment.date || "N/A",
          latestVisitTime: latestRecord?.appointment.time || "N/A",
        };
      })
      .sort((a, b) => {
        const latestA = getVisitTimestamp(a.records[0]);
        const latestB = getVisitTimestamp(b.records[0]);

        return latestB - latestA;
      });
  }, [records]);

  const filteredPatients = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    if (!keyword) {
      return patientGroups;
    }

    return patientGroups.filter((patient) => {
      const searchableText = [
        patient.patientName,
        patient.latestVisitDate,
        patient.latestVisitTime,
        ...patient.records.map((record) => record.appointment.services),
        ...patient.records.map((record) => record.appointment.status),
        ...patient.records.map((record) => record.appointment.doctor_name),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [patientGroups, searchTerm]);

  const selectedPatient = useMemo(() => {
    return (
      patientGroups.find((patient) => patient.id === selectedPatientId) || null
    );
  }, [patientGroups, selectedPatientId]);

  return (
    <>
      <DoctorNavbar />

      <main className={styles.pageWrapper}>
        <div className={styles.headerSection}>
          <h1 className={styles.pageTitle}>Patient Records</h1>
          <p className={styles.pageSubtitle}>
            Select a patient first to view official doctor records and supporting
            AI results.
          </p>
        </div>

        {!selectedPatient ? (
          <section className={styles.sectionCard} style={pageCardStyle}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Choose a Patient</h2>
                <p className={styles.listSecondary}>
                  Search and select a patient to open their consultation history.
                </p>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search patient name, service, doctor, date, or status..."
                style={{
                  width: "100%",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 999,
                  padding: "15px 18px",
                  fontSize: 15,
                  outline: "none",
                  background: "#ffffff",
                }}
              />
            </div>

            <div style={{ marginTop: 20 }}>
              {loading ? (
                <div className={styles.emptyState}>
                  Loading patient records...
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className={styles.emptyState}>
                  No patient records matched your search.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 14,
                  }}
                >
                  {filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setSelectedPatientId(patient.id)}
                      style={{
                        textAlign: "left",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 20,
                        padding: 18,
                        background: "#ffffff",
                        cursor: "pointer",
                        boxShadow: "0 8px 20px rgba(87, 47, 68, 0.05)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 14,
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              color: "#1f1f1f",
                              fontSize: 17,
                              fontWeight: 800,
                            }}
                          >
                            {patient.patientName}
                          </div>

                          <div
                            style={{
                              marginTop: 8,
                              color: MUTED,
                              fontSize: 14,
                              lineHeight: 1.5,
                            }}
                          >
                            Latest visit: {patient.latestVisitDate} •{" "}
                            {patient.latestVisitTime}
                          </div>
                        </div>

                        <span
                          style={{
                            border: `1px solid ${BORDER}`,
                            borderRadius: 999,
                            color: MAROON,
                            background: "#fff7fa",
                            padding: "7px 11px",
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          View
                        </span>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          marginTop: 16,
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ color: MUTED, fontSize: 13 }}>
                          Visits: {patient.totalVisits}
                        </span>

                        <span style={{ color: MUTED, fontSize: 13 }}>
                          Completed: {patient.completedVisits}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className={styles.sectionCard} style={pageCardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={labelStyle}>Selected Patient</div>
                <h2
                  style={{
                    margin: "8px 0 0",
                    color: "#1f1f1f",
                    fontSize: 28,
                    lineHeight: 1.2,
                  }}
                >
                  {selectedPatient.patientName}
                </h2>
                <p
                  style={{
                    margin: "8px 0 0",
                    color: MUTED,
                    fontSize: 15,
                  }}
                >
                  Showing {selectedPatient.totalVisits} consultation record
                  {selectedPatient.totalVisits > 1 ? "s" : ""}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPatientId(null)}
                style={{
                  border: `1px solid ${BORDER}`,
                  borderRadius: 999,
                  background: "#ffffff",
                  color: MAROON,
                  fontWeight: 800,
                  padding: "12px 18px",
                  cursor: "pointer",
                }}
              >
                Back to Patient List
              </button>
            </div>

            <div style={{ marginTop: 24, display: "grid", gap: 18 }}>
              {selectedPatient.records.map((record) => {
                const appointment = record.appointment;
                const appointmentId = String(appointment.id);
                const diagnosisReport = diagnosisReports[appointmentId] || null;
                const status = appointment.status || "Pending";
                const basicOnly = isBasicOnlyStatus(status);
                const completed = isCompletedStatus(status);
                const analysis = getLatestAnalysis(record);
                const prescriptionItems = getDoctorPrescriptionItems(
                  record,
                  diagnosisReport
                );
                const doctorNotes = getDoctorNotes(record, diagnosisReport);

                return (
                  <article
                    key={appointment.id}
                    style={{
                      border: `1px solid ${BORDER}`,
                      borderRadius: 24,
                      background: "#ffffff",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "20px 22px",
                        borderBottom: completed
                          ? `1px solid ${BORDER}`
                          : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin: 0,
                            color: "#1f1f1f",
                            fontSize: 19,
                            fontWeight: 800,
                          }}
                        >
                          {appointment.services || "Consultation"}
                        </h3>

                        <p
                          style={{
                            margin: "8px 0 0",
                            color: MUTED,
                            fontSize: 15,
                          }}
                        >
                          {appointment.date} • {appointment.time}
                        </p>

                        <p
                          style={{
                            margin: "8px 0 0",
                            color: MUTED,
                            fontSize: 15,
                          }}
                        >
                          Assigned Doctor: {appointment.doctor_name || "N/A"}
                        </p>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            ...getStatusStyle(status),
                            borderRadius: 999,
                            padding: "8px 13px",
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          {status}
                        </span>

                        {completed && analysis && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedAiModal({
                                patientName: selectedPatient.patientName,
                                appointment,
                                analysis,
                              })
                            }
                            style={{
                              border: `1px solid ${BORDER}`,
                              borderRadius: 999,
                              background: "#ffffff",
                              color: MAROON_DARK,
                              fontWeight: 800,
                              padding: "11px 16px",
                              cursor: "pointer",
                            }}
                          >
                            View AI Result
                          </button>
                        )}
                      </div>
                    </div>

                    {basicOnly || !completed ? null : (
                      <div style={{ padding: 22, display: "grid", gap: 16 }}>
                        <div style={softPanelStyle}>
                          <div style={labelStyle}>Doctor Final Diagnosis</div>
                          <div
                            style={{
                              ...valueStyle,
                              fontWeight: 800,
                            }}
                          >
                            {getDoctorDiagnosis(record, diagnosisReport)}
                          </div>
                        </div>

                        <div
                          style={{
                            border: `1px solid ${BORDER}`,
                            borderRadius: 22,
                            padding: 18,
                            background: "#ffffff",
                          }}
                        >
                          <h3
                            style={{
                              margin: "0 0 14px",
                              fontSize: 19,
                              color: "#1f1f1f",
                            }}
                          >
                            Doctor Prescription
                          </h3>

                          {prescriptionItems.length === 0 ? (
                            <div style={softPanelStyle}>
                              <div style={valueStyle}>
                                No prescription saved yet.
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "grid", gap: 14 }}>
                              {prescriptionItems.map((item, index) => (
                                <div
                                  key={`${item.medication}-${index}`}
                                  style={{
                                    border: `1px solid ${BORDER}`,
                                    borderRadius: 18,
                                    padding: 16,
                                    background: SOFT_BG,
                                  }}
                                >
                                  <div
                                    style={{
                                      color: "#1f1f1f",
                                      fontSize: 17,
                                      fontWeight: 800,
                                      marginBottom: 12,
                                    }}
                                  >
                                    {item.medication}
                                  </div>

                                  <div
                                    style={{
                                      display: "grid",
                                      gap: 0,
                                      borderTop: `1px solid ${BORDER}`,
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "110px 1fr",
                                        gap: 12,
                                        padding: "12px 0",
                                        borderBottom: `1px solid ${BORDER}`,
                                      }}
                                    >
                                      <div style={labelStyle}>Usage</div>
                                      <div style={{ fontSize: 16 }}>
                                        {item.usage}
                                      </div>
                                    </div>

                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "110px 1fr",
                                        gap: 12,
                                        padding: "12px 0 0",
                                      }}
                                    >
                                      <div style={labelStyle}>Reason</div>
                                      <div style={{ fontSize: 16 }}>
                                        {item.reason}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {doctorNotes && (
                          <div style={softPanelStyle}>
                            <div style={labelStyle}>Doctor Notes</div>
                            <div style={valueStyle}>{doctorNotes}</div>
                          </div>
                        )}

                        <div style={softPanelStyle}>
                          <div style={labelStyle}>Follow-up Plan</div>
                          <div style={valueStyle}>
                            {getDoctorFollowUp(record, diagnosisReport)}
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {selectedAiModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedAiModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(36, 42, 55, 0.68)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(1120px, 100%)",
              maxHeight: "88vh",
              overflow: "hidden",
              background: "#ffffff",
              borderRadius: 24,
              boxShadow: "0 30px 90px rgba(15, 23, 42, 0.35)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "24px 28px 20px",
                borderBottom: `1px solid ${BORDER}`,
                display: "flex",
                justifyContent: "space-between",
                gap: 18,
                alignItems: "flex-start",
              }}
            >
              <div>
                <div
                  style={{
                    ...labelStyle,
                    color: MAROON,
                  }}
                >
                  Supporting AI Result
                </div>

                <h2
                  style={{
                    margin: "8px 0 0",
                    fontSize: 26,
                    color: "#111111",
                    lineHeight: 1.2,
                  }}
                >
                  {selectedAiModal.appointment.date} •{" "}
                  {selectedAiModal.appointment.services || "Consultation"}
                </h2>

                <p
                  style={{
                    margin: "8px 0 0",
                    color: "#667085",
                    fontSize: 15,
                  }}
                >
                  This AI result is for reference only. The doctor’s final
                  diagnosis and prescription remain the official clinical
                  record.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAiModal(null)}
                style={{
                  border: `1px solid ${BORDER}`,
                  borderRadius: 18,
                  background: "#ffffff",
                  color: MAROON_DARK,
                  padding: "14px 22px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <div
              style={{
                overflowY: "auto",
                padding: 28,
              }}
            >
              {(() => {
                const analysis = selectedAiModal.analysis;

                const analysisImage = buildImageUrl(
                  readAny(analysis, ["image_path", "image_url", "photo_url"])
                );

                const possibleConditions = displayValue(
                  readAny(analysis, [
                    "possible_conditions",
                    "possibleConditions",
                  ]),
                  analysis.condition || "N/A"
                );

                const keyFindings = displayValue(
                  readAny(analysis, ["key_findings", "keyFindings"]),
                  "No key findings available."
                );

                const recommendation = displayValue(
                  readAny(analysis, [
                    "recommendation",
                    "ai_recommendation",
                    "aiRecommendation",
                  ]),
                  "No AI recommendation available."
                );

                const treatmentSuggestionsRaw = getAiTextValue(analysis, [
                  "treatment_suggestions",
                  "treatmentSuggestions",
                ]);

                const aiPrescriptionItems = getAiPrescriptionItems(analysis);

                const showTreatmentSuggestions =
                  treatmentSuggestionsRaw &&
                  !textLooksLikeMedicationInstructions(treatmentSuggestionsRaw);

                const followUpSuggestions = displayValue(
                  readAny(analysis, [
                    "follow_up_suggestions",
                    "followUpSuggestions",
                  ]),
                  "No follow-up suggestions available."
                );

                const redFlags = displayValue(
                  readAny(analysis, ["red_flags", "redFlags"]),
                  "No red flags listed."
                );

                return (
                  <div style={{ display: "grid", gap: 22 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: 22,
                        alignItems: "start",
                      }}
                    >
                      <div>
                        {analysisImage ? (
                          <img
                            src={analysisImage}
                            alt="Patient skin analysis"
                            style={{
                              width: "100%",
                              height: 230,
                              objectFit: "cover",
                              borderRadius: 18,
                              border: `1px solid ${BORDER}`,
                              background: SOFT_BG,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              height: 230,
                              borderRadius: 18,
                              border: `1px solid ${BORDER}`,
                              background: SOFT_BG,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: MUTED,
                              fontWeight: 700,
                            }}
                          >
                            No image attached
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 14,
                        }}
                      >
                        <div style={softPanelStyle}>
                          <div style={labelStyle}>AI Condition</div>
                          <div
                            style={{
                              ...valueStyle,
                              fontWeight: 800,
                            }}
                          >
                            {analysis.condition || "N/A"}
                          </div>
                        </div>

                        <div style={softPanelStyle}>
                          <div style={labelStyle}>Confidence</div>
                          <div
                            style={{
                              ...valueStyle,
                              fontWeight: 800,
                            }}
                          >
                            {formatConfidence(analysis.confidence)}
                          </div>
                        </div>

                        <div style={softPanelStyle}>
                          <div style={labelStyle}>AI Severity</div>
                          <div
                            style={{
                              ...valueStyle,
                              fontWeight: 800,
                            }}
                          >
                            {analysis.severity || "N/A"}
                          </div>
                        </div>

                        <div style={softPanelStyle}>
                          <div style={labelStyle}>Generated</div>
                          <div
                            style={{
                              ...valueStyle,
                              fontWeight: 800,
                            }}
                          >
                            {formatGeneratedDate(
                              readAny(analysis, [
                                "created_at",
                                "createdAt",
                                "generated_at",
                                "generatedAt",
                              ])
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            ...softPanelStyle,
                            gridColumn: "1 / -1",
                          }}
                        >
                          <div style={labelStyle}>Possible Conditions</div>
                          <div style={valueStyle}>{possibleConditions}</div>
                        </div>

                        <div
                          style={{
                            ...softPanelStyle,
                            gridColumn: "1 / -1",
                          }}
                        >
                          <div style={labelStyle}>Key Findings</div>
                          <div style={valueStyle}>{keyFindings}</div>
                        </div>

                        <div
                          style={{
                            ...softPanelStyle,
                            gridColumn: "1 / -1",
                          }}
                        >
                          <div style={labelStyle}>AI Recommendation</div>
                          <div style={valueStyle}>{recommendation}</div>
                        </div>
                      </div>
                    </div>

                    {showTreatmentSuggestions && (
                      <div style={softPanelStyle}>
                        <h3
                          style={{
                            margin: "0 0 14px",
                            color: "#1f1f1f",
                            fontSize: 19,
                          }}
                        >
                          AI Treatment Suggestions
                        </h3>
                        <div style={valueStyle}>{treatmentSuggestionsRaw}</div>
                      </div>
                    )}

                    <div
                      style={{
                        border: `1px solid ${BORDER}`,
                        borderRadius: 22,
                        padding: 18,
                        background: "#ffffff",
                      }}
                    >
                      <h3
                        style={{
                          margin: "0 0 14px",
                          color: "#1f1f1f",
                          fontSize: 19,
                        }}
                      >
                        AI Prescription Suggestions
                      </h3>

                      {aiPrescriptionItems.length === 0 ? (
                        <div style={valueStyle}>
                          No AI prescription suggestions available.
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(260px, 1fr))",
                            gap: 14,
                          }}
                        >
                          {aiPrescriptionItems.map((item, index) => (
                            <div
                              key={`${item.medication}-${index}`}
                              style={{
                                border: `1px solid ${BORDER}`,
                                borderRadius: 18,
                                padding: 16,
                                background: SOFT_BG,
                              }}
                            >
                              <div
                                style={{
                                  color: MAROON_DARK,
                                  fontSize: 17,
                                  fontWeight: 800,
                                  marginBottom: 12,
                                }}
                              >
                                {item.medication}
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gap: 0,
                                  borderTop: `1px solid ${BORDER}`,
                                }}
                              >
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "90px 1fr",
                                    gap: 12,
                                    padding: "12px 0",
                                    borderBottom: `1px solid ${BORDER}`,
                                  }}
                                >
                                  <div style={labelStyle}>Usage</div>
                                  <div
                                    style={{
                                      fontSize: 16,
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    {item.usage}
                                  </div>
                                </div>

                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "90px 1fr",
                                    gap: 12,
                                    padding: "12px 0 0",
                                  }}
                                >
                                  <div style={labelStyle}>Reason</div>
                                  <div
                                    style={{
                                      fontSize: 16,
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    {item.reason}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={softPanelStyle}>
                      <div style={labelStyle}>AI Follow-up Suggestions</div>
                      <div style={valueStyle}>{followUpSuggestions}</div>
                    </div>

                    <div style={softPanelStyle}>
                      <div style={labelStyle}>AI Red Flags</div>
                      <div style={valueStyle}>{redFlags}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}