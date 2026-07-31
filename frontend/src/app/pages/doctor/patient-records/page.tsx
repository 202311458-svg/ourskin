"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import { API_BASE_URL } from "@/lib/api";
import sharedStyles from "@/app/styles/doctor-shared.module.css";
import recordStyles from "@/app/styles/doctor-patient-records.module.css";
import {
  getDoctorPatientRecords,
  type PatientRecord,
} from "@/lib/doctor-api";

type AnalysisRecord = PatientRecord["analyses"][number];
type DoctorDiagnosisReport = Record<string, unknown>;
type UnknownRecord = Record<string, unknown>;

type PatientGroup = {
  id: string;
  patientId?: number | null;
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
  const patientId = readAny(record.appointment, ["patient_id"]);

  if (!isEmptyValue(patientId)) {
    return `patient-${String(patientId)}`;
  }

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

function getStatusBadgeClass(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "completed") {
    return `${recordStyles.recordStatusBadge} ${recordStyles.recordStatusCompleted}`;
  }

  if (
    normalizedStatus === "declined" ||
    normalizedStatus === "cancelled" ||
    normalizedStatus === "canceled"
  ) {
    return `${recordStyles.recordStatusBadge} ${recordStyles.recordStatusDeclined}`;
  }

  if (normalizedStatus === "approved") {
    return `${recordStyles.recordStatusBadge} ${recordStyles.recordStatusApproved}`;
  }

  return `${recordStyles.recordStatusBadge} ${recordStyles.recordStatusPending}`;
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

  const stopPattern = stopLabels.map((item) => item + "\\s*:").join("|");

  const pattern = new RegExp(
    label + "\\s*:\\s*([\\s\\S]*?)(?=\\s*\\|?\\s*(?:" + stopPattern + ")|$)",
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

function splitDoctorPrescriptionRows(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\s+(?=\bMedication\s*:)/gi, "\n")
    .replace(/\s+(?=\bMedicine\s*:)/gi, "\n")
    .split(/\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseDoctorPrescriptionRow(row: string, index: number): PrescriptionItem | null {
  const medication = cleanFieldText(
    extractLabelledSegment(row, "Medication", ["Usage", "Reason"]) ||
      extractLabelledSegment(row, "Medicine", ["Usage", "Reason"]) ||
      cleanMedicationName(row)
  );

  const usage = cleanFieldText(
    extractLabelledSegment(row, "Usage", ["Reason", "Medication", "Medicine"])
  );

  const reason = cleanFieldText(
    extractLabelledSegment(row, "Reason", ["Medication", "Medicine"])
  );

  if (!medication && !usage && !reason) {
    return null;
  }

  return {
    medication: medication || "Medication " + (index + 1),
    usage: usage || "Not provided",
    reason: reason || "Not provided",
  };
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
        medication: cleanFieldText(medicationName),
        usage:
          cleanFieldText(getSpecificInstruction(usageText, medicationName)) ||
          cleanFieldText(usageText) ||
          "Not provided",
        reason:
          cleanFieldText(getSpecificInstruction(reasonText, medicationName)) ||
          cleanFieldText(reasonText) ||
          "Not provided",
      }));
    }

    if (medicationText || usageText || reasonText) {
      return [
        {
          medication: cleanFieldText(medicationText || "Medication"),
          usage: cleanFieldText(usageText || "Not provided"),
          reason: cleanFieldText(reasonText || "Not provided"),
        },
      ];
    }
  }

  if (typeof parsedValue === "string") {
    const rawText = parsedValue.trim();

    if (!rawText) {
      return [];
    }

    const doctorRows = splitDoctorPrescriptionRows(rawText);
    const hasDoctorPrescriptionLabels = doctorRows.some(
      (row) =>
        /\bMedication\s*:/i.test(row) ||
        /\bMedicine\s*:/i.test(row) ||
        /\bUsage\s*:/i.test(row) ||
        /\bReason\s*:/i.test(row)
    );

    if (hasDoctorPrescriptionLabels) {
      return doctorRows
        .map((row, index) => parseDoctorPrescriptionRow(row, index))
        .filter((item): item is PrescriptionItem => Boolean(item));
    }

    const medicationSegment =
      extractLabelledSegment(rawText, "Medication", ["Usage", "Reason"]) ||
      extractLabelledSegment(rawText, "Medicine", ["Usage", "Reason"]) ||
      rawText.split(/\bUsage\s*:/i)[0].split(/\bReason\s*:/i)[0];

    const usageSegment = extractLabelledSegment(rawText, "Usage", ["Reason"]);
    const reasonSegment = extractLabelledSegment(rawText, "Reason", ["Usage"]);

    const medicationNames = splitMedicationNames(medicationSegment);

    return medicationNames.map((medicationName) => ({
      medication: cleanFieldText(medicationName),
      usage:
        cleanFieldText(getSpecificInstruction(usageSegment, medicationName)) ||
        cleanFieldText(usageSegment) ||
        "Not provided",
      reason:
        cleanFieldText(getSpecificInstruction(reasonSegment, medicationName)) ||
        cleanFieldText(reasonSegment) ||
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

function DoctorPatientRecordsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const requestedPatientIdFromQuery = useMemo(() => {
    const patientIdParam = searchParams.get("patient_id");
    const patientId = patientIdParam ? Number(patientIdParam) : null;

    return patientId && !Number.isNaN(patientId) ? patientId : null;
  }, [searchParams]);

  const requestedPatientFromQuery = useMemo(() => {
    return searchParams.get("patient")?.trim() || "";
  }, [searchParams]);

  const requestedPatientNormalized = useMemo(() => {
    return requestedPatientFromQuery.toLowerCase();
  }, [requestedPatientFromQuery]);

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

        const rawPatientId = latestRecord
          ? readAny(latestRecord.appointment, ["patient_id"])
          : null;
        const parsedPatientId = !isEmptyValue(rawPatientId)
          ? Number(rawPatientId)
          : null;

        return {
          id,
          patientId:
            parsedPatientId && !Number.isNaN(parsedPatientId)
              ? parsedPatientId
              : null,
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

  useEffect(() => {
    if (patientGroups.length === 0 || selectedPatientId) {
      return;
    }

    if (requestedPatientIdFromQuery) {
      const idMatch = patientGroups.find(
        (patient) => patient.patientId === requestedPatientIdFromQuery
      );

      if (idMatch) {
        setSelectedPatientId(idMatch.id);
        return;
      }
    }

    if (!requestedPatientNormalized) {
      return;
    }

    const exactMatch = patientGroups.find(
      (patient) =>
        patient.patientName.trim().toLowerCase() === requestedPatientNormalized
    );

    const partialMatch = patientGroups.find((patient) =>
      patient.patientName
        .trim()
        .toLowerCase()
        .includes(requestedPatientNormalized)
    );

    const matchedPatient = exactMatch || partialMatch;

    if (matchedPatient) {
      setSelectedPatientId(matchedPatient.id);
      return;
    }

    setSearchTerm(requestedPatientFromQuery);
  }, [
    requestedPatientIdFromQuery,
    requestedPatientNormalized,
    requestedPatientFromQuery,
    patientGroups,
    selectedPatientId,
  ]);

  const handleBackToPatientList = () => {
    setSelectedPatientId(null);
    setSearchTerm("");

    if (requestedPatientFromQuery || requestedPatientIdFromQuery) {
      router.replace("/pages/doctor/patient-records");
    }
  };

  return (
    <>
      <DoctorNavbar />

      <main className={sharedStyles.pageWrapper}>
        <div className={sharedStyles.headerSection}>
          <h1 className={sharedStyles.pageTitle}>Patient Records</h1>
          <p className={sharedStyles.pageSubtitle}>
            Select a patient first to view official doctor records and supporting
            AI results.
          </p>
        </div>

        {!selectedPatient ? (
          <section className={`${sharedStyles.sectionCard} ${recordStyles.recordCard}`}>
            <div className={sharedStyles.sectionHeader}>
              <div>
                <h2 className={sharedStyles.sectionTitle}>Choose a Patient</h2>
                <p className={sharedStyles.listSecondary}>
                  Search and select a patient to open their consultation history.
                </p>
              </div>
            </div>

            <div className={recordStyles.patientSearchField}>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search patient name, service, doctor, date, or status..."
                className={recordStyles.patientSearchInput}
              />
            </div>

            <div className={recordStyles.patientResults}>
              {loading ? (
                <div className={sharedStyles.emptyState}>
                  Loading patient records...
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className={sharedStyles.emptyState}>
                  No patient records matched your search.
                </div>
              ) : (
                <div className={recordStyles.patientGrid}>
                  {filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setSelectedPatientId(patient.id)}
                      className={recordStyles.patientCard}
                    >
                      <div className={recordStyles.patientCardHeader}>
                        <div>
                          <div className={recordStyles.patientCardName}>
                            {patient.patientName}
                          </div>

                          <div className={recordStyles.patientCardLatestVisit}>
                            Latest visit: {patient.latestVisitDate} •{" "}
                            {patient.latestVisitTime}
                          </div>
                        </div>

                        <span className={recordStyles.patientCardActionBadge}>
                          View
                        </span>
                      </div>

                      <div className={recordStyles.patientCardStats}>
                        <span className={recordStyles.patientCardStat}>
                          Visits: {patient.totalVisits}
                        </span>

                        <span className={recordStyles.patientCardStat}>
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
          <section className={`${sharedStyles.sectionCard} ${recordStyles.recordCard}`}>
            <div className={recordStyles.selectedPatientHeader}>
              <div>
                <div className={recordStyles.recordLabel}>Selected Patient</div>
                <h2 className={recordStyles.selectedPatientName}>
                  {selectedPatient.patientName}
                </h2>
                <p className={recordStyles.selectedPatientSummary}>
                  Showing {selectedPatient.totalVisits} consultation record
                  {selectedPatient.totalVisits > 1 ? "s" : ""}.
                </p>
              </div>

              <button
                type="button"
                onClick={handleBackToPatientList}
                className={recordStyles.patientListBackButton}
              >
                Back to Patient List
              </button>
            </div>

            <div className={recordStyles.patientVisitList}>
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
                  <article key={appointment.id} className={recordStyles.patientVisitCard}>
                    <div
                      className={`${recordStyles.patientVisitHeader} ${
                        completed ? recordStyles.patientVisitHeaderBordered : ""
                      }`}
                    >
                      <div>
                        <h3 className={recordStyles.patientVisitTitle}>
                          {appointment.services || "Consultation"}
                        </h3>

                        <p className={recordStyles.patientVisitMeta}>
                          {appointment.date} • {appointment.time}
                        </p>

                        <p className={recordStyles.patientVisitMeta}>
                          Assigned Doctor: {appointment.doctor_name || "N/A"}
                        </p>
                      </div>

                      <div className={recordStyles.patientVisitActions}>
                        <span className={getStatusBadgeClass(status)}>
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
                            className={recordStyles.patientVisitAiButton}
                          >
                            View AI Result
                          </button>
                        )}
                      </div>
                    </div>

                    {basicOnly || !completed ? null : (
                      <div className={recordStyles.patientVisitBody}>
                        <div className={recordStyles.softPanel}>
                          <div className={recordStyles.recordLabel}>Doctor Final Diagnosis</div>
                          <div className={`${recordStyles.recordValue} ${recordStyles.recordValueStrong}`}>
                            {getDoctorDiagnosis(record, diagnosisReport)}
                          </div>
                        </div>

                        <div className={recordStyles.recordSection}>
                          <h3 className={recordStyles.recordSectionTitle}>
                            Doctor Prescription
                          </h3>

                          {prescriptionItems.length === 0 ? (
                            <div className={recordStyles.softPanel}>
                              <div className={recordStyles.recordValue}>
                                No prescription saved yet.
                              </div>
                            </div>
                          ) : (
                            <div className={recordStyles.prescriptionList}>
                              {prescriptionItems.map((item, index) => (
                                <div
                                  key={`${item.medication}-${index}`}
                                  className={recordStyles.prescriptionCard}
                                >
                                  <div className={recordStyles.prescriptionMedication}>
                                    {item.medication}
                                  </div>

                                  <div className={recordStyles.prescriptionDetails}>
                                    <div className={recordStyles.prescriptionRow}>
                                      <div className={recordStyles.recordLabel}>Usage</div>
                                      <div className={recordStyles.prescriptionText}>
                                        {item.usage}
                                      </div>
                                    </div>

                                    <div
                                      className={`${recordStyles.prescriptionRow} ${recordStyles.prescriptionRowLast}`}
                                    >
                                      <div className={recordStyles.recordLabel}>Reason</div>
                                      <div className={recordStyles.prescriptionText}>
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
                          <div className={recordStyles.softPanel}>
                            <div className={recordStyles.recordLabel}>Doctor Notes</div>
                            <div className={recordStyles.recordValue}>{doctorNotes}</div>
                          </div>
                        )}

                        <div className={recordStyles.softPanel}>
                          <div className={recordStyles.recordLabel}>Follow-up Plan</div>
                          <div className={recordStyles.recordValue}>
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
          className={recordStyles.recordModalOverlay}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className={recordStyles.recordModalShell}
          >
            <div className={recordStyles.recordModalHeader}>
              <div>
                <div className={`${recordStyles.recordLabel} ${recordStyles.recordLabelAccent}`}>
                  Supporting AI Result
                </div>

                <h2 className={recordStyles.recordModalTitle}>
                  {selectedAiModal.appointment.date} •{" "}
                  {selectedAiModal.appointment.services || "Consultation"}
                </h2>

                <p className={recordStyles.recordModalSubtitle}>
                  This AI result is for reference only. The doctor&apos;s final
                  diagnosis and prescription remain the official clinical
                  record.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAiModal(null)}
                className={recordStyles.recordModalClose}
              >
                Close
              </button>
            </div>

            <div className={recordStyles.recordModalBody}>
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
                  <div className={recordStyles.recordModalContent}>
                    <div className={recordStyles.recordModalResultGrid}>
                      <div>
                        {analysisImage ? (
                          <img
                            src={analysisImage}
                            alt="Patient skin analysis"
                            className={recordStyles.recordModalImage}
                          />
                        ) : (
                          <div className={recordStyles.recordModalImagePlaceholder}>
                            No image attached
                          </div>
                        )}
                      </div>

                      <div className={recordStyles.recordModalSummaryGrid}>
                        <div className={recordStyles.softPanel}>
                          <div className={recordStyles.recordLabel}>AI Condition</div>
                          <div className={`${recordStyles.recordValue} ${recordStyles.recordValueStrong}`}>
                            {analysis.condition || "N/A"}
                          </div>
                        </div>

                        <div className={recordStyles.softPanel}>
                          <div className={recordStyles.recordLabel}>Confidence</div>
                          <div className={`${recordStyles.recordValue} ${recordStyles.recordValueStrong}`}>
                            {formatConfidence(analysis.confidence)}
                          </div>
                        </div>

                        <div className={recordStyles.softPanel}>
                          <div className={recordStyles.recordLabel}>AI Severity</div>
                          <div className={`${recordStyles.recordValue} ${recordStyles.recordValueStrong}`}>
                            {analysis.severity || "N/A"}
                          </div>
                        </div>

                        <div className={recordStyles.softPanel}>
                          <div className={recordStyles.recordLabel}>Generated</div>
                          <div className={`${recordStyles.recordValue} ${recordStyles.recordValueStrong}`}>
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

                        <div className={`${recordStyles.softPanel} ${sharedStyles.fullWidth}`}>
                          <div className={recordStyles.recordLabel}>Possible Conditions</div>
                          <div className={recordStyles.recordValue}>{possibleConditions}</div>
                        </div>

                        <div className={`${recordStyles.softPanel} ${sharedStyles.fullWidth}`}>
                          <div className={recordStyles.recordLabel}>Key Findings</div>
                          <div className={recordStyles.recordValue}>{keyFindings}</div>
                        </div>

                        <div className={`${recordStyles.softPanel} ${sharedStyles.fullWidth}`}>
                          <div className={recordStyles.recordLabel}>AI Recommendation</div>
                          <div className={recordStyles.recordValue}>{recommendation}</div>
                        </div>
                      </div>
                    </div>

                    {showTreatmentSuggestions && (
                      <div className={recordStyles.softPanel}>
                        <h3 className={recordStyles.recordSectionTitle}>
                          AI Treatment Suggestions
                        </h3>
                        <div className={recordStyles.recordValue}>{treatmentSuggestionsRaw}</div>
                      </div>
                    )}

                    <div className={recordStyles.recordSection}>
                      <h3 className={recordStyles.recordSectionTitle}>
                        AI Prescription Suggestions
                      </h3>

                      {aiPrescriptionItems.length === 0 ? (
                        <div className={recordStyles.recordValue}>
                          No AI prescription suggestions available.
                        </div>
                      ) : (
                        <div className={recordStyles.recordModalPrescriptionGrid}>
                          {aiPrescriptionItems.map((item, index) => (
                            <div
                              key={`${item.medication}-${index}`}
                              className={recordStyles.prescriptionCard}
                            >
                              <div
                                className={`${recordStyles.prescriptionMedication} ${recordStyles.prescriptionMedicationAccent}`}
                              >
                                {item.medication}
                              </div>

                              <div className={recordStyles.prescriptionDetails}>
                                <div className={recordStyles.prescriptionRowCompact}>
                                  <div className={recordStyles.recordLabel}>Usage</div>
                                  <div className={`${recordStyles.prescriptionText} ${recordStyles.prescriptionTextComfortable}`}>
                                    {item.usage}
                                  </div>
                                </div>

                                <div
                                  className={`${recordStyles.prescriptionRowCompact} ${recordStyles.prescriptionRowLast}`}
                                >
                                  <div className={recordStyles.recordLabel}>Reason</div>
                                  <div className={`${recordStyles.prescriptionText} ${recordStyles.prescriptionTextComfortable}`}>
                                    {item.reason}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className={recordStyles.softPanel}>
                      <div className={recordStyles.recordLabel}>AI Follow-up Suggestions</div>
                      <div className={recordStyles.recordValue}>{followUpSuggestions}</div>
                    </div>

                    <div className={recordStyles.softPanel}>
                      <div className={recordStyles.recordLabel}>AI Red Flags</div>
                      <div className={recordStyles.recordValue}>{redFlags}</div>
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

export default function DoctorPatientRecordsPage() {
  return (
    <Suspense
      fallback={
        <main className={recordStyles.pageFallback}>
          Loading patient records...
        </main>
      }
    >
      <DoctorPatientRecordsContent />
    </Suspense>
  );
}
