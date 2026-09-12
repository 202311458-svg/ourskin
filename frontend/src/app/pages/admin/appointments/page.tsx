"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PaginationControls from "@/app/components/PaginationControls";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import AdminToolbar from "@/app/components/portal/admin/AdminToolbar";
import EmptyState from "@/app/components/portal/ui/EmptyState";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import StatCard from "@/app/components/portal/ui/StatCard";
import { useAutoRefresh } from "@/app/hooks/useAutoRefresh";
import { useDebouncedValue } from "@/app/hooks/useDebouncedValue";
import type { AdminAppointment, AppointmentStatus } from "@/lib/admin-api";
import { updateAppointmentStatus as saveAppointmentStatus } from "@/lib/admin-api";
import {
  queryAdminAppointments,
  type AdminAppointmentSummary,
} from "@/lib/admin-data-api";
import AppointmentApprovalDialog from "./components/AppointmentApprovalDialog";
import AppointmentCard from "./components/AppointmentCard";
import AppointmentDetailsDialog from "./components/AppointmentDetailsDialog";
import AppointmentReasonDialog from "./components/AppointmentReasonDialog";
import InitialEvaluationAssignmentDialog from "./components/InitialEvaluationAssignmentDialog";
import {
  needsInitialEvaluationSchedule,
  type ModalAction,
} from "./appointment-utils";
import styles from "./page.module.css";

