"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import styles from "@/app/styles/ai.module.css";
import { API_BASE_URL } from "@/lib/api";
import {
  analyzeAppointmentSkin,
  getAppointmentAnalyses,
  getAppointmentDiagnosisReport,
  getDoctorAppointments,
  getDoctorPatientHistory,
  getDoctorPatients,
  type Analysis,
  type Appointment,
  type DiagnosisReport,
  type DoctorPatientHistoryResponse,
  type DoctorPatientListItem,
} from "@/lib/doctor-api";

type WorkspaceStage = "scan" | "reports" | "history";

type DoctorAssessmentForm = {
  finalDiagnosis: string;
  severity: string;
  clinicalFindings: string;
  treatmentPlan: string;
  prescriptionMedication: string;
  prescriptionUsage: string;
  prescriptionReason: string;
  followUpPlan: string;
  redFlags: string;
  patientInstructions: string;
};

type PatientVisitHistoryRecord = {
  appointment: Appointment;
  analyses: Analysis[];
  report: DiagnosisReport | null;
  linked_analysis?: Analysis | null;
};

const emptyAssessmentForm: DoctorAssessmentForm = {
  finalDiagnosis: "",
  severity: "Needs Further Review",
  clinicalFindings: "",
  treatmentPlan: "",
  prescriptionMedication: "",
  prescriptionUsage: "",
  prescriptionReason: "",
  followUpPlan: "",
  redFlags: "",
  patientInstructions: "",
};

const sortAppointmentsDesc = (items: Appointment[]) => {
  return [...items].sort((a, b) => {
    const aDate = new Date(`${a.date}T${a.time || "00:00:00"}`).getTime();
    const bDate = new Date(`${b.date}T${b.time || "00:00:00"}`).getTime();

    return bDate - aDate;
  });
};

const getAppointmentDateTime = (appointment: Appointment) => {
  return new Date(`${appointment.date}T${appointment.time || "00:00:00"}`);
};

const isBlockedAppointmentStatus = (status?: string | null) => {
  const normalized = (status || "").trim().toLowerCase();

  return normalized === "declined" || normalized === "cancelled";
};

const isVisibleAiAppointment = (appointment: Appointment) => {
  return Boolean(appointment.patient_id) && !isBlockedAppointmentStatus(appointment.status);
};

const isAiAvailableForAppointment = (appointment: Appointment | null) => {
  if (!appointment) return false;

  const status = appointment.status?.trim().toLowerCase();

  if (status === "completed") return true;
  if (status !== "approved") return false;

  const appointmentDateTime = getAppointmentDateTime(appointment);
  const now = new Date();

  return appointmentDateTime <= now;
};

