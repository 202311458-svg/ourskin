import { markBrowserSession } from "@/app/utils/auth";

export type AuthSession = {
  access_token?: string;
  role: string;
};

export function getRoleHome(role: string) {
  if (role === "admin") return "/pages/admin/dashboard";
  if (role === "staff") return "/pages/staff/dashboard";
  if (role === "doctor") return "/pages/doctor/dashboard";
  return "/pages/patient/home";
}

export async function persistAuthSession(session: AuthSession) {
  // Password and Google auth endpoints now establish the HttpOnly cookie on the
  // server response itself. Browser JavaScript never exchanges or persists a
  // bearer token; only non-secret compatibility metadata remains client-side.
  markBrowserSession(session.role);
}