type FeedbackTone = "success" | "warning" | "danger" | "info";
type Feedback = { tone: FeedbackTone; message: string } | null;

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [summary, setSummary] = useState<AdminAppointmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 300);

  const [detailsAppointment, setDetailsAppointment] = useState<AdminAppointment | null>(null);
  const [approvalAppointment, setApprovalAppointment] = useState<AdminAppointment | null>(null);
  const [assignmentAppointment, setAssignmentAppointment] = useState<AdminAppointment | null>(null);
  const [reasonAppointment, setReasonAppointment] = useState<AdminAppointment | null>(null);
  const [reasonAction, setReasonAction] = useState<ModalAction | null>(null);

  const loadAppointments = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError("");

      const data = await queryAdminAppointments({
        page,
        pageSize,
        search: debouncedSearch,
        status: statusFilter,
      });

      setAppointments(uniqueAppointmentsById(data.items));
      setSummary(data.summary);
      setTotal(data.total);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, "Unable to load appointments."));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [debouncedSearch, page, pageSize, statusFilter]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const anyDialogOpen = Boolean(
    detailsAppointment ||
      approvalAppointment ||
      assignmentAppointment ||
      reasonAppointment
  );

  useAutoRefresh(() => loadAppointments(false), {
    enabled: true,
    intervalMs: 15000,
    pause: actionLoading !== null || anyDialogOpen,
  });

  const updateAppointmentInState = (updated: AdminAppointment) => {
    setAppointments((current) =>
      uniqueAppointmentsById(
        current.map((appointment) =>
          appointment.id === updated.id ? updated : appointment
        )
      )
    );
  };

  const openApproval = (appointment: AdminAppointment) => {
    setOperationError("");
    setFeedback(null);
    if (needsInitialEvaluationSchedule(appointment)) {
      setAssignmentAppointment(appointment);
      return;
    }
    setApprovalAppointment(appointment);
  };

  const openReasonAction = (appointment: AdminAppointment, action: ModalAction) => {
    setOperationError("");
    setFeedback(null);
    setReasonAppointment(appointment);
    setReasonAction(action);
  };

  const closeReasonDialog = () => {
    if (actionLoading !== null) return;
    setReasonAppointment(null);
    setReasonAction(null);
    setOperationError("");
  };

  const closeApprovalDialog = () => {
    if (actionLoading !== null) return;
    setApprovalAppointment(null);
    setOperationError("");
  };

  const saveStatus = async (
    appointment: AdminAppointment,
    status: AppointmentStatus,
    options?: {
      cancelReason?: string;
      patientInstruction?: string;
      sendEmail?: boolean;
      source?: "dialog" | "direct";
    }
  ) => {
    const source = options?.source || "dialog";
    try {
      setActionLoading(appointment.id);
      setOperationError("");
      if (source === "direct") setFeedback(null);

      const data = await saveAppointmentStatus(appointment.id, {
        status,
        cancel_reason: options?.cancelReason || null,
        patient_instruction: options?.patientInstruction || null,
        send_email: options?.sendEmail || false,
      });

      if (data.appointment) updateAppointmentInState(data.appointment);

      if (data.email_warning) {
        setFeedback({
          tone: "warning",
          message: `Appointment updated, but the email notification was not sent: ${data.email_warning}`,
        });
      } else {
        setFeedback({ tone: "success", message: successMessage(status) });
      }

      setApprovalAppointment(null);
      setReasonAppointment(null);
      setReasonAction(null);
      setOperationError("");
      await loadAppointments(false);
    } catch (updateError: unknown) {
      const message = getErrorMessage(
        updateError,
        "Unable to update this appointment."
      );
      if (source === "dialog") {
        setOperationError(message);
      } else {
        setFeedback({ tone: "danger", message });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const confirmApproval = async (instruction: string, sendEmail: boolean) => {
    if (!approvalAppointment) return;
    await saveStatus(approvalAppointment, "Approved", {
      patientInstruction: instruction,
      sendEmail,
      source: "dialog",
    });
  };

  const confirmReasonAction = async (reason: string) => {
    if (!reasonAppointment || !reasonAction) return;

    const status: AppointmentStatus =
      reasonAction === "decline"
        ? "Declined"
        : reasonAction === "no-show"
        ? "No-Show"
        : "Cancelled";

    await saveStatus(reasonAppointment, status, {
      cancelReason: reason,
      source: "dialog",
    });
  };

  const completeAppointment = async (appointment: AdminAppointment) => {
    await saveStatus(appointment, "Completed", { source: "direct" });
  };

  const handleAssigned = (updated: AdminAppointment) => {
    updateAppointmentInState(updated);
    setAssignmentAppointment(null);
    setApprovalAppointment(updated);
    setOperationError("");
    setFeedback({
      tone: "info",
      message: "Schedule assigned. Review the patient instructions to finish approval.",
    });
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin operations"
        title="Appointments"
        description="Manage requests, initial evaluations, approvals, attendance outcomes, and appointment history. Follow-up care is handled in its dedicated workspace."
        primaryAction={
          <Link href="/pages/admin/follow-ups" className={styles.followUpLink}>
            Open follow-ups
          </Link>
        }
      />

      <AdminStatsGrid compact>
        <StatCard
          label="Total appointments"
          value={summary?.total ?? "—"}
          hint="All appointment records"
        />
        <StatCard
          label="Pending"
          value={summary?.pending ?? "—"}
          hint="Requests needing a decision"
          tone="warning"
        />
        <StatCard
          label="Initial evaluations"
          value={summary?.initial_evaluation ?? "—"}
          hint="Pending requests needing assignment"
          tone="info"
        />
        <StatCard
          label="Approved"
          value={summary?.approved ?? "—"}
          hint="Active approved appointments"
          tone="success"
        />
      </AdminStatsGrid>

      {feedback ? (
        <div
          className={`${styles.feedback} ${styles[`feedback${capitalize(feedback.tone)}`]}`}
          role={feedback.tone === "danger" ? "alert" : "status"}
          aria-live="polite"
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss message">
            ×
          </button>
        </div>
      ) : null}

      <AdminToolbar
        meta={`${total} matching appointment${total === 1 ? "" : "s"}`}
        ariaLabel="Appointment filters"
      >
        <input
          type="search"
          aria-label="Search appointments"
          placeholder="Search patient, contact, guardian, doctor, service, status, or appointment ID"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          aria-label="Filter appointments by status"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="completed">Completed</option>
          <option value="declined">Declined</option>
          <option value="cancelled">Cancelled</option>
          <option value="no-show">No-show</option>
        </select>
      </AdminToolbar>

      {loading ? (
        <EmptyState title="Loading appointments…" description="Retrieving the current appointment queue." />
      ) : error ? (
        <div className={styles.pageError} role="alert">
          <span>{error}</span>
          <AdminActionButton onClick={() => void loadAppointments()}>Retry</AdminActionButton>
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState
          title="No appointments match this view."
          description="Change the search or status filter to broaden the results."
        />
      ) : (
        <div className={styles.appointmentsList}>
          {appointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              busy={actionLoading === appointment.id}
              onView={setDetailsAppointment}
              onApprove={openApproval}
              onComplete={completeAppointment}
              onReasonAction={openReasonAction}
            />
          ))}
        </div>
      )}

      <PaginationControls
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      <AppointmentDetailsDialog
        appointment={detailsAppointment}
        onClose={() => setDetailsAppointment(null)}
      />

      <InitialEvaluationAssignmentDialog
        appointment={assignmentAppointment}
        onClose={() => setAssignmentAppointment(null)}
        onAssigned={handleAssigned}
      />

      <AppointmentApprovalDialog
        appointment={approvalAppointment}
        busy={Boolean(approvalAppointment && actionLoading === approvalAppointment.id)}
        error={operationError}
        onClose={closeApprovalDialog}
        onConfirm={confirmApproval}
      />

      <AppointmentReasonDialog
        appointment={reasonAppointment}
        action={reasonAction}
        busy={Boolean(reasonAppointment && actionLoading === reasonAppointment.id)}
        error={operationError}
        onClose={closeReasonDialog}
        onConfirm={confirmReasonAction}
       />
    </PageShell>
  );
}

function uniqueAppointmentsById(appointments: AdminAppointment[]) {
  return Array.from(
    new Map(appointments.map((appointment) => [appointment.id, appointment])).values()
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function successMessage(status: AppointmentStatus) {
  if (status === "Approved") return "Appointment approved and patient instructions saved.";
  if (status === "Completed") return "Appointment marked as completed.";
  if (status === "Declined") return "Appointment request declined and the reason was recorded.";
  if (status === "Cancelled") return "Appointment cancelled and the reason was recorded.";
  if (status === "No-Show") return "Appointment marked as no-show and the reason was recorded.";
  return "Appointment updated successfully.";
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