const formatAppointmentSchedule = (appointment: Appointment) => {
  const appointmentDateTime = getAppointmentDateTime(appointment);

  if (Number.isNaN(appointmentDateTime.getTime())) {
    return `${appointment.date} at ${appointment.time || "the scheduled time"}`;
  }

  return appointmentDateTime.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getAiUnavailableMessage = (appointment: Appointment | null) => {
  if (!appointment) {
    return "Please select a valid consultation before running an AI skin analysis.";
  }

  const status = appointment.status?.trim().toLowerCase();

  if (status === "pending") {
    return "This appointment is still pending approval. AI skin analysis will become available once the consultation is approved and the scheduled time has started.";
  }

  if (status === "declined" || status === "cancelled") {
    return "AI skin analysis is not available for declined or cancelled appointments.";
  }

  if (status === "approved" && !isAiAvailableForAppointment(appointment)) {
    return `This consultation is scheduled for ${formatAppointmentSchedule(
      appointment
    )}. AI skin analysis can only be used during or after the consultation, once the doctor has seen the patient's concern.`;
  }

  return "";
};


const buildEmptyPatientHistory = (
  patientItem: DoctorPatientListItem | null
): DoctorPatientHistoryResponse | null => {
  if (!patientItem) return null;

  return {
    patient: patientItem.patient,
    total_reports: patientItem.total_reports || 0,
    history: [],
  };
};

const buildPatientListFromAppointments = (
  reportPatients: DoctorPatientListItem[],
  appointments: Appointment[]
): DoctorPatientListItem[] => {
  const map = new Map<number, DoctorPatientListItem>();

  reportPatients.forEach((item) => {
    if (!item.patient?.id) return;

    map.set(item.patient.id, {
      ...item,
      latest_report: item.latest_report || null,
      latest_appointment: item.latest_appointment || null,
      total_reports: item.total_reports || 0,
    });
  });

  const validAppointments = appointments.filter(isVisibleAiAppointment);

  const sortedAppointments = sortAppointmentsDesc(validAppointments);

  sortedAppointments.forEach((appt) => {
    if (!appt.patient_id) return;

    const existing = map.get(appt.patient_id);

    if (!existing) {
      map.set(appt.patient_id, {
        patient: {
          id: appt.patient_id,
          name: appt.patient_name || "Unnamed patient",
          email: appt.patient_email || null,
        },
        latest_report: null,
        latest_appointment: appt,
        total_reports: 0,
      });

      return;
    }

    if (!existing.latest_appointment) {
      map.set(appt.patient_id, {
        ...existing,
        latest_appointment: appt,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const aDate = a.latest_appointment
      ? new Date(
          `${a.latest_appointment.date}T${
            a.latest_appointment.time || "00:00:00"
          }`
        ).getTime()
      : 0;

    const bDate = b.latest_appointment
      ? new Date(
          `${b.latest_appointment.date}T${
            b.latest_appointment.time || "00:00:00"
          }`
        ).getTime()
      : 0;

    return bDate - aDate;
  });
};

const pickBestTargetAppointment = (items: Appointment[]) => {
  const visibleItems = sortAppointmentsDesc(
    items.filter((item) => isVisibleAiAppointment(item))
  );

  if (visibleItems.length === 0) return null;

  const readyApproved = visibleItems.find(
    (item) => item.status === "Approved" && isAiAvailableForAppointment(item)
  );

  if (readyApproved) return readyApproved;

  const completed = visibleItems.find((item) => item.status === "Completed");

  if (completed) return completed;

  return visibleItems[0];
};

const buildImageUrl = (path?: string | null) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  return `${API_BASE_URL}${path}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const normalizeConfidence = (value?: number | null) => {
  if (typeof value !== "number") return null;

  return value <= 1 ? Math.round(value * 100) : Math.round(value);
};

const splitMultilineText = (value?: string | null) => {
  if (!value) return [];

  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^-\s*/, ""));
};

type ParsedPrescriptionItem = {
  medication: string;
  usage: string;
  reason: string;
};

const cleanPrescriptionText = (value?: string | null) => {
  return (value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
};

const normalizePrescriptionLine = (value: string) => {
  return value
    .replace(/^[-•]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
};

const splitPrescriptionList = (value: string) => {
  return value
    .split(/\n|;/)
    .map((item) => normalizePrescriptionLine(item))
    .filter(Boolean)
    .map((item) => stripPrescriptionLabel(item, "Medication"));
};

const stripPrescriptionLabel = (value: string, label: string) => {
  const expression = new RegExp(`^${label}:\\s*`, "i");
  return value.replace(expression, "").trim();
};

const getLabelIndex = (text: string, label: string) => {
  const match = text.match(new RegExp(`\\b${label}:\\s*`, "i"));
  return match?.index ?? -1;
};

const extractPrescriptionSection = (text: string, label: string) => {
  const labels = ["Medication", "Usage", "Reason"];
  const nextLabels = labels.filter(
    (item) => item.toLowerCase() !== label.toLowerCase()
  );
  const nextPattern = nextLabels.map((item) => `${item}:`).join("|");
  const expression = new RegExp(
    `${label}:\\s*([\\s\\S]*?)(?=\\s+(?:${nextPattern})|$)`,
    "i"
  );

  return text.match(expression)?.[1]?.trim() || "";
};

const parsePipePrescriptionLine = (
  rawLine: string,
  index: number
): ParsedPrescriptionItem => {
  const line = normalizePrescriptionLine(rawLine);
  const parts = line
    .split("|")
    .map((part) => normalizePrescriptionLine(part))
    .filter(Boolean);

  let medication = stripPrescriptionLabel(parts[0] || "", "Medication");
  let usage = "";
  let reason = "";

  parts.slice(1).forEach((part) => {
    if (/^usage:/i.test(part)) {
      usage = stripPrescriptionLabel(part, "Usage");
    } else if (/^reason:/i.test(part)) {
      reason = stripPrescriptionLabel(part, "Reason");
    }
  });

  if (!usage && !reason && line) {
    const usageIndex = getLabelIndex(line, "Usage");
    const reasonIndex = getLabelIndex(line, "Reason");
    const firstLabelIndex = [usageIndex, reasonIndex]
      .filter((value) => value >= 0)
      .sort((a, b) => a - b)[0];

    if (firstLabelIndex !== undefined) {
      medication = stripPrescriptionLabel(line.slice(0, firstLabelIndex), "Medication");

      if (usageIndex >= 0) {
        const usageStart =
          usageIndex + line.slice(usageIndex).match(/^Usage:\s*/i)![0].length;
        const usageEnd = reasonIndex > usageIndex ? reasonIndex : line.length;
        usage = line.slice(usageStart, usageEnd).trim();
      }

      if (reasonIndex >= 0) {
        const reasonStart =
          reasonIndex + line.slice(reasonIndex).match(/^Reason:\s*/i)![0].length;
        reason = line.slice(reasonStart).trim();
      }
    }
  }

  return {
    medication: medication || `Medication ${index + 1}`,
    usage,
    reason,
  };
};

const mapDetailsByMedication = (detailText: string, medications: string[]) => {
  const map = new Map<string, string>();
  const details = splitPrescriptionList(detailText);

  details.forEach((detail, index) => {
    const colonIndex = detail.indexOf(":");

    if (colonIndex > 0) {
      const possibleMedication = detail.slice(0, colonIndex).trim();
      const value = detail.slice(colonIndex + 1).trim();
      const matchedMedication = medications.find(
        (medication) =>
          medication.toLowerCase() === possibleMedication.toLowerCase()
      );

      if (matchedMedication && value) {
        map.set(matchedMedication, value);
        return;
      }
    }

    const medicationByOrder = medications[index];

    if (medicationByOrder && detail) {
      map.set(medicationByOrder, detail);
    }
  });

  return map;
};

const parsePrescriptionEntries = (
  value?: string | null
): ParsedPrescriptionItem[] => {
  const text = cleanPrescriptionText(value);

  if (!text) return [];

  const normalizedLines = text
    .split(/\n+/)
    .map((line) => normalizePrescriptionLine(line))
    .filter(Boolean);

  const looksLikeAiItemRows =
    normalizedLines.length > 0 &&
    normalizedLines.every(
      (line) =>
        line.includes("|") ||
        (!/^Medication:/i.test(line) &&
          (/\bUsage:/i.test(line) || /\bReason:/i.test(line)))
    );

  if (looksLikeAiItemRows) {
    return normalizedLines.map((line, index) =>
      parsePipePrescriptionLine(line, index)
    );
  }

  const medicationSection = extractPrescriptionSection(text, "Medication");
  const usageSection = extractPrescriptionSection(text, "Usage");
  const reasonSection = extractPrescriptionSection(text, "Reason");

  if (medicationSection || usageSection || reasonSection) {
    const medications = splitPrescriptionList(medicationSection || text);
    const usageMap = mapDetailsByMedication(usageSection, medications);
    const reasonMap = mapDetailsByMedication(reasonSection, medications);

    return medications.map((medication, index) => ({
      medication: medication || `Medication ${index + 1}`,
      usage:
        usageMap.get(medication) ||
        (medications.length === 1 ? usageSection : ""),
      reason:
        reasonMap.get(medication) ||
        (medications.length === 1 ? reasonSection : ""),
    }));
  }

  return normalizedLines.map((line, index) =>
    parsePipePrescriptionLine(line, index)
  );
};

const parsePrescriptionSuggestions = (value?: string | null) => {
  return parsePrescriptionEntries(value);
};

const buildPrescriptionText = (payload: DoctorAssessmentForm) => {
  const medication = payload.prescriptionMedication.trim();
  const usage = payload.prescriptionUsage.trim();
  const reason = payload.prescriptionReason.trim();

  return [
    medication ? `Medication: ${medication}` : "",
    usage ? `Usage: ${usage}` : "",
    reason ? `Reason: ${reason}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

const summarizePrescriptionItems = (items: ParsedPrescriptionItem[]) => {
  if (items.length === 0) return "—";

  return items
    .map((item) => {
      const parts = [item.medication];

      if (item.usage) parts.push(`Usage: ${item.usage}`);
      if (item.reason) parts.push(`Reason: ${item.reason}`);

      return parts.join(" | ");
    })
    .join("\n");
};

const getStatusBadgeClass = (status: string | undefined) => {
  switch ((status || "").trim()) {
    case "Reviewed":
    case "Completed":
      return `${styles.statusBadge} ${styles.badgeCompleted}`;
    case "Approved":
      return `${styles.statusBadge} ${styles.badgeApproved}`;
    case "Pending Review":
    case "Pending":
      return `${styles.statusBadge} ${styles.badgePending}`;
    case "Declined":
    case "Cancelled":
      return `${styles.statusBadge} ${styles.badgeUrgent}`;
    default:
      return `${styles.statusBadge} ${styles.badgePending}`;
  }
};

const saveDoctorAssessment = async (
  appointmentId: number,
  analysisId: number,
  payload: DoctorAssessmentForm
) => {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${API_BASE_URL}/doctor/appointments/${appointmentId}/complete-with-report`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        skin_analysis_id: analysisId,
        doctor_final_diagnosis: payload.finalDiagnosis,
        doctor_prescription: buildPrescriptionText(payload),
        // Save only the doctor's own notes here.
        // AI severity, red flags, and recommendations should stay in skin_analysis
        // and should only be viewed through the AI Result button.
        after_appointment_notes: payload.clinicalFindings.trim(),
        follow_up_plan: payload.followUpPlan,
        next_visit_date: null,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      errorText || "Failed to save doctor clinical assessment."
    );
  }

  return response.json().catch(() => null);
};

export default function DoctorAiAnalysisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [initialSelection] = useState(() => {
    const patientIdParam = searchParams.get("patient_id");
    const appointmentIdParam = searchParams.get("appointment_id");

    const patientId = patientIdParam ? Number(patientIdParam) : null;
    const appointmentId = appointmentIdParam ? Number(appointmentIdParam) : null;

    return {
      patientId: patientId && !Number.isNaN(patientId) ? patientId : null,
      appointmentId:
        appointmentId && !Number.isNaN(appointmentId) ? appointmentId : null,
    };
  });

  const [patients, setPatients] = useState<DoctorPatientListItem[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);

  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(
    null
  );

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    number | null
  >(null);

  const [patientHistory, setPatientHistory] =
    useState<DoctorPatientHistoryResponse | null>(null);

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [patientVisitRecords, setPatientVisitRecords] = useState<
    PatientVisitHistoryRecord[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [loadingPatientHistory, setLoadingPatientHistory] = useState(false);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);
  const [loadingVisitRecords, setLoadingVisitRecords] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeStage, setActiveStage] = useState<WorkspaceStage>("scan");
  const [selectedAiModal, setSelectedAiModal] = useState<{
    title: string;
    analysis: Analysis;
  } | null>(null);

  const [assessmentForm, setAssessmentForm] =
    useState<DoctorAssessmentForm>(emptyAssessmentForm);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "doctor") {
      router.push("/");
      return;
    }

    const loadBaseData = async () => {
      try {
        setLoading(true);

        const [patientsData, appointmentsData] = await Promise.all([
          getDoctorPatients(),
          getDoctorAppointments("All"),
        ]);

const reportPatientList = Array.isArray(patientsData) ? patientsData : [];
const appointmentList = Array.isArray(appointmentsData)
  ? appointmentsData
  : [];

const patientList = buildPatientListFromAppointments(
  reportPatientList,
  appointmentList
);

setPatients(patientList);
setAllAppointments(appointmentList);

        const nextPatientId = initialSelection.patientId;

        if (
          !nextPatientId ||
          !patientList.some((item) => item.patient.id === nextPatientId)
        ) {
          setSelectedPatientId(null);
          setSelectedAppointmentId(null);
          return;
        }

        setSelectedPatientId(nextPatientId);

        const matchingAppointments = appointmentList.filter(
          (appt) =>
            appt.patient_id === nextPatientId &&
            isVisibleAiAppointment(appt)
        );

        if (
          initialSelection.appointmentId &&
          matchingAppointments.some(
            (appt) => appt.id === initialSelection.appointmentId
          )
        ) {
          setSelectedAppointmentId(initialSelection.appointmentId);
          return;
        }

        const best = pickBestTargetAppointment(matchingAppointments);
        setSelectedAppointmentId(best ? best.id : null);
      } catch (error) {
        console.error("Failed to load AI analysis base data:", error);
        alert(
          error instanceof Error
            ? error.message
            : "Failed to load AI analysis base data."
        );
      } finally {
        setLoading(false);
      }
    };

    loadBaseData();
  }, [router, initialSelection]);

  useEffect(() => {
    if (!selectedPatientId) {
      setPatientHistory(null);
      return;
    }

    const selectedPatientFallback =
      patients.find((item) => item.patient.id === selectedPatientId) || null;

    const emptyHistory = buildEmptyPatientHistory(selectedPatientFallback);

    const loadPatientHistory = async () => {
      try {
        setLoadingPatientHistory(true);

        const data = await getDoctorPatientHistory(selectedPatientId);
        setPatientHistory(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";

        // Patient not found usually means there is no saved final doctor report yet.
        // Keep the page usable and let the all-visits history loader handle AI-only cases.
        if (message && message !== "Patient not found") {
          console.warn("Patient history unavailable:", message);
        }

        setPatientHistory(emptyHistory);
      } finally {
        setLoadingPatientHistory(false);
      }
    };

    loadPatientHistory();
  }, [selectedPatientId, patients]);

  useEffect(() => {
    if (!selectedAppointmentId) {
      setAnalyses([]);
      return;
    }

    const loadAppointmentAnalyses = async () => {
      try {
        setLoadingAnalyses(true);

        const data = await getAppointmentAnalyses(selectedAppointmentId);
        setAnalyses(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load appointment analyses:", error);
        alert(
          error instanceof Error
            ? error.message
            : "Failed to load appointment analyses."
        );
        setAnalyses([]);
      } finally {
        setLoadingAnalyses(false);
      }
    };

    loadAppointmentAnalyses();
  }, [selectedAppointmentId]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (selectedPatientId) {
      params.set("patient_id", String(selectedPatientId));
    }

    if (selectedAppointmentId) {
      params.set("appointment_id", String(selectedAppointmentId));
    }

    const query = params.toString();

    router.replace(
      query
        ? `/pages/doctor/ai-analysis?${query}`
        : `/pages/doctor/ai-analysis`
    );
  }, [router, selectedPatientId, selectedAppointmentId]);

  const patientAppointmentsMap = useMemo(() => {
    const map = new Map<number, Appointment[]>();

    allAppointments.forEach((appt) => {
      if (!appt.patient_id) return;

      const current = map.get(appt.patient_id) || [];
      current.push(appt);
      map.set(appt.patient_id, current);
    });

    map.forEach((value, key) => {
      map.set(key, sortAppointmentsDesc(value));
    });

    return map;
  }, [allAppointments]);

  const filteredPatients = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    if (!keyword) return patients;

    return patients.filter((item) => {
      const name = item.patient.name?.toLowerCase() || "";
      const email = item.patient.email?.toLowerCase() || "";

      return name.includes(keyword) || email.includes(keyword);
    });
  }, [patients, searchTerm]);

  const selectedPatient = useMemo(() => {
    return patients.find((item) => item.patient.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);

  const selectedPatientEmptyHistory = useMemo(() => {
    return buildEmptyPatientHistory(selectedPatient);
  }, [selectedPatient]);

  const selectedPatientAllVisits = useMemo(() => {
    if (!selectedPatientId) return [];

    return patientAppointmentsMap.get(selectedPatientId) || [];
  }, [patientAppointmentsMap, selectedPatientId]);

  const selectedPatientValidVisits = useMemo(() => {
    return selectedPatientAllVisits.filter(isVisibleAiAppointment);
  }, [selectedPatientAllVisits]);

  useEffect(() => {
    if (!selectedPatientId) {
      setPatientVisitRecords([]);
      return;
    }

    const patientVisits = (patientAppointmentsMap.get(selectedPatientId) || [])
      .filter(isVisibleAiAppointment);

    if (patientVisits.length === 0) {
      setPatientVisitRecords([]);
      return;
    }

    let cancelled = false;

    const loadPatientVisitRecords = async () => {
      try {
        setLoadingVisitRecords(true);

        const records = await Promise.all(
          patientVisits.map(async (appointment) => {
            const [analysisResult, reportResult] = await Promise.allSettled([
              getAppointmentAnalyses(appointment.id),
              getAppointmentDiagnosisReport(appointment.id),
            ]);

            const appointmentAnalyses =
              analysisResult.status === "fulfilled" &&
              Array.isArray(analysisResult.value)
                ? analysisResult.value
                : [];

            const reportResponse =
              reportResult.status === "fulfilled" ? reportResult.value : null;

            return {
              appointment,
              analyses: appointmentAnalyses,
              report: reportResponse?.report || null,
              linked_analysis: reportResponse?.linked_analysis || null,
            };
          })
        );

        if (!cancelled) {
          setPatientVisitRecords(
            records.sort((a, b) => {
              const aDate = getAppointmentDateTime(a.appointment).getTime();
              const bDate = getAppointmentDateTime(b.appointment).getTime();

              return bDate - aDate;
            })
          );
        }
      } catch (error) {
        console.warn("Failed to load full patient visit history:", error);

        if (!cancelled) {
          setPatientVisitRecords([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingVisitRecords(false);
        }
      }
    };

    loadPatientVisitRecords();

    return () => {
      cancelled = true;
    };
  }, [selectedPatientId, patientAppointmentsMap]);


  const targetAppointment = useMemo(() => {
    return (
      selectedPatientValidVisits.find(
        (appt) => appt.id === selectedAppointmentId
      ) || null
    );
  }, [selectedPatientValidVisits, selectedAppointmentId]);

  const sortedAnalyses = useMemo(() => {
    return [...analyses].sort((a, b) => {
      const aDate = new Date(a.created_at || "").getTime();
      const bDate = new Date(b.created_at || "").getTime();

      return bDate - aDate;
    });
  }, [analyses]);

  const latestAnalysis = useMemo(() => {
    return sortedAnalyses.length > 0 ? sortedAnalyses[0] : null;
  }, [sortedAnalyses]);

  const sortedCompletedReports = useMemo(() => {
    if (!patientHistory) return [];

    return [...patientHistory.history].sort((a, b) => {
      const aDate = new Date(
        `${a.appointment?.date || ""}T${a.appointment?.time || "00:00:00"}`
      ).getTime();

      const bDate = new Date(
        `${b.appointment?.date || ""}T${b.appointment?.time || "00:00:00"}`
      ).getTime();

      return bDate - aDate;
    });
  }, [patientHistory]);

  const selectedVisitReport = useMemo(() => {
    if (!selectedAppointmentId) return null;

    return (
      sortedCompletedReports.find(
        (item) => item.appointment?.id === selectedAppointmentId
      ) || null
    );
  }, [sortedCompletedReports, selectedAppointmentId]);

  const sortedPatientVisitHistory = useMemo(() => {
    const reportMap = new Map<number, DiagnosisReport>();
    const linkedAnalysisMap = new Map<number, Analysis>();

    patientHistory?.history?.forEach((item) => {
      if (item.appointment?.id && item.report) {
        reportMap.set(item.appointment.id, item.report);
      }

      if (item.appointment?.id && item.linked_analysis) {
        linkedAnalysisMap.set(item.appointment.id, item.linked_analysis);
      }
    });

    return patientVisitRecords
      .map((record) => {
        const sortedRecordAnalyses = [...record.analyses].sort((a, b) => {
          const aDate = new Date(a.created_at || "").getTime();
          const bDate = new Date(b.created_at || "").getTime();

          return bDate - aDate;
        });

        const historyReport = reportMap.get(record.appointment.id) || null;
        const historyLinkedAnalysis =
          linkedAnalysisMap.get(record.appointment.id) || null;

        const report = record.report || historyReport || null;

        const linkedAnalysis =
          record.linked_analysis ||
          historyLinkedAnalysis ||
          sortedRecordAnalyses.find(
            (analysis) => report?.skin_analysis_id === analysis.id
          ) ||
          sortedRecordAnalyses[0] ||
          null;

        return {
          ...record,
          report,
          linkedAnalysis,
          sortedAnalyses: sortedRecordAnalyses,
        };
      })
      .filter((record) => record.report || record.linkedAnalysis)
      .sort((a, b) => {
        const aDate = getAppointmentDateTime(a.appointment).getTime();
        const bDate = getAppointmentDateTime(b.appointment).getTime();

        return bDate - aDate;
      });
  }, [patientVisitRecords, patientHistory]);

  const isCompletedTarget = targetAppointment?.status === "Completed";
  const isApprovedTarget = targetAppointment?.status === "Approved";
  const aiAvailableForTarget = isAiAvailableForAppointment(targetAppointment);
  const aiUnavailableMessage = getAiUnavailableMessage(targetAppointment);

  const resetWorkspaceDrafts = () => {
    setSelectedFile(null);
    setAssessmentForm(emptyAssessmentForm);
  };

  const updateAssessmentField = (
    field: keyof DoctorAssessmentForm,
    value: string
  ) => {
    setAssessmentForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const openAiResultModal = (title: string, analysis: Analysis) => {
    setSelectedAiModal({ title, analysis });
  };

  const closeAiResultModal = () => {
    setSelectedAiModal(null);
  };

  const selectPatient = (patientId: number) => {
    setSelectedPatientId(patientId);
    setActiveStage("scan");
    resetWorkspaceDrafts();
    setSelectedAiModal(null);

    const matchingAppointments = (
      patientAppointmentsMap.get(patientId) || []
    ).filter(isVisibleAiAppointment);

    const best = pickBestTargetAppointment(matchingAppointments);
    setSelectedAppointmentId(best ? best.id : null);
  };

  const changePatient = () => {
    setSelectedPatientId(null);
    setSelectedAppointmentId(null);
    setActiveStage("scan");
    resetWorkspaceDrafts();
    setSelectedAiModal(null);

    router.replace("/pages/doctor/ai-analysis");
  };

  const handleAppointmentChange = (value: string) => {
    const nextAppointmentId = value ? Number(value) : null;

    setSelectedAppointmentId(nextAppointmentId);
    setActiveStage("scan");
    resetWorkspaceDrafts();
  };

  const handleUploadAnalysis = async () => {
    try {
      if (!selectedAppointmentId) {
        alert("Please select a target visit first.");
        return;
      }

      if (!targetAppointment || !aiAvailableForTarget) {
        alert(aiUnavailableMessage || "AI skin analysis is not available for this visit yet.");
        return;
      }

      if (!selectedFile) {
        alert("Please select a skin image first.");
        return;
      }

      setUploading(true);

      await analyzeAppointmentSkin(selectedAppointmentId, selectedFile, "");

      setSelectedFile(null);

      const analysisData = await getAppointmentAnalyses(selectedAppointmentId);
      setAnalyses(Array.isArray(analysisData) ? analysisData : []);

      if (selectedPatientId) {
        if (selectedPatient?.total_reports) {
          try {
            const historyData = await getDoctorPatientHistory(selectedPatientId);
            setPatientHistory(historyData);
          } catch {
            setPatientHistory(selectedPatientEmptyHistory);
          }
        } else {
          setPatientHistory(selectedPatientEmptyHistory);
        }
      }

      setActiveStage("scan");
      alert(
        "AI analysis completed. The result is now pending until the doctor completes the assessment."
      );
    } catch (error) {
      console.error("Failed to analyze image:", error);
      alert(error instanceof Error ? error.message : "Failed to analyze image.");
    } finally {
      setUploading(false);
    }
  };

  const getAiSuggestionForField = (field: keyof DoctorAssessmentForm) => {
    if (!latestAnalysis) return "";

    const prescriptions = parsePrescriptionSuggestions(
      latestAnalysis.prescription_suggestions
    );

const allMedication = prescriptions
  .map((item) => item.medication)
  .filter(Boolean)
  .join("; ");

const allUsage = prescriptions
  .map((item) => (item.usage ? `${item.medication}: ${item.usage}` : ""))
  .filter(Boolean)
  .join("; ");

const allReason = prescriptions
  .map((item) => (item.reason ? `${item.medication}: ${item.reason}` : ""))
  .filter(Boolean)
  .join("\n");

    switch (field) {
      case "finalDiagnosis":
        return (
          latestAnalysis.condition ||
          latestAnalysis.possible_conditions ||
          ""
        );

      case "severity":
        return latestAnalysis.severity || "";

      case "clinicalFindings":
        return latestAnalysis.key_findings || "";

      case "prescriptionMedication":
        return allMedication;

      case "prescriptionUsage":
        return allUsage;

      case "prescriptionReason":
        return allReason;

      case "followUpPlan":
        return latestAnalysis.follow_up_suggestions || "";

      case "redFlags":
        return latestAnalysis.red_flags || "";

      case "patientInstructions":
        return latestAnalysis.recommendation || "";

      default:
        return "";
    }
  };

  const applyAiSuggestionForField = (field: keyof DoctorAssessmentForm) => {
    const suggestion = getAiSuggestionForField(field);

    if (!suggestion.trim()) {
      alert("No AI suggestion is available for this field.");
      return;
    }

    updateAssessmentField(field, suggestion);
  };

  const renderUseAiSuggestionButton = (field: keyof DoctorAssessmentForm) => {
    const suggestion = getAiSuggestionForField(field);

    return (
      <button
        type="button"
        className={styles.aiSuggestionButton}
        onClick={() => applyAiSuggestionForField(field)}
        disabled={!suggestion.trim()}
      >
        Use AI Suggestion
      </button>
    );
  };

  const renderAiSuggestionPreview = (
    field: keyof DoctorAssessmentForm,
    title: string
  ) => {
    const suggestion = getAiSuggestionForField(field);

    if (!suggestion.trim()) return null;

    return (
      <div className={styles.aiSuggestionPreview}>
        <span>{title}</span>
        <p>{suggestion}</p>
      </div>
    );
  };

  const handleSaveDoctorAssessment = async () => {
    try {
      if (!selectedAppointmentId) {
        alert("Please select a target visit first.");
        return;
      }

      if (!latestAnalysis) {
        alert("Please run an AI analysis before saving the doctor assessment.");
        return;
      }

      if (!assessmentForm.finalDiagnosis.trim()) {
        alert("Please enter the doctor final diagnosis.");
        return;
      }

      setSavingAssessment(true);

      await saveDoctorAssessment(
        selectedAppointmentId,
        latestAnalysis.id,
        assessmentForm
      );

      if (selectedPatientId) {
        try {
          const historyData = await getDoctorPatientHistory(selectedPatientId);
          setPatientHistory(historyData);
        } catch {
          setPatientHistory(selectedPatientEmptyHistory);
        }
      }

      setActiveStage("history");
      alert(
        "Doctor assessment saved successfully. The completed record is now available in History."
      );
    } catch (error) {
      console.error("Failed to save doctor assessment:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to save doctor assessment."
      );
    } finally {
      setSavingAssessment(false);
    }
  };

  const openPatientRecord = () => {
    if (!selectedPatientId) return;

    router.push(`/pages/doctor/patient-records?patient_id=${selectedPatientId}`);
  };

  const getPatientListMeta = (patientId: number) => {
    const visits = patientAppointmentsMap.get(patientId) || [];
    const latestVisit = visits.find((appt) => isVisibleAiAppointment(appt)) || visits[0];

    if (!latestVisit) {
      return {
        label: "No Visits",
        badgeClass: `${styles.statusBadge} ${styles.badgePending}`,
        latestVisitText: "No visit yet",
      };
    }

    if (latestVisit.status === "Completed") {
      return {
        label: "Completed",
        badgeClass: `${styles.statusBadge} ${styles.badgeCompleted}`,
        latestVisitText: `${latestVisit.date} • ${latestVisit.services}`,
      };
    }

    if (latestVisit.status === "Approved") {
      const isAvailable = isAiAvailableForAppointment(latestVisit);

      return {
        label: isAvailable ? "Ready for Review" : "Scheduled",
        badgeClass: isAvailable
          ? `${styles.statusBadge} ${styles.badgeApproved}`
          : `${styles.statusBadge} ${styles.badgePending}`,
        latestVisitText: `${latestVisit.date} • ${latestVisit.services}`,
      };
    }

    if (latestVisit.status === "Pending") {
      return {
        label: "Pending Approval",
        badgeClass: `${styles.statusBadge} ${styles.badgePending}`,
        latestVisitText: `${latestVisit.date} • ${latestVisit.services}`,
      };
    }

    return {
      label: latestVisit.status || "Not Available",
      badgeClass: getStatusBadgeClass(latestVisit.status),
      latestVisitText: `${latestVisit.date} • ${latestVisit.services}`,
    };
  };

  const renderAiReadOnlyResult = () => {
    if (loadingAnalyses) {
      return <div className={styles.emptyState}>Loading AI results...</div>;
    }

    if (!latestAnalysis) {
      return (
        <div className={styles.emptyState}>
          No AI result yet. Upload a skin image to generate the first analysis.
        </div>
      );
    }

    const confidenceValue = normalizeConfidence(latestAnalysis.confidence);

    const prescriptionItems = parsePrescriptionSuggestions(
      latestAnalysis.prescription_suggestions
    );

    const followUpItems = splitMultilineText(latestAnalysis.follow_up_suggestions);
    const redFlagItems = splitMultilineText(latestAnalysis.red_flags);

    return (
      <div className={styles.aiResultCard}>
        <div className={styles.aiResultHeader}>
          <div>
            <p className={styles.eyebrow}>AI Generated Result</p>
            <h3 className={styles.resultTitle}>
              {latestAnalysis.condition || "Unknown condition"}
            </h3>
            <p className={styles.resultMeta}>
              Generated {formatDateTime(latestAnalysis.created_at)}
            </p>
          </div>

          <div className={styles.resultBadgeStack}>
            <span className={styles.aiOnlyBadge}>Read-only AI output</span>
            <span className={styles.confidenceBadge}>
              Confidence: {confidenceValue !== null ? `${confidenceValue}%` : "—"}
            </span>
          </div>
        </div>

        <div className={styles.aiResultGrid}>
          <div className={styles.imagePanel}>
            {latestAnalysis.image_path ? (
              <img
                src={buildImageUrl(latestAnalysis.image_path)}
                alt="AI skin analysis result"
                className={styles.analysisImage}
              />
            ) : (
              <div className={styles.imagePlaceholder}>No image available</div>
            )}
          </div>

          <div className={styles.aiSummaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.infoLabel}>Possible Condition</span>
              <strong>{latestAnalysis.possible_conditions || "—"}</strong>
            </div>

            <div className={styles.summaryCard}>
              <span className={styles.infoLabel}>AI Severity</span>
              <strong>{latestAnalysis.severity || "—"}</strong>
            </div>

            <div className={styles.summaryCardWide}>
              <span className={styles.infoLabel}>Key Findings</span>
              <p>{latestAnalysis.key_findings || "No findings available."}</p>
            </div>

            <div className={styles.summaryCardWide}>
              <span className={styles.infoLabel}>AI Recommendation</span>
              <p>
                {latestAnalysis.recommendation ||
                  "Further clinical review is recommended."}
              </p>
            </div>
          </div>
        </div>

        <div className={styles.detailSectionGrid}>
          <section className={styles.detailBlock}>
            <div className={styles.blockHeader}>
              <h4>Prescription Suggestions</h4>
              <p>Medication, usage, and reason are separated for review.</p>
            </div>

            {prescriptionItems.length === 0 ? (
              <div className={styles.emptyStateSmall}>
                No prescription suggestions available.
              </div>
            ) : (
              <div className={styles.medicationStack}>
                {prescriptionItems.map((item, index) => (
                  <div
                    key={`${item.medication}-${index}`}
                    className={styles.medicationCard}
                  >
                    <strong>{item.medication}</strong>

                    <div className={styles.medicationRow}>
                      <span>Usage</span>
                      <p>{item.usage || "—"}</p>
                    </div>

                    <div className={styles.medicationRow}>
                      <span>Reason</span>
                      <p>{item.reason || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={styles.detailBlock}>
            <div className={styles.blockHeader}>
              <h4>Follow-up Suggestions</h4>
              <p>For doctor review before including in the final report.</p>
            </div>

            {followUpItems.length === 0 ? (
              <div className={styles.emptyStateSmall}>
                No follow-up suggestions available.
              </div>
            ) : (
              <div className={styles.softList}>
                {followUpItems.map((item, index) => (
                  <div key={`${item}-${index}`} className={styles.softListItem}>
                    {item}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={`${styles.detailBlock} ${styles.warningBlock}`}>
            <div className={styles.blockHeader}>
              <h4>Red Flags</h4>
              <p>Items that need extra attention during clinical review.</p>
            </div>

            {redFlagItems.length === 0 ? (
              <div className={styles.emptyStateSmall}>No red flags noted.</div>
            ) : (
              <div className={styles.warningList}>
                {redFlagItems.map((item, index) => (
                  <div key={`${item}-${index}`} className={styles.warningItem}>
                    {item}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  };

  const renderDoctorAssessmentForm = () => {
    if (!latestAnalysis || selectedVisitReport) {
      return null;
    }

    return (
      <section className={styles.workflowCard}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.eyebrow}>Doctor Assessment</p>
            <h2>Complete Doctor Assessment</h2>
            <p>
              Review the AI result above, then complete the doctor-confirmed
              diagnosis, prescription, follow-up plan, red flags, and patient
              instructions.
            </p>
          </div>
        </div>

        <div className={styles.assessmentForm}>
          <div className={styles.formGroup}>
            <div className={styles.fieldHeader}>
              <label htmlFor="finalDiagnosis">Final Diagnosis</label>
              {renderUseAiSuggestionButton("finalDiagnosis")}
            </div>

            {renderAiSuggestionPreview(
              "finalDiagnosis",
              "AI Suggested Diagnosis"
            )}

            <input
              id="finalDiagnosis"
              value={assessmentForm.finalDiagnosis}
              onChange={(e) =>
                updateAssessmentField("finalDiagnosis", e.target.value)
              }
              placeholder="Enter doctor-confirmed diagnosis"
            />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.fieldHeader}>
              <label htmlFor="severity">Doctor Severity Assessment</label>
              {renderUseAiSuggestionButton("severity")}
            </div>

            {renderAiSuggestionPreview("severity", "AI Suggested Severity")}

            <select
              id="severity"
              value={assessmentForm.severity}
              onChange={(e) => updateAssessmentField("severity", e.target.value)}
            >
              <option value="Mild">Mild</option>
              <option value="Moderate">Moderate</option>
              <option value="Severe">Severe</option>
              <option value="Needs Further Review">Needs Further Review</option>
            </select>
          </div>

          <div className={styles.formGroupFull}>
            <div className={styles.fieldHeader}>
              <label htmlFor="clinicalFindings">Doctor Notes / Clinical Findings</label>
              {renderUseAiSuggestionButton("clinicalFindings")}
            </div>

            {renderAiSuggestionPreview(
              "clinicalFindings",
              "AI Suggested Clinical Findings"
            )}

            <textarea
              id="clinicalFindings"
              value={assessmentForm.clinicalFindings}
              onChange={(e) =>
                updateAssessmentField("clinicalFindings", e.target.value)
              }
              placeholder="Enter the doctor's own clinical notes for this visit"
            />
          </div>

          <div className={styles.prescriptionBox}>
            <div className={styles.prescriptionHeader}>
              <h3>Prescription</h3>
              <p>
                Review each AI suggestion before applying it to the final
                prescription.
              </p>
            </div>

<div className={styles.formGroup}>
  <div className={styles.fieldHeader}>
    <label htmlFor="prescriptionMedication">Medication</label>
    {renderUseAiSuggestionButton("prescriptionMedication")}
  </div>

  {renderAiSuggestionPreview(
    "prescriptionMedication",
    "AI Suggested Medication"
  )}

  <input
    id="prescriptionMedication"
    type="text"
    value={assessmentForm.prescriptionMedication}
    onChange={(e) =>
      updateAssessmentField("prescriptionMedication", e.target.value)
    }
    placeholder="Medication name"
  />
</div>

<div className={styles.formGroup}>
  <div className={styles.fieldHeader}>
    <label htmlFor="prescriptionUsage">Usage</label>
    {renderUseAiSuggestionButton("prescriptionUsage")}
  </div>

  {renderAiSuggestionPreview(
    "prescriptionUsage",
    "AI Suggested Usage"
  )}

  <textarea
    id="prescriptionUsage"
    value={assessmentForm.prescriptionUsage}
    onChange={(e) =>
      updateAssessmentField("prescriptionUsage", e.target.value)
    }
    placeholder="Example: Apply a thin layer to the affected area twice daily"
  />
</div>

            <div className={styles.formGroupFull}>
              <div className={styles.fieldHeader}>
                <label htmlFor="prescriptionReason">Reason</label>
                {renderUseAiSuggestionButton("prescriptionReason")}
              </div>

              {renderAiSuggestionPreview(
                "prescriptionReason",
                "AI Suggested Reason"
              )}

              <textarea
                id="prescriptionReason"
                value={assessmentForm.prescriptionReason}
                onChange={(e) =>
                  updateAssessmentField("prescriptionReason", e.target.value)
                }
                placeholder="Why this prescription is recommended"
              />
            </div>
          </div>

          <div className={styles.formGroupFull}>
            <div className={styles.fieldHeader}>
              <label htmlFor="followUpPlan">Follow-up Plan</label>
              {renderUseAiSuggestionButton("followUpPlan")}
            </div>

            {renderAiSuggestionPreview(
              "followUpPlan",
              "AI Suggested Follow-up Plan"
            )}

            <textarea
              id="followUpPlan"
              value={assessmentForm.followUpPlan}
              onChange={(e) =>
                updateAssessmentField("followUpPlan", e.target.value)
              }
              placeholder="Example: Review in 1 to 2 weeks if symptoms persist"
            />
          </div>

          <div className={styles.formGroupFull}>
            <div className={styles.fieldHeader}>
              <label htmlFor="redFlags">Red Flags Observed</label>
              {renderUseAiSuggestionButton("redFlags")}
            </div>

            {renderAiSuggestionPreview("redFlags", "AI Suggested Red Flags")}

            <textarea
              id="redFlags"
              value={assessmentForm.redFlags}
              onChange={(e) => updateAssessmentField("redFlags", e.target.value)}
              placeholder="List warning signs or concerns"
            />
          </div>

          <div className={styles.formGroupFull}>
            <div className={styles.fieldHeader}>
              <label htmlFor="patientInstructions">Patient Instructions</label>
              {renderUseAiSuggestionButton("patientInstructions")}
            </div>

            {renderAiSuggestionPreview(
              "patientInstructions",
              "AI Suggested Patient Instructions"
            )}

            <textarea
              id="patientInstructions"
              value={assessmentForm.patientInstructions}
              onChange={(e) =>
                updateAssessmentField("patientInstructions", e.target.value)
              }
              placeholder="Instructions that may be shown to the patient"
            />
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleSaveDoctorAssessment}
              disabled={savingAssessment || isCompletedTarget}
            >
              {savingAssessment ? "Saving assessment..." : "Save Doctor Assessment"}
            </button>
          </div>
        </div>
      </section>
    );
  };

const renderScanStage = () => {
  if (loadingPatientHistory && isCompletedTarget) {
    return (
      <section className={styles.workflowCard}>
        <div className={styles.emptyState}>Checking completed case...</div>
      </section>
    );
  }

if (selectedVisitReport || isCompletedTarget) {
  return (
    <div className={styles.scanStack}>
      <section className={styles.workflowCard}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.eyebrow}>Completed Case</p>
            <h2>This Consultation Is Already Completed</h2>
            <p>
              The AI analysis and doctor assessment for this consultation have
              already been saved. Please review the completed record in History.
            </p>
          </div>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setActiveStage("history")}
          >
            View in History
          </button>
        </div>
      </section>
    </div>
  );
}

  return (
    <div className={styles.scanStack}>
      <div className={styles.scanUploadCenter}>
        <section className={styles.workflowCard}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.eyebrow}>Step 1</p>
              <h2>Upload Skin Image</h2>
              <p>
                Upload the patient image for the selected approved visit. The AI
                result will appear below after processing.
              </p>
            </div>
          </div>

          {!targetAppointment ? (
            <div className={styles.emptyState}>
              No consultation is available for this patient yet.
            </div>
          ) : !aiAvailableForTarget || !isApprovedTarget ? (
            <div className={styles.emptyState}>
              <strong>AI Skin Analysis Unavailable</strong>
              <p>{aiUnavailableMessage}</p>
            </div>
          ) : (
            <>
              <label className={styles.dropZone} htmlFor="skin_file">
                <input
                  id="skin_file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                  }}
                />

                <span className={styles.dropIcon}>＋</span>
                <strong>
                  {selectedFile
                    ? selectedFile.name
                    : "Choose or drop skin image"}
                </strong>
                <small>Accepted formats: JPG, PNG, WEBP</small>
              </label>

              <button
                className={styles.primaryButton}
                onClick={handleUploadAnalysis}
                disabled={
                  uploading ||
                  !selectedFile ||
                  !isApprovedTarget ||
                  !aiAvailableForTarget
                }
              >
                {uploading ? "Analyzing image..." : "Run AI Analysis"}
              </button>
            </>
          )}
        </section>
      </div>

      <section className={styles.workflowCard}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.eyebrow}>Pending Case</p>
            <h2>Latest AI Result</h2>
            <p>
              This AI-generated result stays here until the doctor completes the
              assessment below.
            </p>
          </div>
        </div>

        {renderAiReadOnlyResult()}
      </section>

      {renderDoctorAssessmentForm()}
    </div>
  );
};

  const renderReportsStage = () => {
    if (loadingPatientHistory) {
      return <div className={styles.emptyState}>Loading completed reports...</div>;
    }

    if (sortedCompletedReports.length === 0) {
      return (
        <section className={styles.workflowCard}>
          <div className={styles.emptyState}>
            No completed reports found for this patient yet.
          </div>
        </section>
      );
    }

    return (
      <section className={styles.workflowCard}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.eyebrow}>Patient Record</p>
            <h2>All Completed Reports</h2>
            <p>Review the patient’s completed diagnosis history.</p>
          </div>
        </div>

        <div className={styles.reportGrid}>
          {sortedCompletedReports.map((item) => (
            <article key={item.report.id} className={styles.historyCard}>
              <div className={styles.historyHeader}>
                <div>
                  <strong>
                    {item.appointment?.date || "Unknown date"} •{" "}
                    {item.appointment?.services || "Consultation"}
                  </strong>
                  <span>Doctor: {item.doctor?.name || "Unknown"}</span>
                </div>

                <span className={`${styles.statusBadge} ${styles.badgeCompleted}`}>
                  Completed
                </span>
              </div>

              <div className={styles.historyBody}>
                <p>
                  <b>Diagnosis:</b>{" "}
                  {item.report.doctor_final_diagnosis || "—"}
                </p>

                <p>
                  <b>Prescription:</b>{" "}
                  {summarizePrescriptionItems(
                    parsePrescriptionEntries(item.report.doctor_prescription)
                  )}
                </p>

                <p>
                  <b>Follow-up:</b> {item.report.follow_up_plan || "—"}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  };



const looksLikeAiGeneratedDoctorNote = (value?: string | null) => {
  const text = (value || "").trim().toLowerCase();

  if (!text) return false;

  const aiMarkers = [
    "severity:",
    "red flags:",
    "patient instructions:",
    "ai recommendation",
    "needs doctor review",
    "possible conditions",
  ];

  return aiMarkers.some((marker) => text.includes(marker));
};

const getDoctorOnlyNote = (value?: string | null) => {
  const text = (value || "").trim();

  if (!text) return "—";

  // Some older test records saved AI-style text in after_appointment_notes.
  // Keep the History card doctor-first by not displaying AI content as doctor notes.
  if (looksLikeAiGeneratedDoctorNote(text)) {
    return "No separate doctor notes were saved for this visit.";
  }

  return text;
};

const renderAiResultPanel = (
  linkedAnalysis: Analysis | null | undefined,
  confidenceValue: number | null
) => {
  if (!linkedAnalysis) {
    return (
      <div className={styles.emptyStateSmall}>
        No linked AI result was saved for this visit.
      </div>
    );
  }

  const prescriptionItems = parsePrescriptionSuggestions(
    linkedAnalysis.prescription_suggestions
  );
  const followUpItems = splitMultilineText(linkedAnalysis.follow_up_suggestions);
  const redFlagItems = splitMultilineText(linkedAnalysis.red_flags);

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: linkedAnalysis.image_path
            ? "minmax(260px, 380px) 1fr"
            : "1fr",
          gap: "18px",
          alignItems: "start",
        }}
      >
        {linkedAnalysis.image_path && (
          <div
            style={{
              border: "1px solid var(--border, #eadde3)",
              borderRadius: "18px",
              overflow: "hidden",
              background: "#fff7fa",
            }}
          >
            <img
              src={buildImageUrl(linkedAnalysis.image_path)}
              alt="AI skin analysis"
              style={{
                display: "block",
                width: "100%",
                maxHeight: "360px",
                objectFit: "cover",
              }}
            />
          </div>
        )}

        <div style={{ display: "grid", gap: "12px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            <div className={styles.historyInfoBox}>
              <span>AI Condition</span>
              <strong>{linkedAnalysis.condition || "—"}</strong>
            </div>

            <div className={styles.historyInfoBox}>
              <span>Confidence</span>
              <strong>
                {confidenceValue !== null
                  ? `${confidenceValue}% confidence`
                  : "Confidence unavailable"}
              </strong>
            </div>

            <div className={styles.historyInfoBox}>
              <span>AI Severity</span>
              <strong>{linkedAnalysis.severity || "—"}</strong>
            </div>

            <div className={styles.historyInfoBox}>
              <span>Generated</span>
              <strong>{formatDateTime(linkedAnalysis.created_at)}</strong>
            </div>
          </div>

          <div className={styles.historyFollowUpBox}>
            <span>Possible Conditions</span>
            <p>{linkedAnalysis.possible_conditions || "—"}</p>
          </div>

          <div className={styles.historyFollowUpBox}>
            <span>Key Findings</span>
            <p>{linkedAnalysis.key_findings || "—"}</p>
          </div>

          <div className={styles.historyFollowUpBox}>
            <span>AI Recommendation</span>
            <p>{linkedAnalysis.recommendation || "No AI recommendation recorded."}</p>
          </div>
        </div>
      </div>

      <div className={styles.historyPrescriptionBox}>
        <h4>AI Prescription Suggestions</h4>

        {prescriptionItems.length === 0 ? (
          <div className={styles.emptyStateSmall}>
            No AI prescription suggestions saved.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "12px",
            }}
          >
            {prescriptionItems.map((item, index) => (
              <div
                key={`${item.medication}-${index}`}
                style={{
                  border: "1px solid var(--border, #eadde3)",
                  borderRadius: "16px",
                  padding: "14px",
                  background: "var(--card, #ffffff)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 12px",
                    color: "var(--accent, #6f2940)",
                    fontSize: "14px",
                    fontWeight: 800,
                    letterSpacing: "0.02em",
                  }}
                >
                  {item.medication}
                </p>

                <div style={{ display: "grid", gap: "10px" }}>
                  <div>
                    <span className={styles.infoLabel}>Usage</span>
                    <p style={{ margin: "4px 0 0", lineHeight: 1.55 }}>
                      {item.usage || "—"}
                    </p>
                  </div>

                  <div>
                    <span className={styles.infoLabel}>Reason</span>
                    <p style={{ margin: "4px 0 0", lineHeight: 1.55 }}>
                      {item.reason || "—"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.historyFollowUpBox}>
        <span>AI Follow-up Suggestions</span>
        <p style={{ whiteSpace: "pre-line" }}>
          {followUpItems.length === 0 ? "—" : followUpItems.join("\n")}
        </p>
      </div>

      <div className={styles.historyFollowUpBox}>
        <span>AI Red Flags</span>
        <p style={{ whiteSpace: "pre-line" }}>
          {redFlagItems.length === 0 ? "—" : redFlagItems.join("\n")}
        </p>
      </div>
    </div>
  );
};

const renderHistoryStage = () => {
  if (loadingPatientHistory || loadingVisitRecords) {
    return (
      <section className={styles.workflowCard}>
        <div className={styles.emptyState}>Loading medical history...</div>
      </section>
    );
  }

  if (sortedPatientVisitHistory.length === 0) {
    return (
      <section className={styles.workflowCard}>
        <div className={styles.emptyState}>
          No completed medical history or AI analysis history yet.
        </div>
      </section>
    );
  }

  return (
    <section className={styles.workflowCard}>
      <div className={styles.cardHeader}>
        <div>
          <p className={styles.eyebrow}>Medical History</p>
          <h2>All Patient Doctor Records</h2>
          <p>
            Doctor diagnosis, prescriptions, notes, and follow-up plans are shown
            first. AI results are kept separate and can be opened when needed.
          </p>
        </div>
      </div>

      <div className={styles.medicalHistoryList}>
        {sortedPatientVisitHistory.map((item) => {
          const linkedAnalysis = item.linkedAnalysis;
          const report = item.report;
          const prescriptionItems = parsePrescriptionEntries(
            report?.doctor_prescription
          );
          const recordKey = `${item.appointment.id}-${
            report?.id || linkedAnalysis?.id || "record"
          }`;
          const appointmentTitle = `${item.appointment.date || "Unknown date"} • ${
            item.appointment.services || "Consultation"
          }`;

          return (
            <article key={recordKey} className={styles.medicalHistoryCard}>
              <div className={styles.medicalHistoryTop}>
                <div>
                  <p className={styles.historyDate}>
                    {item.appointment.date || "Unknown date"}
                  </p>
                  <h3>{item.appointment.services || "Consultation"}</h3>
                  <span>Status: {item.appointment.status || "—"}</span>
                </div>

                <div className={styles.resultBadgeStack}>
                  <span
                    className={`${styles.statusBadge} ${
                      report ? styles.badgeCompleted : styles.badgePending
                    }`}
                  >
                    {report ? "Doctor Report Saved" : "AI Result Only"}
                  </span>

                  {linkedAnalysis && (
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() =>
                        openAiResultModal(appointmentTitle, linkedAnalysis)
                      }
                    >
                      View AI Result
                    </button>
                  )}
                </div>
              </div>

              {report ? (
                <div className={styles.medicalHistoryDetails}>
                  <div className={styles.historyInfoGrid}>
                    <div className={styles.historyInfoBox}>
                      <span>Doctor Final Diagnosis</span>
                      <strong>{report.doctor_final_diagnosis || "—"}</strong>
                    </div>
                  </div>

                  <div className={styles.historyPrescriptionBox}>
                    <h4>Doctor Prescription</h4>

                    {prescriptionItems.length === 0 ? (
                      <div className={styles.emptyStateSmall}>
                        No doctor prescription was saved for this visit.
                      </div>
                    ) : (
                      <div className={styles.medicationStack}>
                        {prescriptionItems.map((item, index) => (
                          <div
                            key={`${item.medication}-${index}`}
                            className={styles.medicationCard}
                          >
                            <strong>{item.medication}</strong>

                            <div className={styles.medicationRow}>
                              <span>Usage</span>
                              <p>{item.usage || "—"}</p>
                            </div>

                            <div className={styles.medicationRow}>
                              <span>Reason</span>
                              <p>{item.reason || "—"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.historyFollowUpBox}>
                    <span>Doctor Notes</span>
                    <p>{getDoctorOnlyNote(report.after_appointment_notes)}</p>
                  </div>

                  <div className={styles.historyFollowUpBox}>
                    <span>Follow-up Plan</span>
                    <p>{report.follow_up_plan || "—"}</p>
                  </div>

                  {report.next_visit_date && (
                    <div className={styles.historyFollowUpBox}>
                      <span>Next Visit Date</span>
                      <p>{report.next_visit_date}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.warningBlock}>
                  <strong>No doctor final report saved yet.</strong>
                  <p>
                    This visit has an AI analysis result, but the doctor has not
                    saved the final diagnosis, prescription, notes, and follow-up
                    plan yet.
                  </p>
                </div>
              )}


            </article>
          );
        })}
      </div>
    </section>
  );
};



  return (
    <>
      <DoctorNavbar />

      <main className={styles.pageShell}>
        <section className={styles.pageHeader}>
          <div>
       
            <h1>AI Skin Analysis</h1>
            <p>
              Run AI scans, complete doctor assessment, review final reports, and
              maintain patient medical history.
            </p>
          </div>
        </section>

        {loading ? (
          <section className={styles.workflowCard}>
            <div className={styles.emptyState}>
              Loading AI analysis workspace...
            </div>
          </section>
        ) : !selectedPatient ? (
          <section className={styles.patientPickerShell}>
            <div className={styles.patientPickerCard}>
              <div className={styles.patientPickerHeader}>
                <div>
                 
                  <h2>Patients</h2>
                  <p>
                    Search and select a patient to open the clinical AI analysis
                    workspace.
                  </p>
                </div>
              </div>

              <div className={styles.searchBox}>
                <label htmlFor="patient_search">Search Patient</label>
                <input
                  id="patient_search"
                  type="text"
                  placeholder="Search by name or email"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className={styles.patientListPicker}>
                {filteredPatients.length === 0 ? (
                  <div className={styles.emptyStateSmall}>
                    No patient matched your search.
                  </div>
                ) : (
                  filteredPatients.map((item) => {
                    const meta = getPatientListMeta(item.patient.id);

                    return (
                      <button
                        key={item.patient.id}
                        type="button"
                        className={styles.patientItem}
                        onClick={() => selectPatient(item.patient.id)}
                      >
                        <div className={styles.patientItemTop}>
                          <div>
                            <strong>
                              {item.patient.name || "Unnamed patient"}
                            </strong>
                            <span>
                              {item.latest_report?.doctor_final_diagnosis ||
                                "No diagnosis yet"}
                            </span>
                          </div>

                          <span className={meta.badgeClass}>{meta.label}</span>
                        </div>

                        <div className={styles.patientItemFooter}>
                          <span>{meta.latestVisitText}</span>
                          <span>
                            {item.total_reports} report
                            {item.total_reports > 1 ? "s" : ""}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.selectedPatientShell}>
            <section className={styles.patientSummaryCard}>
              <div className={styles.patientIdentity}>
                <div className={styles.avatarCircle}>
                  {(selectedPatient.patient.name || "P")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>

                <div>
                  <h2>{selectedPatient.patient.name || "Unnamed patient"}</h2>
                  <p>{selectedPatient.patient.email || "No email available"}</p>
                </div>
              </div>

              <div className={styles.patientHeaderActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={changePatient}
                >
                  Change Patient
                </button>

                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={openPatientRecord}
                >
                  Open Patient Record
                </button>
              </div>

              <div className={styles.summaryMetrics}>
                <div>
                  <span className={styles.infoLabel}>Reports</span>
                  <strong>{selectedPatient.total_reports}</strong>
                </div>

                <div>
                  <span className={styles.infoLabel}>Latest Diagnosis</span>
                  <strong>
                    {selectedPatient.latest_report?.doctor_final_diagnosis ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span className={styles.infoLabel}>Latest Visit</span>
                  <strong>
                    {selectedPatientAllVisits[0]
                      ? `${selectedPatientAllVisits[0].date} • ${selectedPatientAllVisits[0].services}`
                      : "No visit yet"}
                  </strong>
                </div>

                <div>
                  <span className={styles.infoLabel}>Selected Visit</span>
                  <strong>
                    {targetAppointment
                      ? `${targetAppointment.date} • ${targetAppointment.services}`
                      : "No valid visit"}
                  </strong>
                </div>
              </div>

              <div className={styles.visitSelector}>
                <label htmlFor="appointment_selector">Visit to Review</label>
                <select
                  id="appointment_selector"
                  value={selectedAppointmentId ?? ""}
                  onChange={(e) => handleAppointmentChange(e.target.value)}
                  disabled={selectedPatientValidVisits.length === 0}
                >
                  <option value="">Select visit</option>
                  {selectedPatientValidVisits.map((appt) => (
                    <option key={appt.id} value={appt.id}>
                      #{appt.id} • {appt.date} • {appt.services} • {appt.status}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className={styles.stepperCard}>
              <button
                type="button"
                className={`${styles.stepButton} ${
                  activeStage === "scan" ? styles.stepButtonActive : ""
                }`}
                onClick={() => setActiveStage("scan")}
              >
                <span>1</span>
                AI Scan
              </button>

              <button
                type="button"
                className={`${styles.stepButton} ${
                  activeStage === "reports" ? styles.stepButtonActive : ""
                }`}
                onClick={() => setActiveStage("reports")}
              >
                <span>2</span>
                Final Reports
              </button>

              <button
                type="button"
                className={`${styles.stepButton} ${
                  activeStage === "history" ? styles.stepButtonActive : ""
                }`}
                onClick={() => setActiveStage("history")}
              >
                <span>3</span>
                History
              </button>
            </section>

            {isCompletedTarget && (
              <div className={styles.readOnlyBanner}>
                This selected visit is completed. You may review the AI result
                and final doctor report in read-only mode.
              </div>
            )}

            {activeStage === "scan" && renderScanStage()}
            {activeStage === "reports" && renderReportsStage()}
            {activeStage === "history" && renderHistoryStage()}
          </section>
        )}
      </main>

      {selectedAiModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI skin analysis result"
          onClick={closeAiResultModal}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.62)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "18px",
          }}
        >
          <section
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(1040px, 100%)",
              maxHeight: "86vh",
              overflow: "hidden",
              background: "var(--card, #ffffff)",
              color: "var(--text, #111111)",
              borderRadius: "22px",
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.32)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "16px",
                padding: "20px 22px",
                borderBottom: "1px solid var(--border, #eadde3)",
                background: "var(--card, #ffffff)",
              }}
            >
              <div>
                <p className={styles.eyebrow}>Supporting AI Result</p>
                <h2 style={{ margin: "4px 0 6px" }}>{selectedAiModal.title}</h2>
                <p style={{ margin: 0, color: "var(--muted, #6b7280)" }}>
                  This AI result is for reference only. The doctor’s final
                  diagnosis and prescription remain the official clinical record.
                </p>
              </div>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closeAiResultModal}
                style={{ flexShrink: 0 }}
              >
                Close
              </button>
            </div>

            <div
              style={{
                padding: "20px 22px 24px",
                overflowY: "auto",
              }}
            >
              {renderAiResultPanel(
                selectedAiModal.analysis,
                normalizeConfidence(selectedAiModal.analysis.confidence)
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
