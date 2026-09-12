import { apiFetch } from "@/lib/api";
import type { DoctorSchedule } from "@/lib/admin-api";

export type AdminScheduleScope = "all" | "upcoming" | "unavailable" | "past";

export type AdminScheduleRecord = DoctorSchedule & {
  linked_appointments: number;
};

export type AdminScheduleSummary = {
  total: number;
  upcoming_available: number;
  unavailable: number;
  past: number;
  closures: number;
};

export type AdminScheduleQueryResponse = {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  summary: AdminScheduleSummary;
  items: AdminScheduleRecord[];
};

type QueryParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  doctorId?: number | null;
  scheduleDate?: string;
  scope?: AdminScheduleScope;
};

function assertResponse(value: unknown): AdminScheduleQueryResponse {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid schedule response.");
  }

  const response = value as AdminScheduleQueryResponse;
  if (
    !Array.isArray(response.items) ||
    typeof response.total !== "number" ||
    typeof response.page !== "number" ||
    typeof response.page_size !== "number" ||
    typeof response.total_pages !== "number" ||
    !response.summary ||
    typeof response.summary.total !== "number"
  ) {
    throw new Error("Invalid schedule response.");
  }

  return response;
}

export async function queryAdminSchedules(params: QueryParams = {}) {
  const search = new URLSearchParams({
    page: String(params.page ?? 1),
    page_size: String(params.pageSize ?? 25),
    scope: params.scope ?? "upcoming",
  });

  const keyword = params.search?.trim();
  if (keyword) search.set("search", keyword);
  if (params.doctorId) search.set("doctor_id", String(params.doctorId));
  if (params.scheduleDate) search.set("schedule_date", params.scheduleDate);

  const data = await apiFetch<unknown>(`/admin/schedules/query?${search.toString()}`);
  return assertResponse(data);
}
