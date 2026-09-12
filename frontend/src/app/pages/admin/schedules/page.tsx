"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PaginationControls from "@/app/components/PaginationControls";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDataTable from "@/app/components/portal/admin/AdminDataTable";
import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import AdminToolbar from "@/app/components/portal/admin/AdminToolbar";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import Section from "@/app/components/portal/ui/Section";
import StatCard from "@/app/components/portal/ui/StatCard";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import { useDebouncedValue } from "@/app/hooks/useDebouncedValue";
import {
  type AdminDoctor,
  type AdminService,
  type ClinicUnavailableDate,
  type ClinicUnavailableDatePayload,
  type DoctorSchedulePayload,
  createAdminClinicUnavailableDate,
  createAdminDoctorSchedule,
  deleteAdminClinicUnavailableDate,
  deleteAdminDoctorSchedule,
  getAdminClinicUnavailableDates,
  getAdminDoctors,
  getAdminServices,
  updateAdminClinicUnavailableDate,
  updateAdminDoctorSchedule,
} from "@/lib/admin-api";
import {
  queryAdminSchedules,
  type AdminScheduleRecord,
  type AdminScheduleScope,
  type AdminScheduleSummary,
} from "@/lib/admin-schedules-api";
import ClinicClosureDialog from "./components/ClinicClosureDialog";
import ScheduleDeleteDialog, { type DeleteTarget } from "./components/ScheduleDeleteDialog";
import ScheduleEditorDialog from "./components/ScheduleEditorDialog";
import {
  CLINIC_END_TIME,
  CLINIC_START_TIME,
  SCHEDULE_INTERVAL_MINUTES,
  formatDate,
  formatTime,
  getScheduleStatus,
  isPastDate,
  isPastSchedule,
} from "./schedule-utils";
import styles from "./page.module.css";

const EMPTY_SUMMARY: AdminScheduleSummary = {
  total: 0,
  upcoming_available: 0,
  unavailable: 0,
  past: 0,
  closures: 0,
};

