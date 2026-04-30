"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DoctorNavbar from "@/app/components/DoctorNavbar";
import styles from "@/app/styles/ai.module.css";
import { API_BASE_URL } from "@/lib/api";
import {
  analyzeAppointmentSkin,
  getAppointmentAnalyses,
  getAppointmentDiagnosisReport,
  getDoctorAppointments,
  createDoctorFollowUp,
  getDoctorPatientHistory,
  getDoctorPatients,
  type Analysis,
  type Appointment,
  type DiagnosisReport,
  type DoctorPatientHistoryResponse,
  type DoctorPatientListItem,
} from "@/lib/doctor-api";

type WorkspaceStage = "scan" | "reports" | "history";

type DoctorPrescriptionDraft = {
  medication: string;
  usage: string;
  reason: string;
};

type DoctorAssessmentForm = {
  finalDiagnosis: string;
  doctorNotes: string;
  prescriptionItems: DoctorPrescriptionDraft[];
  followUpPlan: string;
};

type OptionalFollowUpForm = {
  followUpDate: string;
  reason: string;
  notes: string;
};

type TextAssessmentField = "finalDiagnosis" | "doctorNotes" | "followUpPlan";
type AiSuggestionField = "finalDiagnosis" | "followUpPlan";

type PatientVisitHistoryRecord = {
  appointment: Appointment;
  analyses: Analysis[];
  report: DiagnosisReport | null;
  linked_analysis?: Analysis | null;
};

type CompletedReportHistoryItem =
  DoctorPatientHistoryResponse["history"][number] & {
    report: DiagnosisReport;
  };

type ParsedPrescriptionItem = {
  medication: string;
  usage: string;
  reason: string;
};

const emptyPrescriptionItem: DoctorPrescriptionDraft = {
  medication: "",
  usage: "",
  reason: "",
};

const emptyAssessmentForm: DoctorAssessmentForm = {
  finalDiagnosis: "",
  doctorNotes: "",
  prescriptionItems: [{ ...emptyPrescriptionItem }],
  followUpPlan: "",
};