type Feedback = { tone: "success" | "warning"; message: string } | null;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminSchedulesPage() {
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [closures, setClosures] = useState<ClinicUnavailableDate[]>([]);
  const [schedules, setSchedules] = useState<AdminScheduleRecord[]>([]);
  const [summary, setSummary] = useState<AdminScheduleSummary>(EMPTY_SUMMARY);

  const [referenceLoading, setReferenceLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [referenceError, setReferenceError] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [search, setSearch] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [scope, setScope] = useState<AdminScheduleScope>("upcoming");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 300);

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<AdminScheduleRecord | null>(null);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);
  const [selectedClosure, setSelectedClosure] = useState<ClinicUnavailableDate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const loadReferenceData = useCallback(async () => {
    try {
      setReferenceLoading(true);
      setReferenceError("");
      const [doctorData, serviceData, closureData] = await Promise.all([
        getAdminDoctors(),
        getAdminServices(),
        getAdminClinicUnavailableDates(),
      ]);
      setDoctors(Array.isArray(doctorData) ? doctorData : []);
      setServices(Array.isArray(serviceData) ? serviceData : []);
      setClosures(Array.isArray(closureData) ? closureData : []);
    } catch (error) {
      setReferenceError(getErrorMessage(error, "Unable to load schedule reference data."));
    } finally {
      setReferenceLoading(false);
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    try {
      setScheduleLoading(true);
      setScheduleError("");
      const data = await queryAdminSchedules({
        page,
        pageSize,
        search: debouncedSearch,
        doctorId: doctorFilter === "all" ? null : Number(doctorFilter),
        scheduleDate: dateFilter,
        scope,
      });

      if (page > data.total_pages && data.total_pages > 0) {
        setPage(data.total_pages);
        return;
      }

      setSchedules(data.items);
      setSummary(data.summary);
      setTotal(data.total);
    } catch (error) {
      setScheduleError(getErrorMessage(error, "Unable to load doctor schedules."));
    } finally {
      setScheduleLoading(false);
    }
  }, [dateFilter, debouncedSearch, doctorFilter, page, pageSize, scope]);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const orderedClosures = useMemo(() => {
    return [...closures].sort((a, b) => {
      const aPast = isPastDate(a.closure_date);
      const bPast = isPastDate(b.closure_date);
      if (aPast !== bPast) return aPast ? 1 : -1;
      return aPast
        ? b.closure_date.localeCompare(a.closure_date)
        : a.closure_date.localeCompare(b.closure_date);
    });
  }, [closures]);

  function resetOperationState() {
    setOperationError("");
    setFeedback(null);
  }

  function openCreateSchedule() {
    resetOperationState();
    setSelectedSchedule(null);
    setScheduleDialogOpen(true);
  }

  function openEditSchedule(schedule: AdminScheduleRecord) {
    resetOperationState();
    setSelectedSchedule(schedule);
    setScheduleDialogOpen(true);
  }

  function openCreateClosure() {
    resetOperationState();
    setSelectedClosure(null);
    setClosureDialogOpen(true);
  }

  function openEditClosure(closure: ClinicUnavailableDate) {
    resetOperationState();
    setSelectedClosure(closure);
    setClosureDialogOpen(true);
  }

  async function saveSchedule(scheduleId: number | null, payload: DoctorSchedulePayload) {
    try {
      setBusy(true);
      setOperationError("");
      if (scheduleId) {
        await updateAdminDoctorSchedule(scheduleId, payload);
        setFeedback({ tone: "success", message: "Doctor schedule updated." });
      } else {
        await createAdminDoctorSchedule(payload);
        setFeedback({ tone: "success", message: "Doctor schedule created." });
      }
      setScheduleDialogOpen(false);
      setSelectedSchedule(null);
      await loadSchedules();
    } catch (error) {
      setOperationError(getErrorMessage(error, "Unable to save doctor schedule."));
    } finally {
      setBusy(false);
    }
  }

  async function saveClosure(closureId: number | null, payload: ClinicUnavailableDatePayload) {
    try {
      setBusy(true);
      setOperationError("");
      if (closureId) {
        await updateAdminClinicUnavailableDate(closureId, payload);
        setFeedback({ tone: "success", message: "Clinic unavailable date updated." });
      } else {
        await createAdminClinicUnavailableDate(payload);
        setFeedback({ tone: "success", message: "Clinic unavailable date created." });
      }
      setClosureDialogOpen(false);
      setSelectedClosure(null);
      await Promise.all([loadReferenceData(), loadSchedules()]);
    } catch (error) {
      setOperationError(getErrorMessage(error, "Unable to save clinic unavailable date."));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete(target: DeleteTarget) {
    try {
      setBusy(true);
      setOperationError("");
      if (target.kind === "schedule") {
        await deleteAdminDoctorSchedule(target.item.id);
        setFeedback({ tone: "success", message: "Doctor schedule deleted." });
        await loadSchedules();
      } else {
        await deleteAdminClinicUnavailableDate(target.item.id);
        setFeedback({ tone: "success", message: "Clinic unavailable date removed." });
        await Promise.all([loadReferenceData(), loadSchedules()]);
      }
      setDeleteTarget(null);
    } catch (error) {
      setOperationError(getErrorMessage(error, "Unable to delete the selected record."));
    } finally {
      setBusy(false);
    }
  }

  const referenceReady = !referenceLoading && !referenceError;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin availability"
        title="Schedules"
        description="Manage doctor availability, service coverage, consultation modes, and clinic-wide unavailable dates without losing appointment history."
        secondaryAction={
          <AdminActionButton onClick={openCreateClosure} disabled={!referenceReady}>
            + Unavailable date
          </AdminActionButton>
        }
        primaryAction={
          <AdminActionButton tone="primary" onClick={openCreateSchedule} disabled={!referenceReady}>
            + New schedule
          </AdminActionButton>
        }
      />

      {feedback ? (
        <div className={`${styles.feedback} ${styles[feedback.tone]}`} role="status">
          {feedback.message}
        </div>
      ) : null}

      {referenceError ? (
        <div className={styles.pageError} role="alert">
          <span>{referenceError}</span>
          <AdminActionButton onClick={() => void loadReferenceData()}>Retry</AdminActionButton>
        </div>
      ) : null}

      <AdminStatsGrid>
        <StatCard label="Total schedules" value={summary.total} hint="All retained schedule records" />
        <StatCard label="Upcoming available" value={summary.upcoming_available} hint="Available schedules that have not started" tone="success" />
        <StatCard label="Unavailable" value={summary.unavailable} hint="Doctor schedules not accepting bookings" tone="warning" />
        <StatCard label="Clinic closures" value={closures.length || summary.closures} hint="Clinic-wide unavailable dates" tone="info" />
      </AdminStatsGrid>

      <Section title="Scheduling policy" description="The Admin workflow follows the same clinic rules enforced by booking and Staff scheduling.">
        <div className={styles.policyGrid}>
          <Policy label="Clinic hours" value={`${formatTime(CLINIC_START_TIME)} – ${formatTime(CLINIC_END_TIME)}`} />
          <Policy label="Time interval" value={`${SCHEDULE_INTERVAL_MINUTES} minutes`} />
          <Policy label="Weekly closure" value="Sundays" />
          <Policy label="Daily assignment" value="One doctor schedule per date" />
        </div>
      </Section>

      <AdminToolbar meta={`${total} matching schedule${total === 1 ? "" : "s"}`}>
        <input
          type="search"
          aria-label="Search doctor schedules"
          placeholder="Search doctor, service, mode, note, or unavailable reason"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Filter schedules by doctor"
          value={doctorFilter}
          onChange={(event) => {
            setDoctorFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All doctors</option>
          {doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
          ))}
        </select>
        <select
          aria-label="Filter schedules by status"
          value={scope}
          onChange={(event) => {
            setScope(event.target.value as AdminScheduleScope);
            setPage(1);
          }}
        >
          <option value="upcoming">Upcoming available</option>
          <option value="unavailable">Unavailable</option>
          <option value="past">Past history</option>
          <option value="all">All schedules</option>
        </select>
        <input
          type="date"
          aria-label="Filter schedules by exact date"
          value={dateFilter}
          onChange={(event) => {
            setDateFilter(event.target.value);
            setPage(1);
          }}
        />
        {dateFilter ? (
          <AdminActionButton tone="ghost" onClick={() => setDateFilter("")}>Clear date</AdminActionButton>
        ) : null}
      </AdminToolbar>

      <AdminDataTable
        title="Doctor schedules"
        description="Booking-critical fields are protected after an appointment links to a schedule. Past schedules are retained as history."
        loading={scheduleLoading}
        loadingText="Loading doctor schedules…"
        error={scheduleError}
        empty={!scheduleLoading && !scheduleError && schedules.length === 0}
        emptyTitle="No schedules match this view."
        emptyDescription="Change the filters or create a new doctor schedule."
      >
        <table>
          <thead>
            <tr>
              <th>Date & time</th>
              <th>Doctor</th>
              <th>Services</th>
              <th>Mode</th>
              <th>Bookings</th>
              <th>Status</th>
              <th>Created by</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule) => {
              const status = getScheduleStatus(schedule);
              const past = isPastSchedule(schedule.schedule_date, schedule.start_time);
              const linked = schedule.linked_appointments > 0;
              return (
                <tr key={schedule.id}>
                  <td>
                    <span className={styles.tableStack}>
                      <strong>{formatDate(schedule.schedule_date)}</strong>
                      <small>{formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}</small>
                    </span>
                  </td>
                  <td>
                    <span className={styles.tableStack}>
                      <strong>{schedule.doctor_name}</strong>
                      {schedule.schedule_note ? <small>{schedule.schedule_note}</small> : null}
                    </span>
                  </td>
                  <td><span className={styles.serviceText}>{schedule.services}</span></td>
                  <td>{schedule.consultation_mode}</td>
                  <td>
                    <StatusBadge tone={linked ? "info" : "neutral"}>
                      {schedule.linked_appointments} linked
                    </StatusBadge>
                  </td>
                  <td>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    {!schedule.is_available && schedule.unavailable_reason ? (
                      <span className={styles.statusReason}>{schedule.unavailable_reason}</span>
                    ) : null}
                  </td>
                  <td>{schedule.created_by_staff_name || "N/A"}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <AdminActionButton
                        onClick={() => openEditSchedule(schedule)}
                        disabled={past || busy}
                        title={past ? "Past schedules are locked" : linked ? "Booking-critical fields will be locked" : undefined}
                      >
                        {past ? "Locked" : "Edit"}
                      </AdminActionButton>
                      <AdminActionButton
                        tone="danger"
                        onClick={() => {
                          resetOperationState();
                          setDeleteTarget({ kind: "schedule", item: schedule });
                        }}
                        disabled={past || linked || busy}
                        title={past ? "Past schedules are retained" : linked ? "Linked schedules cannot be deleted" : undefined}
                      >
                        Delete
                      </AdminActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminDataTable>

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

      <AdminDataTable
        title="Clinic unavailable dates"
        description="Clinic-wide closures prevent new doctor schedules on the selected date. Past closure records remain visible for operational history."
        loading={referenceLoading}
        loadingText="Loading clinic unavailable dates…"
        error={referenceError}
        empty={!referenceLoading && !referenceError && orderedClosures.length === 0}
        emptyTitle="No clinic unavailable dates."
        emptyDescription="Use Unavailable date when the whole clinic should not accept schedules."
      >
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Reason</th>
              <th>Note</th>
              <th>Status</th>
              <th>Created by</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orderedClosures.map((closure) => {
              const past = isPastDate(closure.closure_date);
              return (
                <tr key={closure.id}>
                  <td><strong>{formatDate(closure.closure_date)}</strong></td>
                  <td>{closure.reason}</td>
                  <td>{closure.note || "N/A"}</td>
                  <td><StatusBadge tone={past ? "neutral" : "warning"}>{past ? "Past" : "Upcoming"}</StatusBadge></td>
                  <td>{closure.created_by_staff_name || "N/A"}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <AdminActionButton
                        onClick={() => openEditClosure(closure)}
                        disabled={past || busy}
                      >
                        {past ? "Locked" : "Edit"}
                      </AdminActionButton>
                      <AdminActionButton
                        tone="danger"
                        onClick={() => {
                          resetOperationState();
                          setDeleteTarget({ kind: "closure", item: closure });
                        }}
                        disabled={past || busy}
                        title={past ? "Past closures are retained" : undefined}
                      >
                        Delete
                      </AdminActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminDataTable>

      <ScheduleEditorDialog
        open={scheduleDialogOpen}
        schedule={selectedSchedule}
        doctors={doctors}
        services={services}
        busy={busy}
        error={operationError}
        onClose={() => {
          if (!busy) {
            setScheduleDialogOpen(false);
            setSelectedSchedule(null);
            setOperationError("");
          }
        }}
        onSave={saveSchedule}
      />

      <ClinicClosureDialog
        open={closureDialogOpen}
        closure={selectedClosure}
        busy={busy}
        error={operationError}
        onClose={() => {
          if (!busy) {
            setClosureDialogOpen(false);
            setSelectedClosure(null);
            setOperationError("");
          }
        }}
        onSave={saveClosure}
      />

      <ScheduleDeleteDialog
        target={deleteTarget}
        busy={busy}
        error={operationError}
        onClose={() => {
          if (!busy) {
            setDeleteTarget(null);
            setOperationError("");
          }
        }}
        onConfirm={confirmDelete}
      />
    </PageShell>
  );
}

function Policy({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.policyItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