const emptyOptionalFollowUpForm: OptionalFollowUpForm = {
  followUpDate: "",
  reason: "",
  notes: "",
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
  return (
    Boolean(appointment.patient_id) &&
    !isBlockedAppointmentStatus(appointment.status)
  );
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

const buildImageUrl = (path?: string | null): string | undefined => {
  if (!path) return undefined;

  const cleanPath = path.replace(/\\/g, "/").trim();

  if (!cleanPath) return undefined;

  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
    return cleanPath;
  }

  if (cleanPath.startsWith("/uploads") || cleanPath.startsWith("uploads")) {
    const normalizedBackendPath = cleanPath.startsWith("/")
      ? cleanPath
      : `/${cleanPath}`;

    return `${API_BASE_URL}${normalizedBackendPath}`;
  }

  return undefined;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const getTodayInputDate = () => {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;

  return new Date(today.getTime() - timezoneOffset).toISOString().split("T")[0];
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

const cleanPrescriptionText = (value?: string | null) => {
  return (value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
};

const normalizePrescriptionLine = (value: string) => {
  return value.replace(/^[-•]\s*/, "").replace(/\s+/g, " ").trim();
};

const stripPrescriptionLabel = (value: string, label: string) => {
  const expression = new RegExp(`^${label}:\\s*`, "i");
  return value.replace(expression, "").trim();
};

const splitPrescriptionList = (value: string) => {
  return value
    .split(/\n|;/)
    .map((item) => normalizePrescriptionLine(item))
    .filter(Boolean)
    .map((item) => stripPrescriptionLabel(item, "Medication"));
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
      medication = stripPrescriptionLabel(
        line.slice(0, firstLabelIndex),
        "Medication"
      );

      if (usageIndex >= 0) {
        const usageMatch = line.slice(usageIndex).match(/^Usage:\s*/i);
        const usageStart = usageIndex + (usageMatch ? usageMatch[0].length : 0);
        const usageEnd = reasonIndex > usageIndex ? reasonIndex : line.length;
        usage = line.slice(usageStart, usageEnd).trim();
      }

      if (reasonIndex >= 0) {
        const reasonMatch = line.slice(reasonIndex).match(/^Reason:\s*/i);
        const reasonStart =
          reasonIndex + (reasonMatch ? reasonMatch[0].length : 0);
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
  return payload.prescriptionItems
    .map((item) => {
      const medication = item.medication.trim();
      const usage = item.usage.trim();
      const reason = item.reason.trim();

      if (!medication && !usage && !reason) return "";

      return [
        medication ? `Medication: ${medication}` : "Medication: —",
        usage ? `Usage: ${usage}` : "Usage: —",
        reason ? `Reason: ${reason}` : "Reason: —",
      ].join(" | ");
    })
    .filter(Boolean)
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
  payload: DoctorAssessmentForm,
  nextVisitDate?: string | null
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
        doctor_final_diagnosis: payload.finalDiagnosis.trim(),
        doctor_prescription: buildPrescriptionText(payload),
        after_appointment_notes: payload.doctorNotes.trim(),
        follow_up_plan: payload.followUpPlan.trim(),
        next_visit_date: nextVisitDate || null,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(errorText || "Failed to save doctor clinical assessment.");
  }

  return response.json().catch(() => null);
};

function DoctorAiAnalysisContent() {
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
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [optionalFollowUpForm, setOptionalFollowUpForm] =
    useState<OptionalFollowUpForm>(emptyOptionalFollowUpForm);

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

        const reportPatientList = Array.isArray(patientsData)
          ? patientsData
          : [];
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
            appt.patient_id === nextPatientId && isVisibleAiAppointment(appt)
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

    const patientVisits = (
      patientAppointmentsMap.get(selectedPatientId) || []
    ).filter(isVisibleAiAppointment);

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
    if (!patientHistory?.history) return [];

    return patientHistory.history
      .filter((item): item is CompletedReportHistoryItem => Boolean(item.report))
      .sort((a, b) => {
        const aDate = new Date(
          `${a.appointment?.date || ""}T${
            a.appointment?.time || "00:00:00"
          }`
        ).getTime();

        const bDate = new Date(
          `${b.appointment?.date || ""}T${
            b.appointment?.time || "00:00:00"
          }`
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
  const todayInputDate = getTodayInputDate();

  const resetWorkspaceDrafts = () => {
    setSelectedFile(null);
    setAssessmentForm({
      ...emptyAssessmentForm,
      prescriptionItems: [{ ...emptyPrescriptionItem }],
    });
    setScheduleFollowUp(false);
    setOptionalFollowUpForm(emptyOptionalFollowUpForm);
  };

  const updateAssessmentField = (field: TextAssessmentField, value: string) => {
    setAssessmentForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateOptionalFollowUpField = (
    field: keyof OptionalFollowUpForm,
    value: string
  ) => {
    setOptionalFollowUpForm((prev) => ({
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
        alert(
          aiUnavailableMessage ||
            "AI skin analysis is not available for this visit yet."
        );
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

  const getPrescriptionSuggestionItems = () => {
    if (!latestAnalysis) return [];

    return parsePrescriptionSuggestions(latestAnalysis.prescription_suggestions);
  };

  const applyFullPrescriptionSuggestion = () => {
    const items = getPrescriptionSuggestionItems();

    if (items.length === 0) {
      alert("No AI prescription suggestion is available.");
      return;
    }

    setAssessmentForm((prev) => ({
      ...prev,
      prescriptionItems: items.map((item) => ({
        medication: item.medication || "",
        usage: item.usage || "",
        reason: item.reason || "",
      })),
    }));
  };

  const updatePrescriptionItem = (
    index: number,
    field: keyof DoctorPrescriptionDraft,
    value: string
  ) => {
    setAssessmentForm((prev) => {
      const nextItems = [...prev.prescriptionItems];

      nextItems[index] = {
        ...nextItems[index],
        [field]: value,
      };

      return {
        ...prev,
        prescriptionItems: nextItems,
      };
    });
  };

  const addPrescriptionItem = () => {
    setAssessmentForm((prev) => ({
      ...prev,
      prescriptionItems: [...prev.prescriptionItems, { ...emptyPrescriptionItem }],
    }));
  };

  const removePrescriptionItem = (index: number) => {
    setAssessmentForm((prev) => {
      if (prev.prescriptionItems.length === 1) {
        return {
          ...prev,
          prescriptionItems: [{ ...emptyPrescriptionItem }],
        };
      }

      return {
        ...prev,
        prescriptionItems: prev.prescriptionItems.filter(
          (_, itemIndex) => itemIndex !== index
        ),
      };
    });
  };

  const getAiSuggestionForField = (field: AiSuggestionField) => {
    if (!latestAnalysis) return "";

    switch (field) {
      case "finalDiagnosis":
        return latestAnalysis.condition || latestAnalysis.possible_conditions || "";

      case "followUpPlan":
        return latestAnalysis.follow_up_suggestions || "";

      default:
        return "";
    }
  };

  const applyAiSuggestionForField = (field: AiSuggestionField) => {
    const suggestion = getAiSuggestionForField(field);

    if (!suggestion.trim()) {
      alert("No AI suggestion is available for this field.");
      return;
    }

    updateAssessmentField(field, suggestion);
  };

  const renderUseAiSuggestionButton = (
    field: AiSuggestionField,
    label = "Use AI"
  ) => {
    const suggestion = getAiSuggestionForField(field);

    return (
      <button
        type="button"
        className={styles.aiSuggestionButton}
        onClick={() => applyAiSuggestionForField(field)}
        disabled={!suggestion.trim()}
      >
        {label}
      </button>
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

      const hasPrescription = assessmentForm.prescriptionItems.some(
        (item) =>
          item.medication.trim() || item.usage.trim() || item.reason.trim()
      );

      if (!hasPrescription) {
        alert("Please enter at least one doctor prescription item.");
        return;
      }

      if (scheduleFollowUp && !optionalFollowUpForm.followUpDate) {
        alert("Please select a follow-up date or uncheck Schedule Follow-Up.");
        return;
      }

      if (scheduleFollowUp && optionalFollowUpForm.followUpDate < todayInputDate) {
        alert("Please select today or a future date for the follow-up.");
        return;
      }

      setSavingAssessment(true);

      await saveDoctorAssessment(
        selectedAppointmentId,
        latestAnalysis.id,
        assessmentForm,
        scheduleFollowUp ? optionalFollowUpForm.followUpDate : null
      );

      if (scheduleFollowUp) {
        await createDoctorFollowUp({
          appointment_id: selectedAppointmentId,
          follow_up_date: optionalFollowUpForm.followUpDate,
          reason:
            optionalFollowUpForm.reason.trim() ||
            assessmentForm.followUpPlan.trim() ||
            "Follow-up consultation",
          notes: optionalFollowUpForm.notes.trim(),
        });
      }

      if (selectedPatientId) {
        try {
          const historyData = await getDoctorPatientHistory(selectedPatientId);
          setPatientHistory(historyData);
        } catch {
          setPatientHistory(selectedPatientEmptyHistory);
        }
      }

      setScheduleFollowUp(false);
      setOptionalFollowUpForm(emptyOptionalFollowUpForm);
      setActiveStage("history");
      alert(
        scheduleFollowUp
          ? "Doctor assessment saved successfully and follow-up scheduled."
          : "Doctor assessment saved successfully. The completed record is now available in History."
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
    const latestVisit =
      visits.find((appt) => isVisibleAiAppointment(appt)) || visits[0];

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

    const followUpItems = splitMultilineText(
      latestAnalysis.follow_up_suggestions
    );

    const redFlagItems = splitMultilineText(latestAnalysis.red_flags);

    const latestImageUrl = buildImageUrl(
      latestAnalysis.image_url || latestAnalysis.image_path
    );

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
              Confidence:{" "}
              {confidenceValue !== null ? `${confidenceValue}%` : "—"}
            </span>
          </div>
        </div>

        <div className={styles.aiResultGrid}>
          <div className={styles.imagePanel}>
            {latestImageUrl ? (
              <img
                src={latestImageUrl}
                alt="AI skin analysis result"
                className={styles.analysisImage}
              />
            ) : (
              <div className={styles.imagePlaceholder}>
                No image available. Check if the backend returned image_url.
              </div>
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

    const prescriptionSuggestionItems = getPrescriptionSuggestionItems();

    return (
      <section className={styles.workflowCard}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.eyebrow}>Doctor Assessment</p>
            <h2>Complete Doctor Assessment</h2>
            <p>
              Complete the official doctor record. AI suggestions are shown only
              as reference and must be reviewed before use.
            </p>
          </div>
        </div>

        <div className={styles.aiReferencePanel}>
          <div className={styles.aiReferenceHeader}>
            <div>
              <span>AI Reference Summary</span>
              <p>
                This section is for review only. The saved patient record will
                use the doctor’s final entries below.
              </p>
            </div>
          </div>

          <div className={styles.aiReferenceGrid}>
            <div className={styles.aiReferenceCard}>
              <span>Possible Condition</span>
              <strong>
                {latestAnalysis.condition ||
                  latestAnalysis.possible_conditions ||
                  "—"}
              </strong>
            </div>

            <div className={styles.aiReferenceCard}>
              <span>AI Severity</span>
              <strong>{latestAnalysis.severity || "—"}</strong>
            </div>

            <div className={styles.aiReferenceCardWide}>
              <span>Key Findings</span>
              <p>
                {latestAnalysis.key_findings ||
                  "No AI key findings available."}
              </p>
            </div>

            <div className={styles.aiReferenceCardWide}>
              <span>AI Recommendation</span>
              <p>
                {latestAnalysis.recommendation ||
                  "No AI recommendation available."}
              </p>
            </div>
          </div>
        </div>

        <div className={styles.assessmentForm}>
          <div className={styles.formGroupFull}>
            <div className={styles.fieldHeader}>
              <label htmlFor="finalDiagnosis">Doctor Final Diagnosis</label>
              {renderUseAiSuggestionButton("finalDiagnosis", "Use AI Diagnosis")}
            </div>

            <input
              id="finalDiagnosis"
              value={assessmentForm.finalDiagnosis}
              onChange={(e) =>
                updateAssessmentField("finalDiagnosis", e.target.value)
              }
              placeholder="Example: Acne"
            />
          </div>

          <div className={styles.prescriptionBox}>
            <div className={styles.prescriptionHeader}>
              <div>
                <h3>Doctor Prescription</h3>
                <p>
                  Add the final prescription exactly as it should appear in the
                  patient record.
                </p>
              </div>

              <button
                type="button"
                className={styles.aiSuggestionButton}
                onClick={applyFullPrescriptionSuggestion}
                disabled={prescriptionSuggestionItems.length === 0}
              >
                Use AI Prescription
              </button>
            </div>

            {prescriptionSuggestionItems.length > 0 && (
              <div className={styles.prescriptionSuggestionPanel}>
                <span>AI Prescription Suggestions</span>

                <div className={styles.prescriptionSuggestionGrid}>
                  {prescriptionSuggestionItems.map((item, index) => (
                    <div
                      key={`${item.medication}-${index}`}
                      className={styles.prescriptionSuggestionCard}
                    >
                      <strong>{item.medication}</strong>

                      <div>
                        <span>Usage</span>
                        <p>{item.usage || "—"}</p>
                      </div>

                      <div>
                        <span>Reason</span>
                        <p>{item.reason || "—"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.prescriptionEditorList}>
              {assessmentForm.prescriptionItems.map((item, index) => (
                <div key={index} className={styles.prescriptionEditorCard}>
                  <div className={styles.prescriptionEditorHeader}>
                    <h4>Prescription Item {index + 1}</h4>

                    <button
                      type="button"
                      className={styles.removePrescriptionButton}
                      onClick={() => removePrescriptionItem(index)}
                    >
                      Remove
                    </button>
                  </div>

                  <div className={styles.formGroupFull}>
                    <label htmlFor={`medication-${index}`}>Medication</label>
                    <input
                      id={`medication-${index}`}
                      value={item.medication}
                      onChange={(e) =>
                        updatePrescriptionItem(
                          index,
                          "medication",
                          e.target.value
                        )
                      }
                      placeholder="Example: Adapalene 0.1% gel"
                    />
                  </div>

                  <div className={styles.formGroupFull}>
                    <label htmlFor={`usage-${index}`}>Usage</label>
                    <textarea
                      id={`usage-${index}`}
                      value={item.usage}
                      onChange={(e) =>
                        updatePrescriptionItem(index, "usage", e.target.value)
                      }
                      placeholder="Example: Apply a thin layer once nightly"
                    />
                  </div>

                  <div className={styles.formGroupFull}>
                    <label htmlFor={`reason-${index}`}>Reason</label>
                    <textarea
                      id={`reason-${index}`}
                      value={item.reason}
                      onChange={(e) =>
                        updatePrescriptionItem(index, "reason", e.target.value)
                      }
                      placeholder="Example: Helps unclog pores and prevent new acne lesions"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={addPrescriptionItem}
            >
              Add Another Prescription
            </button>
          </div>

          <div className={styles.formGroupFull}>
            <label htmlFor="doctorNotes">Doctor Notes</label>

            <textarea
              id="doctorNotes"
              value={assessmentForm.doctorNotes}
              onChange={(e) =>
                updateAssessmentField("doctorNotes", e.target.value)
              }
              placeholder="Example: Moderate acne with visible inflammation on affected areas"
            />

            <small className={styles.formHint}>
              Enter the doctor’s own clinical notes. AI findings should only be
              used as reference.
            </small>
          </div>

          <div className={styles.formGroupFull}>
            <div className={styles.fieldHeader}>
              <label htmlFor="followUpPlan">Follow-up Plan</label>
              {renderUseAiSuggestionButton("followUpPlan", "Use AI Follow-up")}
            </div>

            <textarea
              id="followUpPlan"
              value={assessmentForm.followUpPlan}
              onChange={(e) =>
                updateAssessmentField("followUpPlan", e.target.value)
              }
              placeholder="Example: Review in 2 to 4 weeks depending on response"
            />
          </div>

          <div
            className={styles.prescriptionBox}
            style={{
              gap: "18px",
              padding: "20px",
              borderRadius: "18px",
            }}
          >
            <div className={styles.prescriptionHeader}>
              <div>
                <h3>Optional Follow-Up Schedule</h3>
                <p>
                  Enable this only when the patient needs another visit. The
                  selected appointment is linked automatically.
                </p>
              </div>
            </div>

            <label
              htmlFor="scheduleFollowUp"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                width: "100%",
                padding: "14px 16px",
                border: "1px solid rgba(236, 72, 153, 0.35)",
                borderRadius: "14px",
                background: scheduleFollowUp
                  ? "rgba(236, 72, 153, 0.12)"
                  : "rgba(255, 255, 255, 0.03)",
                cursor: "pointer",
              }}
            >
              <div>
                <strong style={{ display: "block", marginBottom: "4px" }}>
                  Schedule a follow-up for this patient
                </strong>
                <span style={{ color: "#aeb6c7", fontSize: "0.9rem" }}>
                  Adds this patient to the Follow-Ups page and doctor dashboard.
                </span>
              </div>

              <input
                id="scheduleFollowUp"
                type="checkbox"
                checked={scheduleFollowUp}
                style={{
                  width: "20px",
                  height: "20px",
                  flex: "0 0 auto",
                  accentColor: "#ec4899",
                  cursor: "pointer",
                }}
                onChange={(e) => {
                  setScheduleFollowUp(e.target.checked);

                  if (!e.target.checked) {
                    setOptionalFollowUpForm(emptyOptionalFollowUpForm);
                  }
                }}
              />
            </label>

            {scheduleFollowUp && (
              <div
                className={styles.prescriptionEditorCard}
                style={{
                  display: "grid",
                  gap: "16px",
                  marginTop: "4px",
                }}
              >
                <div className={styles.formGroupFull}>
                  <label htmlFor="followUpDate">Follow-Up Date</label>
                  <input
                    id="followUpDate"
                    type="date"
                    min={todayInputDate}
                    value={optionalFollowUpForm.followUpDate}
                    onChange={(e) =>
                      updateOptionalFollowUpField("followUpDate", e.target.value)
                    }
                  />
                  <small className={styles.formHint}>
                    Past dates are disabled. Choose today or a future date.
                  </small>
                </div>

                <div className={styles.formGroupFull}>
                  <label htmlFor="followUpReason">Reason</label>
                  <input
                    id="followUpReason"
                    value={optionalFollowUpForm.reason}
                    onChange={(e) =>
                      updateOptionalFollowUpField("reason", e.target.value)
                    }
                    placeholder="Example: Review skin progress after treatment"
                  />
                </div>

                <div className={styles.formGroupFull}>
                  <label htmlFor="followUpNotes">Notes</label>
                  <textarea
                    id="followUpNotes"
                    value={optionalFollowUpForm.notes}
                    onChange={(e) =>
                      updateOptionalFollowUpField("notes", e.target.value)
                    }
                    placeholder="Optional notes for the next consultation"
                  />
                </div>
              </div>
            )}
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleSaveDoctorAssessment}
              disabled={savingAssessment || isCompletedTarget}
            >
              {savingAssessment
                ? "Saving assessment..."
                : "Save Doctor Assessment"}
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
                  The AI analysis and doctor assessment for this consultation
                  have already been saved. Please review the completed record in
                  History.
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
                  Upload the patient image for the selected approved visit. The
                  AI result will appear below after processing.
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
                This AI-generated result stays here until the doctor completes
                the assessment below.
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
      return (
        <div className={styles.emptyState}>Loading completed reports...</div>
      );
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
          {sortedCompletedReports.map((item) => {
            const report = item.report;

            const prescriptionItems = parsePrescriptionEntries(
              report.doctor_prescription
            );

            return (
              <article key={report.id} className={styles.historyCard}>
                <div className={styles.historyHeader}>
                  <div>
                    <strong>
                      {item.appointment?.date || "Unknown date"} •{" "}
                      {item.appointment?.services || "Consultation"}
                    </strong>
                    <span>Doctor: {item.doctor?.name || "Unknown"}</span>
                  </div>

                  <span
                    className={`${styles.statusBadge} ${styles.badgeCompleted}`}
                  >
                    Completed
                  </span>
                </div>

                <div className={styles.historyBody}>
                  <p>
                    <b>Diagnosis:</b> {report.doctor_final_diagnosis || "—"}
                  </p>

                  <div className={styles.historyPrescriptionBox}>
                    <h4>Prescription</h4>

                    {prescriptionItems.length === 0 ? (
                      <div className={styles.emptyStateSmall}>
                        No prescription saved for this report.
                      </div>
                    ) : (
                      <div className={styles.medicationStack}>
                        {prescriptionItems.map((prescription, index) => (
                          <div
                            key={`${prescription.medication}-${index}`}
                            className={styles.medicationCard}
                          >
                            <strong>{prescription.medication}</strong>

                            <div className={styles.medicationRow}>
                              <span>Usage</span>
                              <p>{prescription.usage || "—"}</p>
                            </div>

                            <div className={styles.medicationRow}>
                              <span>Reason</span>
                              <p>{prescription.reason || "—"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <p>
                    <b>Follow-up:</b> {report.follow_up_plan || "—"}
                  </p>
                </div>
              </article>
            );
          })}
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

    if (looksLikeAiGeneratedDoctorNote(text)) {
      return "No separate doctor notes were saved for this visit.";
    }

    return text;
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
            Doctor diagnosis, prescriptions, notes, and follow-up plans are
            shown first. AI results are kept separate and can be opened when
            needed.
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

          const appointmentTitle = `${
            item.appointment.date || "Unknown date"
          } • ${item.appointment.services || "Consultation"}`;

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
                    className={
                      report
                        ? styles.reportSavedBadge
                        : styles.aiResultOnlyBadge
                    }
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
                        {prescriptionItems.map((prescription, index) => (
                          <div
                            key={`${prescription.medication}-${index}`}
                            className={styles.medicationCard}
                          >
                            <strong>{prescription.medication}</strong>

                            <div className={styles.medicationRow}>
                              <span>Usage</span>
                              <p>{prescription.usage || "—"}</p>
                            </div>

                            <div className={styles.medicationRow}>
                              <span>Reason</span>
                              <p>{prescription.reason || "—"}</p>
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

  const followUpItems = splitMultilineText(
    linkedAnalysis.follow_up_suggestions
  );

  const redFlagItems = splitMultilineText(linkedAnalysis.red_flags);

  const modalImageUrl = buildImageUrl(
    linkedAnalysis.image_url || linkedAnalysis.image_path
  );

  return (
    <div className={styles.aiModalContent}>
      <div className={styles.aiModalResultGrid}>
        {modalImageUrl ? (
          <div className={styles.aiModalImagePanel}>
            <img
              src={modalImageUrl}
              alt="AI skin analysis"
              className={styles.aiModalImage}
            />
          </div>
        ) : (
          <div className={styles.aiModalImageUnavailable}>
            Image is unavailable. Check if the backend returned image_url.
          </div>
        )}

        <div className={styles.aiModalSummaryGrid}>
          <div className={styles.aiModalInfoCard}>
            <span>AI Condition</span>
            <strong>{linkedAnalysis.condition || "—"}</strong>
          </div>

          <div className={styles.aiModalInfoCard}>
            <span>Confidence</span>
            <strong>
              {confidenceValue !== null
                ? `${confidenceValue}% confidence`
                : "Confidence unavailable"}
            </strong>
          </div>

          <div className={styles.aiModalInfoCard}>
            <span>AI Severity</span>
            <strong>{linkedAnalysis.severity || "—"}</strong>
          </div>

          <div className={styles.aiModalInfoCard}>
            <span>Generated</span>
            <strong>{formatDateTime(linkedAnalysis.created_at)}</strong>
          </div>

          <div className={styles.aiModalInfoCardWide}>
            <span>Possible Conditions</span>
            <p>{linkedAnalysis.possible_conditions || "—"}</p>
          </div>

          <div className={styles.aiModalInfoCardWide}>
            <span>Key Findings</span>
            <p>{linkedAnalysis.key_findings || "—"}</p>
          </div>

          <div className={styles.aiModalInfoCardWide}>
            <span>AI Recommendation</span>
            <p>
              {linkedAnalysis.recommendation ||
                "No AI recommendation recorded."}
            </p>
          </div>
        </div>
      </div>

      <section className={styles.aiModalSection}>
        <h4>AI Prescription Suggestions</h4>

        {prescriptionItems.length === 0 ? (
          <div className={styles.emptyStateSmall}>
            No AI prescription suggestions saved.
          </div>
        ) : (
          <div className={styles.aiModalPrescriptionGrid}>
            {prescriptionItems.map((item, index) => (
              <div
                key={`${item.medication}-${index}`}
                className={styles.aiModalPrescriptionCard}
              >
                <strong>{item.medication}</strong>

                <div>
                  <span>Usage</span>
                  <p>{item.usage || "—"}</p>
                </div>

                <div>
                  <span>Reason</span>
                  <p>{item.reason || "—"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className={styles.aiModalBottomGrid}>
        <section className={styles.aiModalSection}>
          <h4>AI Follow-up Suggestions</h4>

          {followUpItems.length === 0 ? (
            <p>—</p>
          ) : (
            <div className={styles.aiModalSoftList}>
              {followUpItems.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className={styles.aiModalSoftListItem}
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={`${styles.aiModalSection} ${styles.aiModalWarning}`}>
          <h4>AI Red Flags</h4>

          {redFlagItems.length === 0 ? (
            <p>—</p>
          ) : (
            <div className={styles.aiModalWarningList}>
              {redFlagItems.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className={styles.aiModalWarningItem}
                >
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
                      {appt.date} • {appt.time || "No time"} • {appt.services} • {appt.status}
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
    className={styles.aiModalOverlay}
  >
    <section
      onClick={(event) => event.stopPropagation()}
      className={styles.aiModalShell}
    >
      <div className={styles.aiModalHeader}>
        <div>
          <p className={styles.eyebrow}>Supporting AI Result</p>
          <h2>{selectedAiModal.title}</h2>
          <p>
            This AI result is for reference only. The doctor’s final diagnosis
            and prescription remain the official clinical record.
          </p>
        </div>

        <button
          type="button"
          className={styles.aiModalCloseButton}
          onClick={closeAiResultModal}
        >
          Close
        </button>
      </div>

      <div className={styles.aiModalBody}>
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

export default function DoctorAiAnalysisPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#fff7fa",
            color: "#82334c",
            fontWeight: 700,
          }}
        >
          Loading AI analysis...
        </main>
      }
    >
      <DoctorAiAnalysisContent />
    </Suspense>
  );
}